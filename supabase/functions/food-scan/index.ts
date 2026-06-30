// Supabase Edge Function: food-scan
// Deploy: supabase functions deploy food-scan --no-verify-jwt
// Env: supabase secrets set OPENAI_API_KEY=sk-...

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    try {
        const { image_base64 } = await req.json();
        const apiKey = Deno.env.get("OPENAI_API_KEY");
        const sys = "You are an Indian food nutrition expert. Reply with JSON ONLY: {\"food_name\":\"...\",\"portion\":\"...\",\"calories\":350,\"protein_g\":20,\"carbs_g\":40,\"fats_g\":10,\"notes\":\"...\"}";
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: sys },
                    { role: "user", content: [
                        { type: "text", text: "Identify this Indian dish and estimate nutrition." },
                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image_base64}` } },
                    ] },
                ],
                response_format: { type: "json_object" },
            }),
        });
        const j = await r.json();
        const text = j?.choices?.[0]?.message?.content || "{}";
        const parsed = JSON.parse(text);
        return new Response(JSON.stringify(parsed), { headers: { ...cors, "Content-Type": "application/json" } });
    } catch (e) {
        return new Response(JSON.stringify({ food_name: "Unknown", portion: "1 serving", calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0, notes: String(e) }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
});
