// Simple script to run the database migration
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://ieflizrmhydqnjdpqyti.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseServiceKey) {
  console.error("SUPABASE_SERVICE_KEY not set");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log("Running migration: 002_add_exercise_enhancements.sql");
    
    const sql = `
    ALTER TABLE public.exercises
    ADD COLUMN IF NOT EXISTS shorts_url TEXT,
    ADD COLUMN IF NOT EXISTS posture_guide JSONB;

    CREATE INDEX IF NOT EXISTS exercises_shorts_url_idx ON public.exercises(shorts_url) WHERE shorts_url IS NOT NULL;
    CREATE INDEX IF NOT EXISTS exercises_posture_guide_idx ON public.exercises(posture_guide) WHERE posture_guide IS NOT NULL;
    `;

    // Note: Supabase JS client doesn't support raw SQL execution
    // We need to use the REST API directly or via RPC
    // For now, we'll just try via fetch to the Supabase admin endpoint
    
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "apikey": supabaseServiceKey,
      },
      body: JSON.stringify({ sql }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    console.log("Migration completed successfully!");
    console.log(result);
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exit(1);
  }
}

runMigration();
