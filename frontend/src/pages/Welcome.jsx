import React from "react";
import { Link } from "react-router-dom";
import { Flame, Zap, TrendingUp } from "lucide-react";
import { Button } from "../components/ui/button";

export default function Welcome() {
    return (
        <div className="min-h-screen bg-zinc-950 text-white overflow-hidden">
            <div className="absolute inset-0 opacity-25 pointer-events-none">
                <img alt="hero"
                    src="https://images.pexels.com/photos/6514823/pexels-photo-6514823.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=900&w=940"
                    className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
            </div>
            <div className="relative z-10 max-w-md mx-auto md:max-w-2xl px-6 py-16 min-h-screen flex flex-col">
                <div className="flex items-center gap-2 mb-8">
                    <div className="w-9 h-9 rounded-md bg-[#FF5722] flex items-center justify-center">
                        <Flame className="w-5 h-5 text-white" />
                    </div>
                    <span className="brand-heading text-2xl">GymBuddy</span>
                </div>
                <div className="flex-1 flex flex-col justify-end">
                    <span className="text-xs uppercase tracking-[0.3em] text-[#FF5722] font-bold mb-3" data-testid="hero-tag">India's AI Fitness Coach</span>
                    <h1 className="brand-heading text-5xl sm:text-6xl lg:text-7xl text-white leading-[0.95] mb-4">
                        Build Your<br /><span className="text-[#FF5722]">Strongest</span> Self
                    </h1>
                    <p className="text-zinc-400 text-lg mb-10 max-w-md">
                        AI workout plans, Indian diet, food scanning, and a coach that knows your goals.
                    </p>
                    <div className="space-y-3 mb-8">
                        <Feat icon={Zap} text="AI-generated plans based on your equipment" />
                        <Feat icon={TrendingUp} text="Track strength, weight, photos & streaks" />
                        <Feat icon={Flame} text="Indian diet plans & food image scanner" />
                    </div>
                    <div className="flex flex-col gap-3">
                        <Link to="/register" data-testid="welcome-get-started">
                            <Button className="w-full h-14 bg-[#FF5722] hover:bg-[#E64A19] text-white text-base font-bold uppercase tracking-wider rounded-xl">
                                Get Started
                            </Button>
                        </Link>
                        <Link to="/login" data-testid="welcome-login">
                            <Button variant="outline" className="w-full h-12 bg-transparent border-zinc-700 text-white hover:bg-zinc-900 rounded-xl">
                                I already have an account
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

const Feat = ({ icon: Icon, text }) => (
    <div className="flex items-center gap-3 text-zinc-300">
        <div className="w-9 h-9 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <Icon className="w-4 h-4 text-[#FF5722]" />
        </div>
        <span className="text-sm">{text}</span>
    </div>
);
