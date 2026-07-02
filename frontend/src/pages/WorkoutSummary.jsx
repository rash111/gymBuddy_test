import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "../components/ui/dialog";
import BackButton from "../components/BackButton";
import { Flame, Trophy, Clock, Dumbbell, Plus, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

export default function WorkoutSummary() {
    const { state } = useLocation();
    const navigate = useNavigate();
    const lastSession = state?.session;
    const streak = state?.streak ?? 0;

    // Aggregate ALL today's sessions (main + any Do More add-ons).
    const [todaySessions, setTodaySessions] = useState(lastSession ? [lastSession] : []);
    const [loading, setLoading] = useState(true);

    // Do More dialog
    const [doMoreOpen, setDoMoreOpen] = useState(false);
    const [exercises, setExercises] = useState([]);
    const [exQ, setExQ] = useState("");
    const [loadingExercises, setLoadingExercises] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await api.get("/workout-sessions/today");
                if (!cancelled) setTodaySessions(data && data.length > 0 ? data : (lastSession ? [lastSession] : []));
            } catch {
                if (!cancelled && lastSession) setTodaySessions([lastSession]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [lastSession]);

    const openDoMore = async () => {
        setDoMoreOpen(true);
        if (exercises.length === 0) {
            setLoadingExercises(true);
            try {
                const { data } = await api.get("/exercises");
                setExercises(data || []);
            } catch { setExercises([]); }
            finally { setLoadingExercises(false); }
        }
    };

    const filteredExercises = useMemo(() => {
        const q = exQ.trim().toLowerCase();
        if (!q) return exercises.slice(0, 30);
        return exercises.filter((e) =>
            (e.name || "").toLowerCase().includes(q) ||
            (e.muscle || "").toLowerCase().includes(q) ||
            (e.equipment || "").toLowerCase().includes(q)
        ).slice(0, 30);
    }, [exercises, exQ]);

    const pickExercise = (ex) => {
        setDoMoreOpen(false);
        // Determine today's index (Monday=0..Sunday=6) so the extra session is
        // attached to the correct plan day for downstream calculations.
        const todayIdx = (new Date().getDay() + 6) % 7;
        navigate("/workout/session", {
            state: {
                day: {
                    day: "Add-on",
                    focus: `Bonus: ${ex.name}`,
                    exercises: [{
                        exercise_id: ex.id,
                        name: ex.name,
                        sets: 3,
                        reps: "8-12",
                        rest_sec: 60,
                    }],
                },
                dayIndex: todayIdx,
                isExtra: true,
            },
        });
    };

    // Aggregate stats across all today's sessions
    const stats = useMemo(() => {
        let totalMinutes = 0, totalSets = 0, completedSets = 0, totalVolume = 0;
        const allExercises = [];
        for (const s of todaySessions) {
            totalMinutes += s.duration_minutes || 0;
            for (const ex of (s.exercises || [])) {
                allExercises.push(ex);
                for (const st of (ex.sets || [])) {
                    totalSets += 1;
                    if (st.completed) completedSets += 1;
                    totalVolume += (st.weight_kg || 0) * (st.reps || 0);
                }
            }
        }
        return { totalMinutes, totalSets, completedSets, totalVolume, allExercises };
    }, [todaySessions]);

    // If we never had a session at all AND today has none logged, bail back.
    if (!loading && !lastSession && todaySessions.length === 0) {
        navigate("/dashboard");
        return null;
    }

    const sessionDate = lastSession?.date || todaySessions[0]?.date || new Date().toISOString();
    // Estimate calories burned (rough): 0.1 kcal/min per kg of bodyweight, default 70kg
    // We don't have direct access to user weight here; the Dashboard card handles the
    // authoritative "Calories Burnt" display. This is a session-only estimate.
    const caloriesEstimate = Math.round(stats.totalMinutes * 70 * 0.1);

    return (
        <div className="px-6 pt-10 pb-8">
            <BackButton to="/dashboard" />
            <div className="flex justify-center mb-4">
                <div className="w-20 h-20 rounded-full bg-[#FF5722]/10 border-2 border-[#FF5722] flex items-center justify-center">
                    <Trophy className="w-10 h-10 text-[#FF5722]" />
                </div>
            </div>
            <h1 className="brand-heading text-5xl text-center mb-1">Crushed It!</h1>
            <p className="text-zinc-400 text-center mb-8">
                {todaySessions.length > 1 ? `${todaySessions.length} sessions logged today` : "Session logged"}
                {" · "}{new Date(sessionDate).toLocaleString()}
            </p>

            <div className="grid grid-cols-3 gap-3 mb-4">
                <Stat icon={Clock} value={stats.totalMinutes} label="Minutes" tid="summary-minutes" />
                <Stat icon={Dumbbell} value={`${stats.completedSets}/${stats.totalSets}`} label="Sets" tid="summary-sets" />
                <Stat icon={Flame} value={streak} label="Streak" tid="summary-streak" />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5" data-testid="summary-volume">
                    <p className="text-xs uppercase tracking-[0.3em] text-[#FF5722] font-bold mb-1">Total Volume</p>
                    <p className="brand-heading text-3xl">{Math.round(stats.totalVolume)} <span className="text-zinc-500 text-lg">kg</span></p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5" data-testid="summary-calories">
                    <p className="text-xs uppercase tracking-[0.3em] text-orange-400 font-bold mb-1">Calories</p>
                    <p className="brand-heading text-3xl">{caloriesEstimate} <span className="text-zinc-500 text-lg">kcal</span></p>
                </div>
            </div>

            <h3 className="brand-heading text-xl mb-3">Exercises</h3>
            <div className="space-y-2 mb-6">
                {stats.allExercises.map((ex, i) => (
                    <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex justify-between" data-testid={`summary-ex-${i}`}>
                        <span className="font-semibold">{ex.exercise_name}</span>
                        <span className="text-zinc-400 text-sm">{ex.sets?.length || 0} sets</span>
                    </div>
                ))}
            </div>

            <Button data-testid="do-more-btn" onClick={openDoMore}
                className="w-full h-12 bg-[#FF5722] hover:bg-[#E64A19] font-bold uppercase mb-3">
                <Plus className="w-4 h-4 mr-2" /> Do More
            </Button>

            <div className="flex gap-3">
                <Link to="/dashboard" className="flex-1" data-testid="summary-home">
                    <Button variant="outline" className="w-full h-12 bg-transparent border-zinc-700 hover:bg-zinc-900">Home</Button>
                </Link>
                <Link to="/progress" className="flex-1" data-testid="summary-progress">
                    <Button variant="outline" className="w-full h-12 bg-transparent border-zinc-700 hover:bg-zinc-900">View Progress</Button>
                </Link>
            </div>

            {/* Do More exercise search dialog */}
            <Dialog open={doMoreOpen} onOpenChange={setDoMoreOpen}>
                <DialogContent data-testid="do-more-dialog" className="bg-zinc-900 border-zinc-800 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle className="brand-heading text-2xl">Add an exercise</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Search and pick any exercise to add to today's session. Your extra work will
                            be counted in totals, calories, volume, progress, and history.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-2">
                        <div className="relative">
                            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <Input data-testid="do-more-search"
                                autoFocus
                                placeholder="Search: push-up, squat, chest, dumbbell…"
                                value={exQ}
                                onChange={(e) => setExQ(e.target.value)}
                                className="bg-zinc-950 border-zinc-800 pl-9 h-11" />
                        </div>
                        <div className="mt-3 max-h-72 overflow-y-auto space-y-1">
                            {loadingExercises && (
                                <div className="flex items-center gap-2 text-zinc-500 p-3">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Loading exercises…
                                </div>
                            )}
                            {!loadingExercises && filteredExercises.length === 0 && (
                                <p className="text-zinc-500 text-sm p-3" data-testid="do-more-empty">No exercises match.</p>
                            )}
                            {filteredExercises.map((ex, i) => (
                                <button key={ex.id || i} type="button" data-testid={`do-more-ex-${i}`}
                                    onClick={() => pickExercise(ex)}
                                    className="w-full text-left rounded-lg border border-zinc-800 bg-zinc-950 hover:border-[#FF5722]/50 hover:bg-zinc-900 p-3 transition-colors">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-semibold">{ex.name}</span>
                                        {ex.muscle && (
                                            <span className="text-[10px] uppercase tracking-wider bg-[#FF5722]/10 text-[#FF5722] border border-[#FF5722]/30 rounded-full px-2 py-0.5">
                                                {ex.muscle}
                                            </span>
                                        )}
                                    </div>
                                    {ex.equipment && (
                                        <p className="text-zinc-500 text-xs mt-0.5">{ex.equipment}</p>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

const Stat = ({ icon: Icon, value, label, tid }) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center" data-testid={tid}>
        <Icon className="w-4 h-4 text-[#FF5722] mx-auto mb-2" />
        <p className="brand-heading text-2xl">{value}</p>
        <p className="text-xs text-zinc-500 uppercase tracking-wider">{label}</p>
    </div>
);
