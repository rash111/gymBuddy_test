import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth, formatErr } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { ChevronRight, Loader2 } from "lucide-react";

const goals = [
    { v: "lose_fat", l: "Lose Fat" },
    { v: "build_muscle", l: "Build Muscle" },
    { v: "strength", l: "Get Stronger" },
    { v: "endurance", l: "Endurance" },
    { v: "maintain", l: "Maintain" },
];
const levels = [{ v: "beginner", l: "Beginner" }, { v: "intermediate", l: "Intermediate" }, { v: "advanced", l: "Advanced" }];
const locations = [{ v: "home", l: "Home" }, { v: "gym", l: "Gym" }, { v: "both", l: "Both" }];
const diets = [{ v: "veg", l: "Vegetarian" }, { v: "non_veg", l: "Non-Veg" }, { v: "vegan", l: "Vegan" }, { v: "eggetarian", l: "Eggetarian" }];
const equipmentList = ["Dumbbells", "Barbell", "Pull-up Bar", "Bench", "Resistance Bands", "Kettlebell", "Treadmill", "Cable Machine"];

export default function Onboarding() {
    const [step, setStep] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const { setUser } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({
        age: 25, gender: "male", height_cm: 175, weight_kg: 70,
        goal: "build_muscle", fitness_level: "beginner", workouts_per_week: 4,
        workout_location: "gym", equipment: [], diet_preference: "veg",
    });

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const toggleEq = (e) => set("equipment", form.equipment.includes(e) ? form.equipment.filter((x) => x !== e) : [...form.equipment, e]);

    const submit = async () => {
        setSubmitting(true);
        try {
            const { data } = await api.post("/onboarding", form);
            setUser((u) => ({ ...u, onboarded: true, profile: data.profile }));
            try { window.localStorage.setItem("gb_onboarded", "1"); } catch { /* noop */ }
            toast.success("Plan ready! Let's train.");
            navigate("/dashboard");
        } catch (e) {
            toast.error(formatErr(e));
        } finally {
            setSubmitting(false);
        }
    };

    const next = () => setStep((s) => Math.min(s + 1, 4));
    const back = () => setStep((s) => Math.max(s - 1, 0));

    return (
        <div className="min-h-screen bg-zinc-950 text-white px-6 py-10">
            <div className="max-w-md mx-auto md:max-w-xl">
                <div className="flex items-center gap-1 mb-8">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-[#FF5722]" : "bg-zinc-800"}`} />
                    ))}
                </div>
                <span className="text-xs uppercase tracking-[0.3em] text-[#FF5722] font-bold">Step {step + 1} of 5</span>

                {step === 0 && (
                    <div className="animate-fade-in-up">
                        <h1 className="brand-heading text-4xl mt-3 mb-2">About You</h1>
                        <p className="text-zinc-400 mb-6">Help us tailor your plan</p>
                        <div className="space-y-4">
                            <Row label="Age"><Input data-testid="ob-age" type="number" value={form.age} onChange={(e) => set("age", +e.target.value)} className="bg-zinc-900 border-zinc-800 h-12" /></Row>
                            <Row label="Gender">
                                <SegmentedGroup value={form.gender} onChange={(v) => set("gender", v)}
                                    options={[{ v: "male", l: "Male" }, { v: "female", l: "Female" }, { v: "other", l: "Other" }]} testid="ob-gender" />
                            </Row>
                            <Row label="Height (cm)"><Input data-testid="ob-height" type="number" value={form.height_cm} onChange={(e) => set("height_cm", +e.target.value)} className="bg-zinc-900 border-zinc-800 h-12" /></Row>
                            <Row label="Weight (kg)"><Input data-testid="ob-weight" type="number" value={form.weight_kg} onChange={(e) => set("weight_kg", +e.target.value)} className="bg-zinc-900 border-zinc-800 h-12" /></Row>
                        </div>
                    </div>
                )}

                {step === 1 && (
                    <div className="animate-fade-in-up">
                        <h1 className="brand-heading text-4xl mt-3 mb-2">Your Goal</h1>
                        <p className="text-zinc-400 mb-6">Pick one to focus on</p>
                        <div className="grid grid-cols-2 gap-3">
                            {goals.map((g) => (
                                <button key={g.v} data-testid={`ob-goal-${g.v}`} onClick={() => set("goal", g.v)}
                                    className={`p-4 rounded-xl border text-left ${form.goal === g.v ? "border-[#FF5722] bg-zinc-900" : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"}`}>
                                    <span className="brand-heading text-xl">{g.l}</span>
                                </button>
                            ))}
                        </div>
                        <div className="mt-6">
                            <Row label="Experience">
                                <SegmentedGroup value={form.fitness_level} onChange={(v) => set("fitness_level", v)} options={levels} testid="ob-level" />
                            </Row>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="animate-fade-in-up">
                        <h1 className="brand-heading text-4xl mt-3 mb-2">Training Setup</h1>
                        <p className="text-zinc-400 mb-6">Where and how often will you train?</p>
                        <Row label="Workouts per week">
                            <div className="flex gap-2 flex-wrap">
                                {[2, 3, 4, 5, 6].map((n) => (
                                    <button key={n} data-testid={`ob-freq-${n}`} onClick={() => set("workouts_per_week", n)}
                                        className={`w-12 h-12 rounded-lg font-bold border ${form.workouts_per_week === n ? "border-[#FF5722] bg-[#FF5722]/10 text-[#FF5722]" : "border-zinc-800 bg-zinc-900 text-zinc-300"}`}>
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </Row>
                        <Row label="Location">
                            <SegmentedGroup value={form.workout_location} onChange={(v) => set("workout_location", v)} options={locations} testid="ob-location" />
                        </Row>
                    </div>
                )}

                {step === 3 && (
                    <div className="animate-fade-in-up">
                        <h1 className="brand-heading text-4xl mt-3 mb-2">Equipment</h1>
                        <p className="text-zinc-400 mb-6">Tap what you have access to (optional)</p>
                        <div className="grid grid-cols-2 gap-2">
                            {equipmentList.map((e) => (
                                <button key={e} data-testid={`ob-eq-${e.replace(/\s/g, "-").toLowerCase()}`} onClick={() => toggleEq(e)}
                                    className={`p-3 rounded-lg border text-sm font-medium ${form.equipment.includes(e) ? "border-[#FF5722] bg-[#FF5722]/10 text-white" : "border-zinc-800 bg-zinc-900 text-zinc-300"}`}>
                                    {e}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <div className="animate-fade-in-up">
                        <h1 className="brand-heading text-4xl mt-3 mb-2">Diet Preference</h1>
                        <p className="text-zinc-400 mb-6">For your personalized Indian meal plan</p>
                        <div className="grid grid-cols-2 gap-3">
                            {diets.map((d) => (
                                <button key={d.v} data-testid={`ob-diet-${d.v}`} onClick={() => set("diet_preference", d.v)}
                                    className={`p-4 rounded-xl border text-left ${form.diet_preference === d.v ? "border-[#FF5722] bg-zinc-900" : "border-zinc-800 bg-zinc-900/50"}`}>
                                    <span className="brand-heading text-xl">{d.l}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex gap-3 mt-10">
                    {step > 0 && (
                        <Button data-testid="ob-back" variant="outline" onClick={back} className="flex-1 h-12 bg-transparent border-zinc-700 text-white hover:bg-zinc-900">Back</Button>
                    )}
                    {step < 4 ? (
                        <Button data-testid="ob-next" onClick={next} className="flex-1 h-12 bg-[#FF5722] hover:bg-[#E64A19] font-bold uppercase">
                            Continue <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    ) : (
                        <Button data-testid="ob-finish" onClick={submit} disabled={submitting}
                            className="flex-1 h-12 bg-[#FF5722] hover:bg-[#E64A19] font-bold uppercase">
                            {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating plan…</> : "Generate My Plan"}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

const Row = ({ label, children }) => (
    <div>
        <Label className="text-zinc-300 text-xs uppercase tracking-wider">{label}</Label>
        <div className="mt-2">{children}</div>
    </div>
);

const SegmentedGroup = ({ value, onChange, options, testid }) => (
    <div className="flex gap-2 flex-wrap">
        {options.map((o) => (
            <button key={o.v} data-testid={`${testid}-${o.v}`} type="button" onClick={() => onChange(o.v)}
                className={`px-4 h-12 rounded-lg font-medium border ${value === o.v ? "border-[#FF5722] bg-[#FF5722]/10 text-[#FF5722]" : "border-zinc-800 bg-zinc-900 text-zinc-300"}`}>
                {o.l}
            </button>
        ))}
    </div>
);
