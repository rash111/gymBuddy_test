import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../lib/api";
import BackButton from "../components/BackButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Activity, Dumbbell, Flame, Image, LineChart as LineIcon, Plus, Ruler, Upload } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";

const measurementKeys = ["chest_cm", "waist_cm", "hips_cm", "arm_cm", "thigh_cm"];
const emptyMetrics = { weight_kg: "", body_fat_percent: "", chest_cm: "", waist_cm: "", hips_cm: "", arm_cm: "", thigh_cm: "" };

export default function Progress() {
    const [weights, setWeights] = useState([]);
    const [measurements, setMeasurements] = useState([]);
    const [photos, setPhotos] = useState([]);
    const [strength, setStrength] = useState({});
    const [consistency, setConsistency] = useState(null);
    const [workoutSummary, setWorkoutSummary] = useState(null);
    const [metricsInput, setMetricsInput] = useState(emptyMetrics);
    const fileRef = useRef();

    const todayKey = new Date().toISOString().slice(0, 10);

    const loadAll = async () => {
        const [w, m, p, s, c, ws] = await Promise.all([
            api.get("/progress/weight"), api.get("/progress/measurements"),
            api.get("/progress/photos"), api.get("/progress/strength"),
            api.get("/progress/consistency"), api.get("/progress/workout-summary"),
        ]);
        setWeights(w.data || []);
        setMeasurements(m.data || []);
        setPhotos(p.data || []);
        setStrength(s.data || {});
        setConsistency(c.data || null);
        setWorkoutSummary(ws.data || null);
    };

    useEffect(() => { loadAll(); }, []);

    const bodyHistory = useMemo(() => buildBodyHistory(weights, measurements, photos), [weights, measurements, photos]);
    const todayRecord = bodyHistory.find((r) => r.date === todayKey);

    useEffect(() => {
        if (!todayRecord) {
            setMetricsInput(emptyMetrics);
            return;
        }
        setMetricsInput({
            weight_kg: todayRecord.weight_kg || "",
            body_fat_percent: todayRecord.body_fat_percent || "",
            chest_cm: todayRecord.chest_cm || "",
            waist_cm: todayRecord.waist_cm || "",
            hips_cm: todayRecord.hips_cm || "",
            arm_cm: todayRecord.arm_cm || "",
            thigh_cm: todayRecord.thigh_cm || "",
        });
    }, [todayRecord]);

    const weightSeries = [...weights].reverse().map((w) => ({ date: shortDate(w.date), kg: Number(w.weight_kg) }));
    const bodyFatSeries = [...measurements].reverse().filter((m) => m.body_fat_percent).map((m) => ({ date: shortDate(m.date), body_fat_percent: Number(m.body_fat_percent) }));
    const measurementSeries = [...measurements].reverse().map((m) => ({
        date: shortDate(m.date),
        chest: m.chest_cm, waist: m.waist_cm, hips: m.hips_cm, arm: m.arm_cm, thigh: m.thigh_cm,
    }));
    const strengthRows = Object.entries(strength).flatMap(([name, series]) => (series || []).map((s) => ({ name, ...s })));
    const strengthSummary = buildStrengthSummary(strength);
    const selectedStrength = strengthSummary[0]?.name;
    const selectedStrengthSeries = selectedStrength ? (strength[selectedStrength] || []).map((s) => ({ date: shortDate(s.date), weight: s.weight_kg, one_rm: s.estimated_1rm || s.weight_kg })) : [];

    const saveBodyMetrics = async () => {
        const weight = parseFloat(metricsInput.weight_kg);
        const body = Object.fromEntries(Object.entries(metricsInput)
            .filter(([k, v]) => k !== "weight_kg" && v !== "")
            .map(([k, v]) => [k, parseFloat(v)]));
        if (!weight && Object.keys(body).length === 0) return toast.error("Enter at least one metric");
        try {
            if (weight) await api.post("/progress/weight", { weight_kg: weight });
            if (Object.keys(body).length > 0) await api.post("/progress/measurements", body);
            toast.success(todayRecord ? "Today's metrics updated" : "Body metrics saved");
            loadAll();
        } catch { toast.error("Could not save body metrics"); }
    };

    const uploadPhoto = async (file) => {
        const fd = new FormData(); fd.append("file", file);
        try { await api.post("/progress/photos", fd, { headers: { "Content-Type": "multipart/form-data" } }); toast.success("Today's photo saved"); loadAll(); }
        catch { toast.error("Upload failed"); }
    };

    return (
        <div className="px-6 pt-10 pb-6">
            <BackButton to="/dashboard" />
            <h1 className="brand-heading text-4xl mb-1">Progress</h1>
            <p className="text-zinc-400 text-sm mb-6">Your transformation, by the numbers</p>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase tracking-[0.3em] text-[#FF5722] font-bold">Strength Progress</span>
                    <Dumbbell className="w-4 h-4 text-[#FF5722]" />
                </div>
                {strengthSummary.length ? (
                    <div className="grid grid-cols-3 gap-3">
                        {strengthSummary.slice(0, 3).map((s) => (
                            <MiniStat key={s.name} label={s.name} value={`${s.best} kg`} sub={`1RM ${s.oneRm} kg`} />
                        ))}
                    </div>
                ) : <p className="text-zinc-500 text-sm">Complete weighted workouts to build your strength trend.</p>}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase tracking-[0.3em] text-[#FF5722] font-bold">Consistency · 28d</span>
                    <div className="flex items-center gap-1.5"><Flame className="w-4 h-4 text-[#FF5722]" /><span className="brand-heading text-lg">{consistency?.streak ?? 0}</span></div>
                </div>
                <div className="flex items-end justify-between">
                    <p className="brand-heading text-5xl">{consistency?.score ?? 0}<span className="text-2xl text-zinc-500">%</span></p>
                    <p className="text-zinc-400 text-sm">{consistency?.days_done ?? 0} / {consistency?.target ?? 0} days</p>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mt-3"><div className="h-full bg-[#FF5722]" style={{ width: `${consistency?.score ?? 0}%` }} /></div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
                <SummaryCard icon={Activity} label="Workouts Completed" value={workoutSummary?.workouts_completed || 0} />
                <SummaryCard icon={Dumbbell} label="Exercises Completed" value={workoutSummary?.exercises_completed || 0} />
                <SummaryCard icon={LineIcon} label="Sets Completed" value={workoutSummary?.sets_completed || 0} />
                <SummaryCard icon={Plus} label="Reps Completed" value={workoutSummary?.reps_completed || 0} />
                <SummaryCard icon={Flame} label="Missed Workouts" value={workoutSummary?.missed_workouts || 0} className="col-span-2" />
            </div>

            <Tabs defaultValue="body">
                <TabsList className="grid grid-cols-2 bg-zinc-900 border border-zinc-800 w-full">
                    <TabsTrigger value="body">Body Metrics</TabsTrigger>
                    <TabsTrigger value="strength">Strength</TabsTrigger>
                </TabsList>

                <TabsContent value="body" className="mt-4 space-y-4">
                    <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="brand-heading text-xl">Body Metrics</p>
                                <p className="text-zinc-500 text-xs">{todayRecord ? "Editing today's record" : "Create today's record"}</p>
                            </div>
                            <Ruler className="w-5 h-5 text-[#FF5722]" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Input type="number" placeholder="Weight (kg)" value={metricsInput.weight_kg} onChange={(e) => setMetricsInput((p) => ({ ...p, weight_kg: e.target.value }))} className="bg-zinc-950 border-zinc-800" />
                            <Input type="number" placeholder="Body fat %" value={metricsInput.body_fat_percent} onChange={(e) => setMetricsInput((p) => ({ ...p, body_fat_percent: e.target.value }))} className="bg-zinc-950 border-zinc-800" />
                            {measurementKeys.map((k) => (
                                <Input key={k} type="number" placeholder={labelFor(k)} value={metricsInput[k]} onChange={(e) => setMetricsInput((p) => ({ ...p, [k]: e.target.value }))} className="bg-zinc-950 border-zinc-800" />
                            ))}
                        </div>
                        <Button onClick={saveBodyMetrics} className="w-full bg-[#FF5722] hover:bg-[#E64A19]">{todayRecord ? "Update Today's Metrics" : "Save Today's Metrics"}</Button>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
                        <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full bg-transparent border-zinc-700 hover:bg-zinc-800">
                            <Upload className="w-4 h-4 mr-2" /> {todayRecord?.photo_url ? "Replace Today's Photo" : "Add Today's Photo"}
                        </Button>
                    </section>

                    <ChartBlock title="Weight" empty={!weightSeries.length}>
                        <LineChart data={weightSeries}><XAxis dataKey="date" stroke="#71717a" fontSize={11} /><YAxis stroke="#71717a" fontSize={11} domain={["dataMin - 2", "dataMax + 2"]} /><Tooltip contentStyle={tipStyle} /><Line type="monotone" dataKey="kg" stroke="#FF5722" strokeWidth={2} dot={{ fill: "#FF5722" }} /></LineChart>
                    </ChartBlock>
                    <ChartBlock title="Body Fat %" empty={!bodyFatSeries.length}>
                        <LineChart data={bodyFatSeries}><XAxis dataKey="date" stroke="#71717a" fontSize={11} /><YAxis stroke="#71717a" fontSize={11} domain={["dataMin - 2", "dataMax + 2"]} /><Tooltip contentStyle={tipStyle} /><Line type="monotone" dataKey="body_fat_percent" stroke="#00E5FF" strokeWidth={2} dot={{ fill: "#00E5FF" }} /></LineChart>
                    </ChartBlock>
                    <ChartBlock title="Body Measurements" empty={!measurementSeries.some((r) => measurementKeys.some((k) => r[k.replace("_cm", "")]))}>
                        <LineChart data={measurementSeries}><XAxis dataKey="date" stroke="#71717a" fontSize={11} /><YAxis stroke="#71717a" fontSize={11} /><Tooltip contentStyle={tipStyle} /><Legend />{["chest", "waist", "hips", "arm", "thigh"].map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={["#FF5722", "#00E5FF", "#A3E635", "#F59E0B", "#E879F9"][i]} strokeWidth={2} dot={false} />)}</LineChart>
                    </ChartBlock>
                </TabsContent>

                <TabsContent value="strength" className="mt-4 space-y-4">
                    <ChartBlock title={selectedStrength ? `${selectedStrength} Progress` : "Strength Progress"} empty={!selectedStrengthSeries.length}>
                        <LineChart data={selectedStrengthSeries}><XAxis dataKey="date" stroke="#71717a" fontSize={11} /><YAxis stroke="#71717a" fontSize={11} /><Tooltip contentStyle={tipStyle} /><Legend /><Line type="monotone" dataKey="weight" name="Top Weight" stroke="#00E5FF" strokeWidth={2} dot={{ fill: "#00E5FF", r: 3 }} /><Line type="monotone" dataKey="one_rm" name="Estimated 1RM" stroke="#FF5722" strokeWidth={2} dot={{ fill: "#FF5722", r: 3 }} /></LineChart>
                    </ChartBlock>
                    <section className="space-y-2">
                        <p className="brand-heading text-xl">Body Metrics History</p>
                        {bodyHistory.length ? bodyHistory.map((r) => <HistoryRow key={r.date} record={r} />) : <p className="text-zinc-500 text-sm">No body metrics yet.</p>}
                    </section>
                    <section className="space-y-2">
                        <p className="brand-heading text-xl">Strength History</p>
                        {strengthRows.slice().reverse().slice(0, 10).map((r, i) => <div key={`${r.name}-${i}`} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm flex justify-between"><span className="text-zinc-500">{r.date.slice(0, 10)}</span><span>{r.name}</span><span className="text-[#00E5FF]">{r.weight_kg} kg</span></div>)}
                    </section>
                </TabsContent>
            </Tabs>
        </div>
    );
}

const tipStyle = { background: "#18181b", border: "1px solid #27272a", borderRadius: 8 };

function buildBodyHistory(weights, measurements, photos) {
    const byDate = {};
    weights.forEach((w) => { const d = w.date?.slice(0, 10); if (d) byDate[d] = { ...(byDate[d] || { date: d }), weight_kg: w.weight_kg }; });
    measurements.forEach((m) => { const d = m.date?.slice(0, 10); if (d) byDate[d] = { ...(byDate[d] || { date: d }), ...m }; });
    photos.forEach((p) => { const d = p.date?.slice(0, 10); if (d) byDate[d] = { ...(byDate[d] || { date: d }), photo_url: p.signed_url }; });
    return Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));
}

function buildStrengthSummary(strength) {
    return Object.entries(strength).map(([name, series]) => {
        const best = Math.max(0, ...(series || []).map((s) => Number(s.weight_kg) || 0));
        const oneRm = Math.max(0, ...(series || []).map((s) => Number(s.estimated_1rm || s.weight_kg) || 0));
        return { name, best, oneRm };
    }).filter((s) => s.best > 0).sort((a, b) => b.oneRm - a.oneRm);
}

function shortDate(date) { return (date || "").slice(5, 10); }
function labelFor(key) { return key.replace("_cm", " (cm)").replace("_", " "); }

function SummaryCard({ icon: Icon, label, value, className = "" }) {
    return <div className={`bg-zinc-900 border border-zinc-800 rounded-xl p-4 ${className}`}><Icon className="w-4 h-4 mb-2 text-[#FF5722]" /><p className="text-xs uppercase tracking-wider text-zinc-400">{label}</p><p className="brand-heading text-2xl mt-1">{value}</p></div>;
}

function MiniStat({ label, value, sub }) {
    return <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 min-w-0"><p className="text-zinc-500 text-xs truncate">{label}</p><p className="brand-heading text-xl mt-1">{value}</p><p className="text-zinc-500 text-xs">{sub}</p></div>;
}

function ChartBlock({ title, empty, children }) {
    return <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"><p className="brand-heading text-xl mb-3">{title}</p>{empty ? <p className="text-zinc-500 text-sm">Add more data to see this chart.</p> : <div className="h-64"><ResponsiveContainer>{children}</ResponsiveContainer></div>}</section>;
}

function HistoryRow({ record }) {
    const measurements = measurementKeys.filter((k) => record[k]).map((k) => `${k.replace("_cm", "")}: ${record[k]} cm`).join(" · ");
    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm flex items-center gap-3">
            <div className="w-12 h-12 bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
                {record.photo_url ? <img alt="" src={record.photo_url} className="w-full h-full object-cover" /> : <Image className="w-4 h-4 text-zinc-700" />}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-3"><span className="text-zinc-500">{record.date}</span><span className="text-zinc-400">{record.photo_url ? "Photo" : "No photo"}</span></div>
                <p className="text-zinc-200 truncate">Weight: {record.weight_kg || "-"} kg · Body Fat: {record.body_fat_percent || "-"}%</p>
                <p className="text-zinc-500 truncate">{measurements || "No measurements"}</p>
            </div>
        </div>
    );
}
