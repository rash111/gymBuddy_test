import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import BackButton from "../components/BackButton";
import { Camera, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function FoodScanner() {
    const ref = useRef();
    const navigate = useNavigate();
    const [scanning, setScanning] = useState(false);
    const [result, setResult] = useState(null);
    const [preview, setPreview] = useState(null);

    const onFile = async (file) => {
        if (!file) return;
        setPreview(URL.createObjectURL(file));
        setScanning(true); setResult(null);
        const fd = new FormData(); fd.append("file", file);
        try {
            const { data } = await api.post("/food-scan", fd, { headers: { "Content-Type": "multipart/form-data" } });
            setResult(data);
        } catch { toast.error("Scan failed"); } finally { setScanning(false); }
    };

    const logIt = async () => {
        if (!result) return;
        try {
            await api.post("/meals", {
                meal_type: "Snack", name: result.food_name,
                calories: result.calories, protein_g: result.protein_g,
                carbs_g: result.carbs_g, fats_g: result.fats_g,
                notes: result.notes,
            });
            toast.success("Logged to your diary!");
            // Navigate to Diet plan screen so user can see their updated plate
            setTimeout(() => navigate("/diet"), 400);
        } catch { toast.error("Failed"); }
    };

    return (
        <div className="px-6 pt-10">
            <BackButton to="/diet" label="Diet" />
            <span className="text-xs uppercase tracking-[0.3em] text-[#FF5722] font-bold">AI Powered</span>
            <h1 className="brand-heading text-4xl mt-1 mb-1">Food Scanner</h1>
            <p className="text-zinc-400 text-sm mb-6">Snap any Indian dish for instant nutrition estimates.</p>

            <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])} data-testid="food-file-input" />

            {!preview && (
                <button data-testid="open-camera-btn" onClick={() => ref.current?.click()}
                    className="w-full aspect-video bg-zinc-900 border-2 border-dashed border-zinc-800 hover:border-[#FF5722]/50 rounded-2xl flex flex-col items-center justify-center gap-3 text-zinc-400">
                    <div className="w-14 h-14 rounded-full bg-[#FF5722]/10 border border-[#FF5722]/30 flex items-center justify-center">
                        <Camera className="w-7 h-7 text-[#FF5722]" />
                    </div>
                    <p className="font-semibold">Tap to scan a meal</p>
                </button>
            )}

            {preview && (
                <div className="rounded-2xl overflow-hidden border border-zinc-800 mb-4">
                    <img src={preview} alt="meal" className="w-full aspect-video object-cover" />
                </div>
            )}

            {scanning && (
                <div className="flex items-center gap-2 text-zinc-400 justify-center py-4" data-testid="scanning-indicator">
                    <Loader2 className="w-4 h-4 animate-spin" /> Analyzing…
                </div>
            )}

            {result && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 animate-fade-in-up" data-testid="scan-result">
                    <span className="text-xs uppercase tracking-[0.3em] text-[#FF5722] font-bold">Detected</span>
                    <h3 className="brand-heading text-3xl mt-1">{result.food_name}</h3>
                    <p className="text-zinc-400 text-sm mb-4">{result.portion}</p>
                    <div className="grid grid-cols-4 gap-2 mb-4">
                        <Mini label="Cal" v={Math.round(result.calories)} />
                        <Mini label="Pro" v={`${Math.round(result.protein_g)}g`} />
                        <Mini label="Carb" v={`${Math.round(result.carbs_g)}g`} />
                        <Mini label="Fat" v={`${Math.round(result.fats_g)}g`} />
                    </div>
                    {result.notes && <p className="text-zinc-400 text-sm mb-4">{result.notes}</p>}
                    <div className="flex gap-2">
                        <Button data-testid="log-scanned" onClick={logIt} className="flex-1 bg-[#FF5722] hover:bg-[#E64A19]">
                            <Plus className="w-4 h-4 mr-1" /> Log meal
                        </Button>
                        <Button onClick={() => { setPreview(null); setResult(null); }} variant="outline" className="bg-transparent border-zinc-700">Scan again</Button>
                    </div>
                </div>
            )}
        </div>
    );
}

const Mini = ({ label, v }) => (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-center">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">{label}</p>
        <p className="brand-heading text-lg">{v}</p>
    </div>
);
