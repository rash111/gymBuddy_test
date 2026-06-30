// Edge Function: ai-coach
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    try {
        const { message, profile, name } = await req.json();
        const apiKey = Deno.env.get("OPENAI_API_KEY");
        const sys = `You are an expert Indian fitness coach for ${name || "the user"}. Profile: goal=${profile?.goal}, level=${profile?.fitness_level}, diet=${profile?.diet_preference}. Be motivating, concise, give actionable advice. Reference Indian foods/gym context.`;
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: sys }, { role: "user", content: message }] }),
        });
        const j = await r.json();
        return new Response(JSON.stringify({ reply: j?.choices?.[0]?.message?.content || "(no reply)" }), { headers: { ...cors, "Content-Type": "application/json" } });
    } catch (e) {
        return new Response(JSON.stringify({ reply: "Sorry, I had trouble responding. Try again.", error: String(e) }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
});
