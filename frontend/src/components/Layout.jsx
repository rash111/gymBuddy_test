import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, Dumbbell, BarChart3, Apple, Bot } from "lucide-react";

const items = [
    { to: "/dashboard", label: "Home", icon: Home, tid: "nav-home" },
    { to: "/workout", label: "Workout", icon: Dumbbell, tid: "nav-workout" },
    { to: "/progress", label: "Progress", icon: BarChart3, tid: "nav-progress" },
    { to: "/diet", label: "Diet", icon: Apple, tid: "nav-diet" },
    { to: "/coach", label: "Coach", icon: Bot, tid: "nav-coach" },
];

export default function Layout({ children }) {
    return (
        <div className="min-h-screen flex flex-col bg-zinc-950 text-white">
            <main
                className="flex-1 overflow-y-auto max-w-md mx-auto md:max-w-2xl lg:max-w-4xl w-full"
                style={{ paddingBottom: "calc(110px + env(safe-area-inset-bottom))" }}
            >
                {children}
            </main>
            <nav
                className="
    fixed
    bottom-4
    left-4
    right-4
    z-50
    rounded-3xl
    border
    border-white/10
    bg-zinc-900/90
    backdrop-blur-xl
    shadow-2xl
    "
            >
                <div className="max-w-md mx-auto md:max-w-2xl lg:max-w-4xl flex justify-around items-center px-2 py-2">
                    {items.map(({ to, label, icon: Icon, tid }) => (
                        <NavLink key={to} to={to} data-testid={tid}
                            className={({ isActive }) =>
                                `flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs transition-colors ${isActive ? "text-[#FF5722]" : "text-zinc-400 hover:text-white"
                                }`
                            }>
                            <Icon className="w-5 h-5" strokeWidth={2} />
                            <span className="font-medium">{label}</span>
                        </NavLink>
                    ))}
                </div>
            </nav>
        </div>
    );
}
