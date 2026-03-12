"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  CreditCard,
  BarChart3,
  RefreshCw,
  Activity,
  Download,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AnalyticsData {
  users: {
    total: number;
    regulars: number;
    admins: number;
    superAdmins: number;
  };
  credits: {
    totalTransactions: number;
    totalCreditsFlowed: number;
    last30dTransactions: number;
    last30dCreditsFlowed: number;
  };
  topRatedResources: {
    resourceId: string;
    resourceTitle: string;
    resourceType: string | null;
    topicTitle: string | null;
    subjectName: string | null;
    levelTitle: string | null;
    upCount: number;
    downCount: number;
    totalRatings: number;
  }[];
  recentAuditLogs: {
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    actorEmail: string | null;
    createdAt: Date;
  }[];
  creditSpendingByDay: {
    day: string;
    creditsUsed: number;
    creditsPurchased: number;
  }[];
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  badge?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        {badge && (
          <Badge variant="secondary" className="mt-2 text-xs">
            {badge}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/analytics");
      if (!res.ok) throw new Error("Failed to fetch analytics");
      const json = await res.json();
      setData(json);
    } catch {
      toast.error("Failed to load analytics");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const maxCredits = Math.max(
    ...data.creditSpendingByDay.map((d) => Math.max(d.creditsUsed, d.creditsPurchased)),
    1
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Analytics
          </h1>
          <p className="text-muted-foreground mt-1">Institution statistics and trends</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open("/api/admin/content/export", "_blank")}>
            <Download className="h-4 w-4 mr-2" />
            Export Content
          </Button>
          <Button variant="outline" size="sm" onClick={fetchAnalytics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* User Stats */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Users
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Users"
            value={data.users.total}
            icon={Users}
          />
          <StatCard
            title="Learners"
            value={data.users.regulars}
            icon={Users}
            subtitle="Regular users"
          />
          <StatCard
            title="Admins"
            value={data.users.admins}
            icon={Users}
            subtitle="Institution admins"
          />
          <StatCard
            title="Super Admins"
            value={data.users.superAdmins}
            icon={Users}
          />
        </div>
      </div>

      {/* Credit Stats */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Credits
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Transactions"
            value={data.credits.totalTransactions}
            icon={CreditCard}
            subtitle="Credit transactions"
          />
          <StatCard
            title="Credits (30d)"
            value={data.credits.last30dCreditsFlowed.toLocaleString()}
            icon={CreditCard}
            subtitle="Credits flowed in 30 days"
          />
        </div>
      </div>

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Credit Spending by Day */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credit Activity (Last 7 Days)</CardTitle>
            <CardDescription>Credits used vs purchased per day</CardDescription>
          </CardHeader>
          <CardContent>
            {data.creditSpendingByDay.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No activity in the last 7 days
              </p>
            ) : (
              <div className="space-y-3">
                {data.creditSpendingByDay.map((day) => (
                  <div key={day.day} className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{new Date(day.day).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}</span>
                      <span>{day.creditsUsed} used / {day.creditsPurchased} purchased</span>
                    </div>
                    <div className="flex gap-1 h-2">
                      <div
                        className="bg-destructive/70 rounded-full"
                        style={{ width: `${(day.creditsUsed / maxCredits) * 100}%`, minWidth: day.creditsUsed > 0 ? "2px" : "0" }}
                      />
                      <div
                        className="bg-primary/70 rounded-full"
                        style={{ width: `${(day.creditsPurchased / maxCredits) * 100}%`, minWidth: day.creditsPurchased > 0 ? "2px" : "0" }}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex gap-4 text-xs text-muted-foreground pt-2">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-2 bg-destructive/70 rounded-full inline-block" />
                    Used
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-2 bg-primary/70 rounded-full inline-block" />
                    Purchased
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
      {/* Content Ratings */}
      {data.topRatedResources && data.topRatedResources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ThumbsUp className="h-4 w-4" />
              Content Ratings
            </CardTitle>
            <CardDescription>Learner feedback on top-rated resources</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topRatedResources.map((r) => {
                const total = r.upCount + r.downCount;
                const pct = total > 0 ? Math.round((r.upCount / total) * 100) : 0;
                return (
                  <div key={r.resourceId} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-muted/40">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.resourceTitle}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.levelTitle} › {r.subjectName} › {r.topicTitle}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <ThumbsUp className="h-3 w-3" />{r.upCount}
                      </span>
                      <span className="flex items-center gap-1 text-red-500">
                        <ThumbsDown className="h-3 w-3" />{r.downCount}
                      </span>
                      <Badge variant="secondary" className="text-xs">{pct}%</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Audit Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Recent Activity
          </CardTitle>
          <CardDescription>Last 50 system events</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentAuditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No audit events recorded yet</p>
          ) : (
            <ScrollArea className="h-[320px]">
              <div className="space-y-1">
                {data.recentAuditLogs.map((log) => (
                  <div key={log.id} className="flex items-start justify-between gap-3 py-2 px-2 rounded hover:bg-muted/40 text-xs">
                    <div className="flex items-start gap-2 min-w-0">
                      <Badge variant="outline" className="shrink-0 font-mono text-[10px] px-1.5">
                        {log.entityType}
                      </Badge>
                      <div className="min-w-0">
                        <p className="font-medium">{log.action}</p>
                        {log.entityId && (
                          <p className="text-muted-foreground font-mono truncate">{log.entityId}</p>
                        )}
                        {log.actorEmail && (
                          <p className="text-muted-foreground">{log.actorEmail}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-muted-foreground shrink-0 tabular-nums">
                      {new Date(log.createdAt).toLocaleDateString("en", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
