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
    if (!d) return e?.message || "Something went wrong";
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(", ");
    return JSON.stringify(d);
};
