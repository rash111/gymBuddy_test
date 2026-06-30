// Edge Function: generate-workout-plan
// Saves to workout_plans table. Requires user JWT in Authorization header.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const EX_IDS = "ex_pushup,ex_squat,ex_bench,ex_deadlift,ex_bsquat,ex_ohp,ex_row,ex_pullup,ex_lunge,ex_plank,ex_dbcurl,ex_dips,ex_lat_pd,ex_legpress,ex_burpee";

const fallback = (profile: any) => ({
    days: [
        { day: "Monday", focus: "Push", exercises: [{ exercise_id: "ex_bench", name: "Barbell Bench Press", sets: 4, reps: "8-10", rest_sec: 90 }, { exercise_id: "ex_ohp", name: "Overhead Press", sets: 3, reps: "8-10", rest_sec: 90 }, { exercise_id: "ex_pushup", name: "Push-Up", sets: 3, reps: "12-15", rest_sec: 60 }] },
        { day: "Tuesday", focus: "Pull", exercises: [{ exercise_id: "ex_deadlift", name: "Deadlift", sets: 4, reps: "5-6", rest_sec: 120 }, { exercise_id: "ex_row", name: "Barbell Row", sets: 4, reps: "8-10", rest_sec: 90 }, { exercise_id: "ex_pullup", name: "Pull-Up", sets: 3, reps: "6-10", rest_sec: 90 }] },
        { day: "Wednesday", focus: "Legs", exercises: [{ exercise_id: "ex_bsquat", name: "Barbell Back Squat", sets: 4, reps: "8-10", rest_sec: 120 }, { exercise_id: "ex_legpress", name: "Leg Press", sets: 3, reps: "10-12", rest_sec: 90 }, { exercise_id: "ex_lunge", name: "Walking Lunge", sets: 3, reps: "12-15", rest_sec: 60 }] },
        { day: "Thursday", focus: "Rest", exercises: [] },
        { day: "Friday", focus: "Full Body", exercises: [{ exercise_id: "ex_squat", name: "Bodyweight Squat", sets: 3, reps: "15", rest_sec: 45 }, { exercise_id: "ex_pushup", name: "Push-Up", sets: 3, reps: "12", rest_sec: 45 }, { exercise_id: "ex_plank", name: "Plank", sets: 3, reps: "45s", rest_sec: 45 }] },
        { day: "Saturday", focus: "Core + Cardio", exercises: [{ exercise_id: "ex_plank", name: "Plank", sets: 4, reps: "60s", rest_sec: 45 }, { exercise_id: "ex_burpee", name: "Burpee", sets: 4, reps: "12", rest_sec: 45 }] },
        { day: "Sunday", focus: "Rest", exercises: [] },
    ],
});

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    try {
        const auth = req.headers.get("Authorization");
        const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth! } } });
        const { data: { user } } = await supa.auth.getUser();
        if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

        const { profile } = await req.json();
        const apiKey = Deno.env.get("OPENAI_API_KEY");
        const sys = `You are an expert fitness coach. Generate a structured weekly workout plan as JSON only. Use exercises from these ids: ${EX_IDS}. Return: {"days":[{"day":"Monday","focus":"Push","exercises":[{"exercise_id":"ex_bench","name":"Barbell Bench Press","sets":4,"reps":"8-10","rest_sec":90}]}]}. Include Rest days with empty exercises.`;
        const prompt = `Profile: ${JSON.stringify(profile)}. Output JSON only.`;
        let data: any;
        try {
            const r = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: sys }, { role: "user", content: prompt }], response_format: { type: "json_object" } }),
            });
            const j = await r.json();
            data = JSON.parse(j.choices[0].message.content);
        } catch { data = fallback(profile); }

        await supa.from("workout_plans").update({ active: false }).eq("user_id", user.id).eq("active", true);
        const { data: saved } = await supa.from("workout_plans").insert({ user_id: user.id, days: data.days, active: true }).select().single();
        return new Response(JSON.stringify(saved), { headers: { ...cors, "Content-Type": "application/json" } });
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
    }
});
