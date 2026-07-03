import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../components/ui/dialog";
import BackButton from "../components/BackButton";
import {
    RefreshCw, Library, CheckCircle2, XCircle, Circle, Clock, CalendarSync,
} from "lucide-react";
import { toast } from "sonner";

// day meta helper (Monday-first)
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function todayIdxMondayFirst() {
    const now = new Date();
    return (now.getDay() + 6) % 7; // Monday=0..Sunday=6
}

function statusFor(dayIndex, day, weekSessions) {
    const isRest = !day?.exercises || day.exercises.length === 0;
    const todayIdx = todayIdxMondayFirst();

    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - todayIdx);
    monday.setHours(0, 0, 0, 0);
    const thatDate = new Date(monday);
    thatDate.setDate(monday.getDate() + dayIndex);
    thatDate.setHours(0, 0, 0, 0);
    const endOfDay = new Date(thatDate);
    endOfDay.setHours(23, 59, 59, 999);
    const now2 = new Date();

    if (isRest) return { key: "rest", label: "Rest" };

    const hasSession = (weekSessions || []).some((s) => {
        if (!s.date) return false;
        const d = new Date(s.date);
        return d >= thatDate && d <= endOfDay;
    });
    if (hasSession) return { key: "completed", label: "Completed" };
    if (dayIndex === todayIdx) return { key: "today", label: "Today" };
    if (thatDate < now2) return { key: "missed", label: "Missed" };
    return { key: "upcoming", label: "Upcoming" };
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

    // Reschedule dialog state
    const [rescheduleOpen, setRescheduleOpen] = useState(false);
    const [rescheduleTarget, setRescheduleTarget] = useState(null);
    const [rescheduling, setRescheduling] = useState(false);

    const load = () => api.get("/workout-plan").then((r) => setPlan(r.data)).catch(() => setPlan(false));
    const loadSessions = () => api.get("/workout-sessions/week").then((r) => setWeekSessions(r.data || [])).catch(() => setWeekSessions([]));

    useEffect(() => { load(); loadSessions(); }, []);

    const regenerate = async () => {
        setRegen(true);
        try {
            const { data } = await api.post("/workout-plan/regenerate");
            setPlan(data);
            toast.success("Plan regenerated!");
            await loadSessions();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Failed to regenerate plan");
        } finally { setRegen(false); }
    };

    const todayIdx = todayIdxMondayFirst();
    const days = useMemo(() => plan?.days || [], [plan]);
    const todayStatus = days[todayIdx] ? statusFor(todayIdx, days[todayIdx], weekSessions) : null;
    const canReschedule = todayStatus &&
        todayStatus.key !== "rest" &&
        todayStatus.key !== "completed";

    // Compute list of eligible target days for today
    const eligibleTargets = useMemo(() => {
        if (!canReschedule) return [];
        const out = [];
        for (let i = 0; i < days.length; i++) {
            if (i === todayIdx) continue;
            const st = statusFor(i, days[i], weekSessions);
            if (st.key === "completed") continue; // never target completed
            // Future OR (past AND missed)
            const isFuture = i > todayIdx;
            const isPast = i < todayIdx;
            const isMissed = st.key === "missed";
            if (isFuture || (isPast && isMissed)) {
                out.push({ index: i, day: days[i], status: st });
            }
        }
        return out;
    }, [days, todayIdx, weekSessions, canReschedule]);

    const openReschedule = () => {
        setRescheduleTarget(null);
        setRescheduleOpen(true);
    };
    const submitReschedule = async () => {
        if (rescheduleTarget == null) { toast.error("Pick a day"); return; }
        setRescheduling(true);
        try {
            const { data } = await api.post("/workout-plan/reschedule", { sourceIdx: todayIdx, targetIdx: rescheduleTarget });
            setPlan(data);
            toast.success("Workout rescheduled");
            setRescheduleOpen(false);
            await loadSessions();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Reschedule failed");
        } finally {
            setRescheduling(false);
        }
    };

    return (
        <div className="px-6 pt-10">
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
                {days.map((d, i) => {
                    const status = statusFor(i, d, weekSessions);
                    const isToday = i === todayIdx;
                    return (
                        <div key={i}
                            className={`bg-zinc-900 border rounded-xl p-4 ${isToday ? "border-[#FF5722]/40" : "border-zinc-800"}`}
                            data-testid={`day-${i}`}>
                            <div className="flex items-center justify-between mb-3 gap-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs uppercase tracking-wider text-zinc-500">{d.day || DAY_NAMES[i]}</span>
                                        {isToday && <span className="text-[10px] uppercase tracking-wider text-[#FF5722] font-bold">· Today</span>}
                                        <StatusBadge status={status} />
                                    </div>
                                    <h3 className="brand-heading text-2xl">{d.focus}</h3>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-zinc-500 text-sm">{d.exercises?.length || 0} ex</span>
                                    {isToday && canReschedule && (
                                        <Button data-testid="reschedule-today-btn" size="sm" variant="outline"
                                            onClick={openReschedule}
                                            className="bg-transparent border-zinc-700 hover:bg-zinc-800 h-8">
                                            <CalendarSync className="w-3.5 h-3.5 mr-1" /> Reschedule
                                        </Button>
                                    )}
                                </div>
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

            {/* Reschedule dialog */}
            <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
                <DialogContent data-testid="reschedule-dialog" className="bg-zinc-900 border-zinc-800 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle className="brand-heading text-2xl">Reschedule today's workout</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Pick a day to swap with today. You can pick any future day, or a past day
                            that was missed. Completed workouts can't be moved.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-80 overflow-y-auto space-y-2 mt-2">
                        {eligibleTargets.length === 0 && (
                            <p className="text-zinc-500 text-sm p-4 text-center" data-testid="reschedule-no-options">
                                No eligible days to swap with this week.
                            </p>
                        )}
                        {eligibleTargets.map((t) => {
                            const selected = rescheduleTarget === t.index;
                            return (
                                <button key={t.index} type="button"
                                    data-testid={`reschedule-opt-${t.index}`}
                                    onClick={() => setRescheduleTarget(t.index)}
                                    className={`w-full text-left rounded-xl border p-3 transition-colors ${selected ? "border-[#FF5722] bg-[#FF5722]/10" : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"}`}>
                                    <div className="flex items-center justify-between mb-1 gap-2">
                                        <span className="text-xs uppercase tracking-wider text-zinc-500">
                                            {t.day.day || DAY_NAMES[t.index]}
                                        </span>
                                        <StatusBadge status={t.status} />
                                    </div>
                                    <p className="brand-heading text-lg">{t.day.focus || "Rest"}</p>
                                    <p className="text-xs text-zinc-500">{t.day.exercises?.length || 0} exercises currently scheduled</p>
                                </button>
                            );
                        })}
                    </div>
                    <DialogFooter className="mt-3">
                        <Button data-testid="reschedule-cancel-btn" variant="outline" onClick={() => setRescheduleOpen(false)}
                            className="bg-transparent border-zinc-700 hover:bg-zinc-800 text-white">Cancel</Button>
                        <Button data-testid="reschedule-confirm-btn" onClick={submitReschedule}
                            disabled={rescheduling || rescheduleTarget == null || eligibleTargets.length === 0}
                            className="bg-[#FF5722] hover:bg-[#E64A19] text-white">
                            {rescheduling ? "Swapping…" : "Confirm Swap"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
