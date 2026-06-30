# GymBuddy - PRD

## Original Problem Statement
Build GymBuddy: a comprehensive AI-powered Indian fitness app covering 10 phases (62 prompts).
Core: AI workout planning, today's workout tracking, exercise library, progress dashboard, Indian diet plan, AI food scanner, AI coach, progressive overload, equipment profiles, streak/consistency.

## Tech Stack
- Backend: FastAPI + MongoDB + Motor
- Frontend: React 19 + Tailwind + shadcn/ui + Recharts
- AI: GPT-4.1-mini via Emergent Universal LLM Key (emergentintegrations)
- Auth: JWT email/password (bcrypt + PyJWT)
- Storage: Emergent object storage (progress photos, food scanner)

## User Personas
- Beginner Indian gym-goer (home or gym) wanting structured plans + diet
- Intermediate lifter tracking progressive overload and macros
- Vegetarian/vegan users needing localized Indian diet plans

## Core Requirements (Static)
- Onboarding wizard (5 steps): personal, goal, schedule, equipment, diet
- AI-generated weekly workout plan (7 days, customized to equipment/goal/level)
- AI-generated Indian diet plan (Veg/Non-Veg/Vegan/Eggetarian)
- Workout session tracker (per-set weight/reps logging)
- Exercise library with embedded form videos
- Progress: weight chart, measurements, photos (object storage), strength chart per exercise, consistency score
- Meal logging + AI food image scanner (vision model nutrition estimate)
- AI Coach chat with persona-aware system prompt
- Streak system updated on workout log
- JWT-protected mobile-first UI with bottom nav

## What's Been Implemented (June 2026)
### Backend (server.py, 26 endpoints, 100% test pass)
- Auth: /register, /login, /logout, /me (JWT + cookie)
- Onboarding: /onboarding (generates workout + diet plans)
- Plans: /workout-plan, /workout-plan/regenerate, /diet-plan, /diet-plan/regenerate
- Exercises: /exercises (15 seeded), /exercises/{id}
- Sessions: /workout-sessions (POST/GET/recent) with streak update
- Progress: /progress/weight, /progress/measurements, /progress/photos (multipart), /progress/strength, /progress/consistency
- Files: /files/{path}?auth= (serves uploaded photos)
- Diet: /meals (POST/GET), /diet-plan
- AI: /food-scan (image vision), /coach/message, /coach/history
- Dashboard: /dashboard (aggregated home view)

### Frontend (mobile-first, dark "Performance Pro" theme)
- Pages: Welcome, Login, Register, Onboarding(5-step wizard), Dashboard, TodayWorkout, WorkoutSession (set tracker w/ live timer), WorkoutSummary, WeeklyPlan, ExerciseLibrary, ExerciseDetail (video), Progress (4 tabs: Weight/Body/Strength/Photos), Diet (macro bento + meals), FoodScanner, AICoach (chat), Profile
- Components: Layout w/ glass bottom nav, ProtectedRoute, AuthContext
- Recharts strength + weight line charts
- Sonner toasts, shadcn UI components

## Backlog / Next Phases
### P1 (next iteration)
- Phase 7: Push notifications, accountability partner, structured streak badges
- Phase 8: Settings page, subscription tier placeholder, data export/CSV
- Phase 9: Polish design system, custom icons, animations library expansion
- Phase 10: Analytics dashboard, error boundary, performance optimization, deployment hardening

### P2 (future)
- Adaptive weekly planning based on completed sessions
- Smart exercise substitution when equipment unavailable
- Restart Mode (deload protocols)
- Progressive overload automation (auto bump weight after N consecutive sessions)
- Social sharing / leaderboard

## Test Credentials
- Admin: admin@gymbuddy.app / admin123
- Test user: register fresh via UI/API
