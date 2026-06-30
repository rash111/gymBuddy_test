import React from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Flame, Trophy, Clock, Dumbbell } from "lucide-react";

export default function WorkoutSummary() {
    const { state } = useLocation();
    const navigate = useNavigate();
    const session = state?.session;
    const streak = state?.streak ?? 0;

    if (!session) {
        navigate("/dashboard");
        return null;
    }

    const totalSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);
    const completedSets = session.exercises.reduce((a, e) => a + e.sets.filter((s) => s.completed).length, 0);
    const totalVolume = session.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.weight_kg * s.reps, 0), 0);

    return (
        <div className="px-6 pt-16 pb-8">
            <div className="flex justify-center mb-4">
                <div className="w-20 h-20 rounded-full bg-[#FF5722]/10 border-2 border-[#FF5722] flex items-center justify-center">
                    <Trophy className="w-10 h-10 text-[#FF5722]" />
                </div>
            </div>
            <h1 className="brand-heading text-5xl text-center mb-1">Crushed It!</h1>
            <p className="text-zinc-400 text-center mb-8">Session logged · {new Date(session.date).toLocaleString()}</p>

            <div className="grid grid-cols-3 gap-3 mb-6">
                <Stat icon={Clock} value={session.duration_minutes} label="Minutes" />
                <Stat icon={Dumbbell} value={`${completedSets}/${totalSets}`} label="Sets" />
                <Stat icon={Flame} value={streak} label="Streak" />
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
                <p className="text-xs uppercase tracking-[0.3em] text-[#FF5722] font-bold mb-1">Total Volume</p>
                <p className="brand-heading text-4xl">{Math.round(totalVolume)} <span className="text-zinc-500 text-xl">kg</span></p>
            </div>

            <h3 className="brand-heading text-xl mb-3">Exercises</h3>
            <div className="space-y-2 mb-8">
                {session.exercises.map((ex, i) => (
                    <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex justify-between">
                        <span className="font-semibold">{ex.exercise_name}</span>
                        <span className="text-zinc-400 text-sm">{ex.sets.length} sets</span>
                    </div>
                ))}
            </div>

            <div className="flex gap-3">
                <Link to="/dashboard" className="flex-1" data-testid="summary-home">
                    <Button variant="outline" className="w-full h-12 bg-transparent border-zinc-700 hover:bg-zinc-900">Home</Button>
                </Link>
                <Link to="/progress" className="flex-1" data-testid="summary-progress">
                    <Button className="w-full h-12 bg-[#FF5722] hover:bg-[#E64A19] font-bold uppercase">View Progress</Button>
                </Link>
            </div>
        </div>
    );
}

const Stat = ({ icon: Icon, value, label }) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
        <Icon className="w-4 h-4 text-[#FF5722] mx-auto mb-2" />
        <p className="brand-heading text-2xl">{value}</p>
        <p className="text-xs text-zinc-500 uppercase tracking-wider">{label}</p>
    </div>
);
