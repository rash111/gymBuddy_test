import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, requireOnboarded = true }) {
    const { user, loading } = useAuth();

    console.log("ProtectedRoute", {
        loading,
        onboarded: user?.onboarded,
        user,
    });

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
                Loading…
            </div>
        );
    }

    if (!user) return <Navigate to="/login" replace />;

    if (requireOnboarded && !user.onboarded) {
        return <Navigate to="/onboarding" replace />;
    }

    return children;
}