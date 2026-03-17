"use server";

import { db } from "@/lib/db";
import {
  aiQuizAttempt,
  aiQuiz,
  aiGrade,
  aiSubmission,
  resourceProgress,
  user,
  adminRegulars,
} from "@/lib/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";

/**
 * Get performance data for a specific student (teacher's regular).
 */
export async function getStudentPerformance(studentId: string) {
  // Quiz attempts
  const quizResults = await db
    .select({
      quizTitle: aiQuiz.subject,
      score: aiQuizAttempt.score,
      totalMarks: aiQuizAttempt.totalMarks,
      percentage: aiQuizAttempt.percentage,
      passed: aiQuizAttempt.passed,
      completedAt: aiQuizAttempt.completedAt,
    })
    .from(aiQuizAttempt)
    .innerJoin(aiQuiz, eq(aiQuizAttempt.quizId, aiQuiz.id))
    .where(eq(aiQuizAttempt.userId, studentId))
    .orderBy(desc(aiQuizAttempt.completedAt))
    .limit(20);

  // Grades from submissions
  const grades = await db
    .select({
      totalScore: aiGrade.totalScore,
      maxScore: aiGrade.maxScore,
      percentage: aiGrade.percentage,
      passed: aiGrade.passed,
      gradedBy: aiGrade.gradedBy,
    })
    .from(aiGrade)
    .innerJoin(aiSubmission, eq(aiGrade.submissionId, aiSubmission.id))
    .where(eq(aiSubmission.userId, studentId))
    .orderBy(desc(aiGrade.createdAt))
    .limit(20);

  // Resource progress
  const [progressStats] = await db
    .select({
      completed: sql<number>`count(*) filter (where ${resourceProgress.status} = 'completed')`,
      started: sql<number>`count(*) filter (where ${resourceProgress.status} = 'started')`,
      total: sql<number>`count(*)`,
    })
    .from(resourceProgress)
    .where(eq(resourceProgress.userId, studentId));

  return { quizResults, grades, progressStats };
}

/**
 * Get class-level performance for all regulars belonging to this admin.
 */
export async function getClassPerformance(adminClerkId: string) {
  // Get admin's regulars
  const { getUserByClerkId } = await import("@/lib/actions/auth");
  const admin = await getUserByClerkId(adminClerkId);
  if (!admin) return { students: [], averageScore: 0 };

  const regulars = await db
    .select({ regularId: adminRegulars.regularId, email: adminRegulars.regularEmail })
    .from(adminRegulars)
    .where(and(eq(adminRegulars.adminId, admin.id), eq(adminRegulars.isActive, true)));

  const studentIds = regulars.map((r) => r.regularId);
  if (studentIds.length === 0) return { students: [], averageScore: 0 };

  // Get average quiz scores per student
  const results = await Promise.all(
    studentIds.map(async (sid) => {
      const [avg] = await db
        .select({
          avgPercentage: sql<number>`coalesce(avg(${aiQuizAttempt.percentage}), 0)`,
          attemptCount: sql<number>`count(*)`,
        })
        .from(aiQuizAttempt)
        .where(eq(aiQuizAttempt.userId, sid));

      const studentInfo = await db
        .select({ name: user.name, email: user.email })
        .from(user)
        .where(eq(user.id, sid))
        .limit(1);

      return {
        studentId: sid,
        name: studentInfo[0]?.name || "Unknown",
        email: studentInfo[0]?.email || "",
        avgPercentage: avg?.avgPercentage || 0,
        attemptCount: avg?.attemptCount || 0,
      };
    })
  );

  const averageScore =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.avgPercentage, 0) / results.length
      : 0;

  return { students: results, averageScore };
}

/**
 * Get topic difficulty analytics based on quiz performance across all students.
 */
export async function getTopicDifficulty() {
  const topics = await db
    .select({
      subject: aiQuiz.subject,
      avgPercentage: sql<number>`avg(${aiQuizAttempt.percentage})`,
      attemptCount: sql<number>`count(*)`,
      passRate: sql<number>`avg(case when ${aiQuizAttempt.passed} then 100 else 0 end)`,
    })
    .from(aiQuizAttempt)
    .innerJoin(aiQuiz, eq(aiQuizAttempt.quizId, aiQuiz.id))
    .groupBy(aiQuiz.subject)
    .orderBy(sql`avg(${aiQuizAttempt.percentage}) ASC`);

  return topics;
}

/**
 * Generate parent report data for a student.
 */
export async function generateParentReportData(studentId: string) {
  const performance = await getStudentPerformance(studentId);

  const studentInfo = await db
    .select({ name: user.name, email: user.email, level: user.level })
    .from(user)
    .where(eq(user.id, studentId))
    .limit(1);

  return {
    student: studentInfo[0] || null,
    performance,
    generatedAt: new Date().toISOString(),
  };
}
