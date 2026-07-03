// Edge Function: generate-posture-guide

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
    const { exerciseName, muscle, equipment, difficulty, injuries = [] } = await req.json();

    const injuryContext = injuries.length > 0 
      ? `\n\nIMPORTANT: The user has reported the following injuries/limitations: ${injuries.join(", ")}. Include safety modifications in the Safety Tips section specific to these limitations.`
      : "";

    const prompt = `
You are an expert fitness coach specializing in exercise form and injury prevention.

Generate a comprehensive posture guide for the following exercise in valid JSON format ONLY (no markdown, no extra text):

Exercise: ${exerciseName}
Primary Muscle Group: ${muscle}
Equipment: ${equipment}
Difficulty Level: ${difficulty}${injuryContext}

Return ONLY a valid JSON object (no markdown backticks, no extra text) with exactly these fields:
{
  "setup": "1-2 sentences describing initial body position and stance",
  "execution": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
  "breathing": "Breathing cues during the exercise (e.g., 'Exhale as you push, inhale on the return')",
  "commonMistakes": ["Mistake 1: ...", "Mistake 2: ...", "Mistake 3: ..."],
  "safetyTips": ["Tip 1: ...", "Tip 2: ...", "Tip 3: ..."],
  "primaryMuscles": "List of primary muscles worked (e.g., 'Chest, Triceps, Front Shoulders')"
}

STRICT: Return ONLY valid JSON, nothing else. No markdown formatting. No extra text.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const responseText = completion.choices[0].message.content || "{}";
    
    // Parse the JSON response - handle potential markdown code blocks
    let jsonText = responseText.trim();
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }
    
    const guide = JSON.parse(jsonText);

    return new Response(
      JSON.stringify({
        success: true,
        guide: guide,
      }),
      {
        headers: {
          ...cors,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("Error generating posture guide:", err);

    return new Response(
      JSON.stringify({
        success: false,
        error: String(err),
        message: "Failed to generate posture guide",
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
