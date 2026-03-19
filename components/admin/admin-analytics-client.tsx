"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Users, Target, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface SubjectPerformance {
  name: string;
  averageScore: number;
  studentCount: number;
}

interface TopicAnalytic {
  name: string;
  difficulty: "easy" | "medium" | "hard";
  averageScore: number;
  attemptCount: number;
  subjectName: string;
}

interface ClassPerformanceData {
  overview: {
    totalStudents: number;
    averageScore: number;
    completionRate: number;
  };
  subjects: SubjectPerformance[];
}

interface TopicAnalyticsData {
  topics: TopicAnalytic[];
}

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const variant =
    difficulty === "hard"
      ? "destructive"
      : difficulty === "medium"
        ? "default"
        : "secondary";

  return <Badge variant={variant}>{difficulty}</Badge>;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border p-4 space-y-3">
        <Skeleton className="h-6 w-40" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminAnalyticsClient() {
  const [classData, setClassData] = useState<ClassPerformanceData | null>(null);
  const [topicData, setTopicData] = useState<TopicAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      const [classRes, topicRes] = await Promise.all([
        fetch("/api/admin/ai/class-performance"),
        fetch("/api/admin/ai/topic-analytics"),
      ]);

      if (!classRes.ok) throw new Error("Failed to fetch class performance");
      if (!topicRes.ok) throw new Error("Failed to fetch topic analytics");

      const [classJson, topicJson] = await Promise.all([
        classRes.json(),
        topicRes.json(),
      ]);

      setClassData(classJson);
      setTopicData(topicJson);
    } catch {
      toast.error("Failed to load analytics data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!classData || !topicData) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>No analytics data available.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const { overview, subjects } = classData;
  const { topics } = topicData;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            AI Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Class performance and topic difficulty insights
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Students"
          value={overview.totalStudents}
          icon={Users}
        />
        <StatCard
          title="Average Score"
          value={`${overview.averageScore}%`}
          icon={Target}
        />
        <StatCard
          title="Completion Rate"
          value={`${overview.completionRate}%`}
          icon={BarChart3}
        />
      </div>

      {/* Topic Difficulty Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Topic Difficulty Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          {topics.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No topic data available yet
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Topic</th>
                    <th className="pb-2 font-medium">Subject</th>
                    <th className="pb-2 font-medium">Difficulty</th>
                    <th className="pb-2 font-medium text-right">Avg Score</th>
                    <th className="pb-2 font-medium text-right">Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {topics.map((topic, i) => (
                    <tr
                      key={`${topic.name}-${topic.subjectName}-${i}`}
                      className="border-b last:border-0 hover:bg-muted/40"
                    >
                      <td className="py-2.5">{topic.name}</td>
                      <td className="py-2.5 text-muted-foreground">
                        {topic.subjectName}
                      </td>
                      <td className="py-2.5">
                        <DifficultyBadge difficulty={topic.difficulty} />
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {topic.averageScore}%
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {topic.attemptCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subject Performance Cards */}
      {subjects.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Subject Performance
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map((subject) => (
              <Card key={subject.name}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{subject.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Avg Score</span>
                    <span className="font-semibold tabular-nums">
                      {subject.averageScore}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Students</span>
                    <span className="font-semibold tabular-nums">
                      {subject.studentCount}
                    </span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(subject.averageScore, 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
