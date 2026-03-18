"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Flame, Trophy, TrendingUp, Users, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StreakEntry {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  userName: string | null;
  userEmail: string;
  userRole: string;
}

interface StreakStats {
  totalTracked: number;
  activeStreaks: number;
  averageStreak: number;
  longestEver: number;
}

function getRankEmoji(index: number) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return `#${index + 1}`;
}

function getStreakLabel(streak: number) {
  if (streak >= 100) return "Legend";
  if (streak >= 30) return "Master";
  if (streak >= 14) return "Champion";
  if (streak >= 7) return "Warrior";
  if (streak >= 3) return "Rising";
  return null;
}

export default function StreaksPage() {
  const [leaderboard, setLeaderboard] = useState<StreakEntry[]>([]);
  const [stats, setStats] = useState<StreakStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStreaks = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/streaks");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setLeaderboard(data.leaderboard);
      setStats(data.stats);
    } catch {
      toast.error("Failed to load streak data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStreaks();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flame className="h-6 w-6 text-orange-500" />
            Streak Leaderboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Track learner engagement and daily activity streaks
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStreaks}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tracked</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTracked}</div>
              <p className="text-xs text-muted-foreground">Users with streak data</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Streaks</CardTitle>
              <Flame className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeStreaks}</div>
              <p className="text-xs text-muted-foreground">Currently on a streak</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Streak</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageStreak}</div>
              <p className="text-xs text-muted-foreground">Days across all users</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Longest Ever</CardTitle>
              <Trophy className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.longestEver}</div>
              <p className="text-xs text-muted-foreground">All-time record</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Top Streaks
          </CardTitle>
          <CardDescription>Top 50 users by current streak</CardDescription>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No streak data yet. Streaks are tracked when learners view resources.
            </p>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-1">
                {leaderboard.map((entry, i) => {
                  const label = getStreakLabel(entry.currentStreak);
                  return (
                    <div
                      key={entry.userId}
                      className="flex items-center gap-3 py-2.5 px-3 rounded-md hover:bg-muted/40 transition-colors"
                    >
                      <span className="w-8 text-center text-sm font-semibold flex-shrink-0">
                        {getRankEmoji(i)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {entry.userName || entry.userEmail}
                        </p>
                        {entry.userName && (
                          <p className="text-xs text-muted-foreground truncate">{entry.userEmail}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {label && (
                          <Badge variant="secondary" className="text-[10px]">{label}</Badge>
                        )}
                        <Badge variant={entry.currentStreak > 0 ? "default" : "outline"} className="tabular-nums">
                          {entry.currentStreak}d
                        </Badge>
                        <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">
                          Best: {entry.longestStreak}d
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
