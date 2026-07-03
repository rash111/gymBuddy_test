import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "../components/ui/dialog";
import BackButton from "../components/BackButton";
import { Play, ChevronRight, Calendar, RotateCcw, Plus, CheckCircle2, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function TodayWorkout() {
    const [plan, setPlan] = useState(null);
    const [todaySessions, setTodaySessions] = useState([]);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [resetting, setResetting] = useState(false);

    // Do More dialog
    const [doMoreOpen, setDoMoreOpen] = useState(false);
    const [exercises, setExercises] = useState([]);
    const [exQ, setExQ] = useState("");
    const [loadingExercises, setLoadingExercises] = useState(false);

    const navigate = useNavigate();
    const todayIdx = new Date().getDay(); // Sun=0..Sat=6

    const loadTodaySessions = async () => {
        try {
            const { data } = await api.get("/workout-sessions/today");
            setTodaySessions(data || []);
        } catch { setTodaySessions([]); }
    };

    useEffect(() => {
        api.get("/workout-plan").then((r) => setPlan(r.data)).catch(() => setPlan(false));
        loadTodaySessions();
        // Safety timeout — never leave the user stuck on "Loading…"
        const t = setTimeout(() => {
            setPlan((cur) => (cur === null ? false : cur));
        }, 6000);
        return () => clearTimeout(t);
    }, []);

    if (plan === null) return <div className="p-6 text-zinc-400">Loading…</div>;
    if (!plan) return (
        <div className="p-6">
            <BackButton to="/dashboard" />
            No plan yet. <Link to="/onboarding" className="text-[#FF5722]">Complete onboarding</Link>
        </div>
    );

    // Map JS Sunday=0..Saturday=6 → plan day index based on Monday-first names
    const dayIndex = ((todayIdx + 6) % 7); // Monday=0..Sunday=6
    const day = plan.days[dayIndex % plan.days.length];
    const isCompleted = todaySessions.length > 0;

    const startWorkout = () => navigate("/workout/session", { state: { day, dayIndex } });

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

    const pickExercise = (ex) => {
        setDoMoreOpen(false);
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
                dayIndex,
                isExtra: true,
            },
        });
    };

    const restartWorkout = async () => {
        setResetting(true);
        try {
            await api.post("/workout-sessions/reset-today");
            toast.success("Today's workout progress reset.");
            setConfirmOpen(false);
            await loadTodaySessions();
            navigate("/workout/session", { state: { day, dayIndex } });
        } catch (e) {
            toast.error("Failed to reset today's workout");
        } finally {
            setResetting(false);
        }
    };

    return (
        <div className="px-6 pt-10">
            <BackButton to="/dashboard" />
            <Link to="/workout/weekly" className="inline-flex items-center gap-1 text-zinc-400 hover:text-white mb-2 text-sm" data-testid="view-weekly">
                <Calendar className="w-4 h-4" /> View Weekly Plan
            </Link>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <span className="text-xs uppercase tracking-[0.3em] text-[#FF5722] font-bold">{day?.day || "Today"}</span>
                    <h1 className="brand-heading text-5xl mt-1 mb-2">{day?.focus || "Rest"}</h1>
                    <p className="text-zinc-400">{day?.exercises?.length || 0} exercises</p>
                </div>
                {isCompleted && (
                    <div data-testid="workout-status-badge"
                        className="shrink-0 inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-full px-3 py-1.5 mt-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Completed</span>
                    </div>
                )}
            </div>

            <div className="mt-6 space-y-3">
                {day?.exercises?.map((ex, i) => (
                    <Link key={i} to={`/exercises/${ex.exercise_id}`} data-testid={`ex-card-${i}`}
                        className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 transition-colors">
                        <div className="w-10 h-10 rounded-lg bg-[#FF5722]/10 border border-[#FF5722]/20 flex items-center justify-center brand-heading text-[#FF5722]">
                            {i + 1}
                        </div>
                        <div className="flex-1">
                            <h3 className="brand-heading text-xl">{ex.name}</h3>
                            <p className="text-zinc-400 text-sm">{ex.sets} sets × {ex.reps} reps · {ex.rest_sec}s rest</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-zinc-500" />
                    </Link>
                ))}
                {(!day?.exercises || day.exercises.length === 0) && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                        <p className="brand-heading text-2xl mb-2">Recovery Day</p>
                        <p className="text-zinc-400">Stretch, hydrate, and prep for tomorrow.</p>
                    </div>
                )}
            </div>

            {day?.exercises?.length > 0 && (
                isCompleted ? (
                    <div className="mt-8 grid grid-cols-2 gap-3" data-testid="completed-actions">
                        <Button data-testid="restart-workout-btn" onClick={() => setConfirmOpen(true)}
                            variant="outline"
                            className="h-14 bg-transparent border-zinc-700 hover:bg-zinc-900 font-bold uppercase tracking-wider">
                            <RotateCcw className="w-5 h-5 mr-2" /> Restart
                        </Button>
                        <Button data-testid="do-more-btn" onClick={openDoMore}
                            className="h-14 bg-[#FF5722] hover:bg-[#E64A19] font-bold uppercase tracking-wider">
                            <Plus className="w-5 h-5 mr-2" /> Do More
                        </Button>
                    </div>
                ) : (
                    <Button data-testid="start-workout-btn" onClick={startWorkout}
                        className="w-full h-14 mt-8 bg-[#FF5722] hover:bg-[#E64A19] font-bold uppercase tracking-wider">
                        <Play className="w-5 h-5 mr-2" /> Start Workout
                    </Button>
                )
            )}

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent data-testid="restart-confirm-dialog" className="bg-zinc-900 border-zinc-800 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="brand-heading text-2xl">Restart today's workout?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                            Your logged sets, reps, and workout time for today will be permanently deleted,
                            your streak counter for today will reset, and you'll start today's session from scratch.
                            This action cannot be undone. Are you sure you want to restart today's workout?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel data-testid="restart-cancel-btn" className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white">Cancel</AlertDialogCancel>
                        <AlertDialogAction data-testid="restart-confirm-btn" onClick={restartWorkout} disabled={resetting}
                            className="bg-[#FF5722] hover:bg-[#E64A19] text-white">
                            {resetting ? "Resetting…" : "Yes, restart"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <DoMoreDialog
                open={doMoreOpen}
                onOpenChange={setDoMoreOpen}
                exercises={exercises}
                exQ={exQ}
                setExQ={setExQ}
                loadingExercises={loadingExercises}
                pickExercise={pickExercise}
            />
        </div>
    );
}

// ---- Exercise search dialog reused for "Do More" ----
function DoMoreDialog({ open, onOpenChange, exercises, exQ, setExQ, loadingExercises, pickExercise }) {
    const q = (exQ || "").trim().toLowerCase();
    const filtered = !q
        ? exercises.slice(0, 30)
        : exercises.filter((e) =>
            (e.name || "").toLowerCase().includes(q) ||
            (e.muscle || "").toLowerCase().includes(q) ||
            (e.equipment || "").toLowerCase().includes(q)
        ).slice(0, 30);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
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
                        {!loadingExercises && filtered.length === 0 && (
                            <p className="text-zinc-500 text-sm p-3" data-testid="do-more-empty">No exercises match.</p>
                        )}
                        {filtered.map((ex, i) => (
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
    );
}
