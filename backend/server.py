from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import bcrypt
import jwt
import logging
import asyncio
import requests
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal, Any, Dict

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Depends, Query, Header
from fastapi.responses import StreamingResponse, Response as FastResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone, ImageContent

# ===== CONFIG =====
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = os.environ.get("APP_NAME", "gymbuddy")
LLM_MODEL = ("openai", "gpt-4.1-mini")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gymbuddy")

app = FastAPI(title="GymBuddy API")
api = APIRouter(prefix="/api")

# ===== UTILS =====
def now_iso():
    return datetime.now(timezone.utc).isoformat()

def gen_id():
    return str(uuid.uuid4())

def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_token(user_id: str, ttl_minutes: int = 60 * 24 * 7) -> str:
    return jwt.encode({
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes),
        "type": "access",
    }, JWT_SECRET, algorithm=JWT_ALG)

async def get_current_user(request: Request) -> dict:
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ===== STORAGE =====
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
storage_key = None
def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        r.raise_for_status()
        storage_key = r.json()["storage_key"]
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        storage_key = None
    return storage_key

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(500, "Storage unavailable")
    r = requests.put(f"{STORAGE_URL}/objects/{path}",
                     headers={"X-Storage-Key": key, "Content-Type": content_type},
                     data=data, timeout=120)
    r.raise_for_status()
    return r.json()

def get_object(path: str):
    key = init_storage()
    if not key:
        raise HTTPException(500, "Storage unavailable")
    r = requests.get(f"{STORAGE_URL}/objects/{path}",
                     headers={"X-Storage-Key": key}, timeout=60)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")

# ===== MODELS =====
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class OnboardingIn(BaseModel):
    age: int
    gender: str  # male/female/other
    height_cm: float
    weight_kg: float
    goal: str  # lose_fat / build_muscle / maintain / strength / endurance
    fitness_level: str  # beginner / intermediate / advanced
    workouts_per_week: int
    workout_location: str  # home / gym / both
    equipment: List[str] = []
    diet_preference: str  # veg / non_veg / vegan / eggetarian
    target_calories: Optional[int] = None
    medical_notes: Optional[str] = ""

class WorkoutLogSet(BaseModel):
    set_number: int
    reps: int
    weight_kg: float = 0
    completed: bool = True

class WorkoutLogExerciseIn(BaseModel):
    exercise_id: str
    exercise_name: str
    sets: List[WorkoutLogSet]
    notes: Optional[str] = ""

class WorkoutSessionIn(BaseModel):
    plan_day_index: int
    duration_minutes: int
    exercises: List[WorkoutLogExerciseIn]
    rating: Optional[int] = 0
    notes: Optional[str] = ""

class WeightEntryIn(BaseModel):
    weight_kg: float
    note: Optional[str] = ""

class MeasurementIn(BaseModel):
    chest_cm: Optional[float] = None
    waist_cm: Optional[float] = None
    hips_cm: Optional[float] = None
    arm_cm: Optional[float] = None
    thigh_cm: Optional[float] = None
    note: Optional[str] = ""

class MealLogIn(BaseModel):
    meal_type: str  # breakfast/lunch/dinner/snack
    name: str
    calories: float
    protein_g: float = 0
    carbs_g: float = 0
    fats_g: float = 0
    notes: Optional[str] = ""

class CoachMessageIn(BaseModel):
    message: str
    session_id: Optional[str] = None

# ===== EXERCISE SEED =====
EXERCISE_SEED = [
    {"id": "ex_pushup", "name": "Push-Up", "muscle": "Chest", "equipment": "Bodyweight", "difficulty": "Beginner", "instructions": "Start in plank, lower chest to floor, push back up.", "video_url": "https://www.youtube.com/embed/IODxDxX7oi4"},
    {"id": "ex_squat", "name": "Bodyweight Squat", "muscle": "Legs", "equipment": "Bodyweight", "difficulty": "Beginner", "instructions": "Feet shoulder-width, lower hips back and down, drive up.", "video_url": "https://www.youtube.com/embed/aclHkVaku9U"},
    {"id": "ex_bench", "name": "Barbell Bench Press", "muscle": "Chest", "equipment": "Barbell", "difficulty": "Intermediate", "instructions": "Lie on bench, lower bar to chest, press up.", "video_url": "https://www.youtube.com/embed/rT7DgCr-3pg"},
    {"id": "ex_deadlift", "name": "Deadlift", "muscle": "Back", "equipment": "Barbell", "difficulty": "Advanced", "instructions": "Hinge at hips, grip bar, drive through heels to stand.", "video_url": "https://www.youtube.com/embed/op9kVnSso6Q"},
    {"id": "ex_bsquat", "name": "Barbell Back Squat", "muscle": "Legs", "equipment": "Barbell", "difficulty": "Intermediate", "instructions": "Bar across upper back, squat down, drive up.", "video_url": "https://www.youtube.com/embed/ultWZbUMPL8"},
    {"id": "ex_ohp", "name": "Overhead Press", "muscle": "Shoulders", "equipment": "Barbell", "difficulty": "Intermediate", "instructions": "Press bar overhead from shoulders.", "video_url": "https://www.youtube.com/embed/2yjwXTZQDDI"},
    {"id": "ex_row", "name": "Barbell Row", "muscle": "Back", "equipment": "Barbell", "difficulty": "Intermediate", "instructions": "Hinge forward, row bar to lower chest.", "video_url": "https://www.youtube.com/embed/9efgcAjQe7E"},
    {"id": "ex_pullup", "name": "Pull-Up", "muscle": "Back", "equipment": "Pull-up Bar", "difficulty": "Intermediate", "instructions": "Grip bar overhand, pull chin above bar.", "video_url": "https://www.youtube.com/embed/eGo4IYlbE5g"},
    {"id": "ex_lunge", "name": "Walking Lunge", "muscle": "Legs", "equipment": "Bodyweight", "difficulty": "Beginner", "instructions": "Step forward into lunge, alternate legs.", "video_url": "https://www.youtube.com/embed/L8fvypPrzzs"},
    {"id": "ex_plank", "name": "Plank", "muscle": "Core", "equipment": "Bodyweight", "difficulty": "Beginner", "instructions": "Hold forearm plank, body straight.", "video_url": "https://www.youtube.com/embed/ASdvN_XEl_c"},
    {"id": "ex_dbcurl", "name": "Dumbbell Bicep Curl", "muscle": "Arms", "equipment": "Dumbbell", "difficulty": "Beginner", "instructions": "Curl dumbbells to shoulders.", "video_url": "https://www.youtube.com/embed/ykJmrZ5v0Oo"},
    {"id": "ex_dips", "name": "Tricep Dips", "muscle": "Arms", "equipment": "Bodyweight", "difficulty": "Intermediate", "instructions": "Lower body between parallel bars, push up.", "video_url": "https://www.youtube.com/embed/6kALZikXxLc"},
    {"id": "ex_lat_pd", "name": "Lat Pulldown", "muscle": "Back", "equipment": "Cable", "difficulty": "Beginner", "instructions": "Pull bar to upper chest.", "video_url": "https://www.youtube.com/embed/CAwf7n6Luuc"},
    {"id": "ex_legpress", "name": "Leg Press", "muscle": "Legs", "equipment": "Machine", "difficulty": "Beginner", "instructions": "Press platform away with legs.", "video_url": "https://www.youtube.com/embed/IZxyjW7MPJQ"},
    {"id": "ex_burpee", "name": "Burpee", "muscle": "Full Body", "equipment": "Bodyweight", "difficulty": "Intermediate", "instructions": "Squat, plank, push-up, jump.", "video_url": "https://www.youtube.com/embed/auBLPXO8Fww"},
]

# ===== STARTUP =====
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.workout_sessions.create_index([("user_id", 1), ("date", -1)])
    await db.meal_logs.create_index([("user_id", 1), ("date", -1)])
    await db.weight_entries.create_index([("user_id", 1), ("date", -1)])
    # seed exercises
    count = await db.exercises.count_documents({})
    if count == 0:
        for ex in EXERCISE_SEED:
            await db.exercises.insert_one({**ex, "created_at": now_iso()})
    # seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@gymbuddy.app")
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": gen_id(), "email": admin_email, "name": "Admin",
            "password_hash": hash_pw(admin_pw), "role": "admin",
            "onboarded": False, "created_at": now_iso(),
        })
    init_storage()
    logger.info("Startup complete")

# ===== AUTH ENDPOINTS =====
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    user = {
        "id": gen_id(), "email": email, "name": body.name,
        "password_hash": hash_pw(body.password), "role": "user",
        "onboarded": False, "created_at": now_iso(),
        "streak": 0, "last_workout_date": None,
    }
    await db.users.insert_one(user)
    token = create_token(user["id"])
    response.set_cookie("access_token", token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"user": user, "token": token}

@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_pw(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_token(user["id"])
    response.set_cookie("access_token", token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"user": user, "token": token}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

# ===== ONBOARDING / PROFILE =====
@api.post("/onboarding")
async def submit_onboarding(body: OnboardingIn, user: dict = Depends(get_current_user)):
    profile = body.model_dump()
    profile["updated_at"] = now_iso()
    await db.users.update_one({"id": user["id"]}, {"$set": {"profile": profile, "onboarded": True}})
    # Auto generate workout plan and diet plan
    plan = await generate_workout_plan_for_user(user["id"], profile)
    diet = await generate_diet_plan_for_user(user["id"], profile)
    return {"profile": profile, "workout_plan": plan, "diet_plan": diet}

@api.get("/profile")
async def get_profile(user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return full

# ===== AI HELPERS =====
def make_chat(session_id: str, system: str) -> LlmChat:
    return LlmChat(api_key=EMERGENT_KEY, session_id=session_id, system_message=system).with_model(*LLM_MODEL)

async def ai_call(session_id: str, system: str, user_text: str, image_b64: Optional[str] = None) -> str:
    chat = make_chat(session_id, system)
    if image_b64:
        msg = UserMessage(text=user_text, file_contents=[ImageContent(image_base64=image_b64)])
    else:
        msg = UserMessage(text=user_text)
    out = []
    async for ev in chat.stream_message(msg):
        if isinstance(ev, TextDelta):
            out.append(ev.content)
        elif isinstance(ev, StreamDone):
            break
    return "".join(out)

# ===== WORKOUT PLAN GENERATION =====
async def generate_workout_plan_for_user(user_id: str, profile: dict) -> dict:
    import json
    system = (
        "You are an expert fitness coach. Generate a structured weekly workout plan as JSON only, no prose. "
        "Use exercises from this list (use exact ids and names): " +
        ", ".join([f"{e['id']}:{e['name']}" for e in EXERCISE_SEED]) +
        ". Return JSON: {\"days\":[{\"day\":\"Monday\",\"focus\":\"Push\",\"exercises\":[{\"exercise_id\":\"ex_bench\",\"name\":\"Barbell Bench Press\",\"sets\":4,\"reps\":\"8-10\",\"rest_sec\":90}]}]} . "
        "Include 'Rest' day entries with empty exercises list. Match number of training days to workouts_per_week."
    )
    prompt = (
        f"Profile: age={profile['age']} gender={profile['gender']} weight={profile['weight_kg']}kg height={profile['height_cm']}cm "
        f"goal={profile['goal']} level={profile['fitness_level']} workouts_per_week={profile['workouts_per_week']} "
        f"location={profile['workout_location']} equipment={profile.get('equipment', [])}. "
        f"Output JSON only."
    )
    try:
        raw = await ai_call(f"plan_{user_id}", system, prompt)
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.strip("`")
            if raw.startswith("json"):
                raw = raw[4:]
        plan_data = json.loads(raw)
    except Exception as e:
        logger.warning(f"AI plan failed, using fallback: {e}")
        plan_data = fallback_workout_plan(profile)
    plan = {
        "id": gen_id(), "user_id": user_id,
        "days": plan_data.get("days", []),
        "created_at": now_iso(), "active": True,
    }
    await db.workout_plans.update_many({"user_id": user_id, "active": True}, {"$set": {"active": False}})
    await db.workout_plans.insert_one(plan)
    plan.pop("_id", None)
    return plan

def fallback_workout_plan(profile: dict) -> dict:
    days_count = max(3, min(6, profile.get("workouts_per_week", 4)))
    templates = [
        {"day": "Monday", "focus": "Push", "exercises": [
            {"exercise_id": "ex_bench", "name": "Barbell Bench Press", "sets": 4, "reps": "8-10", "rest_sec": 90},
            {"exercise_id": "ex_ohp", "name": "Overhead Press", "sets": 3, "reps": "8-10", "rest_sec": 90},
            {"exercise_id": "ex_pushup", "name": "Push-Up", "sets": 3, "reps": "12-15", "rest_sec": 60},
            {"exercise_id": "ex_dips", "name": "Tricep Dips", "sets": 3, "reps": "10-12", "rest_sec": 60},
        ]},
        {"day": "Tuesday", "focus": "Pull", "exercises": [
            {"exercise_id": "ex_deadlift", "name": "Deadlift", "sets": 4, "reps": "5-6", "rest_sec": 120},
            {"exercise_id": "ex_row", "name": "Barbell Row", "sets": 4, "reps": "8-10", "rest_sec": 90},
            {"exercise_id": "ex_pullup", "name": "Pull-Up", "sets": 3, "reps": "6-10", "rest_sec": 90},
            {"exercise_id": "ex_dbcurl", "name": "Dumbbell Bicep Curl", "sets": 3, "reps": "10-12", "rest_sec": 60},
        ]},
        {"day": "Wednesday", "focus": "Legs", "exercises": [
            {"exercise_id": "ex_bsquat", "name": "Barbell Back Squat", "sets": 4, "reps": "8-10", "rest_sec": 120},
            {"exercise_id": "ex_legpress", "name": "Leg Press", "sets": 3, "reps": "10-12", "rest_sec": 90},
            {"exercise_id": "ex_lunge", "name": "Walking Lunge", "sets": 3, "reps": "12-15", "rest_sec": 60},
        ]},
        {"day": "Thursday", "focus": "Rest", "exercises": []},
        {"day": "Friday", "focus": "Full Body", "exercises": [
            {"exercise_id": "ex_squat", "name": "Bodyweight Squat", "sets": 3, "reps": "15", "rest_sec": 45},
            {"exercise_id": "ex_pushup", "name": "Push-Up", "sets": 3, "reps": "12", "rest_sec": 45},
            {"exercise_id": "ex_plank", "name": "Plank", "sets": 3, "reps": "45s", "rest_sec": 45},
            {"exercise_id": "ex_burpee", "name": "Burpee", "sets": 3, "reps": "10", "rest_sec": 60},
        ]},
        {"day": "Saturday", "focus": "Core + Cardio", "exercises": [
            {"exercise_id": "ex_plank", "name": "Plank", "sets": 4, "reps": "60s", "rest_sec": 45},
            {"exercise_id": "ex_burpee", "name": "Burpee", "sets": 4, "reps": "12", "rest_sec": 45},
        ]},
        {"day": "Sunday", "focus": "Rest", "exercises": []},
    ]
    return {"days": templates}

# ===== DIET PLAN =====
async def generate_diet_plan_for_user(user_id: str, profile: dict) -> dict:
    import json
    system = (
        "You are an Indian nutrition expert. Generate an Indian diet plan tailored to the user's preference. "
        "Return JSON ONLY: {\"daily_calories\":2200,\"protein_g\":140,\"carbs_g\":240,\"fats_g\":70,"
        "\"meals\":[{\"meal_type\":\"Breakfast\",\"name\":\"Moong Dal Cheela with Curd\",\"calories\":450,\"protein_g\":22,\"carbs_g\":55,\"fats_g\":12,\"items\":[\"2 cheelas\",\"1 cup curd\"]}]}. "
        "Use Indian foods (dal, sabzi, roti, paneer, idli, etc). 4 meals: Breakfast, Lunch, Snack, Dinner."
    )
    prompt = (
        f"User: weight={profile['weight_kg']}kg height={profile['height_cm']}cm age={profile['age']} "
        f"gender={profile['gender']} goal={profile['goal']} diet_preference={profile['diet_preference']} "
        f"target_calories={profile.get('target_calories') or 'auto'}. Output JSON only."
    )
    try:
        raw = await ai_call(f"diet_{user_id}", system, prompt)
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.strip("`")
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw)
    except Exception as e:
        logger.warning(f"AI diet failed, fallback: {e}")
        data = fallback_diet_plan(profile)
    plan = {"id": gen_id(), "user_id": user_id, **data, "created_at": now_iso(), "active": True}
    await db.diet_plans.update_many({"user_id": user_id, "active": True}, {"$set": {"active": False}})
    await db.diet_plans.insert_one(plan)
    plan.pop("_id", None)
    return plan

def fallback_diet_plan(profile: dict):
    veg = profile.get("diet_preference", "veg") in ("veg", "vegan", "eggetarian")
    return {
        "daily_calories": 2200, "protein_g": 140, "carbs_g": 240, "fats_g": 70,
        "meals": [
            {"meal_type": "Breakfast", "name": "Moong Dal Cheela + Curd", "calories": 450, "protein_g": 22, "carbs_g": 55, "fats_g": 12, "items": ["2 cheelas", "1 bowl curd", "Mint chutney"]},
            {"meal_type": "Lunch", "name": "Rajma Chawal + Salad" if veg else "Chicken Curry + Roti", "calories": 650, "protein_g": 35, "carbs_g": 80, "fats_g": 18, "items": ["1 bowl rajma", "1 cup rice", "Cucumber salad"] if veg else ["150g chicken curry", "3 rotis", "Salad"]},
            {"meal_type": "Snack", "name": "Sprouts Chaat + Buttermilk", "calories": 300, "protein_g": 18, "carbs_g": 35, "fats_g": 6, "items": ["1 bowl sprouts", "1 glass buttermilk"]},
            {"meal_type": "Dinner", "name": "Paneer Bhurji + 2 Rotis" if veg else "Grilled Fish + Veg", "calories": 600, "protein_g": 38, "carbs_g": 50, "fats_g": 22, "items": ["120g paneer", "2 rotis", "Sabzi"] if veg else ["150g fish", "Mixed veg", "1 roti"]},
        ],
    }

# ===== WORKOUT PLAN ENDPOINTS =====
@api.get("/workout-plan")
async def get_plan(user: dict = Depends(get_current_user)):
    plan = await db.workout_plans.find_one({"user_id": user["id"], "active": True}, {"_id": 0})
    if not plan:
        raise HTTPException(404, "No active plan")
    return plan

@api.post("/workout-plan/regenerate")
async def regen_plan(user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if not full.get("profile"):
        raise HTTPException(400, "Complete onboarding first")
    plan = await generate_workout_plan_for_user(user["id"], full["profile"])
    return plan

@api.get("/exercises")
async def list_exercises(muscle: Optional[str] = None, equipment: Optional[str] = None):
    q = {}
    if muscle:
        q["muscle"] = muscle
    if equipment:
        q["equipment"] = equipment
    items = await db.exercises.find(q, {"_id": 0}).to_list(200)
    return items

@api.get("/exercises/{exercise_id}")
async def get_exercise(exercise_id: str):
    ex = await db.exercises.find_one({"id": exercise_id}, {"_id": 0})
    if not ex:
        raise HTTPException(404, "Not found")
    return ex

# ===== WORKOUT SESSIONS =====
@api.post("/workout-sessions")
async def log_session(body: WorkoutSessionIn, user: dict = Depends(get_current_user)):
    session = {
        "id": gen_id(), "user_id": user["id"],
        "date": now_iso(), **body.model_dump(),
    }
    await db.workout_sessions.insert_one(session)
    # Update streak
    today = datetime.now(timezone.utc).date()
    full = await db.users.find_one({"id": user["id"]})
    last = full.get("last_workout_date")
    streak = full.get("streak", 0)
    if last:
        last_d = datetime.fromisoformat(last).date()
        if (today - last_d).days == 1:
            streak += 1
        elif (today - last_d).days == 0:
            pass
        else:
            streak = 1
    else:
        streak = 1
    await db.users.update_one({"id": user["id"]}, {"$set": {"streak": streak, "last_workout_date": today.isoformat()}})
    session.pop("_id", None)
    return {"session": session, "streak": streak}

@api.get("/workout-sessions")
async def list_sessions(limit: int = 50, user: dict = Depends(get_current_user)):
    items = await db.workout_sessions.find({"user_id": user["id"]}, {"_id": 0}).sort("date", -1).to_list(limit)
    return items

@api.get("/workout-sessions/recent")
async def recent_session(user: dict = Depends(get_current_user)):
    s = await db.workout_sessions.find_one({"user_id": user["id"]}, {"_id": 0}, sort=[("date", -1)])
    return s

# ===== PROGRESS: WEIGHT, MEASUREMENTS, PHOTOS =====
@api.post("/progress/weight")
async def log_weight(body: WeightEntryIn, user: dict = Depends(get_current_user)):
    entry = {"id": gen_id(), "user_id": user["id"], "date": now_iso(), **body.model_dump()}
    await db.weight_entries.insert_one(entry)
    entry.pop("_id", None)
    return entry

@api.get("/progress/weight")
async def get_weight(user: dict = Depends(get_current_user)):
    items = await db.weight_entries.find({"user_id": user["id"]}, {"_id": 0}).sort("date", -1).to_list(200)
    return items

@api.post("/progress/measurements")
async def log_measurement(body: MeasurementIn, user: dict = Depends(get_current_user)):
    entry = {"id": gen_id(), "user_id": user["id"], "date": now_iso(), **body.model_dump()}
    await db.measurements.insert_one(entry)
    entry.pop("_id", None)
    return entry

@api.get("/progress/measurements")
async def get_measurements(user: dict = Depends(get_current_user)):
    items = await db.measurements.find({"user_id": user["id"]}, {"_id": 0}).sort("date", -1).to_list(200)
    return items

@api.post("/progress/photos")
async def upload_photo(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = file.filename.split(".")[-1].lower() if "." in (file.filename or "") else "jpg"
    path = f"{APP_NAME}/photos/{user['id']}/{gen_id()}.{ext}"
    data = await file.read()
    ctype = file.content_type or "image/jpeg"
    result = put_object(path, data, ctype)
    record = {
        "id": gen_id(), "user_id": user["id"], "storage_path": result["path"],
        "content_type": ctype, "size": result.get("size", len(data)),
        "is_deleted": False, "date": now_iso(),
    }
    await db.progress_photos.insert_one(record)
    record.pop("_id", None)
    return record

@api.get("/progress/photos")
async def list_photos(user: dict = Depends(get_current_user)):
    items = await db.progress_photos.find({"user_id": user["id"], "is_deleted": False}, {"_id": 0}).sort("date", -1).to_list(200)
    return items

@api.get("/files/{path:path}")
async def serve_file(path: str, auth: Optional[str] = Query(None), authorization: Optional[str] = Header(None)):
    # Auth via header or query param
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif auth:
        token = auth
    if not token:
        raise HTTPException(401, "Auth required")
    try:
        jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(401, "Invalid token")
    record = await db.progress_photos.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(404, "Not found")
    data, ctype = get_object(path)
    return FastResponse(content=data, media_type=record.get("content_type", ctype))

@api.get("/progress/strength")
async def strength_progress(user: dict = Depends(get_current_user)):
    """Aggregate top weight per exercise per session."""
    sessions = await db.workout_sessions.find({"user_id": user["id"]}, {"_id": 0}).sort("date", 1).to_list(500)
    out: Dict[str, List[dict]] = {}
    for s in sessions:
        for ex in s.get("exercises", []):
            top = max((st.get("weight_kg", 0) for st in ex.get("sets", [])), default=0)
            if top <= 0:
                continue
            out.setdefault(ex["exercise_name"], []).append({"date": s["date"], "weight_kg": top})
    return out

@api.get("/progress/consistency")
async def consistency(user: dict = Depends(get_current_user)):
    """Workouts in last 28 days."""
    since = (datetime.now(timezone.utc) - timedelta(days=28)).isoformat()
    sessions = await db.workout_sessions.find({"user_id": user["id"], "date": {"$gte": since}}, {"_id": 0, "date": 1}).to_list(200)
    days_done = len(set(s["date"][:10] for s in sessions))
    full = await db.users.find_one({"id": user["id"]})
    target = (full.get("profile") or {}).get("workouts_per_week", 4) * 4
    score = min(100, int(round((days_done / max(1, target)) * 100)))
    return {"days_done": days_done, "target": target, "score": score, "streak": full.get("streak", 0)}

# ===== DIET =====
@api.get("/diet-plan")
async def get_diet(user: dict = Depends(get_current_user)):
    plan = await db.diet_plans.find_one({"user_id": user["id"], "active": True}, {"_id": 0})
    if not plan:
        raise HTTPException(404, "No active plan")
    return plan

@api.post("/diet-plan/regenerate")
async def regen_diet(user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]})
    if not full.get("profile"):
        raise HTTPException(400, "Complete onboarding first")
    return await generate_diet_plan_for_user(user["id"], full["profile"])

@api.post("/meals")
async def log_meal(body: MealLogIn, user: dict = Depends(get_current_user)):
    entry = {"id": gen_id(), "user_id": user["id"], "date": now_iso(), **body.model_dump()}
    await db.meal_logs.insert_one(entry)
    entry.pop("_id", None)
    return entry

@api.get("/meals")
async def list_meals(days: int = 7, user: dict = Depends(get_current_user)):
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    items = await db.meal_logs.find({"user_id": user["id"], "date": {"$gte": since}}, {"_id": 0}).sort("date", -1).to_list(500)
    return items

# ===== AI FOOD SCANNER =====
@api.post("/food-scan")
async def food_scan(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    import base64, json
    data = await file.read()
    b64 = base64.b64encode(data).decode()
    system = (
        "You are an Indian food nutrition expert. Analyze the food image and respond with JSON ONLY: "
        "{\"food_name\":\"...\",\"portion\":\"1 plate / 1 bowl\",\"calories\":350,\"protein_g\":20,\"carbs_g\":40,\"fats_g\":10,\"notes\":\"...\"}"
    )
    try:
        raw = await ai_call(f"food_{user['id']}_{gen_id()}", system, "Identify this Indian food and estimate nutrition.", image_b64=b64)
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.strip("`")
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw)
    except Exception as e:
        logger.warning(f"food scan failed: {e}")
        result = {"food_name": "Unknown", "portion": "1 serving", "calories": 0, "protein_g": 0, "carbs_g": 0, "fats_g": 0, "notes": "Could not analyze"}
    return result

# ===== AI COACH =====
@api.post("/coach/message")
async def coach_message(body: CoachMessageIn, user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]})
    profile = full.get("profile", {})
    session_id = body.session_id or f"coach_{user['id']}"
    system = (
        f"You are an expert Indian fitness coach for {full.get('name', 'the user')}. "
        f"User profile: goal={profile.get('goal')}, level={profile.get('fitness_level')}, "
        f"diet={profile.get('diet_preference')}. Be motivating, concise, give actionable advice. "
        f"Reference Indian food and gym context when relevant."
    )
    reply = await ai_call(session_id, system, body.message)
    msg = {"id": gen_id(), "user_id": user["id"], "session_id": session_id, "user_message": body.message, "ai_reply": reply, "date": now_iso()}
    await db.coach_messages.insert_one(msg)
    msg.pop("_id", None)
    return msg

@api.get("/coach/history")
async def coach_history(limit: int = 50, user: dict = Depends(get_current_user)):
    items = await db.coach_messages.find({"user_id": user["id"]}, {"_id": 0}).sort("date", 1).to_list(limit)
    return items

# ===== DASHBOARD SUMMARY =====
@api.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    plan = await db.workout_plans.find_one({"user_id": user["id"], "active": True}, {"_id": 0})
    today_idx = datetime.now(timezone.utc).weekday()
    today_day = None
    if plan and plan.get("days"):
        days = plan["days"]
        today_day = days[today_idx % len(days)]
    # Today's calories logged
    today_str = datetime.now(timezone.utc).date().isoformat()
    meals_today = await db.meal_logs.find({"user_id": user["id"], "date": {"$gte": today_str}}, {"_id": 0}).to_list(50)
    cal_today = sum(m.get("calories", 0) for m in meals_today)
    return {
        "user": full,
        "today_workout": today_day,
        "calories_today": cal_today,
        "meals_today": meals_today,
        "streak": full.get("streak", 0),
    }

# Mount router
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown():
    client.close()
