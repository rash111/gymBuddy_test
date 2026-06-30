// Edge Function: ai-coach

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { openai } from "../shared/openai.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const { message, profile, name } = await req.json();

    const sys = `
You are GymBuddy, an expert Indian fitness coach.

User Name: ${name || "User"}

Profile:
- Goal: ${profile?.goal}
- Fitness Level: ${profile?.fitness_level}
- Diet Preference: ${profile?.diet_preference}

Rules:
- Give practical advice.
- Keep responses motivating.
- Consider Indian food and gym context.
- Prioritize safety.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: sys,
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    return new Response(
      JSON.stringify({
        reply: completion.choices[0].message.content,
      }),
      {
        headers: {
          ...cors,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error(err);

    return new Response(
      JSON.stringify({
        reply: "Sorry, I couldn't generate a response.",
        error: String(err),
      }),
      {
        status: 500,
        headers: {
          ...cors,
          "Content-Type": "application/json",
        },
      }
    );
  }
});