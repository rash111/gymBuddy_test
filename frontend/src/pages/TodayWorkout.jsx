import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Play, ChevronRight, Calendar } from "lucide-react";

export default function TodayWorkout() {
    const [plan, setPlan] = useState(null);
    const navigate = useNavigate();
    const todayIdx = new Date().getDay(); // Sun=0..Sat=6

    useEffect(() => {
        api.get("/workout-plan").then((r) => setPlan(r.data)).catch(() => setPlan(false));
    }, []);

    if (plan === null) return <div className="p-6 text-zinc-400">Loading…</div>;
    if (!plan) return <div className="p-6">No plan yet. <Link to="/onboarding" className="text-[#FF5722]">Complete onboarding</Link></div>;

    // Map JS Sunday=0..Saturday=6 → plan day index based on Monday-first names if matching
    const dayIndex = ((todayIdx + 6) % 7); // Monday=0..Sunday=6
    const day = plan.days[dayIndex % plan.days.length];

    return (
        <div className="px-6 pt-10 pb-6">
            <Link to="/workout/weekly" className="inline-flex items-center gap-1 text-zinc-400 hover:text-white mb-2 text-sm" data-testid="view-weekly">
                <Calendar className="w-4 h-4" /> View Weekly Plan
            </Link>
            <span className="text-xs uppercase tracking-[0.3em] text-[#FF5722] font-bold">{day?.day || "Today"}</span>
            <h1 className="brand-heading text-5xl mt-1 mb-2">{day?.focus || "Rest"}</h1>
            <p className="text-zinc-400">{day?.exercises?.length || 0} exercises</p>

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
                <Button data-testid="start-workout-btn" onClick={() => navigate("/workout/session", { state: { day, dayIndex } })}
                    className="w-full h-14 mt-8 bg-[#FF5722] hover:bg-[#E64A19] font-bold uppercase tracking-wider">
                    <Play className="w-5 h-5 mr-2" /> Start Workout
                </Button>
            )}
        </div>
    );
}
