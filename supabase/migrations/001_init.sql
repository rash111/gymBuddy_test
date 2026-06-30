-- ============================================================
-- GymBuddy Supabase Schema (run in Supabase SQL Editor)
-- ============================================================

-- PROFILES (extends auth.users)
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text,
    name text,
    onboarded boolean default false,
    streak integer default 0,
    last_workout_date date,
    fitness_profile jsonb,
    created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    insert into public.profiles (id, email, name)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.email))
    on conflict (id) do nothing;
    return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- EXERCISES (seed catalog, public read)
create table if not exists public.exercises (
    id text primary key,
    name text not null,
    muscle text,
    equipment text,
    difficulty text,
    instructions text,
    video_url text,
    created_at timestamptz default now()
);

-- WORKOUT PLANS
create table if not exists public.workout_plans (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    days jsonb not null,
    active boolean default true,
    created_at timestamptz default now()
);
create index if not exists workout_plans_user_idx on public.workout_plans(user_id);

-- DIET PLANS
create table if not exists public.diet_plans (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    daily_calories integer,
    protein_g integer,
    carbs_g integer,
    fats_g integer,
    meals jsonb,
    active boolean default true,
    created_at timestamptz default now()
);

-- WORKOUT SESSIONS
create table if not exists public.workout_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    plan_day_index integer,
    duration_minutes integer,
    exercises jsonb,
    rating integer,
    notes text,
    date timestamptz default now()
);
create index if not exists ws_user_date_idx on public.workout_sessions(user_id, date desc);

-- WEIGHT ENTRIES
create table if not exists public.weight_entries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    weight_kg numeric not null,
    note text,
    date timestamptz default now()
);

-- MEASUREMENTS
create table if not exists public.measurements (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    chest_cm numeric, waist_cm numeric, hips_cm numeric, arm_cm numeric, thigh_cm numeric,
    note text,
    date timestamptz default now()
);

-- PROGRESS PHOTOS
create table if not exists public.progress_photos (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    storage_path text not null,
    content_type text,
    date timestamptz default now()
);

-- MEAL LOGS
create table if not exists public.meal_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    meal_type text,
    name text,
    calories numeric,
    protein_g numeric,
    carbs_g numeric,
    fats_g numeric,
    notes text,
    date timestamptz default now()
);
create index if not exists meals_user_date_idx on public.meal_logs(user_id, date desc);

-- COACH MESSAGES
create table if not exists public.coach_messages (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    user_message text,
    ai_reply text,
    date timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.workout_plans enable row level security;
alter table public.diet_plans enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.weight_entries enable row level security;
alter table public.measurements enable row level security;
alter table public.progress_photos enable row level security;
alter table public.meal_logs enable row level security;
alter table public.coach_messages enable row level security;
alter table public.exercises enable row level security;

-- Profiles
create policy "own profile select" on public.profiles for select using (auth.uid() = id);
create policy "own profile upsert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- Generic "owns row" policies
do $$
declare t text;
begin
    for t in select unnest(array['workout_plans','diet_plans','workout_sessions','weight_entries','measurements','progress_photos','meal_logs','coach_messages'])
    loop
        execute format('drop policy if exists "own_select_%1$s" on public.%1$s;', t);
        execute format('drop policy if exists "own_insert_%1$s" on public.%1$s;', t);
        execute format('drop policy if exists "own_update_%1$s" on public.%1$s;', t);
        execute format('drop policy if exists "own_delete_%1$s" on public.%1$s;', t);
        execute format('create policy "own_select_%1$s" on public.%1$s for select using (auth.uid() = user_id);', t);
        execute format('create policy "own_insert_%1$s" on public.%1$s for insert with check (auth.uid() = user_id);', t);
        execute format('create policy "own_update_%1$s" on public.%1$s for update using (auth.uid() = user_id);', t);
        execute format('create policy "own_delete_%1$s" on public.%1$s for delete using (auth.uid() = user_id);', t);
    end loop;
end $$;

-- Public-read for exercises catalog
create policy "exercises_public_read" on public.exercises for select using (true);

-- ============================================================
-- SEED EXERCISES
-- ============================================================
insert into public.exercises (id, name, muscle, equipment, difficulty, instructions, video_url) values
('ex_pushup','Push-Up','Chest','Bodyweight','Beginner','Start in plank, lower chest, push back up.','https://www.youtube.com/embed/IODxDxX7oi4'),
('ex_squat','Bodyweight Squat','Legs','Bodyweight','Beginner','Lower hips back and down, drive up.','https://www.youtube.com/embed/aclHkVaku9U'),
('ex_bench','Barbell Bench Press','Chest','Barbell','Intermediate','Lower bar to chest, press up.','https://www.youtube.com/embed/rT7DgCr-3pg'),
('ex_deadlift','Deadlift','Back','Barbell','Advanced','Hinge at hips, drive through heels to stand.','https://www.youtube.com/embed/op9kVnSso6Q'),
('ex_bsquat','Barbell Back Squat','Legs','Barbell','Intermediate','Bar across upper back, squat, drive up.','https://www.youtube.com/embed/ultWZbUMPL8'),
('ex_ohp','Overhead Press','Shoulders','Barbell','Intermediate','Press bar overhead.','https://www.youtube.com/embed/2yjwXTZQDDI'),
('ex_row','Barbell Row','Back','Barbell','Intermediate','Hinge forward, row to lower chest.','https://www.youtube.com/embed/9efgcAjQe7E'),
('ex_pullup','Pull-Up','Back','Pull-up Bar','Intermediate','Pull chin above bar.','https://www.youtube.com/embed/eGo4IYlbE5g'),
('ex_lunge','Walking Lunge','Legs','Bodyweight','Beginner','Step into lunge, alternate legs.','https://www.youtube.com/embed/L8fvypPrzzs'),
('ex_plank','Plank','Core','Bodyweight','Beginner','Hold forearm plank, body straight.','https://www.youtube.com/embed/ASdvN_XEl_c'),
('ex_dbcurl','Dumbbell Bicep Curl','Arms','Dumbbell','Beginner','Curl dumbbells to shoulders.','https://www.youtube.com/embed/ykJmrZ5v0Oo'),
('ex_dips','Tricep Dips','Arms','Bodyweight','Intermediate','Lower body, push up.','https://www.youtube.com/embed/6kALZikXxLc'),
('ex_lat_pd','Lat Pulldown','Back','Cable','Beginner','Pull bar to upper chest.','https://www.youtube.com/embed/CAwf7n6Luuc'),
('ex_legpress','Leg Press','Legs','Machine','Beginner','Press platform with legs.','https://www.youtube.com/embed/IZxyjW7MPJQ'),
('ex_burpee','Burpee','Full Body','Bodyweight','Intermediate','Squat, plank, push-up, jump.','https://www.youtube.com/embed/auBLPXO8Fww')
on conflict (id) do nothing;

-- ============================================================
-- STORAGE BUCKET (run separately or via dashboard if needed)
-- ============================================================
-- In Supabase Dashboard → Storage, create bucket "progress-photos" (PUBLIC).
-- Or run:
-- insert into storage.buckets (id, name, public) values ('progress-photos','progress-photos', true) on conflict do nothing;
