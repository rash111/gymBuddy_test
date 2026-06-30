// API shim that translates the old axios-style calls used by pages
// (api.get/post/...) to Supabase queries and edge functions.
// This keeps all UI pages unchanged.

import { supabase } from "./supabase";

const requireUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw { response: { data: { detail: "Not authenticated" } } };
    return user;
};

const dayWeekday = () => (new Date().getDay() + 6) % 7; // Monday=0..Sunday=6

const handlers = {
    // ---- DASHBOARD ----
    async getDashboard() {
        const user = await requireUser();
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
        const { data: plan } = await supabase.from("workout_plans").select("*").eq("user_id", user.id).eq("active", true).maybeSingle();
        const today = plan?.days?.[dayWeekday() % (plan?.days?.length || 1)] || null;
        const today_str = new Date().toISOString().slice(0, 10);
        const { data: meals } = await supabase.from("meal_logs").select("*").eq("user_id", user.id).gte("date", today_str);
        const cal = (meals || []).reduce((a, m) => a + (Number(m.calories) || 0), 0);
        return {
            user: { ...profile, email: user.email, name: profile?.name || user.email },
            today_workout: today, calories_today: cal, meals_today: meals || [], streak: profile?.streak || 0,
        };
    },
    // ---- PROFILE / ONBOARDING ----
    async getProfile() {
        const user = await requireUser();
        const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
        return { ...data, email: user.email, profile: data?.fitness_profile || null };
    },
    async submitOnboarding(body) {
        const user = await requireUser();
        await supabase.from("profiles").update({ fitness_profile: body, onboarded: true }).eq("id", user.id);
        const { data: plan } = await supabase.functions.invoke("generate-workout-plan", { body: { profile: body } });
        const { data: diet } = await supabase.functions.invoke("generate-diet-plan", { body: { profile: body } });
        return { profile: body, workout_plan: plan, diet_plan: diet };
    },
    // ---- WORKOUT PLAN ----
    async getWorkoutPlan() {
        const user = await requireUser();
        const { data, error } = await supabase.from("workout_plans").select("*").eq("user_id", user.id).eq("active", true).maybeSingle();
        if (!data) throw { response: { status: 404, data: { detail: "No active plan" } } };
        return data;
    },
    async regenWorkoutPlan() {
        const { data: profile } = await this.getProfile();
        const { data } = await supabase.functions.invoke("generate-workout-plan", { body: { profile: profile.profile } });
        return data;
    },
    // ---- EXERCISES ----
    async getExercises() {
        const { data } = await supabase.from("exercises").select("*").order("name");
        return data || [];
    },
    async getExercise(id) {
        const { data } = await supabase.from("exercises").select("*").eq("id", id).maybeSingle();
        if (!data) throw { response: { status: 404 } };
        return data;
    },
    // ---- WORKOUT SESSIONS ----
    async logSession(body) {
        const user = await requireUser();
        const session = { user_id: user.id, ...body, date: new Date().toISOString() };
        const { data } = await supabase.from("workout_sessions").insert(session).select().single();
        // streak
        const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        const today = new Date().toISOString().slice(0, 10);
        let streak = prof?.streak || 0;
        if (prof?.last_workout_date) {
            const diff = (new Date(today) - new Date(prof.last_workout_date)) / 86400000;
            streak = diff === 1 ? streak + 1 : diff === 0 ? streak : 1;
        } else streak = 1;
        await supabase.from("profiles").update({ streak, last_workout_date: today }).eq("id", user.id);
        return { session: data, streak };
    },
    async getSessions() {
        const user = await requireUser();
        const { data } = await supabase.from("workout_sessions").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(50);
        return data || [];
    },
    // ---- PROGRESS ----
    async logWeight(body) {
        const user = await requireUser();
        const { data } = await supabase.from("weight_entries").insert({ user_id: user.id, ...body, date: new Date().toISOString() }).select().single();
        return data;
    },
    async getWeights() {
        const user = await requireUser();
        const { data } = await supabase.from("weight_entries").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(200);
        return data || [];
    },
    async logMeasurement(body) {
        const user = await requireUser();
        const { data } = await supabase.from("measurements").insert({ user_id: user.id, ...body, date: new Date().toISOString() }).select().single();
        return data;
    },
    async getMeasurements() {
        const user = await requireUser();
        const { data } = await supabase.from("measurements").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(200);
        return data || [];
    },
    async uploadPhoto(file) {
        const user = await requireUser();
        const ext = (file.name || "photo.jpg").split(".").pop();
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("progress-photos").upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
        if (error) throw { response: { data: { detail: error.message } } };
        const { data } = await supabase.from("progress_photos").insert({ user_id: user.id, storage_path: path, content_type: file.type || "image/jpeg", date: new Date().toISOString() }).select().single();
        return data;
    },
    async getPhotos() {
        const user = await requireUser();
        const { data } = await supabase.from("progress_photos").select("*").eq("user_id", user.id).order("date", { ascending: false });
        return (data || []).map((p) => ({ ...p, signed_url: supabase.storage.from("progress-photos").getPublicUrl(p.storage_path).data.publicUrl }));
    },
    async getStrength() {
        const sessions = await this.getSessions();
        const out = {};
        sessions.slice().reverse().forEach((s) => {
            (s.exercises || []).forEach((ex) => {
                const top = Math.max(0, ...((ex.sets || []).map((st) => st.weight_kg || 0)));
                if (top > 0) (out[ex.exercise_name] = out[ex.exercise_name] || []).push({ date: s.date, weight_kg: top });
            });
        });
        return out;
    },
    async getConsistency() {
        const user = await requireUser();
        const since = new Date(Date.now() - 28 * 86400000).toISOString();
        const { data } = await supabase.from("workout_sessions").select("date").eq("user_id", user.id).gte("date", since);
        const days = new Set((data || []).map((s) => s.date.slice(0, 10))).size;
        const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        const target = ((prof?.fitness_profile?.workouts_per_week) || 4) * 4;
        return { days_done: days, target, score: Math.min(100, Math.round((days / Math.max(1, target)) * 100)), streak: prof?.streak || 0 };
    },
    // ---- DIET ----
    async getDietPlan() {
        const user = await requireUser();
        const { data } = await supabase.from("diet_plans").select("*").eq("user_id", user.id).eq("active", true).maybeSingle();
        if (!data) throw { response: { status: 404 } };
        return data;
    },
    async regenDietPlan() {
        const { data: profile } = await this.getProfile();
        const { data } = await supabase.functions.invoke("generate-diet-plan", { body: { profile: profile.profile } });
        return data;
    },
    async logMeal(body) {
        const user = await requireUser();
        const { data } = await supabase.from("meal_logs").insert({ user_id: user.id, ...body, date: new Date().toISOString() }).select().single();
        return data;
    },
    async getMeals(days = 7) {
        const user = await requireUser();
        const since = new Date(Date.now() - days * 86400000).toISOString();
        const { data } = await supabase.from("meal_logs").select("*").eq("user_id", user.id).gte("date", since).order("date", { ascending: false });
        return data || [];
    },
    // ---- AI ----
    async scanFood(file) {
        const reader = new FileReader();
        const b64 = await new Promise((res, rej) => { reader.onload = () => res(reader.result.split(",")[1]); reader.onerror = rej; reader.readAsDataURL(file); });
        const { data, error } = await supabase.functions.invoke("food-scan", { body: { image_base64: b64 } });
        if (error) throw { response: { data: { detail: error.message } } };
        return data;
    },
    async coachMessage(message) {
        const user = await requireUser();
        const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        const { data: resp } = await supabase.functions.invoke("ai-coach", { body: { message, profile: prof?.fitness_profile, name: prof?.name } });
        const row = { user_id: user.id, user_message: message, ai_reply: resp?.reply || "", date: new Date().toISOString() };
        const { data: saved } = await supabase.from("coach_messages").insert(row).select().single();
        return saved;
    },
    async getCoachHistory() {
        const user = await requireUser();
        const { data } = await supabase.from("coach_messages").select("*").eq("user_id", user.id).order("date", { ascending: true }).limit(50);
        return data || [];
    },
};

// Route table for the axios-like shim
const route = async (method, url, body) => {
    const u = url.split("?")[0];
    const m = method.toLowerCase();
    if (u === "/dashboard" && m === "get") return handlers.getDashboard();
    if (u === "/profile" && m === "get") return handlers.getProfile();
    if (u === "/onboarding" && m === "post") return handlers.submitOnboarding(body);
    if (u === "/workout-plan" && m === "get") return handlers.getWorkoutPlan();
    if (u === "/workout-plan/regenerate" && m === "post") return handlers.regenWorkoutPlan();
    if (u === "/exercises" && m === "get") return handlers.getExercises();
    if (u.startsWith("/exercises/") && m === "get") return handlers.getExercise(u.split("/")[2]);
    if (u === "/workout-sessions" && m === "post") return handlers.logSession(body);
    if (u === "/workout-sessions" && m === "get") return handlers.getSessions();
    if (u === "/progress/weight" && m === "post") return handlers.logWeight(body);
    if (u === "/progress/weight" && m === "get") return handlers.getWeights();
    if (u === "/progress/measurements" && m === "post") return handlers.logMeasurement(body);
    if (u === "/progress/measurements" && m === "get") return handlers.getMeasurements();
    if (u === "/progress/photos" && m === "post") return handlers.uploadPhoto(body.get("file"));
    if (u === "/progress/photos" && m === "get") return handlers.getPhotos();
    if (u === "/progress/strength" && m === "get") return handlers.getStrength();
    if (u === "/progress/consistency" && m === "get") return handlers.getConsistency();
    if (u === "/diet-plan" && m === "get") return handlers.getDietPlan();
    if (u === "/diet-plan/regenerate" && m === "post") return handlers.regenDietPlan();
    if (u === "/meals" && m === "post") return handlers.logMeal(body);
    if (u === "/meals" && m === "get") return handlers.getMeals();
    if (u === "/food-scan" && m === "post") return handlers.scanFood(body.get("file"));
    if (u === "/coach/message" && m === "post") return handlers.coachMessage(body.message);
    if (u === "/coach/history" && m === "get") return handlers.getCoachHistory();
    throw new Error("Unknown route " + url);
};

const api = {
    get: async (url) => ({ data: await route("get", url) }),
    post: async (url, body) => ({ data: await route("post", url, body) }),
};

export default api;
export const API = "supabase";
export const getToken = () => null;
export const setToken = () => {};
export const clearToken = () => {};
