"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Search,
  Send,
  RefreshCw,
  Loader2,
  Eye,
  Users,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StudentReportView, type ReportData } from "@/components/admin/student-report-view";
import { toast } from "sonner";

// ── Types ──

interface ClassOverview {
  totalStudents: number;
  averageScore: number;
  completionRate: number;
}

interface ClassStudent {
  studentId: string;
  name: string;
  email: string;
  avgPercentage: number;
  attemptCount: number;
}

interface TopicStat {
  subject: string;
  avgPercentage: number;
  attemptCount: number;
  passRate: number;
}

interface ParentReport {
  id: string;
  studentId: string;
  studentEmail?: string | null;
  reportType: string;
  period: { startDate: string; endDate: string } | null;
  content: unknown;
  emailSent: boolean;
  createdAt: string;
}

// ── Component ──

export function ReportsClient() {
  const [activeTab, setActiveTab] = useState("class-overview");

  // Class Overview state
  const [overview, setOverview] = useState<ClassOverview | null>(null);
  const [classStudents, setClassStudents] = useState<ClassStudent[]>([]);
  const [topics, setTopics] = useState<TopicStat[]>([]);
  const [isLoadingClass, setIsLoadingClass] = useState(true);
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);

  // Student Reports state
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStudentEmail, setSelectedStudentEmail] = useState<string | null>(null);
  const [studentReport, setStudentReport] = useState<ReportData | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportPeriod, setReportPeriod] = useState("7");

  // Parent Reports state
  const [parentReports, setParentReports] = useState<ParentReport[]>([]);
  const [isLoadingParentReports, setIsLoadingParentReports] = useState(true);
  const [parentSearch, setParentSearch] = useState("");
  const [parentFilter, setParentFilter] = useState<"all" | "sent" | "not_sent">("all");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [previewReport, setPreviewReport] = useState<ParentReport | null>(null);
  const [previewLiveData, setPreviewLiveData] = useState<ReportData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // ── Data fetching ──

  const fetchClassPerformance = useCallback(async () => {
    try {
      setIsLoadingClass(true);
      const res = await fetch("/api/admin/ai/class-performance");
      if (res.ok) {
        const data = await res.json();
        setOverview(data.overview ?? null);
        setClassStudents(data.students ?? []);
      }
    } catch {
      toast.error("Failed to load class performance");
    } finally {
      setIsLoadingClass(false);
    }
  }, []);

  const fetchTopics = useCallback(async () => {
    try {
      setIsLoadingTopics(true);
      const res = await fetch("/api/admin/ai/topic-analytics");
      if (res.ok) {
        const data = await res.json();
        setTopics(data.topics ?? []);
      }
    } catch {
      toast.error("Failed to load topic analytics");
    } finally {
      setIsLoadingTopics(false);
    }
  }, []);

  const fetchParentReports = useCallback(async () => {
    try {
      setIsLoadingParentReports(true);
      const res = await fetch("/api/admin/ai/parent-reports");
      if (res.ok) {
        const data = await res.json();
        setParentReports(data.reports ?? []);
      }
    } catch {
      toast.error("Failed to load parent reports");
    } finally {
      setIsLoadingParentReports(false);
    }
  }, []);

  useEffect(() => {
    fetchClassPerformance();
    fetchTopics();
    fetchParentReports();
  }, [fetchClassPerformance, fetchTopics, fetchParentReports]);

  // Fetch individual student report
  const fetchStudentReport = useCallback(async (email: string) => {
    setIsLoadingReport(true);
    setStudentReport(null);
    try {
      const res = await fetch(
        `/api/admin/ai/student/_/report?email=${encodeURIComponent(email)}`
      );
      if (!res.ok) throw new Error();
      const d = await res.json();
      setStudentReport(d.report ?? d);
    } catch {
      toast.error("Failed to load learner report");
    } finally {
      setIsLoadingReport(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStudentEmail) {
      fetchStudentReport(selectedStudentEmail);
    }
  }, [selectedStudentEmail, fetchStudentReport]);

  // ── Handlers ──

  const selectStudent = (id: string, email: string) => {
    setSelectedStudentId(id);
    setSelectedStudentEmail(email);
  };

  const handleStudentRowClick = (id: string, email: string) => {
    selectStudent(id, email);
  };

  const handleGenerateParentReport = async () => {
    if (!selectedStudentEmail) return;
    setIsGenerating(true);
    try {
      const now = new Date();
      const days = parseInt(reportPeriod, 10);
      const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      const res = await fetch("/api/admin/ai/parent-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentEmail: selectedStudentEmail,
          reportType: days === 7 ? "weekly" : days === 30 ? "monthly" : "custom",
          period: { startDate: start.toISOString(), endDate: now.toISOString() },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed");
      }
      toast.success("Parent report generated");
      fetchParentReports();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate parent report"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const openParentReportPreview = async (report: ParentReport) => {
    setPreviewReport(report);
    setPreviewLiveData(null);

    // Fetch live data for this student so the preview matches the learner report
    const email = report.studentEmail;
    if (!email) return;

    setIsLoadingPreview(true);
    try {
      const res = await fetch(
        `/api/admin/ai/student/_/report?email=${encodeURIComponent(email)}`
      );
      if (res.ok) {
        const d = await res.json();
        setPreviewLiveData(d.report ?? d);
      }
    } catch {
      // Fall back to stored content silently
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleSendReport = async (reportId: string) => {
    setSendingId(reportId);
    try {
      const res = await fetch(`/api/admin/ai/parent-reports/${reportId}/send`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      toast.success("Report sent");
      fetchParentReports();
    } catch {
      toast.error("Failed to send report");
    } finally {
      setSendingId(null);
    }
  };

  // ── Filtered data ──

  const filteredStudents = classStudents.filter(
    (s) =>
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const filteredParentReports = parentReports.filter((r) => {
    const matchesSearch =
      !parentSearch ||
      (r.studentEmail ?? "").toLowerCase().includes(parentSearch.toLowerCase());
    const matchesFilter =
      parentFilter === "all" ||
      (parentFilter === "sent" && r.emailSent) ||
      (parentFilter === "not_sent" && !r.emailSent);
    return matchesSearch && matchesFilter;
  });

  // ── Helpers ──

  function difficultyColor(pct: number) {
    if (pct < 50) return "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-900";
    if (pct < 75) return "text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-950 dark:border-yellow-900";
    return "text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950 dark:border-green-900";
  }

  function formatPeriod(period: { startDate: string; endDate: string } | null) {
    if (!period) return "—";
    const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${fmt(period.startDate)} – ${fmt(period.endDate)}`;
  }

  // ── Render ──

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Reports
        </h1>
        <p className="text-muted-foreground mt-1">
          View learner reports and class analytics
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="class-overview">Class Overview</TabsTrigger>
          <TabsTrigger value="student-reports">Learner Reports</TabsTrigger>
          <TabsTrigger value="parent-reports">Parent Reports</TabsTrigger>
        </TabsList>

        {/* ═══ Tab 1: Class Overview ═══ */}
        <TabsContent value="class-overview" className="space-y-6">
          {/* Summary cards */}
          {isLoadingClass ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Users className="h-8 w-8 text-blue-500" />
                      <div>
                        <p className="text-2xl font-bold">{overview?.totalStudents ?? 0}</p>
                        <p className="text-xs text-muted-foreground">Total Learners</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="h-8 w-8 text-green-500" />
                      <div>
                        <p className="text-2xl font-bold">{overview?.averageScore ?? 0}%</p>
                        <p className="text-xs text-muted-foreground">Average Score</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <BarChart3 className="h-8 w-8 text-purple-500" />
                      <div>
                        <p className="text-2xl font-bold">{overview?.completionRate ?? 0}%</p>
                        <p className="text-xs text-muted-foreground">Completion Rate</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Student table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Learners</CardTitle>
                </CardHeader>
                <CardContent>
                  {classStudents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No learners found
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 font-medium">Name</th>
                            <th className="pb-2 font-medium">Email</th>
                            <th className="pb-2 font-medium text-right">Avg Score</th>
                            <th className="pb-2 font-medium text-right">Attempts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classStudents.map((s) => (
                            <tr
                              key={s.studentId}
                              className="border-b last:border-0 hover:bg-muted/40 cursor-pointer transition-colors"
                              onClick={() => handleStudentRowClick(s.studentId, s.email)}
                            >
                              <td className="py-2.5">{s.name}</td>
                              <td className="py-2.5 text-muted-foreground">{s.email}</td>
                              <td className="py-2.5 text-right font-medium">
                                {Math.round(s.avgPercentage)}%
                              </td>
                              <td className="py-2.5 text-right">{s.attemptCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Topic difficulty */}
              {isLoadingTopics ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : topics.length > 0 ? (
                <div>
                  <h2 className="text-base font-semibold mb-3">Topic Difficulty</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {topics.map((t) => {
                      const pct = Math.round(t.avgPercentage);
                      return (
                        <div
                          key={t.subject}
                          className={`border rounded-lg p-4 ${difficultyColor(pct)}`}
                        >
                          <p className="font-medium text-sm">{t.subject}</p>
                          <div className="mt-2 flex items-center justify-between text-xs">
                            <span>Avg: {pct}%</span>
                            <span>{t.attemptCount} attempts</span>
                          </div>
                          <div className="mt-1 text-xs">
                            Pass rate: {Math.round(t.passRate)}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </TabsContent>

        {/* ═══ Tab 2: Learner Reports ═══ */}
        <TabsContent value="student-reports" className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search learners..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {!isLoadingClass && (
              <p className="text-xs text-muted-foreground">
                {filteredStudents.length === classStudents.length
                  ? `${classStudents.length} learners`
                  : `${filteredStudents.length} of ${classStudents.length} learners`}
              </p>
            )}
          </div>

          <Card>
            <CardContent className="pt-6">
              {isLoadingClass ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {classStudents.length === 0
                    ? "No learners enrolled"
                    : "No matching learners"}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">Name</th>
                        <th className="pb-2 font-medium">Email</th>
                        <th className="pb-2 font-medium text-right">Avg Score</th>
                        <th className="pb-2 font-medium text-right">Attempts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((s) => (
                        <tr
                          key={s.studentId}
                          className="border-b last:border-0 hover:bg-muted/40 cursor-pointer transition-colors"
                          onClick={() => selectStudent(s.studentId, s.email)}
                        >
                          <td className="py-2.5">{s.name}</td>
                          <td className="py-2.5 text-muted-foreground">{s.email}</td>
                          <td className="py-2.5 text-right font-medium">
                            {Math.round(s.avgPercentage)}%
                          </td>
                          <td className="py-2.5 text-right">{s.attemptCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Learner report modal */}
          <Dialog
            open={!!selectedStudentEmail}
            onOpenChange={(open) => {
              if (!open) {
                setSelectedStudentId(null);
                setSelectedStudentEmail(null);
                setStudentReport(null);
              }
            }}
          >
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Learner Report
                </DialogTitle>
              </DialogHeader>
              <StudentReportView
                report={studentReport}
                isLoading={isLoadingReport}
              />
              {studentReport && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-3 border-t">
                  <Select
                    value={reportPeriod}
                    onValueChange={setReportPeriod}
                  >
                    <SelectTrigger className="w-full sm:w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Last 7 days</SelectItem>
                      <SelectItem value="30">Last 30 days</SelectItem>
                      <SelectItem value="90">Last 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleGenerateParentReport}
                    disabled={isGenerating}
                    className="w-full sm:w-auto"
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    Generate Parent Report
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ═══ Tab 3: Parent Reports ═══ */}
        <TabsContent value="parent-reports" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email..."
                value={parentSearch}
                onChange={(e) => setParentSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={parentFilter}
              onValueChange={(v) => setParentFilter(v as typeof parentFilter)}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="not_sent">Not Sent</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={fetchParentReports}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="pt-6">
              {isLoadingParentReports ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredParentReports.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No parent reports found
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">Student</th>
                        <th className="pb-2 font-medium">Type</th>
                        <th className="pb-2 font-medium">Period</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredParentReports.map((r) => (
                        <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="py-2.5">
                            {r.studentEmail || r.studentId}
                          </td>
                          <td className="py-2.5 capitalize">{r.reportType}</td>
                          <td className="py-2.5 text-muted-foreground">
                            {formatPeriod(r.period)}
                          </td>
                          <td className="py-2.5">
                            <Badge variant={r.emailSent ? "default" : "secondary"}>
                              {r.emailSent ? "Sent" : "Not Sent"}
                            </Badge>
                          </td>
                          <td className="py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openParentReportPreview(r)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {!r.emailSent && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSendReport(r.id)}
                                  disabled={sendingId === r.id}
                                >
                                  {sendingId === r.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Send className="h-4 w-4 mr-1" />
                                      Send
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview dialog */}
          <Dialog
            open={!!previewReport}
            onOpenChange={(open) => {
              if (!open) {
                setPreviewReport(null);
                setPreviewLiveData(null);
              }
            }}
          >
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Parent Report Preview
                </DialogTitle>
              </DialogHeader>
              {previewReport && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{previewReport.studentEmail || previewReport.studentId}</span>
                    <Badge variant="outline" className="capitalize">
                      {previewReport.reportType}
                    </Badge>
                    <span>{formatPeriod(previewReport.period)}</span>
                  </div>
                  <StudentReportView
                    report={previewLiveData}
                    isLoading={isLoadingPreview}
                  />
                  <div className="flex items-center justify-between pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(previewReport.createdAt).toLocaleString()}
                    </p>
                    {!previewReport.emailSent && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          handleSendReport(previewReport.id);
                          setPreviewReport(null);
                        }}
                        disabled={sendingId === previewReport.id}
                      >
                        {sendingId === previewReport.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Send className="h-4 w-4 mr-1" />
                        )}
                        Send to Parent
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
