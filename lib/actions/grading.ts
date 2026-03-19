"use server";

import { db } from "@/lib/db";
import { aiSubmission, aiGrade, aiExam, aiAssignment } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

// ── Submit answers ──────────────────────────────────────────────

export async function submitAnswers(params: {
  userId: string;
  examId?: string;
  assignmentId?: string;
  type: string;
  answers: unknown;
  fileUrl?: string;
}) {
  const [submission] = await db
    .insert(aiSubmission)
    .values({
      userId: params.userId,
      examId: params.examId,
      assignmentId: params.assignmentId,
      type: params.type,
      answers: params.answers,
      fileUrl: params.fileUrl,
      status: "submitted",
    })
    .returning();

  return submission;
}

// ── Grade a submission with AI ──────────────────────────────────

export async function gradeSubmissionWithAI(submissionId: string) {
  // Fetch submission
  const [submission] = await db
    .select()
    .from(aiSubmission)
    .where(eq(aiSubmission.id, submissionId));

  if (!submission) throw new Error("Submission not found");

  // Mark as grading
  await db
    .update(aiSubmission)
    .set({ status: "grading" })
    .where(eq(aiSubmission.id, submissionId));

  // Fetch answer key from the assessment
  let answerKey: unknown[] = [];
  let maxScore = 0;

  if (submission.examId) {
    const [exam] = await db
      .select()
      .from(aiExam)
      .where(eq(aiExam.id, submission.examId));
    if (exam) {
      answerKey = (exam.answerKey as unknown[]) || [];
      maxScore = exam.totalMarks;
    }
  } else if (submission.assignmentId) {
    const [assignment] = await db
      .select()
      .from(aiAssignment)
      .where(eq(aiAssignment.id, submission.assignmentId));
    if (assignment) {
      answerKey = (assignment.answerKey as unknown[]) || [];
      maxScore = assignment.totalMarks;
    }
  }

  // Grade MCQ / true-false with exact matching
  const answers = submission.answers as Array<{
    questionId: string;
    answer: string;
  }>;
  const keyMap = new Map<
    string,
    { correctAnswer: string; marks: number; explanation?: string }
  >();
  (answerKey as Array<{ id?: string; questionId?: string; correctAnswer: string; marks: number; explanation?: string }>).forEach((k) => {
    keyMap.set(k.id || k.questionId || "", k);
  });

  let totalScore = 0;
  const perQuestionFeedback: Array<{
    questionId: string;
    score: number;
    maxMarks: number;
    correct: boolean;
    feedback: string;
  }> = [];

  for (const a of answers) {
    const key = keyMap.get(a.questionId);
    if (!key) {
      perQuestionFeedback.push({
        questionId: a.questionId,
        score: 0,
        maxMarks: 0,
        correct: false,
        feedback: "Question not found in answer key",
      });
      continue;
    }

    const isCorrect =
      String(a.answer).trim().toLowerCase() ===
      String(key.correctAnswer).trim().toLowerCase();
    const score = isCorrect ? key.marks : 0;
    totalScore += score;

    perQuestionFeedback.push({
      questionId: a.questionId,
      score,
      maxMarks: key.marks,
      correct: isCorrect,
      feedback: isCorrect
        ? "Correct!"
        : `Incorrect. The correct answer is: ${key.correctAnswer}${key.explanation ? `. ${key.explanation}` : ""}`,
    });
  }

  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const passed = percentage >= 50;

  // Save grade
  const [grade] = await db
    .insert(aiGrade)
    .values({
      submissionId,
      gradedBy: "ai",
      totalScore,
      maxScore,
      percentage,
      passed,
      perQuestionFeedback,
      overallFeedback: `You scored ${totalScore}/${maxScore} (${percentage}%). ${passed ? "Well done!" : "Keep practicing!"}`,
      aiConfidence: 95, // High for MCQ exact match
      status: "published",
      publishedAt: new Date(),
    })
    .returning();

  // Update submission status
  await db
    .update(aiSubmission)
    .set({ status: "published" })
    .where(eq(aiSubmission.id, submissionId));

  return grade;
}

// ── Get submissions ─────────────────────────────────────────────

export async function getSubmissionsByUser(userId: string) {
  return db
    .select()
    .from(aiSubmission)
    .where(and(eq(aiSubmission.userId, userId), eq(aiSubmission.isActive, true)))
    .orderBy(desc(aiSubmission.submittedAt));
}

export async function getSubmissionsByAssessment(
  assessmentId: string,
  type: "exam" | "assignment"
) {
  const col = type === "exam" ? aiSubmission.examId : aiSubmission.assignmentId;
  return db
    .select()
    .from(aiSubmission)
    .where(and(eq(col, assessmentId), eq(aiSubmission.isActive, true)))
    .orderBy(desc(aiSubmission.submittedAt));
}

export async function getSubmissionById(submissionId: string) {
  const [submission] = await db
    .select()
    .from(aiSubmission)
    .where(eq(aiSubmission.id, submissionId));
  return submission || null;
}

// ── Get grade ───────────────────────────────────────────────────

export async function getGrade(submissionId: string) {
  const [grade] = await db
    .select()
    .from(aiGrade)
    .where(eq(aiGrade.submissionId, submissionId));
  return grade || null;
}

// ── Teacher grade override ──────────────────────────────────────

export async function overrideGrade(
  gradeId: string,
  teacherId: string,
  overrides: {
    totalScore?: number;
    perQuestionOverrides?: Array<{
      questionId: string;
      newScore: number;
      feedback: string;
    }>;
    overallFeedback?: string;
  }
) {
  const [existing] = await db
    .select()
    .from(aiGrade)
    .where(eq(aiGrade.id, gradeId));
  if (!existing) throw new Error("Grade not found");

  const newTotal = overrides.totalScore ?? existing.totalScore;
  const percentage =
    existing.maxScore > 0
      ? Math.round((newTotal / existing.maxScore) * 100)
      : 0;

  const [updated] = await db
    .update(aiGrade)
    .set({
      teacherId,
      totalScore: newTotal,
      percentage,
      passed: percentage >= 50,
      overallFeedback: overrides.overallFeedback ?? existing.overallFeedback,
      teacherOverrides: overrides.perQuestionOverrides ?? existing.teacherOverrides,
      gradedBy: "teacher",
    })
    .where(eq(aiGrade.id, gradeId))
    .returning();

  // Update submission status
  await db
    .update(aiSubmission)
    .set({ status: "reviewed" })
    .where(eq(aiSubmission.id, existing.submissionId));

  await logAudit(
    teacherId,
    "grade.overridden",
    "ai_grade",
    gradeId,
    { totalScore: newTotal, percentage }
  );

  return updated;
}

// ── Publish grade ───────────────────────────────────────────────

export async function publishGrade(gradeId: string, actorId: string) {
  const [grade] = await db
    .update(aiGrade)
    .set({ status: "published", publishedAt: new Date() })
    .where(eq(aiGrade.id, gradeId))
    .returning();

  if (grade) {
    await db
      .update(aiSubmission)
      .set({ status: "published" })
      .where(eq(aiSubmission.id, grade.submissionId));

    await logAudit(actorId, "grade.published", "ai_grade", gradeId);
  }

  return grade;
}
