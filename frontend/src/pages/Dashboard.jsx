import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Flame, ChevronRight, Apple, Dumbbell, TrendingUp, Camera, User, Flame as FireIcon } from "lucide-react";

export default function Dashboard() {
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [todaySessions, setTodaySessions] = useState([]);

    useEffect(() => {
        api.get("/dashboard").then((r) => setData(r.data)).catch(() => {});
        api.get("/workout-sessions/today").then((r) => setTodaySessions(r.data || [])).catch(() => setTodaySessions([]));
    }, []);

    // Estimate calories burned from today's workout sessions.
    // Approx formula: 0.1 kcal/min per kg of bodyweight (moderate weight training).
    const weightKg = user?.profile?.weight_kg || 70;
    const totalMinutes = todaySessions.reduce((a, s) => a + (s.duration_minutes || 0), 0);
    const caloriesBurned = Math.round(totalMinutes * weightKg * 0.1);
    const workoutCompletedToday = todaySessions.length > 0;

    return (
        <div className="px-6 pt-10 pb-6">
            <div className="flex items-start justify-between mb-2 gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-zinc-400 text-sm">Hello,</p>
                    <h1 className="brand-heading text-4xl truncate">{user?.name}</h1>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1.5" data-testid="streak-pill">
                        <Flame className="w-4 h-4 text-[#FF5722]" />
                        <span className="font-bold text-sm">{data?.streak ?? 0}</span>
                    </div>
                    <Link to="/profile" data-testid="header-profile-btn"
                        aria-label="Profile"
                        className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 hover:border-[#FF5722]/50 flex items-center justify-center transition-colors">
                        <User className="w-4 h-4 text-zinc-300" />
                    </Link>
                </div>
            </div>

            {/* Today's workout card */}
            <Link to="/workout" data-testid="today-workout-card"
                className="block mt-6 relative overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-[#FF5722]/50 transition-all p-6">
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <img alt="" src="https://images.unsplash.com/photo-1682241367368-6387d5d4921a?crop=entropy&cs=srgb&fm=jpg&q=85&w=900"
                        className="w-full h-full object-cover" />
                </div>
                <div className="relative">
                    <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-[0.3em] text-[#FF5722] font-bold">Today's Mission</span>
                        {workoutCompletedToday && (
                            <span data-testid="today-completed-badge" className="text-[10px] uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5 font-bold">
                                Completed
                            </span>
                        )}
                    </div>
                    <h2 className="brand-heading text-3xl mt-2 mb-1">
                        {data?.today_workout?.focus || "Rest Day"}
                    </h2>
                    <p className="text-zinc-400 text-sm">
                        {data?.today_workout?.exercises?.length || 0} exercises planned
                    </p>
                    <div className="mt-5 inline-flex items-center gap-1.5 text-[#FF5722] font-bold uppercase text-sm">
                        {workoutCompletedToday ? "View workout" : "Start workout"} <ChevronRight className="w-4 h-4" />
                    </div>
                </div>
            </Link>

            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-3 mt-5">
                <StatCard icon={Apple} label="Calories Today" value={Math.round(data?.calories_today || 0)} unit="kcal" testid="stat-calories" />
                {workoutCompletedToday ? (
                    <StatCard icon={FireIcon} label="Calories Burnt" value={caloriesBurned} unit="kcal" testid="stat-calories-burnt" tintClass="text-orange-400" />
                ) : (
                    <StatCard icon={TrendingUp} label="Current Streak" value={data?.streak || 0} unit="days" testid="stat-streak" />
                )}
            </div>

            {/* Quick actions */}
            <h3 className="brand-heading text-xl mt-8 mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
                <ActionTile to="/diet" icon={Apple} label="Diet Plan" />
                <ActionTile to="/food-scanner" icon={Camera} label="Scan Food" />
                <ActionTile to="/workout/weekly" icon={Dumbbell} label="Weekly Plan" />
                <ActionTile to="/coach" icon={Flame} label="AI Coach" />
            </div>
        </div>
    );
}

const StatCard = ({ icon: Icon, label, value, unit, testid, tintClass = "text-[#FF5722]" }) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4" data-testid={testid}>
        <Icon className={`w-4 h-4 mb-2 ${tintClass}`} />
        <p className="text-xs uppercase tracking-wider text-zinc-400">{label}</p>
        <p className="brand-heading text-2xl mt-1">
            {value}<span className="text-sm text-zinc-500 ml-1 font-normal">{unit}</span>
        </p>
    </div>
);

const ActionTile = ({ to, icon: Icon, label }) => (
    <Link to={to} data-testid={`action-${label.toLowerCase().replace(/\s/g, "-")}`}
        className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 flex items-center gap-3 transition-colors">
        <div className="w-10 h-10 rounded-lg bg-[#FF5722]/10 border border-[#FF5722]/20 flex items-center justify-center">
            <Icon className="w-5 h-5 text-[#FF5722]" />
        </div>
        <span className="font-semibold">{label}</span>
    </Link>
);
