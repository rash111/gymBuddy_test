import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { Input } from "../components/ui/input";
import BackButton from "../components/BackButton";
import { Search } from "lucide-react";

export default function ExerciseLibrary() {
    const [exs, setExs] = useState([]);
    const [q, setQ] = useState("");

    useEffect(() => { api.get("/exercises").then((r) => setExs(r.data)); }, []);

    const filtered = exs.filter((e) =>
        e.name.toLowerCase().includes(q.toLowerCase()) ||
        e.muscle.toLowerCase().includes(q.toLowerCase()) ||
        e.equipment.toLowerCase().includes(q.toLowerCase())
    );

    return (
        <div className="px-6 pt-10 pb-6">
            <BackButton />
            <h1 className="brand-heading text-4xl mb-1">Exercise Library</h1>
            <p className="text-zinc-400 text-sm mb-6">{exs.length} exercises with form videos</p>
            <div className="relative mb-5">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <Input data-testid="exercise-search" placeholder="Search by name, muscle, equipment…"
                    value={q} onChange={(e) => setQ(e.target.value)}
                    className="bg-zinc-900 border-zinc-800 pl-9 h-12" />
            </div>
            <div className="space-y-2">
                {filtered.map((ex) => (
                    <Link key={ex.id} to={`/exercises/${ex.id}`} data-testid={`lib-ex-${ex.id}`}
                        className="block bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="brand-heading text-xl">{ex.name}</h3>
                                <p className="text-zinc-400 text-xs mt-1">{ex.muscle} · {ex.equipment} · {ex.difficulty}</p>
                            </div>
                            <span className="text-xs px-2 py-1 rounded-full bg-[#FF5722]/10 text-[#FF5722] border border-[#FF5722]/20">
                                {ex.muscle}
                            </span>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
