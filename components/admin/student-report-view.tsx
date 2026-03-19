"use client";

import { useState } from "react";
import { Loader2, ChevronDown, ChevronUp, CheckCircle2, BookOpen, Library } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface QuizResult {
  quizTitle: string | null;
  score: number | null;
  totalMarks: number | null;
  percentage: number | null;
  passed: boolean | null;
  completedAt: string | null;
}

interface GradeResult {
  totalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  passed: boolean | null;
  gradedBy: string | null;
}

export interface ReportData {
  student: { name: string | null; email: string; level: string | null } | null;
  performance: {
    quizResults: QuizResult[];
    grades: GradeResult[];
    progressStats: { completed: number; started: number; total: number } | null;
  };
  generatedAt: string;
}

interface StudentReportViewProps {
  report: ReportData | null;
  isLoading: boolean;
}

const INITIAL_SHOW = 5;

export function StudentReportView({ report, isLoading }: StudentReportViewProps) {
  const [showAllQuizzes, setShowAllQuizzes] = useState(false);
  const [showAllGrades, setShowAllGrades] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!report) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No report data available
      </p>
    );
  }

  const rawStats = report.performance.progressStats;
  const stats = rawStats
    ? {
        completed: Number(rawStats.completed) || 0,
        started: Number(rawStats.started) || 0,
        total: Number(rawStats.total) || 0,
      }
    : null;
  const quizResults = report.performance.quizResults ?? [];
  const grades = report.performance.grades ?? [];

  const visibleQuizzes = showAllQuizzes ? quizResults : quizResults.slice(0, INITIAL_SHOW);
  const visibleGrades = showAllGrades ? grades : grades.slice(0, INITIAL_SHOW);

  return (
    <div className="space-y-5">
      {/* Student header */}
      {report.student && (
        <div className="flex items-center gap-3 pb-3 border-b">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
            {(report.student.name || report.student.email).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">
              {report.student.name || report.student.email}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {report.student.name && (
                <span className="truncate">{report.student.email}</span>
              )}
              {report.student.level && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {report.student.level}
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resource Progress */}
      {stats && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Resource Progress</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="border rounded-md p-3 text-center">
              <CheckCircle2 className="h-4 w-4 mx-auto mb-1 text-green-500" />
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
            <div className="border rounded-md p-3 text-center">
              <BookOpen className="h-4 w-4 mx-auto mb-1 text-blue-500" />
              <p className="text-2xl font-bold">{stats.started}</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
            <div className="border rounded-md p-3 text-center">
              <Library className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Resources</p>
            </div>
          </div>
          {stats.total > 0 && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {Math.round((stats.completed / stats.total) * 100)}% of all available resources completed
            </p>
          )}
        </div>
      )}

      {/* Quiz Results */}
      {quizResults.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">
              Quiz Results
              <span className="text-muted-foreground font-normal ml-1.5">
                ({quizResults.length})
              </span>
            </h3>
          </div>
          <div className="space-y-2">
            {visibleQuizzes.map((q, i) => (
              <div
                key={i}
                className="flex items-center justify-between border rounded-md p-3"
              >
                <div className="min-w-0 mr-3">
                  <p className="text-sm font-medium truncate">
                    {q.quizTitle || "Quiz"}
                  </p>
                  {q.completedAt && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(q.completedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-medium">
                    {q.score}/{q.totalMarks} (
                    {q.percentage != null ? Math.round(q.percentage) : 0}%)
                  </span>
                  <Badge variant={q.passed ? "default" : "destructive"}>
                    {q.passed ? "Passed" : "Failed"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          {quizResults.length > INITIAL_SHOW && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-xs"
              onClick={() => setShowAllQuizzes(!showAllQuizzes)}
            >
              {showAllQuizzes ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5 mr-1" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5 mr-1" />
                  Show all {quizResults.length} results
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Grades */}
      {grades.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">
              Submission Grades
              <span className="text-muted-foreground font-normal ml-1.5">
                ({grades.length})
              </span>
            </h3>
          </div>
          <div className="space-y-2">
            {visibleGrades.map((g, i) => (
              <div
                key={i}
                className="flex items-center justify-between border rounded-md p-3"
              >
                <span className="text-sm">
                  {g.totalScore}/{g.maxScore}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {g.percentage != null ? Math.round(g.percentage) : 0}%
                  </span>
                  <Badge variant={g.passed ? "default" : "destructive"}>
                    {g.passed ? "Passed" : "Failed"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          {grades.length > INITIAL_SHOW && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-xs"
              onClick={() => setShowAllGrades(!showAllGrades)}
            >
              {showAllGrades ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5 mr-1" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5 mr-1" />
                  Show all {grades.length} grades
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {quizResults.length === 0 && grades.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No quiz or grade data available for this learner yet.
        </p>
      )}

      <p className="text-xs text-muted-foreground text-right">
        Generated {new Date(report.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}
