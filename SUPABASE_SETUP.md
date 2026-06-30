# GymBuddy — Supabase Setup (5 steps)

## 1) Create Supabase project & get credentials
- Go to https://supabase.com → New Project.
- Wait ~2 min for provisioning.
- Settings → API → copy:
  - **Project URL** → `REACT_APP_SUPABASE_URL`
  - **anon public** key → `REACT_APP_SUPABASE_ANON_KEY`

Paste them into `/app/frontend/.env` (replace placeholders) then run:
```
sudo supervisorctl restart frontend
```

## 2) Run the SQL migration
- Supabase Dashboard → SQL Editor → New Query.
- Paste contents of `/app/supabase/migrations/001_init.sql` → **Run**.
- This creates all tables, RLS policies, triggers, and seeds 15 exercises.

## 3) Create the Storage bucket
- Supabase Dashboard → Storage → New bucket.
- Name: `progress-photos`, **Public**: ON, file size limit: 10 MB.
- (Optional) Add a policy: `auth.uid()::text = (storage.foldername(name))[1]` for stricter scoping.

## 4) Deploy Edge Functions (run locally on YOUR machine)
You need [Supabase CLI](https://supabase.com/docs/guides/cli) installed.

```bash
# from /app/supabase on your local machine
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# set your OpenAI key as a function secret
supabase secrets set OPENAI_API_KEY=sk-proj-xxxx

# deploy all 4 functions
supabase functions deploy food-scan
supabase functions deploy ai-coach
supabase functions deploy generate-workout-plan
supabase functions deploy generate-diet-plan
```

## 5) Test the app
1. Open the app → Sign Up with a new email.
2. Complete onboarding → AI generates workout + diet plan via Edge Functions.
3. Log a workout, scan a food photo, chat with the coach.

---

## What changed vs the previous build
- **Auth**: now Supabase `signUp` / `signInWithPassword` with session persistence via `localStorage`.
- **Database**: every endpoint now goes through `@supabase/supabase-js` (`supabase.from('table')…`). All UI pages remain unchanged — `src/lib/api.js` is a thin shim that maps old `api.get('/path')` calls to Supabase queries.
- **Storage**: progress photos uploaded to `progress-photos` bucket with `supabase.storage.from(…).upload(…)`; public URL fetched via `getPublicUrl`.
- **AI features**: moved to 4 Supabase Edge Functions (TypeScript). They call OpenAI `gpt-4o-mini` directly using your `OPENAI_API_KEY` secret.
- **RLS**: enabled on all tables, with `auth.uid() = user_id` policies — each user only ever sees their own data.
- **Protected routes**: still handled by `ProtectedRoute.jsx` + `AuthContext` (now powered by Supabase sessions).
- **FastAPI backend**: no longer used by the frontend; kept idle. You can remove `/app/backend` if you want a clean Supabase-only repo.

## Env vars summary
`/app/frontend/.env`
```
REACT_APP_BACKEND_URL=<unused now, keep for compat>
REACT_APP_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1...
```

Edge Function secrets (set with `supabase secrets set`):
```
OPENAI_API_KEY=sk-proj-...
```
