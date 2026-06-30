import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async (sessionUser) => {
        if (!sessionUser) { setUser(false); return; }
        const { data } = await supabase.from("profiles").select("*").eq("id", sessionUser.id).maybeSingle();
        setUser({ id: sessionUser.id, email: sessionUser.email, name: data?.name || sessionUser.email, onboarded: !!data?.onboarded, profile: data?.fitness_profile, streak: data?.streak || 0 });
    };

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            await fetchProfile(session?.user);
            setLoading(false);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
            await fetchProfile(session?.user);
        });
        return () => subscription?.unsubscribe();
    }, []);

    const login = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw { response: { data: { detail: error.message } } };
        await fetchProfile(data.user);
        const { data: prof } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
        return { ...data.user, onboarded: !!prof?.onboarded, name: prof?.name };
    };

    const register = async (name, email, password) => {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
        if (error) throw { response: { data: { detail: error.message } } };
        // If email confirmation is ON in Supabase, no session is returned.
        // Surface a clear message so the UI can guide the user instead of silently navigating.
        if (!data.session) {
            throw {
                response: {
                    data: {
                        detail: "Account created. Please check your email to confirm your address before signing in. (If you don't want this step, ask the admin to disable 'Confirm email' in Supabase → Authentication → Providers → Email.)",
                    },
                },
                code: "EMAIL_CONFIRMATION_REQUIRED",
            };
        }
        // Insert profile row if not auto-created by trigger
        if (data.user) {
            await supabase.from("profiles").upsert({ id: data.user.id, name, email, onboarded: false }).select();
        }
        await fetchProfile(data.user);
        return { ...data.user, onboarded: false, name };
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setUser(false);
    };

    const refresh = async () => {
        const { data: { user: u } } = await supabase.auth.getUser();
        await fetchProfile(u);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout, refresh, setUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export const formatErr = (e) => {
    const d = e?.response?.data?.detail;
    const raw = typeof d === "string" ? d : (d ? JSON.stringify(d) : (e?.message || "Something went wrong"));
    const lower = raw.toLowerCase();

    // Friendly translations for common Supabase Auth errors
    if (lower.includes("email rate limit") || lower.includes("over_email_send_rate_limit")) {
        return "Too many signup emails sent in a short time. Please wait ~1 hour and try again — or ask the admin to disable 'Confirm email' in Supabase Auth settings, or configure a custom SMTP provider.";
    }
    if (lower.includes("user already registered") || lower.includes("already been registered") || lower.includes("user_already_exists")) {
        return "This email is already registered. Try signing in instead.";
    }
    if (lower.includes("invalid login credentials")) {
        return "Incorrect email or password.";
    }
    if (lower.includes("email not confirmed")) {
        return "Please confirm your email before signing in. Check your inbox for the confirmation link.";
    }
    if (lower.includes("password should be at least") || lower.includes("weak_password")) {
        return "Password is too weak. Use at least 6 characters.";
    }

    if (!d) return e?.message || "Something went wrong";
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(", ");
    return JSON.stringify(d);
};
