import React, { useEffect, useRef, useState } from "react";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import BackButton from "../components/BackButton";
import { Send, Bot, User as UserIcon, Loader2 } from "lucide-react";

export default function AICoach() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const endRef = useRef();

    useEffect(() => { api.get("/coach/history").then((r) => setMessages(r.data)).catch(() => {}); }, []);
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

    const send = async () => {
        const t = input.trim(); if (!t) return;
        setInput(""); setSending(true);
        setMessages((m) => [...m, { id: `tmp-${Date.now()}`, user_message: t, ai_reply: null, date: new Date().toISOString(), pending: true }]);
        try {
            const { data } = await api.post("/coach/message", { message: t });
            setMessages((m) => m.filter((x) => !x.pending).concat([data]));
        } catch {
            setMessages((m) => m.filter((x) => !x.pending));
        } finally { setSending(false); }
    };

    const suggestions = [
        "How do I lose belly fat with an Indian diet?",
        "Best protein sources for vegetarians?",
        "Form check on deadlift",
        "Why am I not getting stronger?",
    ];

    return (
        <div className="px-6 pt-10 min-h-screen flex flex-col">
            <BackButton to="/dashboard" />
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-[#FF5722] flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="brand-heading text-3xl leading-none">AI Coach</h1>
                    <p className="text-xs text-[#00E5FF] uppercase tracking-wider">Online · Always</p>
                </div>
            </div>

            {messages.length === 0 && !sending && (
                <div className="mt-6 space-y-2">
                    <p className="text-zinc-400 text-sm">Try asking…</p>
                    {suggestions.map((s) => (
                        <button key={s} data-testid={`suggestion-${s.slice(0, 10)}`} onClick={() => { setInput(s); }}
                            className="block w-full text-left bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg p-3 text-sm text-zinc-300">
                            {s}
                        </button>
                    ))}
                </div>
            )}

            <div className="flex-1 space-y-3 mt-4 overflow-y-auto">
                {messages.map((m) => (
                    <div key={m.id} className="space-y-2" data-testid={`msg-${m.id}`}>
                        <div className="flex items-start gap-2 justify-end">
                            <div className="bg-[#FF5722] text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%]">
                                <p className="text-sm whitespace-pre-wrap">{m.user_message}</p>
                            </div>
                            <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center shrink-0"><UserIcon className="w-4 h-4 text-zinc-400" /></div>
                        </div>
                        {(m.ai_reply || m.pending) && (
                            <div className="flex items-start gap-2">
                                <div className="w-7 h-7 rounded-full bg-zinc-900 border border-[#00E5FF]/30 flex items-center justify-center shrink-0"><Bot className="w-4 h-4 text-[#00E5FF]" /></div>
                                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                                    {m.pending ? <Loader2 className="w-4 h-4 animate-spin text-zinc-400" /> :
                                        <p className="text-sm whitespace-pre-wrap text-zinc-100">{m.ai_reply}</p>}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                <div ref={endRef} />
            </div>

            <div className="fixed bottom-20 left-0 right-0 px-6 z-40">
                <div className="max-w-md mx-auto md:max-w-2xl lg:max-w-4xl flex gap-2 glass-nav border border-zinc-800 rounded-2xl p-2">
                    <Input data-testid="coach-input" placeholder="Ask your coach…" value={input}
                        onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
                        className="bg-transparent border-0 focus-visible:ring-0 text-white" />
                    <Button data-testid="coach-send" onClick={send} disabled={sending || !input.trim()} className="bg-[#FF5722] hover:bg-[#E64A19] h-10 w-10 p-0">
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
