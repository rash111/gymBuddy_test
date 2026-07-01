import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import BackButton from "../components/BackButton";
import { RefreshCw, Library, CheckCircle2, XCircle, Circle, Clock } from "lucide-react";
import { toast } from "sonner";

// day meta helper (Monday-first)
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function statusFor(dayIndex, day, weekSessions) {
    // Rest / no exercises → 'rest'
    const isRest = !day?.exercises || day.exercises.length === 0;

    // Today's date is JS Sunday=0..Saturday=6 → convert to Monday=0..Sunday=6
    const now = new Date();
    const todayIdxMondayFirst = (now.getDay() + 6) % 7;

    // Determine the date corresponding to this day of the current week (Mon..Sun)
    const monday = new Date(now);
    monday.setDate(now.getDate() - todayIdxMondayFirst);
    monday.setHours(0, 0, 0, 0);
    const thatDate = new Date(monday);
    thatDate.setDate(monday.getDate() + dayIndex);
    thatDate.setHours(0, 0, 0, 0);

    const endOfDay = new Date(thatDate);
    endOfDay.setHours(23, 59, 59, 999);

    const now2 = new Date();

    if (isRest) return { key: "rest", label: "Rest", color: "zinc" };

    // Has any workout session logged on this day?
    const hasSession = (weekSessions || []).some((s) => {
        if (!s.date) return false;
        const d = new Date(s.date);
        return d >= thatDate && d <= endOfDay;
    });

    if (hasSession) return { key: "completed", label: "Completed", color: "emerald" };

    if (dayIndex === todayIdxMondayFirst) return { key: "today", label: "Today", color: "orange" };
    if (thatDate < now2) return { key: "missed", label: "Missed", color: "red" };
    return { key: "upcoming", label: "Upcoming", color: "sky" };
}

const StatusBadge = ({ status }) => {
    const map = {
        completed: { icon: CheckCircle2, cls: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" },
        missed:    { icon: XCircle,      cls: "bg-red-500/15 border-red-500/30 text-red-400" },
        upcoming:  { icon: Clock,        cls: "bg-sky-500/15 border-sky-500/30 text-sky-400" },
        today:     { icon: Circle,       cls: "bg-[#FF5722]/15 border-[#FF5722]/30 text-[#FF5722]" },
        rest:      { icon: Circle,       cls: "bg-zinc-800 border-zinc-700 text-zinc-400" },
    };
    const cfg = map[status.key] || map.rest;
    const Icon = cfg.icon;
    return (
        <span data-testid={`day-status-${status.key}`}
            className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold rounded-full border px-2 py-0.5 ${cfg.cls}`}>
            <Icon className="w-3 h-3" /> {status.label}
        </span>
    );
};

export default function WeeklyPlan() {
    const [plan, setPlan] = useState(null);
    const [regen, setRegen] = useState(false);
    const [weekSessions, setWeekSessions] = useState([]);

    const load = () => api.get("/workout-plan").then((r) => setPlan(r.data)).catch(() => setPlan(false));
    const loadSessions = () => api.get("/workout-sessions/week").then((r) => setWeekSessions(r.data || [])).catch(() => setWeekSessions([]));

    useEffect(() => {
        load();
        loadSessions();
    }, []);

    const regenerate = async () => {
        setRegen(true);
        try {
            const { data } = await api.post("/workout-plan/regenerate");
            setPlan(data);
            toast.success("Plan regenerated!");
            await loadSessions();
        } catch (e) {
            const msg = e?.response?.data?.detail || "Failed to regenerate plan";
            toast.error(msg);
        } finally { setRegen(false); }
    };

    return (
        <div className="px-6 pt-10 pb-6">
            <BackButton to="/workout" />
            <div className="flex justify-between items-start mb-6 gap-3">
                <div className="min-w-0">
                    <span className="text-xs uppercase tracking-[0.3em] text-[#FF5722] font-bold">7-Day Split</span>
                    <h1 className="brand-heading text-4xl mt-1">Weekly Plan</h1>
                </div>
                <Button data-testid="regen-plan" onClick={regenerate} disabled={regen} variant="outline"
                    className="shrink-0 bg-transparent border-zinc-700 hover:bg-zinc-900">
                    <RefreshCw className={`w-4 h-4 mr-2 ${regen ? "animate-spin" : ""}`} /> AI Re-gen
                </Button>
            </div>

            <Link to="/exercises" data-testid="exercise-library-link"
                className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 mb-6">
                <Library className="w-5 h-5 text-[#FF5722]" />
                <div className="flex-1">
                    <p className="font-semibold">Exercise Library</p>
                    <p className="text-zinc-400 text-xs">Browse all exercises with videos</p>
                </div>
            </Link>

            <div className="space-y-3">
                {plan?.days?.map((d, i) => {
                    const status = statusFor(i, d, weekSessions);
                    return (
                        <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4" data-testid={`day-${i}`}>
                            <div className="flex items-center justify-between mb-3 gap-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs uppercase tracking-wider text-zinc-500">{d.day || DAY_NAMES[i]}</span>
                                        <StatusBadge status={status} />
                                    </div>
                                    <h3 className="brand-heading text-2xl">{d.focus}</h3>
                                </div>
                                <span className="text-zinc-500 text-sm shrink-0">{d.exercises?.length || 0} ex</span>
                            </div>
                            {d.exercises?.length > 0 ? (
                                <div className="space-y-1">
                                    {d.exercises.map((ex, j) => (
                                        <Link key={j} to={`/exercises/${ex.exercise_id}`}
                                            className="flex justify-between text-sm py-1.5 px-2 -mx-2 rounded hover:bg-zinc-800/50">
                                            <span className="text-zinc-200">{ex.name}</span>
                                            <span className="text-zinc-500">{ex.sets}×{ex.reps}</span>
                                        </Link>
                                    ))}
                                </div>
                            ) : <p className="text-zinc-500 text-sm">Rest & recovery</p>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
