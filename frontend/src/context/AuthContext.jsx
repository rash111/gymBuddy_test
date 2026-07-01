import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async (sessionUser) => {
        if (!sessionUser) {
            setUser(false);
            try { window.localStorage.removeItem("gb_onboarded"); } catch { /* noop */ }
            return;
        }
        try {
            // Race with a 4s timeout so we never hang the app on a slow RLS query
            const query = supabase
                .from("profiles")
                .select("*")
                .eq("id", sessionUser.id)
                .maybeSingle();
            const timeout = new Promise((res) => setTimeout(() => res({ data: null, error: { message: "timeout" }, __timedout: true }), 4000));
            const { data, error, __timedout } = await Promise.race([query, timeout]);
            if (error && !__timedout) console.warn("[Auth] profiles fetch error:", error?.message);
            if (__timedout) {
                console.warn("[Auth] profiles fetch timeout; using cached/optimistic values");
            }
            const cachedOnboarded = (() => { try { return window.localStorage.getItem("gb_onboarded") === "1"; } catch { return false; } })();
            const onboarded = data ? !!data.onboarded : cachedOnboarded;
            try { window.localStorage.setItem("gb_onboarded", onboarded ? "1" : "0"); } catch { /* noop */ }
            setUser({
                id: sessionUser.id,
                email: sessionUser.email,
                name: data?.name || sessionUser.user_metadata?.name || sessionUser.email,
                onboarded,
                profile: data?.fitness_profile || null,
                streak: data?.streak || 0,
            });
        } catch (e) {
            console.warn("[Auth] fetchProfile threw:", e?.message);
            const cachedOnboarded = (() => { try { return window.localStorage.getItem("gb_onboarded") === "1"; } catch { return false; } })();
            setUser({
                id: sessionUser.id,
                email: sessionUser.email,
                name: sessionUser.user_metadata?.name || sessionUser.email,
                onboarded: cachedOnboarded,
                profile: null,
                streak: 0,
            });
        }
    };

    useEffect(() => {
        let cancelled = false;
        // Safety timeout so we never hang on "Loading…"
        const safety = setTimeout(() => {
            if (!cancelled) {
                console.warn("[Auth] safety timeout — forcing loading=false");
                setLoading(false);
            }
        }, 4000);

        (async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (cancelled) return;
                await fetchProfile(session?.user);
            } catch (e) {
                console.warn("[Auth] init failed:", e?.message);
                if (!cancelled) setUser(false);
            } finally {
                if (!cancelled) setLoading(false);
                clearTimeout(safety);
            }
        })();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            try {
                if (event === "SIGNED_OUT") {
                    setUser(false);
                    try { window.localStorage.removeItem("gb_onboarded"); } catch { /* noop */ }
                    return;
                }
                if (session?.user) {
                    // fire-and-forget so we don't block auth events
                    fetchProfile(session.user);
                }
            } catch (e) {
                console.warn("[Auth] onAuthStateChange error:", e?.message);
            }
        });

        return () => {
            cancelled = true;
            clearTimeout(safety);
            subscription.unsubscribe();
        };
    }, []);

    const login = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            throw { response: { data: { detail: error.message } } };
        }

        return data.user;
    };

    const register = async (name, email, password) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name } },
        });

        if (error) {
            throw { response: { data: { detail: error.message } } };
        }

        if (data.user) {
            await supabase
                .from("profiles")
                .upsert({
                    id: data.user.id,
                    name,
                    email,
                    onboarded: false,
                });
        }

        await fetchProfile(data.user);

        return {
            ...data.user,
            onboarded: false,
            name,
        };
    };

    const logout = async () => {
        try {
            await supabase.auth.signOut();
        } catch (e) {
            console.warn("[Auth] signOut error:", e?.message);
        }
        // Force clear any local supabase session tokens to guarantee a clean state
        try {
            Object.keys(window.localStorage || {}).forEach((k) => {
                if (k.startsWith("sb-") && k.includes("-auth-token")) {
                    window.localStorage.removeItem(k);
                }
            });
            window.localStorage.removeItem("gb_onboarded");
        } catch { /* ignore */ }
        setUser(false);
    };

    const refresh = async () => {
        const {
            data: { user },
        } = await supabase.auth.getUser();

        await fetchProfile(user);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                login,
                register,
                logout,
                refresh,
                setUser,
            }}
        >
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