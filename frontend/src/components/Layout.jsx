import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, Dumbbell, BarChart3, Apple, Bot, User } from "lucide-react";

const items = [
    { to: "/dashboard", label: "Home", icon: Home, tid: "nav-home" },
    { to: "/workout", label: "Workout", icon: Dumbbell, tid: "nav-workout" },
    { to: "/progress", label: "Progress", icon: BarChart3, tid: "nav-progress" },
    { to: "/diet", label: "Diet", icon: Apple, tid: "nav-diet" },
    { to: "/coach", label: "Coach", icon: Bot, tid: "nav-coach" },
    { to: "/profile", label: "Profile", icon: User, tid: "nav-profile" },
];

export default function Layout({ children }) {
    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            <main className="max-w-md mx-auto md:max-w-2xl lg:max-w-4xl pb-24 lg:pb-8">
                {children}
            </main>
            <nav className="glass-nav fixed bottom-0 left-0 right-0 border-t border-white/5 z-50" data-testid="bottom-nav">
                <div className="max-w-md mx-auto md:max-w-2xl lg:max-w-4xl flex justify-around items-center px-2 py-2">
                    {items.map(({ to, label, icon: Icon, tid }) => (
                        <NavLink key={to} to={to} data-testid={tid}
                            className={({ isActive }) =>
                                `flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs transition-colors ${
                                    isActive ? "text-[#FF5722]" : "text-zinc-400 hover:text-white"
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
