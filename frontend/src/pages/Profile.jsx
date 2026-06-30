import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { LogOut, Target, Activity, User as UserIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Profile() {
    const { user, logout } = useAuth();
    const [profile, setProfile] = useState(null);
    const navigate = useNavigate();

    useEffect(() => { api.get("/profile").then((r) => setProfile(r.data)); }, []);

    const p = profile?.profile;

    return (
        <div className="px-6 pt-10 pb-6">
            <h1 className="brand-heading text-4xl mb-1">Profile</h1>
            <p className="text-zinc-400 text-sm mb-6">{user?.email}</p>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-5">
                <div className="w-16 h-16 rounded-full bg-[#FF5722] flex items-center justify-center brand-heading text-2xl text-white mb-3">
                    {user?.name?.[0] || "?"}
                </div>
                <h2 className="brand-heading text-2xl" data-testid="profile-name">{user?.name}</h2>
                <p className="text-zinc-400 text-sm">{user?.email}</p>
            </div>

            {p && (
                <div className="space-y-3 mb-6">
                    <Info icon={Target} label="Goal" v={p.goal?.replace("_", " ")} />
                    <Info icon={Activity} label="Level" v={p.fitness_level} />
                    <Info icon={UserIcon} label="Stats" v={`${p.age}y · ${p.height_cm}cm · ${p.weight_kg}kg`} />
                    <Info icon={Target} label="Diet" v={p.diet_preference} />
                </div>
            )}

            <Button data-testid="redo-onboarding-btn" variant="outline" onClick={() => navigate("/onboarding")}
                className="w-full h-12 bg-transparent border-zinc-700 hover:bg-zinc-900 mb-2">
                Update Fitness Profile
            </Button>

            <Button data-testid="logout-btn" onClick={async () => { await logout(); navigate("/welcome"); }}
                variant="outline" className="w-full h-12 bg-transparent border-red-900/50 text-red-400 hover:bg-red-950/30">
                <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
        </div>
    );
}

const Info = ({ icon: Icon, label, v }) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
        <Icon className="w-5 h-5 text-[#FF5722]" />
        <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
            <p className="font-semibold capitalize">{v}</p>
        </div>
    </div>
);
