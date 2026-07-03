import React, { useEffect, useState, useMemo } from "react";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Calendar as CalendarCmp } from "../components/ui/calendar";
import BackButton from "../components/BackButton";
import {
    RotateCcw, Search, Loader2, Camera, Plus, Calendar as CalendarIcon,
    ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

// ---- Helpers ----

const toISODateOnly = (d) => {
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

const fmtNiceDate = (d) =>
    new Date(d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });

export default function Diet() {
    const [plan, setPlan] = useState(null);
    const [meals, setMeals] = useState([]);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [resetting, setResetting] = useState(false);

    // Search state
    const [query, setQuery] = useState("");
    const [searching, setSearching] = useState(false);
    const [result, setResult] = useState(null);       // full nutrition object
    const [portionKey, setPortionKey] = useState("medium");
    const [logging, setLogging] = useState(false);

    // History date picker
    const [historyDate, setHistoryDate] = useState(new Date());
    const [historyMeals, setHistoryMeals] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const load = async () => {
        try {
            const [pRes, mRes] = await Promise.allSettled([
                api.get("/diet-plan"),
                api.get("/meals?days=1"),
            ]);
            if (pRes.status === "fulfilled") setPlan(pRes.value.data);
            else setPlan(false);
            setMeals(mRes.status === "fulfilled" ? (mRes.value.data || []) : []);
        } catch {
            setPlan(false);
        }
    };
    useEffect(() => {
        load();
        const t = setTimeout(() => setPlan((cur) => (cur === null ? false : cur)), 6000);
        return () => clearTimeout(t);
    }, []);

    // Load history meals whenever date changes
    useEffect(() => {
        const iso = toISODateOnly(historyDate);
        const todayIso = toISODateOnly(new Date());
        if (iso === todayIso) {
            // reuse the already-loaded today's meals to avoid double query
            setHistoryMeals(meals);
            return;
        }
        setHistoryLoading(true);
        api.get(`/meals/by-date/${iso}`)
            .then((r) => setHistoryMeals(r.data || []))
            .catch(() => setHistoryMeals([]))
            .finally(() => setHistoryLoading(false));
    }, [historyDate, meals]);

    // ---- Actions ----
    const resetTodaysPlate = async () => {
        setResetting(true);
        try {
            await api.post("/meals/reset-today");
            toast.success("Today's plate has been reset.");
            setConfirmOpen(false);
            await load();
        } catch { toast.error("Failed to reset today's plate"); }
        finally { setResetting(false); }
    };

    const doSearch = async () => {
        const q = query.trim();
        if (!q) { toast.error("Type a dish to search"); return; }
        setSearching(true); setResult(null);
        try {
            const { data } = await api.post("/meal-search", { query: q });
            setResult(data);
            setPortionKey("medium");
        } catch (e) {
            const msg = e?.response?.data?.detail || "Search failed";
            toast.error(msg);
        } finally { setSearching(false); }
    };

    const logSelectedMeal = async () => {
        if (!result) return;
        const p = result.portions[portionKey];
        setLogging(true);
        try {
            await api.post("/meals", {
                meal_type: "Meal",
                name: `${result.name} (${p.label})`,
                calories: p.calories,
                protein_g: p.protein_g,
                carbs_g: p.carbs_g,
                fats_g: p.fats_g,
                notes: `${p.grams}g · ${result.cuisine || ""}`.trim(),
            });
            toast.success(`Logged: ${result.name} (${p.label})`);
            setResult(null);
            setQuery("");
            await load();
        } catch { toast.error("Failed to log meal"); }
        finally { setLogging(false); }
    };

    // ---- Totals ----
    const totals = useMemo(() => {
        const t = { cal: 0, p: 0, c: 0, f: 0 };
        for (const m of meals) {
            t.cal += m.calories || 0;
            t.p += m.protein_g || 0;
            t.c += m.carbs_g || 0;
            t.f += m.fats_g || 0;
        }
        return t;
    }, [meals]);

    if (plan === null) return <div className="p-6 text-zinc-400">Loading diet…</div>;
    if (!plan) return (
        <div className="p-6">
            <BackButton to="/dashboard" />
            No plan. Complete onboarding.
        </div>
    );

    const isViewingToday = toISODateOnly(historyDate) === toISODateOnly(new Date());

    return (
        <div className="px-6 pt-10">
            <BackButton to="/dashboard" />
            <div className="flex justify-between items-start mb-4 gap-3">
                <div className="min-w-0">
                    <span className="text-xs uppercase tracking-[0.3em] text-[#FF5722] font-bold">Diet</span>
                    <h1 className="brand-heading text-4xl mt-1">Today's Plate</h1>
                </div>
                <Button data-testid="reset-diet-btn" onClick={() => setConfirmOpen(true)} variant="outline" size="sm"
                    className="shrink-0 bg-transparent border-zinc-700 hover:bg-zinc-900 h-9 mt-1">
                    <RotateCcw className="w-4 h-4 mr-1.5" /> Reset
                </Button>
            </div>

            {/* Macros */}
            <div className="grid grid-cols-4 gap-2 mb-5">
                <Macro label="Cal" v={Math.round(totals.cal)} t={plan.daily_calories} color="#FF5722" tid="macro-cal" />
                <Macro label="Pro" v={Math.round(totals.p)} t={plan.protein_g} color="#00E5FF" unit="g" tid="macro-pro" />
                <Macro label="Carb" v={Math.round(totals.c)} t={plan.carbs_g} color="#10B981" unit="g" tid="macro-carb" />
                <Macro label="Fat" v={Math.round(totals.f)} t={plan.fats_g} color="#F59E0B" unit="g" tid="macro-fat" />
            </div>

            {/* Search Meal */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6" data-testid="meal-search-section">
                <div className="flex items-center gap-2 mb-2">
                    <Search className="w-4 h-4 text-[#FF5722]" />
                    <h3 className="brand-heading text-xl">Search Meal</h3>
                </div>
                <p className="text-zinc-400 text-xs mb-3">Any dish, worldwide — powered by AI</p>
                <div className="flex gap-2">
                    <Input
                        data-testid="meal-search-input"
                        placeholder="e.g. Chicken Biryani, Sushi, Aloo Paratha…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }}
                        className="bg-zinc-950 border-zinc-800 h-11"
                    />
                    <Button data-testid="meal-search-btn" onClick={doSearch} disabled={searching}
                        className="bg-[#FF5722] hover:bg-[#E64A19] h-11 min-w-24">
                        {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Search</>}
                    </Button>
                </div>

                {result && (
                    <div className="mt-4 border-t border-zinc-800 pt-4" data-testid="meal-result-panel">
                        <div className="flex items-start justify-between gap-3 mb-3">
                            <div>
                                <h4 className="brand-heading text-xl">{result.name}</h4>
                                {result.cuisine && (
                                    <span className="inline-block text-[10px] uppercase tracking-wider bg-[#FF5722]/10 text-[#FF5722] border border-[#FF5722]/30 rounded-full px-2 py-0.5 mt-1">{result.cuisine}</span>
                                )}
                                {result.description && (
                                    <p className="text-zinc-400 text-sm mt-2">{result.description}</p>
                                )}
                            </div>
                        </div>
                        <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Portion consumed</p>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                            {["small", "medium", "large"].map((k) => {
                                const p = result.portions?.[k];
                                if (!p) return null;
                                const active = portionKey === k;
                                return (
                                    <button
                                        key={k}
                                        type="button"
                                        data-testid={`portion-${k}`}
                                        onClick={() => setPortionKey(k)}
                                        className={`text-left rounded-lg border p-3 transition-colors ${active ? "border-[#FF5722] bg-[#FF5722]/10" : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"}`}
                                    >
                                        <p className={`text-xs uppercase tracking-wider ${active ? "text-[#FF5722]" : "text-zinc-400"}`}>{p.label}</p>
                                        <p className="brand-heading text-lg mt-1">{p.calories}<span className="text-xs text-zinc-500 ml-1 font-normal">kcal</span></p>
                                        <p className="text-[11px] text-zinc-400 mt-1">{p.grams}g · P{p.protein_g} · C{p.carbs_g} · F{p.fats_g}</p>
                                    </button>
                                );
                            })}
                        </div>
                        <Button data-testid="log-meal-btn" onClick={logSelectedMeal} disabled={logging}
                            className="w-full h-11 bg-[#FF5722] hover:bg-[#E64A19] font-bold uppercase">
                            {logging ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                            Log Meal
                        </Button>
                    </div>
                )}
            </section>

            {/* Scanner shortcut */}
            <Link to="/food-scanner" data-testid="scan-link"
                className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-[#FF5722]/50 rounded-xl p-4 mb-6">
                <div className="w-10 h-10 rounded-lg bg-[#FF5722] flex items-center justify-center">
                    <Camera className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                    <p className="font-semibold">AI Food Scanner</p>
                    <p className="text-zinc-400 text-xs">Snap a photo to get instant nutrition</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500" />
            </Link>

            {/* Today's Meals */}
            <h3 className="brand-heading text-xl mb-3">Today's Meals</h3>
            {meals.length === 0 ? (
                <p className="text-zinc-500 text-sm" data-testid="no-meals-logged">Nothing logged yet.</p>
            ) : (
                <div className="space-y-2 mb-8">
                    {meals.map((m, i) => (
                        <div key={m.id || i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex justify-between text-sm" data-testid={`today-meal-${i}`}>
                            <div className="min-w-0 pr-2">
                                <p className="font-semibold truncate">{m.name}</p>
                                <p className="text-zinc-500 text-xs">{m.meal_type} · P{Math.round(m.protein_g || 0)}g · C{Math.round(m.carbs_g || 0)}g · F{Math.round(m.fats_g || 0)}g</p>
                            </div>
                            <span className="text-zinc-400 shrink-0">{Math.round(m.calories || 0)} kcal</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Meal History with calendar picker */}
            <div className="border-t border-zinc-800 pt-6">
                <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="brand-heading text-xl">Meal History</h3>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button data-testid="history-date-btn" variant="outline" size="sm"
                                className="bg-transparent border-zinc-700 hover:bg-zinc-900 text-white h-9">
                                <CalendarIcon className="w-4 h-4 mr-1.5" />
                                {isViewingToday ? "Today" : fmtNiceDate(historyDate)}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-auto p-0 bg-zinc-900 border-zinc-800" data-testid="history-date-popover">
                            <CalendarCmp
                                mode="single"
                                selected={historyDate}
                                onSelect={(d) => d && setHistoryDate(d)}
                                disabled={(date) => date > new Date()}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </div>

                {historyLoading ? (
                    <p className="text-zinc-500 text-sm">Loading meals…</p>
                ) : historyMeals.length === 0 ? (
                    <p className="text-zinc-500 text-sm" data-testid="no-meals-history">No meals recorded.</p>
                ) : (
                    <div className="space-y-2">
                        {historyMeals.map((m, i) => (
                            <div key={m.id || i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex justify-between text-sm" data-testid={`history-meal-${i}`}>
                                <div className="min-w-0 pr-2">
                                    <p className="font-semibold truncate">{m.name}</p>
                                    <p className="text-zinc-500 text-xs">{m.meal_type} · P{Math.round(m.protein_g || 0)}g · C{Math.round(m.carbs_g || 0)}g · F{Math.round(m.fats_g || 0)}g</p>
                                </div>
                                <span className="text-zinc-400 shrink-0">{Math.round(m.calories || 0)} kcal</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent data-testid="reset-confirm-dialog" className="bg-zinc-900 border-zinc-800 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="brand-heading text-2xl">Reset today's plate?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                            This will remove all meals you've logged today. Your macros for today will go back to zero.
                            This action cannot be undone. Are you sure you want to reset today's plate?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel data-testid="reset-cancel-btn" className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white">Cancel</AlertDialogCancel>
                        <AlertDialogAction data-testid="reset-confirm-btn" onClick={resetTodaysPlate} disabled={resetting}
                            className="bg-[#FF5722] hover:bg-[#E64A19] text-white">
                            {resetting ? "Resetting…" : "Yes, reset"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

const Macro = ({ label, v, t, color, unit = "", tid }) => {
    const pct = Math.min(100, (v / Math.max(1, t)) * 100);
    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3" data-testid={tid}>
            <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
            <p className="brand-heading text-xl mt-1">{v}<span className="text-xs text-zinc-500">{unit}</span></p>
            <p className="text-xs text-zinc-500">/ {t}{unit}</p>
            <div className="h-1 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
            </div>
        </div>
    );
};
