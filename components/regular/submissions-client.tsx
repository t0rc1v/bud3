"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FileCheck,
  Eye,
  Loader2,
  Plus,
  ChevronLeft,
  CheckCircle2,
  Circle,
  XCircle,
  Trophy,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Submission {
  id: string;
  type: string;
  status: string;
  submittedAt: string;
  examId: string | null;
  assignmentId: string | null;
}

interface QuestionFeedback {
  questionId: string;
  score: number;
  maxMarks: number;
  correct: boolean;
  feedback: string;
}

interface Grade {
  totalScore: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  overallFeedback: string;
  perQuestionFeedback: QuestionFeedback[];
  letterGrade?: string;
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
  submission: Submission & { answers?: Array<{ questionId: string; answer: string }> };
  grade: Grade | null;
  assessmentTitle?: string;
  questions?: AssessmentQuestion[];
}

interface ExamQuestion {
  id?: string;
  questionId?: string;
  question?: string;
  text?: string;
  type?: string;
  options?: string[];
  marks?: number;
}

interface ExamSection {
  sectionTitle: string;
  questions: ExamQuestion[];
}

interface Assessment {
  id: string;
  title: string;
  subject: string;
  level: string;
  totalMarks: number;
  timeLimit: number | null;
  sections?: ExamSection[];
  questions?: ExamQuestion[];
}

type SubmitStep = "pick" | "answer" | "results";

export function SubmissionsClient() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDetail, setSelectedDetail] = useState<SubmissionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // New submission flow
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitStep, setSubmitStep] = useState<SubmitStep>("pick");
  const [exams, setExams] = useState<Assessment[]>([]);
  const [assignments, setAssignments] = useState<Assessment[]>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [selectedType, setSelectedType] = useState<"exam" | "assignment">("exam");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submissionGrade, setSubmissionGrade] = useState<Grade | null>(null);

  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/submissions");
      if (!res.ok) throw new Error("Failed to fetch submissions");
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

  const openSubmitFlow = async () => {
    setSubmitOpen(true);
    setSubmitStep("pick");
    setSelectedAssessment(null);
    setAnswers({});
    setSubmissionGrade(null);
    setAssessmentsLoading(true);
    try {
      const res = await fetch("/api/ai/assessments");
      if (!res.ok) throw new Error("Failed to fetch assessments");
      const data = await res.json();
      setExams(data.exams ?? []);
      setAssignments(data.assignments ?? []);
    } catch {
      toast.error("Failed to load available assessments");
      setSubmitOpen(false);
    } finally {
      setAssessmentsLoading(false);
    }
  };

  const selectAssessment = (assessment: Assessment, type: "exam" | "assignment") => {
    setSelectedAssessment(assessment);
    setSelectedType(type);
    setAnswers({});
    setSubmitStep("answer");
  };

  const getQuestions = (): { id: string; question: string; type?: string; options?: string[]; marks?: number }[] => {
    if (!selectedAssessment) return [];
    if (selectedAssessment.sections) {
      return selectedAssessment.sections.flatMap((s) =>
        s.questions.map((q) => {
          const questionText = q.text || q.question || "";
          return {
            id: q.id || q.questionId || questionText,
            question: questionText,
            type: q.type,
            options: q.options,
            marks: q.marks,
          };
        })
      );
    }
    if (selectedAssessment.questions) {
      return (selectedAssessment.questions as ExamQuestion[]).map((q) => {
        const questionText = q.text || q.question || "";
        return {
          id: q.id || q.questionId || questionText,
          question: questionText,
          type: q.type,
          options: q.options,
          marks: q.marks,
        };
      });
    }
    return [];
  };

  const handleSubmit = async () => {
    if (!selectedAssessment) return;
    const questions = getQuestions();
    const unanswered = questions.filter((q) => !answers[q.id]?.trim());
    if (unanswered.length > 0) {
      toast.error(`Please answer all questions (${unanswered.length} remaining)`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        type: selectedType,
        ...(selectedType === "exam"
          ? { examId: selectedAssessment.id }
          : { assignmentId: selectedAssessment.id }),
        answers: questions.map((q) => ({
          questionId: q.id,
          answer: answers[q.id],
        })),
      };
      const res = await fetch("/api/ai/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to submit");
      const data = await res.json();
      setSubmissionGrade(data.grade);
      setSubmitStep("results");
      fetchSubmissions();
    } catch {
      toast.error("Failed to submit answers");
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "graded":
      case "published":
        return "default" as const;
      case "submitted":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "graded":
      case "published":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "submitted":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100";
      default:
        return "";
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getLetterGrade = (pct: number) => {
    if (pct >= 90) return "A";
    if (pct >= 80) return "B";
    if (pct >= 70) return "C";
    if (pct >= 60) return "D";
    if (pct >= 50) return "E";
    return "F";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const questions = getQuestions();
  const answeredCount = questions.filter((q) => answers[q.id]?.trim()).length;

  // Build a feedback map for the results view
  const feedbackMap = new Map<string, QuestionFeedback>();
  if (submissionGrade?.perQuestionFeedback) {
    for (const f of submissionGrade.perQuestionFeedback) {
      feedbackMap.set(f.questionId, f);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Submissions</h1>
        <Button onClick={openSubmitFlow}>
          <Plus className="h-4 w-4 mr-1" />
          New Submission
        </Button>
      </div>

      {submissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-muted-foreground">
          <FileCheck className="h-12 w-12" />
          <p className="text-lg font-medium">No submissions yet</p>
          <p className="text-sm">Submit your first exam or assignment</p>
          <Button variant="outline" onClick={openSubmitFlow}>
            <Plus className="h-4 w-4 mr-1" />
            New Submission
          </Button>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>{formatDate(sub.submittedAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{sub.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusBadgeVariant(sub.status)}
                        className={statusColor(sub.status)}
                      >
                        {sub.status}
                      </Badge>
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

      {/* View Details Dialog */}
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
                <Badge
                  variant={statusBadgeVariant(selectedDetail.submission.status)}
                  className={statusColor(selectedDetail.submission.status)}
                >
                  {selectedDetail.submission.status}
                </Badge>
                <span className="font-medium">Submitted:</span>
                <span>
                  {formatDate(selectedDetail.submission.submittedAt)}
                </span>
              </div>

              {selectedDetail.grade && (
                <GradeResultsView
                  grade={selectedDetail.grade}
                  questions={selectedDetail.questions}
                  answers={selectedDetail.submission.answers}
                />
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* New Submission Dialog */}
      <Dialog open={submitOpen} onOpenChange={(open) => {
        if (!open && submitStep === "results") {
          // Allow closing from results
          setSubmitOpen(false);
        } else if (!open && !submitting) {
          setSubmitOpen(false);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {submitStep === "pick" && "Select Assessment"}
              {submitStep === "answer" && selectedAssessment?.title}
              {submitStep === "results" && "Your Results"}
            </DialogTitle>
          </DialogHeader>

          {assessmentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : submitStep === "pick" ? (
            <div className="space-y-4">
              {exams.length === 0 && assignments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No assessments available yet. Your teacher will assign them via AI Chat.
                </p>
              ) : (
                <>
                  {exams.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Exams
                      </h3>
                      <div className="space-y-2">
                        {exams.map((exam) => (
                          <Card
                            key={exam.id}
                            className="cursor-pointer hover:shadow-md transition-all"
                            onClick={() => selectAssessment(exam, "exam")}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">{exam.title}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {exam.subject} - {exam.level} - {exam.totalMarks} marks
                                    {exam.timeLimit ? ` - ${exam.timeLimit}min` : ""}
                                  </p>
                                </div>
                                <Badge variant="outline">Exam</Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                  {assignments.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Assignments
                      </h3>
                      <div className="space-y-2">
                        {assignments.map((a) => (
                          <Card
                            key={a.id}
                            className="cursor-pointer hover:shadow-md transition-all"
                            onClick={() => selectAssessment(a, "assignment")}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">{a.title}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {a.subject} - {a.level} - {a.totalMarks} marks
                                    {a.timeLimit ? ` - ${a.timeLimit}min` : ""}
                                  </p>
                                </div>
                                <Badge variant="outline">Assignment</Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : submitStep === "answer" ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSubmitStep("pick")}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <span className="text-sm text-muted-foreground">
                  {answeredCount}/{questions.length} answered
                </span>
              </div>

              {questions.map((q, idx) => (
                <Card key={q.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      {answers[q.id]?.trim() ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <span>
                        Q{idx + 1}. {q.question}
                      </span>
                      {q.marks && (
                        <Badge variant="outline" className="ml-auto flex-shrink-0">
                          {q.marks} marks
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {q.options && q.options.length > 0 ? (
                      <RadioGroup
                        value={answers[q.id] || ""}
                        onValueChange={(val) =>
                          setAnswers((prev) => ({ ...prev, [q.id]: val }))
                        }
                      >
                        {q.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center space-x-2">
                            <RadioGroupItem
                              value={opt}
                              id={`${q.id}-${oi}`}
                            />
                            <Label htmlFor={`${q.id}-${oi}`}>{opt}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    ) : (
                      <Textarea
                        placeholder="Type your answer..."
                        value={answers[q.id] || ""}
                        onChange={(e) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [q.id]: e.target.value,
                          }))
                        }
                        rows={3}
                      />
                    )}
                  </CardContent>
                </Card>
              ))}

              {questions.length > 0 && (
                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <FileCheck className="h-4 w-4 mr-1" />
                  )}
                  Submit ({answeredCount}/{questions.length})
                </Button>
              )}
            </div>
          ) : submitStep === "results" ? (
            <div className="space-y-6">
              {submissionGrade ? (
                <>
                  {/* Score summary */}
                  <div className="text-center space-y-3">
                    <div className={cn(
                      "inline-flex items-center justify-center w-20 h-20 rounded-full text-3xl font-bold",
                      submissionGrade.passed
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    )}>
                      {submissionGrade.percentage}%
                    </div>
                    <div className="space-y-1">
                      <p className="text-lg font-semibold">
                        {submissionGrade.totalScore}/{submissionGrade.maxScore} marks
                      </p>
                      <Badge
                        className={cn(
                          "text-sm px-3 py-1",
                          submissionGrade.passed
                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                            : "bg-red-100 text-red-800 hover:bg-red-100"
                        )}
                      >
                        {submissionGrade.passed ? "Passed" : "Not Passed"} — Grade {getLetterGrade(submissionGrade.percentage)}
                      </Badge>
                    </div>
                    <Progress
                      value={submissionGrade.percentage}
                      className="h-2 max-w-xs mx-auto"
                    />
                  </div>

                  {/* Per-question feedback */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      Answer Key & Feedback
                    </h3>
                    {questions.map((q, idx) => {
                      const fb = feedbackMap.get(q.id);
                      return (
                        <Card key={q.id} className={cn(
                          "border-l-4",
                          fb?.correct ? "border-l-green-500" : "border-l-red-500"
                        )}>
                          <CardContent className="p-4 space-y-2">
                            <div className="flex items-start gap-2">
                              {fb?.correct ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">
                                  Q{idx + 1}. {q.question}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  <span className="font-medium">Your answer:</span>{" "}
                                  {answers[q.id] || "—"}
                                </p>
                                {fb && (
                                  <p className={cn(
                                    "text-sm mt-1",
                                    fb.correct ? "text-green-700" : "text-red-700"
                                  )}>
                                    {fb.feedback}
                                  </p>
                                )}
                              </div>
                              {fb && (
                                <Badge variant="outline" className="flex-shrink-0">
                                  {fb.score}/{fb.maxMarks}
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setSubmitOpen(false)}
                    >
                      Done
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setSubmitStep("pick");
                        setSelectedAssessment(null);
                        setAnswers({});
                        setSubmissionGrade(null);
                      }}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Take Another
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Your submission was recorded but grading is pending.</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setSubmitOpen(false)}
                  >
                    Done
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Reusable grade results view for the detail dialog */
function GradeResultsView({
  grade,
  questions,
  answers,
}: {
  grade: Grade;
  questions?: AssessmentQuestion[];
  answers?: Array<{ questionId: string; answer: string }>;
}) {
  const getLetterGrade = (pct: number) => {
    if (pct >= 90) return "A";
    if (pct >= 80) return "B";
    if (pct >= 70) return "C";
    if (pct >= 60) return "D";
    if (pct >= 50) return "E";
    return "F";
  };

  return (
    <div className="space-y-6">
      {/* Score summary */}
      <div className="text-center space-y-3">
        <div className={cn(
          "inline-flex items-center justify-center w-20 h-20 rounded-full text-3xl font-bold",
          grade.passed
            ? "bg-green-100 text-green-700"
            : "bg-red-100 text-red-700"
        )}>
          {grade.percentage}%
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold">
            {grade.totalScore}/{grade.maxScore} marks
          </p>
          <Badge
            className={cn(
              "text-sm px-3 py-1",
              grade.passed
                ? "bg-green-100 text-green-800 hover:bg-green-100"
                : "bg-red-100 text-red-800 hover:bg-red-100"
            )}
          >
            {grade.passed ? "Passed" : "Not Passed"} — Grade {grade.letterGrade || getLetterGrade(grade.percentage)}
          </Badge>
        </div>
        <Progress
          value={grade.percentage}
          className="h-2 max-w-xs mx-auto"
        />
      </div>

      {grade.overallFeedback && (
        <p className="text-sm text-muted-foreground text-center">
          {grade.overallFeedback}
        </p>
      )}

      {/* Per-question feedback */}
      {grade.perQuestionFeedback && grade.perQuestionFeedback.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Question Review
          </h3>
          {grade.perQuestionFeedback.map((fb, idx) => {
            const q = questions?.find(
              (q) => (q.id || q.questionId) === fb.questionId
            );
            const questionText = q?.text || q?.question || "";
            const studentAnswer = answers?.find(
              (a) => a.questionId === fb.questionId
            )?.answer;
            // Extract correct answer from feedback string
            const correctMatch = fb.feedback?.match(
              /The correct answer is:\s*(.+?)(?:\.|$)/
            );
            const correctAnswer = correctMatch?.[1]?.trim();

            return (
            <Card key={fb.questionId} className={cn(
              "border-l-4",
              fb.correct ? "border-l-green-500" : "border-l-red-500"
            )}>
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
                        <span className="text-muted-foreground">Your answer: </span>
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
          })}
        </div>
      )}
    </div>
  );
}
