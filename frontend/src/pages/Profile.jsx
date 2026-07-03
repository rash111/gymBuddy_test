import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import BackButton from "../components/BackButton";
import {
    LogOut, Target, Activity, User as UserIcon, Ruler, Weight, Sigma,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// ---- BMI helpers ----
const computeBMI = (heightCm, weightKg) => {
    if (!heightCm || !weightKg) return null;
    const h = heightCm / 100;
    if (h <= 0) return null;
    return weightKg / (h * h);
};
const bmiCategory = (bmi) => {
    if (bmi === null || bmi === undefined || Number.isNaN(bmi)) return { label: "—", color: "text-zinc-400", tint: "bg-zinc-800 border-zinc-700" };
    if (bmi < 18.5) return { label: "Underweight", color: "text-sky-400", tint: "bg-sky-500/10 border-sky-500/30" };
    if (bmi < 25)   return { label: "Healthy",     color: "text-emerald-400", tint: "bg-emerald-500/10 border-emerald-500/30" };
    if (bmi < 30)   return { label: "Overweight",  color: "text-amber-400",   tint: "bg-amber-500/10 border-amber-500/30" };
    return { label: "Obese", color: "text-red-400", tint: "bg-red-500/10 border-red-500/30" };
};

export default function Profile() {
    const { user, logout } = useAuth();
    const [profile, setProfile] = useState(null);
    const [latestWeight, setLatestWeight] = useState(null); // from weight_entries
    const navigate = useNavigate();

    useEffect(() => {
        api.get("/profile").then((r) => setProfile(r.data)).catch(() => setProfile(false));
        api.get("/progress/weight").then((r) => {
            const arr = r.data || [];
            if (arr.length > 0) setLatestWeight(arr[0].weight_kg);
        }).catch(() => {});
    }, []);

    const p = profile?.profile;
    const heightCm = p?.height_cm || null;
    // Prefer the most recent logged weight (auto-updates BMI when progress logged),
    // falling back to the onboarding weight.
    const weightKg = (latestWeight != null ? latestWeight : p?.weight_kg) || null;
    const bmi = useMemo(() => computeBMI(heightCm, weightKg), [heightCm, weightKg]);
    const bmiCat = bmiCategory(bmi);

    return (
        <div className="px-6 pt-10">
            <BackButton to="/dashboard" />
            <h1 className="brand-heading text-4xl mb-1">Profile</h1>
            <p className="text-zinc-400 text-sm mb-6">{user?.email}</p>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-5">
                <div className="w-16 h-16 rounded-full bg-[#FF5722] flex items-center justify-center brand-heading text-2xl text-white mb-3">
                    {user?.name?.[0] || "?"}
                </div>
                <h2 className="brand-heading text-2xl" data-testid="profile-name">{user?.name}</h2>
                <p className="text-zinc-400 text-sm">{user?.email}</p>
            </div>

            {/* Body Metrics */}
            <h3 className="brand-heading text-xl mb-3">Body Metrics</h3>
            <div className="grid grid-cols-3 gap-2 mb-5">
                <MetricCard icon={Ruler}  label="Height" value={heightCm ? `${heightCm}` : "—"} unit={heightCm ? "cm" : ""} tid="metric-height" />
                <MetricCard icon={Weight} label="Weight" value={weightKg ? `${Math.round(weightKg * 10) / 10}` : "—"} unit={weightKg ? "kg" : ""} tid="metric-weight" />
                <MetricCard icon={Sigma}  label="BMI"    value={bmi ? bmi.toFixed(1) : "—"} unit="" tid="metric-bmi" />
            </div>
            <div data-testid="bmi-category-pill" className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${bmiCat.tint} ${bmiCat.color}`}>
                BMI: {bmiCat.label}
            </div>

            {p && (
                <div className="space-y-3 mt-6 mb-6">
                    <Info icon={Target} label="Goal" v={p.goal?.replace(/_/g, " ")} />
                    <Info icon={Activity} label="Level" v={p.fitness_level} />
                    <Info icon={UserIcon} label="Stats" v={`${p.age}y · ${p.gender}`} />
                    <Info icon={Target} label="Diet" v={p.diet_preference} />
                </div>
            )}

            <Button data-testid="redo-onboarding-btn" variant="outline" onClick={() => navigate("/onboarding")}
                className="w-full h-12 bg-transparent border-zinc-700 hover:bg-zinc-900 mb-2">
                Update Fitness Profile
            </Button>

            <Button data-testid="logout-btn" onClick={async () => {
                try {
                    navigate("/welcome", { replace: true });
                    await logout();
                    toast.success("Signed out.");
                } catch (e) {
                    toast.error("Failed to sign out. Please try again.");
                }
            }}
                variant="outline" className="w-full h-12 bg-transparent border-red-900/50 text-red-400 hover:bg-red-950/30">
                <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
        </div>
    );
}

const MetricCard = ({ icon: Icon, label, value, unit, tid }) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3" data-testid={tid}>
        <Icon className="w-4 h-4 text-[#FF5722] mb-2" />
        <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
        <p className="brand-heading text-2xl mt-1">
            {value}<span className="text-sm text-zinc-500 ml-1 font-normal">{unit}</span>
        </p>
    </div>
);

const Info = ({ icon: Icon, label, v }) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
        <Icon className="w-5 h-5 text-[#FF5722]" />
        <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
            <p className="font-semibold capitalize">{v}</p>
        </div>
    </div>
);
