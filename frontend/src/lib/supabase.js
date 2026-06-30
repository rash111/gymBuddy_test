import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnon = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnon || supabaseUrl.includes("YOUR_PROJECT_REF")) {
    console.warn("[Supabase] Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in /app/frontend/.env then restart.");
}

export const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseAnon || "placeholder", {
    auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage },
});
