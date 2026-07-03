import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../hooks/use-toast";
import BackButton from "../components/BackButton";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { AlertTriangle, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

const BODY_PARTS = {
  "Knee pain": ["Legs", "Calves"],
  "Lower back pain": ["Back", "Legs", "Core"],
  "Shoulder pain": ["Shoulders", "Chest", "Arms", "Back"],
  "Wrist pain": ["Arms"],
  "Neck pain": ["Shoulders", "Back"],
  "Ankle pain": ["Legs", "Calves"],
};

export default function ExerciseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [ex, setEx] = useState(null);
  const [loadingGuide, setLoadingGuide] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    api
      .get(`/exercises/${id}`)
      .then((r) => setEx(r.data))
      .catch(() => setEx(false));
  }, [id]);

  // Check if exercise targets affected body parts
  const getRelevantInjuries = () => {
    if (!user?.profile?.injuries) return [];
    return user.profile.injuries.filter((injury) => {
      const affectedParts = BODY_PARTS[injury] || [];
      return affectedParts.some((part) =>
        ex.muscle.toLowerCase().includes(part.toLowerCase())
      );
    });
  };

  const handleRefreshGuide = async () => {
    setLoadingGuide(true);
    try {
      const response = await api.post(
        `/exercises/${id}/posture-guide/refresh`
      );
      if (response.data.success) {
        setEx((prev) => ({
          ...prev,
          posture_guide: response.data.guide,
        }));
        toast({
          title: "Success",
          description: "Posture guide refreshed",
        });
      }
    } catch (err) {
      console.error("Error refreshing guide:", err);
      toast({
        title: "Error",
        description: "Failed to refresh posture guide",
        variant: "destructive",
      });
    } finally {
      setLoadingGuide(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  if (ex === null)
    return <div className="p-6 text-zinc-400">Loading…</div>;
  if (!ex)
    return (
      <div className="p-6">
        <BackButton /> Not found
      </div>
    );

  const relevantInjuries = getRelevantInjuries();
  const hasGuide = ex.posture_guide !== null && ex.posture_guide !== undefined;
  const showMedicalDisclaimer =
    user?.profile?.medical_condition &&
    user.profile.medical_condition !== "none";

  return (
    <div className="px-6 pt-10">
      <BackButton />
      <span className="text-xs uppercase tracking-[0.3em] text-[#FF5722] font-bold">
        {ex.muscle}
      </span>
      <h1 className="brand-heading text-4xl mt-1 mb-2" data-testid="exercise-title">
        {ex.name}
      </h1>
      <div className="flex gap-2 mb-6 text-xs">
        <span className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
          {ex.equipment}
        </span>
        <span className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
          {ex.difficulty}
        </span>
      </div>

      {/* Medical Disclaimer */}
      {showMedicalDisclaimer && (
        <Alert className="mb-6 border-yellow-900/50 bg-yellow-900/20">
          <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
          <AlertDescription className="text-yellow-100 text-sm">
            These exercise recommendations are for general fitness purposes and
            are not medical advice. Consult your healthcare provider before
            performing exercises that may be affected by your medical
            condition.
          </AlertDescription>
        </Alert>
      )}

      {/* Injury Warning */}
      {relevantInjuries.length > 0 && (
        <Alert className="mb-6 border-red-900/50 bg-red-900/20">
          <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
          <AlertDescription className="text-red-100 text-sm">
            You indicated a previous{" "}
            {relevantInjuries.join(" and ")}
            . This exercise places significant load on the affected areas. Use
            lighter weight, maintain proper form, and stop immediately if you
            experience pain.
          </AlertDescription>
        </Alert>
      )}

      {/* Exercise Demo - YouTube Shorts or Video */}
      <div className="aspect-video w-full rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 mb-6">
        <iframe
          data-testid="exercise-video"
          src={ex.shorts_url || ex.video_url}
          title={ex.name}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      {/* How to Perform */}
      <h3 className="brand-heading text-xl mb-2">How to perform</h3>
      <p className="text-zinc-300 leading-relaxed mb-6">{ex.instructions}</p>

      {/* Posture Guide Section */}
      {hasGuide ? (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="brand-heading text-xl">Posture Guide</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshGuide}
              disabled={loadingGuide}
              className="gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${loadingGuide ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>

          {/* Setup */}
          <Card className="mb-3 border-zinc-800 bg-zinc-900/50">
            <CardHeader
              className="cursor-pointer py-3"
              onClick={() => toggleSection("setup")}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Setup</CardTitle>
                {expandedSections.setup ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </CardHeader>
            {expandedSections.setup && (
              <CardContent className="pt-0">
                <p className="text-sm text-zinc-300">
                  {ex.posture_guide.setup}
                </p>
              </CardContent>
            )}
          </Card>

          {/* Execution */}
          <Card className="mb-3 border-zinc-800 bg-zinc-900/50">
            <CardHeader
              className="cursor-pointer py-3"
              onClick={() => toggleSection("execution")}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Execution</CardTitle>
                {expandedSections.execution ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </CardHeader>
            {expandedSections.execution && (
              <CardContent className="pt-0">
                <ul className="space-y-2">
                  {ex.posture_guide.execution.map((step, idx) => (
                    <li key={idx} className="text-sm text-zinc-300">
                      <span className="text-[#FF5722] font-semibold">
                        {idx + 1}.
                      </span>{" "}
                      {step}
                    </li>
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>

          {/* Breathing */}
          <Card className="mb-3 border-zinc-800 bg-zinc-900/50">
            <CardHeader
              className="cursor-pointer py-3"
              onClick={() => toggleSection("breathing")}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Breathing</CardTitle>
                {expandedSections.breathing ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </CardHeader>
            {expandedSections.breathing && (
              <CardContent className="pt-0">
                <p className="text-sm text-zinc-300">
                  {ex.posture_guide.breathing}
                </p>
              </CardContent>
            )}
          </Card>

          {/* Common Mistakes */}
          <Card className="mb-3 border-zinc-800 bg-zinc-900/50">
            <CardHeader
              className="cursor-pointer py-3"
              onClick={() => toggleSection("commonMistakes")}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Common Mistakes</CardTitle>
                {expandedSections.commonMistakes ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </CardHeader>
            {expandedSections.commonMistakes && (
              <CardContent className="pt-0">
                <ul className="space-y-2">
                  {ex.posture_guide.commonMistakes.map((mistake, idx) => (
                    <li key={idx} className="text-sm text-zinc-300">
                      <span className="text-red-400 font-semibold">•</span>{" "}
                      {mistake}
                    </li>
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>

          {/* Safety Tips */}
          <Card className="mb-3 border-zinc-800 bg-zinc-900/50">
            <CardHeader
              className="cursor-pointer py-3"
              onClick={() => toggleSection("safetyTips")}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Safety Tips</CardTitle>
                {expandedSections.safetyTips ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </CardHeader>
            {expandedSections.safetyTips && (
              <CardContent className="pt-0">
                <ul className="space-y-2">
                  {ex.posture_guide.safetyTips.map((tip, idx) => (
                    <li key={idx} className="text-sm text-zinc-300">
                      <span className="text-green-400 font-semibold">✓</span>{" "}
                      {tip}
                    </li>
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>

          {/* Primary Muscles */}
          <Card className="mb-3 border-zinc-800 bg-zinc-900/50">
            <CardHeader
              className="cursor-pointer py-3"
              onClick={() => toggleSection("primaryMuscles")}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Primary Muscles</CardTitle>
                {expandedSections.primaryMuscles ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </CardHeader>
            {expandedSections.primaryMuscles && (
              <CardContent className="pt-0">
                <p className="text-sm text-zinc-300">
                  {ex.posture_guide.primaryMuscles}
                </p>
              </CardContent>
            )}
          </Card>
        </div>
      ) : (
        <div className="mb-6">
          <h3 className="brand-heading text-xl mb-4">Posture Guide</h3>
          <Button
            onClick={handleRefreshGuide}
            disabled={loadingGuide}
            className="w-full gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loadingGuide ? "animate-spin" : ""}`} />
            {loadingGuide ? "Generating..." : "Generate Posture Guide"}
          </Button>
          {loadingGuide && (
            <div className="space-y-3 mt-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
