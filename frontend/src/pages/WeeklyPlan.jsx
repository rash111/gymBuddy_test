import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { RefreshCw, Library } from "lucide-react";
import { toast } from "sonner";

export default function WeeklyPlan() {
    const [plan, setPlan] = useState(null);
    const [regen, setRegen] = useState(false);

    const load = () => api.get("/workout-plan").then((r) => setPlan(r.data)).catch(() => setPlan(false));
    useEffect(() => { load(); }, []);

    const regenerate = async () => {
        setRegen(true);
        try {
            const { data } = await api.post("/workout-plan/regenerate");
            setPlan(data);
            toast.success("Plan regenerated!");
        } catch { toast.error("Failed"); } finally { setRegen(false); }
    };

    return (
        <div className="px-6 pt-10 pb-6">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <span className="text-xs uppercase tracking-[0.3em] text-[#FF5722] font-bold">7-Day Split</span>
                    <h1 className="brand-heading text-4xl mt-1">Weekly Plan</h1>
                </div>
                <Button data-testid="regen-plan" onClick={regenerate} disabled={regen} variant="outline"
                    className="bg-transparent border-zinc-700 hover:bg-zinc-900">
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
                {plan?.days?.map((d, i) => (
                    <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4" data-testid={`day-${i}`}>
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <span className="text-xs uppercase tracking-wider text-zinc-500">{d.day}</span>
                                <h3 className="brand-heading text-2xl">{d.focus}</h3>
                            </div>
                            <span className="text-zinc-500 text-sm">{d.exercises?.length || 0} ex</span>
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
                ))}
            </div>
        </div>
    );
}
