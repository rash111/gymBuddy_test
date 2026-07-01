import React, { useEffect, useRef, useState } from "react";
import api from "../lib/api";
import BackButton from "../components/BackButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Camera, Flame, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

export default function Progress() {
    const [weights, setWeights] = useState([]);
    const [measurements, setMeasurements] = useState([]);
    const [photos, setPhotos] = useState([]);
    const [strength, setStrength] = useState({});
    const [consistency, setConsistency] = useState(null);
    const [wInput, setWInput] = useState("");
    const [mInput, setMInput] = useState({ chest_cm: "", waist_cm: "", hips_cm: "", arm_cm: "", thigh_cm: "" });
    const fileRef = useRef();

    const loadAll = async () => {
        const [w, m, p, s, c] = await Promise.all([
            api.get("/progress/weight"), api.get("/progress/measurements"),
            api.get("/progress/photos"), api.get("/progress/strength"),
            api.get("/progress/consistency"),
        ]);
        setWeights(w.data); setMeasurements(m.data); setPhotos(p.data); setStrength(s.data); setConsistency(c.data);
    };
    useEffect(() => { loadAll(); }, []);

    const logWeight = async () => {
        if (!wInput) return;
        try {
            await api.post("/progress/weight", { weight_kg: parseFloat(wInput) });
            setWInput(""); toast.success("Weight logged"); loadAll();
        } catch { toast.error("Failed"); }
    };
    const logMeasurement = async () => {
        try {
            const body = Object.fromEntries(Object.entries(mInput).filter(([_, v]) => v).map(([k, v]) => [k, parseFloat(v)]));
            if (Object.keys(body).length === 0) return toast.error("Enter at least one value");
            await api.post("/progress/measurements", body);
            setMInput({ chest_cm: "", waist_cm: "", hips_cm: "", arm_cm: "", thigh_cm: "" });
            toast.success("Saved"); loadAll();
        } catch { toast.error("Failed"); }
    };
    const uploadPhoto = async (file) => {
        const fd = new FormData(); fd.append("file", file);
        try { await api.post("/progress/photos", fd, { headers: { "Content-Type": "multipart/form-data" } }); toast.success("Photo saved"); loadAll(); }
        catch { toast.error("Upload failed"); }
    };

    const weightSeries = [...weights].reverse().map((w) => ({ date: w.date.slice(5, 10), kg: w.weight_kg }));
    const strengthList = Object.entries(strength).slice(0, 4);

    return (
        <div className="px-6 pt-10 pb-6">
            <BackButton to="/dashboard" />
            <h1 className="brand-heading text-4xl mb-1">Progress</h1>
            <p className="text-zinc-400 text-sm mb-6">Your transformation, by the numbers</p>

            {/* Consistency widget */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase tracking-[0.3em] text-[#FF5722] font-bold">Consistency · 28d</span>
                    <div className="flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-[#FF5722]" />
                        <span className="brand-heading text-lg" data-testid="consistency-streak">{consistency?.streak ?? 0}</span>
                    </div>
                </div>
                <div className="flex items-end justify-between">
                    <p className="brand-heading text-5xl" data-testid="consistency-score">{consistency?.score ?? 0}<span className="text-2xl text-zinc-500">%</span></p>
                    <p className="text-zinc-400 text-sm">{consistency?.days_done ?? 0} / {consistency?.target ?? 0} days</p>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mt-3">
                    <div className="h-full bg-[#FF5722]" style={{ width: `${consistency?.score ?? 0}%` }} />
                </div>
            </div>

            <Tabs defaultValue="weight">
                <TabsList className="grid grid-cols-4 bg-zinc-900 border border-zinc-800 w-full">
                    <TabsTrigger value="weight" data-testid="tab-weight">Weight</TabsTrigger>
                    <TabsTrigger value="measure" data-testid="tab-measure">Body</TabsTrigger>
                    <TabsTrigger value="strength" data-testid="tab-strength">Strength</TabsTrigger>
                    <TabsTrigger value="photos" data-testid="tab-photos">Photos</TabsTrigger>
                </TabsList>

                <TabsContent value="weight" className="mt-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-3">
                        <div className="flex gap-2">
                            <Input data-testid="weight-input" type="number" placeholder="Today's weight (kg)" value={wInput} onChange={(e) => setWInput(e.target.value)} className="bg-zinc-950 border-zinc-800" />
                            <Button data-testid="weight-log-btn" onClick={logWeight} className="bg-[#FF5722] hover:bg-[#E64A19]"><Plus className="w-4 h-4" /></Button>
                        </div>
                    </div>
                    {weightSeries.length > 0 ? (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 h-64">
                            <ResponsiveContainer>
                                <LineChart data={weightSeries}>
                                    <XAxis dataKey="date" stroke="#71717a" fontSize={11} />
                                    <YAxis stroke="#71717a" fontSize={11} domain={["dataMin - 2", "dataMax + 2"]} />
                                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }} />
                                    <Line type="monotone" dataKey="kg" stroke="#FF5722" strokeWidth={2} dot={{ fill: "#FF5722" }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : <p className="text-zinc-500 text-sm">Log your first weight to see the chart.</p>}
                </TabsContent>

                <TabsContent value="measure" className="mt-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-3 space-y-2">
                        {Object.keys(mInput).map((k) => (
                            <Input key={k} data-testid={`m-${k}`} placeholder={k.replace("_cm", " (cm)")} value={mInput[k]}
                                onChange={(e) => setMInput((p) => ({ ...p, [k]: e.target.value }))}
                                className="bg-zinc-950 border-zinc-800" type="number" />
                        ))}
                        <Button data-testid="measure-save" onClick={logMeasurement} className="w-full bg-[#FF5722] hover:bg-[#E64A19]">Save Measurements</Button>
                    </div>
                    <div className="space-y-2">
                        {measurements.slice(0, 5).map((m, i) => (
                            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm flex justify-between">
                                <span className="text-zinc-500">{m.date.slice(0, 10)}</span>
                                <span className="text-zinc-200">
                                    {["chest_cm", "waist_cm", "hips_cm", "arm_cm", "thigh_cm"].filter((k) => m[k]).map((k) => `${k[0].toUpperCase()}:${m[k]}`).join(" · ")}
                                </span>
                            </div>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="strength" className="mt-4 space-y-3">
                    {strengthList.length === 0 ? <p className="text-zinc-500 text-sm">Complete workouts to track strength gains.</p> :
                        strengthList.map(([name, series]) => (
                            <div key={name} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                                <p className="brand-heading text-lg mb-2">{name}</p>
                                <div className="h-32">
                                    <ResponsiveContainer>
                                        <LineChart data={series.map((s) => ({ d: s.date.slice(5, 10), kg: s.weight_kg }))}>
                                            <XAxis dataKey="d" stroke="#71717a" fontSize={10} />
                                            <YAxis stroke="#71717a" fontSize={10} />
                                            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a" }} />
                                            <Line type="monotone" dataKey="kg" stroke="#00E5FF" strokeWidth={2} dot={{ fill: "#00E5FF", r: 3 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        ))}
                </TabsContent>

                <TabsContent value="photos" className="mt-4">
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} data-testid="photo-input" />
                    <Button data-testid="photo-upload-btn" onClick={() => fileRef.current?.click()} className="w-full bg-[#FF5722] hover:bg-[#E64A19] mb-3">
                        <Upload className="w-4 h-4 mr-2" /> Add Progress Photo
                    </Button>
                    <div className="grid grid-cols-3 gap-2">
                        {photos.map((p) => (
                            <PhotoTile key={p.id} url={p.signed_url} />
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

function PhotoTile({ url }) {
    return (
        <div className="aspect-square bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            {url ? <img alt="progress" src={url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-700"><Camera className="w-6 h-6" /></div>}
        </div>
    );
}
