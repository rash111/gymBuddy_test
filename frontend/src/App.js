import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import { Toaster } from "./components/ui/sonner";
import Welcome from "./pages/Welcome";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import TodayWorkout from "./pages/TodayWorkout";
import WorkoutSession from "./pages/WorkoutSession";
import WorkoutSummary from "./pages/WorkoutSummary";
import WeeklyPlan from "./pages/WeeklyPlan";
import ExerciseLibrary from "./pages/ExerciseLibrary";
import ExerciseDetail from "./pages/ExerciseDetail";
import Progress from "./pages/Progress";
import Diet from "./pages/Diet";
import FoodScanner from "./pages/FoodScanner";
import AICoach from "./pages/AICoach";
import Profile from "./pages/Profile";
import "./App.css";

function RootRedirect() {
    const { user, loading } = useAuth();
    if (loading) return <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400">Loading…</div>;
    if (!user) return <Navigate to="/welcome" replace />;
    if (!user.onboarded) return <Navigate to="/onboarding" replace />;
    return <Navigate to="/dashboard" replace />;
}

const Protected = ({ children }) => (
    <ProtectedRoute><Layout>{children}</Layout></ProtectedRoute>
);

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<RootRedirect />} />
                    <Route path="/welcome" element={<Welcome />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/onboarding" element={<ProtectedRoute requireOnboarded={false}><Onboarding /></ProtectedRoute>} />
                    <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
                    <Route path="/workout" element={<Protected><TodayWorkout /></Protected>} />
                    <Route path="/workout/session" element={<Protected><WorkoutSession /></Protected>} />
                    <Route path="/workout/summary" element={<Protected><WorkoutSummary /></Protected>} />
                    <Route path="/workout/weekly" element={<Protected><WeeklyPlan /></Protected>} />
                    <Route path="/exercises" element={<Protected><ExerciseLibrary /></Protected>} />
                    <Route path="/exercises/:id" element={<Protected><ExerciseDetail /></Protected>} />
                    <Route path="/progress" element={<Protected><Progress /></Protected>} />
                    <Route path="/diet" element={<Protected><Diet /></Protected>} />
                    <Route path="/food-scanner" element={<Protected><FoodScanner /></Protected>} />
                    <Route path="/coach" element={<Protected><AICoach /></Protected>} />
                    <Route path="/profile" element={<Protected><Profile /></Protected>} />
                </Routes>
                <Toaster richColors position="top-center" />
            </BrowserRouter>
        </AuthProvider>
    );
}
