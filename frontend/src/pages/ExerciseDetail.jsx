import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";
import BackButton from "../components/BackButton";

export default function ExerciseDetail() {
    const { id } = useParams();
    const [ex, setEx] = useState(null);

    useEffect(() => { api.get(`/exercises/${id}`).then((r) => setEx(r.data)).catch(() => setEx(false)); }, [id]);

    if (ex === null) return <div className="p-6 text-zinc-400">Loading…</div>;
    if (!ex) return <div className="p-6"><BackButton /> Not found</div>;

    return (
        <div className="px-6 pt-10 pb-6">
            <BackButton />
            <span className="text-xs uppercase tracking-[0.3em] text-[#FF5722] font-bold">{ex.muscle}</span>
            <h1 className="brand-heading text-4xl mt-1 mb-2" data-testid="exercise-title">{ex.name}</h1>
            <div className="flex gap-2 mb-6 text-xs">
                <span className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">{ex.equipment}</span>
                <span className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">{ex.difficulty}</span>
            </div>
            <div className="aspect-video w-full rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 mb-6">
                <iframe data-testid="exercise-video" src={ex.video_url} title={ex.name} className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
            <h3 className="brand-heading text-xl mb-2">How to perform</h3>
            <p className="text-zinc-300 leading-relaxed">{ex.instructions}</p>
        </div>
    );
}
