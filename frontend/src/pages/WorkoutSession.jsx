import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Check, Plus, Minus, Timer, Flag } from "lucide-react";
import { toast } from "sonner";

export default function WorkoutSession() {
    const { state } = useLocation();
    const navigate = useNavigate();
    const day = state?.day;
    const [start] = useState(Date.now());
    const [logs, setLogs] = useState(() =>
        (day?.exercises || []).map((ex) => ({
            exercise_id: ex.exercise_id, exercise_name: ex.name,
            sets: Array.from({ length: ex.sets || 3 }, (_, i) => ({ set_number: i + 1, reps: parseInt(String(ex.reps).split("-")[0]) || 10, weight_kg: 0, completed: false })),
        }))
    );
    const [saving, setSaving] = useState(false);
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
        return () => clearInterval(t);
    }, [start]);

    if (!day) {
        navigate("/workout");
        return null;
    }

    const updateSet = (exIdx, setIdx, key, val) => {
        setLogs((prev) => {
            const c = [...prev];
            c[exIdx] = { ...c[exIdx], sets: [...c[exIdx].sets] };
            c[exIdx].sets[setIdx] = { ...c[exIdx].sets[setIdx], [key]: val };
            return c;
        });
    };
    const addSet = (exIdx) => setLogs((p) => {
        const c = [...p];
        const last = c[exIdx].sets[c[exIdx].sets.length - 1] || { reps: 10, weight_kg: 0 };
        c[exIdx] = { ...c[exIdx], sets: [...c[exIdx].sets, { set_number: c[exIdx].sets.length + 1, reps: last.reps, weight_kg: last.weight_kg, completed: false }] };
        return c;
    });
    const removeSet = (exIdx) => setLogs((p) => {
        const c = [...p];
        if (c[exIdx].sets.length > 1) c[exIdx] = { ...c[exIdx], sets: c[exIdx].sets.slice(0, -1) };
        return c;
    });

    const finish = async () => {
        setSaving(true);
        try {
            const body = {
                plan_day_index: state?.dayIndex ?? 0,
                duration_minutes: Math.max(1, Math.floor(elapsed / 60)),
                exercises: logs,
                rating: 0, notes: "",
            };
            const { data } = await api.post("/workout-sessions", body);
            toast.success(`Workout complete! Streak: ${data.streak}`);
            navigate("/workout/summary", { state: { session: data.session, streak: data.streak } });
        } catch (e) {
            toast.error("Failed to save");
        } finally {
            setSaving(false);
        }
    };

    const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const ss = String(elapsed % 60).padStart(2, "0");

    return (
        <div className="px-6 pt-10 pb-32">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <span className="text-xs uppercase tracking-[0.3em] text-[#FF5722] font-bold">Live Session</span>
                    <h1 className="brand-heading text-3xl">{day.focus}</h1>
                </div>
                <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1.5">
                    <Timer className="w-4 h-4 text-[#FF5722]" />
                    <span className="brand-heading text-lg" data-testid="session-timer">{mm}:{ss}</span>
                </div>
            </div>

            <div className="space-y-4">
                {logs.map((ex, i) => (
                    <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4" data-testid={`ex-block-${i}`}>
                        <h3 className="brand-heading text-xl mb-3">{ex.exercise_name}</h3>
                        <div className="space-y-2">
                            <div className="grid grid-cols-[40px_1fr_1fr_60px] gap-2 text-xs uppercase tracking-wider text-zinc-500 px-1">
                                <span>Set</span><span>Weight (kg)</span><span>Reps</span><span></span>
                            </div>
                            {ex.sets.map((s, j) => (
                                <div key={j} className="grid grid-cols-[40px_1fr_1fr_60px] gap-2 items-center">
                                    <span className="brand-heading text-lg text-zinc-400">{s.set_number}</span>
                                    <Input type="number" data-testid={`ex-${i}-set-${j}-weight`} value={s.weight_kg}
                                        onChange={(e) => updateSet(i, j, "weight_kg", parseFloat(e.target.value) || 0)}
                                        className="bg-zinc-950 border-zinc-800 h-10" />
                                    <Input type="number" data-testid={`ex-${i}-set-${j}-reps`} value={s.reps}
                                        onChange={(e) => updateSet(i, j, "reps", parseInt(e.target.value) || 0)}
                                        className="bg-zinc-950 border-zinc-800 h-10" />
                                    <button data-testid={`ex-${i}-set-${j}-done`} onClick={() => updateSet(i, j, "completed", !s.completed)}
                                        className={`h-10 rounded-lg flex items-center justify-center border ${s.completed ? "bg-[#FF5722] border-[#FF5722]" : "bg-zinc-950 border-zinc-800"}`}>
                                        <Check className={`w-4 h-4 ${s.completed ? "text-white" : "text-zinc-600"}`} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2 mt-3">
                            <button onClick={() => addSet(i)} data-testid={`ex-${i}-add-set`}
                                className="flex-1 h-9 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-sm flex items-center justify-center gap-1">
                                <Plus className="w-3.5 h-3.5" /> Add Set
                            </button>
                            <button onClick={() => removeSet(i)}
                                className="px-3 h-9 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-300">
                                <Minus className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="fixed bottom-20 left-0 right-0 px-6 z-40">
                <div className="max-w-md mx-auto md:max-w-2xl lg:max-w-4xl">
                    <Button data-testid="finish-workout-btn" disabled={saving} onClick={finish}
                        className="w-full h-14 bg-[#FF5722] hover:bg-[#E64A19] font-bold uppercase tracking-wider shadow-lg shadow-[#FF5722]/20">
                        <Flag className="w-5 h-5 mr-2" /> {saving ? "Saving…" : "Finish Workout"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
