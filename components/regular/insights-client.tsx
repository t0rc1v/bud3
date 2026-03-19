"use client";

import { useState, useEffect, useCallback } from "react";
import { Lightbulb, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Weakness {
  topic: string;
  severity: "high" | "medium" | "low";
  details: string;
}

interface Recommendation {
  id: string;
  title: string;
  type: string;
  reason: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  high: "bg-red-500/15 text-red-700 border-red-500/30",
  medium: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  low: "bg-green-500/15 text-green-700 border-green-500/30",
};

export function InsightsClient() {
  const [weaknesses, setWeaknesses] = useState<Weakness[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchWeaknesses = useCallback(async () => {
    const res = await fetch("/api/ai/weakness-profile");
    const data = await res.json();
    if (data?.weaknesses) setWeaknesses(data.weaknesses);
  }, []);

  const fetchRecommendations = useCallback(async () => {
    const res = await fetch("/api/ai/recommendations");
    const data = await res.json();
    if (data?.recommendations) setRecommendations(data.recommendations);
  }, []);

  useEffect(() => {
    Promise.all([fetchWeaknesses(), fetchRecommendations()])
      .catch(() => {
        toast.error("Failed to load insights");
      })
      .finally(() => setIsLoading(false));
  }, [fetchWeaknesses, fetchRecommendations]);

  async function handleRefreshWeaknesses() {
    setIsRefreshing(true);
    try {
      await fetchWeaknesses();
      toast.success("Weakness profile refreshed");
    } catch {
      toast.error("Failed to refresh weakness profile");
    } finally {
      setIsRefreshing(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Insights</h1>

      {/* Weakness Profile */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Weakness Profile</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={isRefreshing}
            onClick={handleRefreshWeaknesses}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {weaknesses.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                No weaknesses identified yet. Keep studying to generate your
                profile.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {weaknesses.map((w, i) => (
              <Card key={i}>
                <CardContent className="flex items-start gap-3 p-4">
                  <Badge
                    className={
                      SEVERITY_STYLES[w.severity] ?? SEVERITY_STYLES.low
                    }
                  >
                    {w.severity}
                  </Badge>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{w.topic}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {w.details}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Recommended Resources</h2>
        </div>

        {recommendations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <Lightbulb className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                No recommendations available yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recommendations.map((rec) => (
              <Card key={rec.id} className="hover:shadow-md transition-all">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm truncate">
                      {rec.title}
                    </CardTitle>
                    <Badge variant="outline" className="flex-shrink-0">
                      {rec.type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{rec.reason}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
