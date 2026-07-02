// API shim that translates the old axios-style calls used by pages
// (api.get/post/...) to Supabase queries and edge functions.
// This keeps all UI pages unchanged.

import { supabase } from "./supabase";

// ---- Fallback plan generators (used if Supabase edge functions fail) ----
function fallbackWorkoutDays() {
    return [
        { day: "Monday", focus: "Push", exercises: [
            { exercise_id: "ex_bench", name: "Barbell Bench Press", sets: 4, reps: "8-10", rest_sec: 90 },
            { exercise_id: "ex_ohp", name: "Overhead Press", sets: 3, reps: "8-10", rest_sec: 90 },
            { exercise_id: "ex_pushup", name: "Push-Up", sets: 3, reps: "12-15", rest_sec: 60 },
        ]},
        { day: "Tuesday", focus: "Pull", exercises: [
            { exercise_id: "ex_deadlift", name: "Deadlift", sets: 4, reps: "5-6", rest_sec: 120 },
            { exercise_id: "ex_row", name: "Barbell Row", sets: 4, reps: "8-10", rest_sec: 90 },
            { exercise_id: "ex_pullup", name: "Pull-Up", sets: 3, reps: "6-10", rest_sec: 90 },
        ]},
        { day: "Wednesday", focus: "Legs", exercises: [
            { exercise_id: "ex_bsquat", name: "Barbell Back Squat", sets: 4, reps: "8-10", rest_sec: 120 },
            { exercise_id: "ex_legpress", name: "Leg Press", sets: 3, reps: "10-12", rest_sec: 90 },
            { exercise_id: "ex_lunge", name: "Walking Lunge", sets: 3, reps: "12-15", rest_sec: 60 },
        ]},
        { day: "Thursday", focus: "Rest", exercises: [] },
        { day: "Friday", focus: "Full Body", exercises: [
            { exercise_id: "ex_squat", name: "Bodyweight Squat", sets: 3, reps: "15", rest_sec: 45 },
            { exercise_id: "ex_pushup", name: "Push-Up", sets: 3, reps: "12", rest_sec: 45 },
            { exercise_id: "ex_plank", name: "Plank", sets: 3, reps: "45s", rest_sec: 45 },
        ]},
        { day: "Saturday", focus: "Core + Cardio", exercises: [
            { exercise_id: "ex_plank", name: "Plank", sets: 4, reps: "60s", rest_sec: 45 },
            { exercise_id: "ex_burpee", name: "Burpee", sets: 4, reps: "12", rest_sec: 45 },
        ]},
        { day: "Sunday", focus: "Rest", exercises: [] },
    ];
}
function fallbackDietPlan(profile) {
    const veg = ["veg", "vegan", "eggetarian"].includes(profile?.diet_preference);
    return {
        daily_calories: 2200, protein_g: 140, carbs_g: 240, fats_g: 70,
        meals: [
            { meal_type: "Breakfast", name: "Moong Dal Cheela + Curd", calories: 450, protein_g: 22, carbs_g: 55, fats_g: 12, items: ["2 cheelas", "1 bowl curd"] },
            { meal_type: "Lunch", name: veg ? "Rajma Chawal + Salad" : "Chicken Curry + Roti", calories: 650, protein_g: 35, carbs_g: 80, fats_g: 18, items: veg ? ["1 bowl rajma", "1 cup rice"] : ["150g chicken curry", "3 rotis"] },
            { meal_type: "Snack", name: "Sprouts Chaat + Buttermilk", calories: 300, protein_g: 18, carbs_g: 35, fats_g: 6, items: ["1 bowl sprouts", "1 glass buttermilk"] },
            { meal_type: "Dinner", name: veg ? "Paneer Bhurji + 2 Rotis" : "Grilled Fish + Veg", calories: 600, protein_g: 38, carbs_g: 50, fats_g: 22, items: veg ? ["120g paneer", "2 rotis"] : ["150g fish", "Mixed veg"] },
        ],
    };
}

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

        // Try edge functions first; fall back to client-side creation so we NEVER
        // leave the user without an active workout/diet plan.
        let plan = null, diet = null;
        try {
            const { data, error } = await supabase.functions.invoke("generate-workout-plan", { body: { profile: body } });
            if (!error) plan = data;
        } catch (e) { /* ignore, use fallback */ }
        try {
            const { data, error } = await supabase.functions.invoke("generate-diet-plan", { body: { profile: body } });
            if (!error) diet = data;
        } catch (e) { /* ignore, use fallback */ }

        if (!plan) {
            // deactivate any old, then insert fallback
            await supabase.from("workout_plans").update({ active: false }).eq("user_id", user.id).eq("active", true);
            const { data: saved } = await supabase.from("workout_plans")
                .insert({ user_id: user.id, days: fallbackWorkoutDays(), active: true })
                .select().single();
            plan = saved;
        }
        if (!diet) {
            await supabase.from("diet_plans").update({ active: false }).eq("user_id", user.id).eq("active", true);
            const { data: saved } = await supabase.from("diet_plans")
                .insert({ user_id: user.id, ...fallbackDietPlan(body), active: true })
                .select().single();
            diet = saved;
        }
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
        const p = await this.getProfile();
        const fitnessProfile = p?.profile || p?.fitness_profile || null;
        if (!fitnessProfile) throw { response: { data: { detail: "Complete onboarding first" } } };
        const user = await requireUser();
        // Try edge function
        try {
            const { data, error } = await supabase.functions.invoke("generate-workout-plan", { body: { profile: fitnessProfile } });
            if (!error && data) return data;
            console.warn("[regenWorkoutPlan] edge function error, using fallback:", error?.message);
        } catch (e) {
            console.warn("[regenWorkoutPlan] edge function threw, using fallback:", e?.message);
        }
        // Fallback: deactivate existing and insert a fresh template
        await supabase.from("workout_plans").update({ active: false }).eq("user_id", user.id).eq("active", true);
        const { data: saved, error } = await supabase.from("workout_plans")
            .insert({ user_id: user.id, days: fallbackWorkoutDays(), active: true })
            .select().single();
        if (error) throw { response: { data: { detail: error.message || "Regenerate failed" } } };
        return saved;
    },
    async rescheduleWorkoutDay({ sourceIdx, targetIdx }) {
        // Swap the workout at plan.days[sourceIdx] with plan.days[targetIdx],
        // enforcing:
        //   - source must NOT be completed (has no session logged today)
        //   - target must NOT be completed
        //   - target must be future OR (past AND missed)
        // "Missed" = past day with exercises but no session logged this week.
        const user = await requireUser();
        if (sourceIdx === targetIdx) throw { response: { data: { detail: "Pick a different day" } } };
        const { data: plan } = await supabase.from("workout_plans")
            .select("*").eq("user_id", user.id).eq("active", true).maybeSingle();
        if (!plan) throw { response: { data: { detail: "No active plan" } } };
        const days = Array.isArray(plan.days) ? [...plan.days] : [];
        if (!days[sourceIdx] || !days[targetIdx]) throw { response: { data: { detail: "Invalid day index" } } };

        // Determine current-week completion for source & target using workout_sessions
        const now = new Date();
        const todayIdxMondayFirst = (now.getDay() + 6) % 7;
        const monday = new Date(now);
        monday.setDate(now.getDate() - todayIdxMondayFirst);
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        const { data: sessions } = await supabase.from("workout_sessions")
            .select("date")
            .eq("user_id", user.id)
            .gte("date", monday.toISOString())
            .lte("date", sunday.toISOString());

        const dayHasSession = (idx) => {
            const d0 = new Date(monday);
            d0.setDate(monday.getDate() + idx);
            d0.setHours(0, 0, 0, 0);
            const d1 = new Date(d0);
            d1.setHours(23, 59, 59, 999);
            return (sessions || []).some((s) => {
                const t = new Date(s.date);
                return t >= d0 && t <= d1;
            });
        };
        const sourceCompleted = dayHasSession(sourceIdx);
        const targetCompleted = dayHasSession(targetIdx);
        if (sourceCompleted) throw { response: { data: { detail: "This workout is already completed — it can't be moved." } } };
        if (targetCompleted) throw { response: { data: { detail: "Target day is already completed — pick another day." } } };

        const isPast = targetIdx < todayIdxMondayFirst;
        const isFuture = targetIdx > todayIdxMondayFirst;
        if (!isFuture && !isPast) {
            // targetIdx === todayIdxMondayFirst shouldn't happen (source is today)
            throw { response: { data: { detail: "Pick a different day" } } };
        }
        if (isPast) {
            const targetHasExercises = Array.isArray(days[targetIdx].exercises) && days[targetIdx].exercises.length > 0;
            const targetMissed = targetHasExercises && !targetCompleted;
            if (!targetMissed) {
                throw { response: { data: { detail: "You can only swap with a past day that was missed." } } };
            }
        }

        // Preserve day-of-week labels; swap only focus + exercises
        const srcDay = days[sourceIdx];
        const tgtDay = days[targetIdx];
        days[sourceIdx] = { ...srcDay, focus: tgtDay.focus, exercises: tgtDay.exercises || [] };
        days[targetIdx] = { ...tgtDay, focus: srcDay.focus, exercises: srcDay.exercises || [] };

        const { data: saved, error } = await supabase.from("workout_plans")
            .update({ days })
            .eq("id", plan.id)
            .select().single();
        if (error) throw { response: { data: { detail: error.message || "Reschedule failed" } } };
        return saved;
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
        const today = new Date().toISOString().slice(0, 10);
        const start = `${today}T00:00:00.000Z`;
        const end = `${today}T23:59:59.999Z`;
        const { data: existing } = await supabase.from("weight_entries").select("*").eq("user_id", user.id).gte("date", start).lte("date", end).maybeSingle();
        const query = existing
            ? supabase.from("weight_entries").update({ ...body, date: new Date().toISOString() }).eq("id", existing.id)
            : supabase.from("weight_entries").insert({ user_id: user.id, ...body, date: new Date().toISOString() });
        const { data, error } = await query.select().single();
        if (error) throw { response: { data: { detail: error.message } } };
        return data;
    },
    async getWeights() {
        const user = await requireUser();
        const { data } = await supabase.from("weight_entries").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(200);
        return data || [];
    },
    async logMeasurement(body) {
        const user = await requireUser();
        const today = new Date().toISOString().slice(0, 10);
        const start = `${today}T00:00:00.000Z`;
        const end = `${today}T23:59:59.999Z`;
        const { data: existing } = await supabase.from("measurements").select("*").eq("user_id", user.id).gte("date", start).lte("date", end).maybeSingle();
        const query = existing
            ? supabase.from("measurements").update({ ...body, date: new Date().toISOString() }).eq("id", existing.id)
            : supabase.from("measurements").insert({ user_id: user.id, ...body, date: new Date().toISOString() });
        const { data, error } = await query.select().single();
        if (error) throw { response: { data: { detail: error.message } } };
        return data;
    },
    async getMeasurements() {
        const user = await requireUser();
        const { data } = await supabase.from("measurements").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(200);
        return data || [];
    },
    async uploadPhoto(file) {
        const user = await requireUser();
        const today = new Date().toISOString().slice(0, 10);
        const start = `${today}T00:00:00.000Z`;
        const end = `${today}T23:59:59.999Z`;
        const { data: existing } = await supabase.from("progress_photos").select("*").eq("user_id", user.id).gte("date", start).lte("date", end).maybeSingle();
        const ext = (file.name || "photo.jpg").split(".").pop();
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("progress-photos").upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
        if (error) throw { response: { data: { detail: error.message } } };
        const query = existing
            ? supabase.from("progress_photos").update({ storage_path: path, content_type: file.type || "image/jpeg", date: new Date().toISOString() }).eq("id", existing.id)
            : supabase.from("progress_photos").insert({ user_id: user.id, storage_path: path, content_type: file.type || "image/jpeg", date: new Date().toISOString() });
        const { data, error: saveError } = await query.select().single();
        if (saveError) throw { response: { data: { detail: saveError.message } } };
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
                const reps = Math.max(1, ...((ex.sets || []).filter((st) => st.weight_kg > 0).map((st) => st.reps || 1)));
                const estimated_1rm = top > 0 ? Math.round(top * (1 + reps / 30)) : 0;
                if (top > 0) (out[ex.exercise_name] = out[ex.exercise_name] || []).push({ date: s.date, weight_kg: top, estimated_1rm });
            });
        });
        return out;
    },
    async getWorkoutProgressSummary() {
        const [sessions, planRes] = await Promise.all([
            this.getSessions(),
            this.getWorkoutPlan().catch(() => null),
        ]);
        const exercisesCompleted = sessions.reduce((a, s) => a + (s.exercises || []).length, 0);
        const setsCompleted = sessions.reduce((a, s) => a + (s.exercises || []).reduce((x, ex) => x + (ex.sets || []).filter((st) => st.completed !== false).length, 0), 0);
        const repsCompleted = sessions.reduce((a, s) => a + (s.exercises || []).reduce((x, ex) => x + (ex.sets || []).filter((st) => st.completed !== false).reduce((r, st) => r + (Number(st.reps) || 0), 0), 0), 0);
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const completedDays = new Set(sessions.filter((s) => new Date(s.date) >= monthStart).map((s) => s.date.slice(0, 10)));
        let planned = 0;
        for (let d = new Date(monthStart); d <= today; d.setDate(d.getDate() + 1)) {
            const idx = (d.getDay() + 6) % 7;
            const day = planRes?.days?.[idx % (planRes?.days?.length || 1)];
            if ((day?.exercises || []).length > 0) planned += 1;
        }
        return {
            workouts_completed: sessions.length,
            exercises_completed: exercisesCompleted,
            sets_completed: setsCompleted,
            reps_completed: repsCompleted,
            missed_workouts: Math.max(0, planned - completedDays.size),
        };
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
        const p = await this.getProfile();
        const fitnessProfile = p?.profile || p?.fitness_profile || null;
        if (!fitnessProfile) throw { response: { data: { detail: "Complete onboarding first" } } };
        const user = await requireUser();
        try {
            const { data, error } = await supabase.functions.invoke("generate-diet-plan", { body: { profile: fitnessProfile } });
            if (!error && data) return data;
            console.warn("[regenDietPlan] edge function error, using fallback:", error?.message);
        } catch (e) {
            console.warn("[regenDietPlan] edge function threw, using fallback:", e?.message);
        }
        await supabase.from("diet_plans").update({ active: false }).eq("user_id", user.id).eq("active", true);
        const { data: saved, error } = await supabase.from("diet_plans")
            .insert({ user_id: user.id, ...fallbackDietPlan(fitnessProfile), active: true })
            .select().single();
        if (error) throw { response: { data: { detail: error.message || "Regenerate failed" } } };
        return saved;
    },
    async logMeal(body) {
        const user = await requireUser();
        const { data } = await supabase.from("meal_logs").insert({ user_id: user.id, ...body, date: new Date().toISOString() }).select().single();
        return data;
    },
    async searchMeal(query) {
        // Calls the FastAPI backend meal-search endpoint (public, uses EMERGENT_LLM_KEY)
        const url = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "") + "/api/meal-search";
        try {
            const resp = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query }),
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({ detail: `HTTP ${resp.status}` }));
                throw { response: { data: err } };
            }
            return await resp.json();
        } catch (e) {
            if (e?.response) throw e;
            throw { response: { data: { detail: e?.message || "Search failed" } } };
        }
    },
    async getMeals(days = 7) {
        const user = await requireUser();
        const since = new Date(Date.now() - days * 86400000).toISOString();
        const { data } = await supabase.from("meal_logs").select("*").eq("user_id", user.id).gte("date", since).order("date", { ascending: false });
        return data || [];
    },
    async getMealsByDate(dateISO) {
        // dateISO = "YYYY-MM-DD" — returns meals logged on that local calendar day
        const user = await requireUser();
        const start = new Date(dateISO); start.setHours(0, 0, 0, 0);
        const end = new Date(dateISO); end.setHours(23, 59, 59, 999);
        const { data } = await supabase.from("meal_logs")
            .select("*").eq("user_id", user.id)
            .gte("date", start.toISOString()).lte("date", end.toISOString())
            .order("date", { ascending: false });
        return data || [];
    },
    async resetTodayMeals() {
        const user = await requireUser();
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const end = new Date(); end.setHours(23, 59, 59, 999);
        const { error } = await supabase.from("meal_logs")
            .delete()
            .eq("user_id", user.id)
            .gte("date", start.toISOString())
            .lte("date", end.toISOString());
        if (error) throw { response: { data: { detail: error.message } } };
        return { ok: true };
    },
    async resetTodayWorkout() {
        const user = await requireUser();
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const end = new Date(); end.setHours(23, 59, 59, 999);
        const { error } = await supabase.from("workout_sessions")
            .delete()
            .eq("user_id", user.id)
            .gte("date", start.toISOString())
            .lte("date", end.toISOString());
        if (error) throw { response: { data: { detail: error.message } } };
        // Optionally reset streak/last_workout_date if it was today
        const today = new Date().toISOString().slice(0, 10);
        const { data: prof } = await supabase.from("profiles").select("last_workout_date, streak").eq("id", user.id).maybeSingle();
        if (prof?.last_workout_date === today) {
            const newStreak = Math.max(0, (prof.streak || 1) - 1);
            await supabase.from("profiles").update({ last_workout_date: null, streak: newStreak }).eq("id", user.id);
        }
        return { ok: true };
    },
    async getTodaySessions() {
        const user = await requireUser();
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const end = new Date(); end.setHours(23, 59, 59, 999);
        const { data } = await supabase.from("workout_sessions")
            .select("*")
            .eq("user_id", user.id)
            .gte("date", start.toISOString())
            .lte("date", end.toISOString())
            .order("date", { ascending: false });
        return data || [];
    },
    async getWeekSessions() {
        const user = await requireUser();
        // Get current week's Monday
        const now = new Date();
        const day = (now.getDay() + 6) % 7; // Monday=0
        const monday = new Date(now);
        monday.setDate(now.getDate() - day);
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        const { data } = await supabase.from("workout_sessions")
            .select("*")
            .eq("user_id", user.id)
            .gte("date", monday.toISOString())
            .lte("date", sunday.toISOString());
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
    if (u === "/workout-plan/reschedule" && m === "post") return handlers.rescheduleWorkoutDay(body);
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
    if (u === "/progress/workout-summary" && m === "get") return handlers.getWorkoutProgressSummary();
    if (u === "/diet-plan" && m === "get") return handlers.getDietPlan();
    if (u === "/diet-plan/regenerate" && m === "post") return handlers.regenDietPlan();
    if (u === "/meals" && m === "post") return handlers.logMeal(body);
    if (u === "/meals" && m === "get") return handlers.getMeals();
    if (u.startsWith("/meals/by-date/") && m === "get") return handlers.getMealsByDate(u.slice("/meals/by-date/".length));
    if (u === "/meal-search" && m === "post") return handlers.searchMeal(body?.query);
    if (u === "/meals/reset-today" && m === "post") return handlers.resetTodayMeals();
    if (u === "/workout-sessions/reset-today" && m === "post") return handlers.resetTodayWorkout();
    if (u === "/workout-sessions/today" && m === "get") return handlers.getTodaySessions();
    if (u === "/workout-sessions/week" && m === "get") return handlers.getWeekSessions();
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
