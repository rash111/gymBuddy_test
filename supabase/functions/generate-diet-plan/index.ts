// Edge Function: generate-diet-plan
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const fallback = (profile: any) => {
    const veg = ["veg", "vegan", "eggetarian"].includes(profile?.diet_preference);
    return {
        daily_calories: 2200, protein_g: 140, carbs_g: 240, fats_g: 70,
        meals: [
            { meal_type: "Breakfast", name: "Moong Dal Cheela + Curd", calories: 450, protein_g: 22, carbs_g: 55, fats_g: 12, items: ["2 cheelas", "1 bowl curd"] },
            { meal_type: "Lunch", name: veg ? "Rajma Chawal" : "Chicken Curry + Roti", calories: 650, protein_g: 35, carbs_g: 80, fats_g: 18, items: veg ? ["1 bowl rajma", "1 cup rice"] : ["150g chicken", "3 rotis"] },
            { meal_type: "Snack", name: "Sprouts Chaat", calories: 300, protein_g: 18, carbs_g: 35, fats_g: 6, items: ["1 bowl sprouts"] },
            { meal_type: "Dinner", name: veg ? "Paneer Bhurji + Rotis" : "Grilled Fish + Veg", calories: 600, protein_g: 38, carbs_g: 50, fats_g: 22, items: veg ? ["120g paneer", "2 rotis"] : ["150g fish"] },
        ],
    };
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    try {
        const auth = req.headers.get("Authorization");
        const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth! } } });
        const { data: { user } } = await supa.auth.getUser();
        if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

        const { profile } = await req.json();
        const apiKey = Deno.env.get("OPENAI_API_KEY");
        const sys = `You are an Indian nutrition expert. Return JSON ONLY: {"daily_calories":2200,"protein_g":140,"carbs_g":240,"fats_g":70,"meals":[{"meal_type":"Breakfast","name":"...","calories":450,"protein_g":22,"carbs_g":55,"fats_g":12,"items":["..."]}]}. 4 meals using Indian foods.`;
        let data: any;
        try {
            const r = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: sys }, { role: "user", content: `Profile: ${JSON.stringify(profile)}. JSON only.` }], response_format: { type: "json_object" } }),
            });
            const j = await r.json();
            data = JSON.parse(j.choices[0].message.content);
        } catch { data = fallback(profile); }

        await supa.from("diet_plans").update({ active: false }).eq("user_id", user.id).eq("active", true);
        const { data: saved } = await supa.from("diet_plans").insert({ user_id: user.id, ...data, active: true }).select().single();
        return new Response(JSON.stringify(saved), { headers: { ...cors, "Content-Type": "application/json" } });
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
    }
});
