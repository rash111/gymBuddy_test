import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

/**
 * Compact back button with consistent alignment across screens.
 * Uses browser history when possible, else falls back to `to` or /dashboard.
 */
export default function BackButton({ to, label = "Back", className = "" }) {
    const navigate = useNavigate();
    const location = useLocation();

    const handleClick = () => {
        // Prefer explicit `to` if provided, else history back, else dashboard
        if (to) {
            navigate(to);
            return;
        }
        // window.history has length > 1 when there is prior history
        if (window.history.length > 1 && location.key !== "default") {
            navigate(-1);
        } else {
            navigate("/dashboard");
        }
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            data-testid="back-btn"
            className={`inline-flex items-center gap-1 text-zinc-400 hover:text-white text-sm mb-3 -ml-1 px-1 py-1 rounded transition-colors ${className}`}
        >
            <ChevronLeft className="w-4 h-4" /> {label}
        </button>
    );
}
