import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Camera, RefreshCw, Apple, Plus } from "lucide-react";
import { toast } from "sonner";

export default function Diet() {
    const [plan, setPlan] = useState(null);
    const [meals, setMeals] = useState([]);
    const [regen, setRegen] = useState(false);

    const load = async () => {
        try {
            const [p, m] = await Promise.all([api.get("/diet-plan"), api.get("/meals?days=1")]);
            setPlan(p.data); setMeals(m.data);
        } catch { setPlan(false); }
    };
    useEffect(() => { load(); }, []);

    const regenerate = async () => {
        setRegen(true);
        try { const { data } = await api.post("/diet-plan/regenerate"); setPlan(data); toast.success("Diet refreshed!"); }
        catch { toast.error("Failed"); } finally { setRegen(false); }
    };

    const logMealFromPlan = async (m) => {
        try {
            await api.post("/meals", { meal_type: m.meal_type, name: m.name, calories: m.calories, protein_g: m.protein_g, carbs_g: m.carbs_g, fats_g: m.fats_g });
            toast.success(`Logged: ${m.name}`); load();
        } catch { toast.error("Failed"); }
    };

    const todayCals = meals.reduce((a, m) => a + (m.calories || 0), 0);
    const todayP = meals.reduce((a, m) => a + (m.protein_g || 0), 0);
    const todayC = meals.reduce((a, m) => a + (m.carbs_g || 0), 0);
    const todayF = meals.reduce((a, m) => a + (m.fats_g || 0), 0);

    if (plan === null) return <div className="p-6 text-zinc-400">Loading diet…</div>;
    if (!plan) return <div className="p-6">No plan. Complete onboarding.</div>;

    return (
        <div className="px-6 pt-10 pb-6">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <span className="text-xs uppercase tracking-[0.3em] text-[#FF5722] font-bold">Indian Diet</span>
                    <h1 className="brand-heading text-4xl mt-1">Today's Plate</h1>
                </div>
                <Button data-testid="regen-diet" onClick={regenerate} disabled={regen} variant="outline" size="sm" className="bg-transparent border-zinc-700 hover:bg-zinc-900">
                    <RefreshCw className={`w-4 h-4 ${regen ? "animate-spin" : ""}`} />
                </Button>
            </div>

            {/* Macro bento */}
            <div className="grid grid-cols-4 gap-2 mb-5">
                <Macro label="Cal" v={Math.round(todayCals)} t={plan.daily_calories} color="#FF5722" tid="macro-cal" />
                <Macro label="Pro" v={Math.round(todayP)} t={plan.protein_g} color="#00E5FF" unit="g" tid="macro-pro" />
                <Macro label="Carb" v={Math.round(todayC)} t={plan.carbs_g} color="#10B981" unit="g" tid="macro-carb" />
                <Macro label="Fat" v={Math.round(todayF)} t={plan.fats_g} color="#F59E0B" unit="g" tid="macro-fat" />
            </div>

            <Link to="/food-scanner" data-testid="scan-link"
                className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-[#FF5722]/50 rounded-xl p-4 mb-6">
                <div className="w-10 h-10 rounded-lg bg-[#FF5722] flex items-center justify-center">
                    <Camera className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                    <p className="font-semibold">AI Food Scanner</p>
                    <p className="text-zinc-400 text-xs">Snap a photo to get instant nutrition</p>
                </div>
            </Link>

            <h3 className="brand-heading text-xl mb-3">Your Meals</h3>
            <div className="space-y-3 mb-6">
                {plan.meals?.map((m, i) => (
                    <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4" data-testid={`meal-${i}`}>
                        <div className="flex justify-between items-start mb-1">
                            <div>
                                <span className="text-xs uppercase tracking-wider text-zinc-500">{m.meal_type}</span>
                                <h4 className="brand-heading text-xl">{m.name}</h4>
                            </div>
                            <Button size="sm" data-testid={`log-meal-${i}`} onClick={() => logMealFromPlan(m)} className="bg-[#FF5722] hover:bg-[#E64A19] h-8">
                                <Plus className="w-3.5 h-3.5 mr-1" /> Log
                            </Button>
                        </div>
                        <p className="text-zinc-400 text-sm mb-2">{(m.items || []).join(" · ")}</p>
                        <div className="flex gap-3 text-xs text-zinc-400">
                            <span><b className="text-white">{m.calories}</b> kcal</span>
                            <span>P: <b className="text-white">{m.protein_g}g</b></span>
                            <span>C: <b className="text-white">{m.carbs_g}g</b></span>
                            <span>F: <b className="text-white">{m.fats_g}g</b></span>
                        </div>
                    </div>
                ))}
            </div>

            <h3 className="brand-heading text-xl mb-3">Logged Today</h3>
            {meals.length === 0 ? <p className="text-zinc-500 text-sm">Nothing logged yet.</p> : (
                <div className="space-y-2">
                    {meals.map((m, i) => (
                        <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex justify-between text-sm">
                            <div>
                                <p className="font-semibold">{m.name}</p>
                                <p className="text-zinc-500 text-xs">{m.meal_type}</p>
                            </div>
                            <span className="text-zinc-400">{Math.round(m.calories)} kcal</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const Macro = ({ label, v, t, color, unit = "", tid }) => {
    const pct = Math.min(100, (v / Math.max(1, t)) * 100);
    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3" data-testid={tid}>
            <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
            <p className="brand-heading text-xl mt-1">{v}<span className="text-xs text-zinc-500">{unit}</span></p>
            <p className="text-xs text-zinc-500">/ {t}{unit}</p>
            <div className="h-1 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
            </div>
        </div>
    );
};
