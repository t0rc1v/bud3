"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FileCheck,
  Eye,
  Loader2,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Send,
  Edit,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface SubmissionRow {
  id: string;
  userId: string;
  type: string;
  status: string;
  submittedAt: string;
  userName: string | null;
  userEmail: string;
  assessmentTitle: string;
  grade: {
    totalScore: number;
    maxScore: number;
    percentage: number;
    passed: boolean;
    gradedBy: string;
  } | null;
}

interface QuestionFeedback {
  questionId: string;
  score: number;
  maxMarks: number;
  correct: boolean;
  feedback: string;
}

interface DetailGrade {
  id: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  overallFeedback: string;
  perQuestionFeedback: QuestionFeedback[];
  gradedBy: string;
  status?: string;
  teacherOverrides?: unknown;
}

interface AssessmentQuestion {
  id?: string;
  questionId?: string;
  question?: string;
  text?: string;
  type?: string;
  options?: string[];
  marks?: number;
}

interface SubmissionDetail {
  submission: {
    id: string;
    type: string;
    status: string;
    submittedAt: string;
    answers: Array<{ questionId: string; answer: string }>;
  };
  grade: DetailGrade | null;
  assessmentTitle: string;
  questions?: AssessmentQuestion[];
}

export function AdminSubmissionsClient() {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Detail dialog
  const [selectedDetail, setSelectedDetail] = useState<SubmissionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Feedback state
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [overrideScore, setOverrideScore] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [publishingGrade, setPublishingGrade] = useState(false);

  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/submissions");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setSubmissions(data.submissions ?? []);
    } catch {
      toast.error("Failed to load submissions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const viewDetails = async (id: string) => {
    setDetailLoading(true);
    setDialogOpen(true);
    setSelectedDetail(null);
    setShowFeedbackForm(false);
    setFeedbackText("");
    setOverrideScore("");
    try {
      const res = await fetch(`/api/ai/submissions/${id}`);
      if (!res.ok) throw new Error("Failed to fetch details");
      const data: SubmissionDetail = await res.json();
      setSelectedDetail(data);
    } catch {
      toast.error("Failed to load submission details");
      setDialogOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const submitFeedback = async () => {
    if (!selectedDetail?.grade?.id) return;
    if (!feedbackText.trim() && !overrideScore) {
      toast.error("Provide feedback or a score override");
      return;
    }
    setFeedbackSubmitting(true);
    try {
      const res = await fetch(`/api/admin/submissions/${selectedDetail.submission.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gradeId: selectedDetail.grade.id,
          overallFeedback: feedbackText.trim() || undefined,
          totalScore: overrideScore ? Number(overrideScore) : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit feedback");
      const data = await res.json();
      toast.success("Feedback submitted");
      // Update local state with the updated grade
      if (data.grade && selectedDetail) {
        setSelectedDetail({
          ...selectedDetail,
          grade: {
            ...selectedDetail.grade,
            totalScore: data.grade.totalScore ?? selectedDetail.grade.totalScore,
            percentage: data.grade.percentage ?? selectedDetail.grade.percentage,
            passed: data.grade.passed ?? selectedDetail.grade.passed,
            overallFeedback: data.grade.overallFeedback ?? selectedDetail.grade.overallFeedback,
            gradedBy: data.grade.gradedBy ?? selectedDetail.grade.gradedBy,
          },
          submission: {
            ...selectedDetail.submission,
            status: data.submission?.status ?? "reviewed",
          },
        });
      }
      setShowFeedbackForm(false);
      setFeedbackText("");
      setOverrideScore("");
      // Refresh submissions list
      fetchSubmissions();
    } catch {
      toast.error("Failed to submit feedback");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const publishGrade = async () => {
    if (!selectedDetail?.grade?.id) return;
    setPublishingGrade(true);
    try {
      const res = await fetch(`/api/admin/submissions/${selectedDetail.submission.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gradeId: selectedDetail.grade.id }),
      });
      if (!res.ok) throw new Error("Failed to publish");
      toast.success("Grade published to student");
      if (selectedDetail) {
        setSelectedDetail({
          ...selectedDetail,
          grade: { ...selectedDetail.grade, status: "published" },
          submission: { ...selectedDetail.submission, status: "published" },
        });
      }
      fetchSubmissions();
    } catch {
      toast.error("Failed to publish grade");
    } finally {
      setPublishingGrade(false);
    }
  };

  const filtered = submissions.filter((s) => {
    const matchesSearch =
      !search ||
      (s.userName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      s.userEmail.toLowerCase().includes(search.toLowerCase()) ||
      s.assessmentTitle.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    const matchesType = typeFilter === "all" || s.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "graded":
      case "published":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "submitted":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100";
      case "grading":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      case "reviewed":
        return "bg-purple-100 text-purple-800 hover:bg-purple-100";
      default:
        return "";
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const getLetterGrade = (pct: number) => {
    if (pct >= 90) return "A";
    if (pct >= 80) return "B";
    if (pct >= 70) return "C";
    if (pct >= 60) return "D";
    if (pct >= 50) return "E";
    return "F";
  };

  // Summary stats
  const totalSubmissions = submissions.length;
  const gradedCount = submissions.filter((s) => s.grade).length;
  const avgScore =
    gradedCount > 0
      ? Math.round(
          submissions
            .filter((s) => s.grade)
            .reduce((sum, s) => sum + (s.grade?.percentage ?? 0), 0) / gradedCount
        )
      : 0;
  const passRate =
    gradedCount > 0
      ? Math.round(
          (submissions.filter((s) => s.grade?.passed).length / gradedCount) * 100
        )
      : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalSubmissions}</p>
            <p className="text-xs text-muted-foreground">Total Submissions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{gradedCount}</p>
            <p className="text-xs text-muted-foreground">Graded</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{avgScore}%</p>
            <p className="text-xs text-muted-foreground">Avg Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{passRate}%</p>
            <p className="text-xs text-muted-foreground">Pass Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by learner name, email, or assessment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="h-4 w-4 mr-1" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="grading">Grading</SelectItem>
            <SelectItem value="graded">Graded</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="exam">Exam</SelectItem>
            <SelectItem value="assignment">Assignment</SelectItem>
            <SelectItem value="quiz">Quiz</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Submissions table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-muted-foreground">
          <FileCheck className="h-12 w-12" />
          <p className="text-lg font-medium">
            {submissions.length === 0
              ? "No submissions from your learners yet"
              : "No submissions match your filters"}
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Learner</TableHead>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">
                          {sub.userName || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {sub.userEmail}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {sub.assessmentTitle}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{sub.type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(sub.submittedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusBadge(sub.status)}>
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {sub.grade ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "font-semibold text-sm",
                              sub.grade.passed
                                ? "text-green-700"
                                : "text-red-700"
                            )}
                          >
                            {sub.grade.percentage}%
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({getLetterGrade(sub.grade.percentage)})
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewDetails(sub.id)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedDetail?.assessmentTitle || "Submission Details"}
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : selectedDetail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="font-medium">Type:</span>
                <Badge variant="outline">
                  {selectedDetail.submission.type}
                </Badge>
                <span className="font-medium">Status:</span>
                <Badge className={statusBadge(selectedDetail.submission.status)}>
                  {selectedDetail.submission.status}
                </Badge>
                <span className="font-medium">Submitted:</span>
                <span>{formatDate(selectedDetail.submission.submittedAt)}</span>
              </div>

              {selectedDetail.grade && (
                <div className="space-y-6">
                  {selectedDetail.grade.gradedBy && (
                    <div className="flex justify-end">
                      <Badge variant="outline" className="text-xs">
                        Graded by {selectedDetail.grade.gradedBy}
                      </Badge>
                    </div>
                  )}

                  {/* Score summary */}
                  <div className="text-center space-y-3">
                    <div
                      className={cn(
                        "inline-flex items-center justify-center w-20 h-20 rounded-full text-3xl font-bold",
                        selectedDetail.grade.passed
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      )}
                    >
                      {selectedDetail.grade.percentage}%
                    </div>
                    <div className="space-y-1">
                      <p className="text-lg font-semibold">
                        {selectedDetail.grade.totalScore}/
                        {selectedDetail.grade.maxScore} marks
                      </p>
                      <Badge
                        className={cn(
                          "text-sm px-3 py-1",
                          selectedDetail.grade.passed
                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                            : "bg-red-100 text-red-800 hover:bg-red-100"
                        )}
                      >
                        {selectedDetail.grade.passed ? "Passed" : "Not Passed"} — Grade{" "}
                        {getLetterGrade(selectedDetail.grade.percentage)}
                      </Badge>
                    </div>
                    <Progress
                      value={selectedDetail.grade.percentage}
                      className="h-2 max-w-xs mx-auto"
                    />
                  </div>

                  {selectedDetail.grade.overallFeedback && (
                    <p className="text-sm text-muted-foreground text-center">
                      {selectedDetail.grade.overallFeedback}
                    </p>
                  )}

                  {/* Per-question feedback */}
                  {selectedDetail.grade.perQuestionFeedback?.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                        Question Review
                      </h3>
                      {selectedDetail.grade.perQuestionFeedback.map(
                        (fb, idx) => {
                          const q = selectedDetail.questions?.find(
                            (q) => (q.id || q.questionId) === fb.questionId
                          );
                          const questionText = q?.text || q?.question || "";
                          const studentAnswer = selectedDetail.submission.answers?.find(
                            (a) => a.questionId === fb.questionId
                          )?.answer;
                          const correctMatch = fb.feedback?.match(
                            /The correct answer is:\s*(.+?)(?:\.|$)/
                          );
                          const correctAnswer = correctMatch?.[1]?.trim();

                          return (
                          <Card
                            key={fb.questionId}
                            className={cn(
                              "border-l-4",
                              fb.correct ? "border-l-green-500" : "border-l-red-500"
                            )}
                          >
                            <CardContent className="p-4 space-y-2">
                              <div className="flex items-start gap-2">
                                {fb.correct ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                                ) : (
                                  <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1 min-w-0 space-y-1.5">
                                  <p className="font-medium text-sm">
                                    Q{idx + 1}. {questionText}
                                  </p>
                                  {studentAnswer && (
                                    <p className="text-sm">
                                      <span className="text-muted-foreground">Answer given: </span>
                                      <span className={cn(
                                        "font-medium",
                                        fb.correct ? "text-green-700" : "text-red-700"
                                      )}>
                                        {studentAnswer}
                                      </span>
                                    </p>
                                  )}
                                  {!fb.correct && correctAnswer && (
                                    <p className="text-sm">
                                      <span className="text-muted-foreground">Correct answer: </span>
                                      <span className="font-medium text-green-700">
                                        {correctAnswer}
                                      </span>
                                    </p>
                                  )}
                                  {fb.feedback && fb.correct && (
                                    <p className="text-sm text-green-700">
                                      {fb.feedback}
                                    </p>
                                  )}
                                </div>
                                <Badge variant="outline" className="flex-shrink-0">
                                  {fb.score}/{fb.maxMarks}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Feedback & Actions */}
              {selectedDetail.grade && (
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      Teacher Actions
                    </h3>
                    <div className="flex items-center gap-2">
                      {!showFeedbackForm && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowFeedbackForm(true);
                            setFeedbackText(selectedDetail.grade?.overallFeedback ?? "");
                            setOverrideScore("");
                          }}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Provide Feedback
                        </Button>
                      )}
                      {selectedDetail.grade.status !== "published" && (
                        <Button
                          size="sm"
                          onClick={publishGrade}
                          disabled={publishingGrade}
                        >
                          {publishingGrade ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-1" />
                          )}
                          Publish Grade
                        </Button>
                      )}
                    </div>
                  </div>

                  {showFeedbackForm && (
                    <Card>
                      <CardContent className="p-4 space-y-3">
                        <div>
                          <label className="text-xs font-medium mb-1 block">
                            Override Score (optional)
                          </label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              max={selectedDetail.grade.maxScore}
                              placeholder={`Current: ${selectedDetail.grade.totalScore}/${selectedDetail.grade.maxScore}`}
                              value={overrideScore}
                              onChange={(e) => setOverrideScore(e.target.value)}
                              className="w-48"
                            />
                            <span className="text-xs text-muted-foreground">
                              / {selectedDetail.grade.maxScore} marks
                            </span>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium mb-1 block">
                            Feedback to Student
                          </label>
                          <Textarea
                            placeholder="Write feedback for the student..."
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            rows={3}
                          />
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setShowFeedbackForm(false);
                              setFeedbackText("");
                              setOverrideScore("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={submitFeedback}
                            disabled={feedbackSubmitting || (!feedbackText.trim() && !overrideScore)}
                          >
                            {feedbackSubmitting ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                              <Send className="h-4 w-4 mr-1" />
                            )}
                            Submit Feedback
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* No grade yet — allow manual feedback */}
              {!selectedDetail.grade && (
                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    This submission has not been graded yet.
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
