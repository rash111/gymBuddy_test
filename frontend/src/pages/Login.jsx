import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, formatErr } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Flame } from "lucide-react";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const u = await login(email, password);
            toast.success("Welcome back!");
            navigate(u.onboarded ? "/dashboard" : "/onboarding");
        } catch (e) {
            toast.error(formatErr(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex items-center px-6 py-10">
            <div className="w-full max-w-md mx-auto">
                <Link to="/welcome" className="inline-flex items-center gap-2 mb-10">
                    <div className="w-9 h-9 rounded-md bg-[#FF5722] flex items-center justify-center">
                        <Flame className="w-5 h-5 text-white" />
                    </div>
                    <span className="brand-heading text-2xl">GymBuddy</span>
                </Link>
                <h1 className="brand-heading text-4xl mb-2">Welcome Back</h1>
                <p className="text-zinc-400 mb-8">Sign in to your training log</p>
                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <Label className="text-zinc-300 text-xs uppercase tracking-wider">Email</Label>
                        <Input data-testid="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                            className="bg-zinc-900 border-zinc-800 text-white h-12 mt-2" />
                    </div>
                    <div>
                        <Label className="text-zinc-300 text-xs uppercase tracking-wider">Password</Label>
                        <Input data-testid="login-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                            className="bg-zinc-900 border-zinc-800 text-white h-12 mt-2" />
                    </div>
                    <Button data-testid="login-submit" disabled={loading} type="submit"
                        className="w-full h-12 bg-[#FF5722] hover:bg-[#E64A19] text-white font-bold uppercase tracking-wider">
                        {loading ? "Signing in…" : "Sign In"}
                    </Button>
                </form>
                <p className="text-zinc-400 text-sm mt-6 text-center">
                    No account? <Link to="/register" className="text-[#FF5722] font-semibold" data-testid="login-to-register">Create one</Link>
                </p>
            </div>
        </div>
    );
}
