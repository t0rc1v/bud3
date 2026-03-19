"use server";

import { db } from "@/lib/db";
import {
  aiQuizAttempt,
  aiQuiz,
  aiGrade,
  aiSubmission,
  resourceProgress,
  resource,
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

  // Resource progress — completed/started from resourceProgress, total from resource table
  const [progressCounts] = await db
    .select({
      completed: sql<number>`count(*) filter (where ${resourceProgress.status} = 'completed')`,
      started: sql<number>`count(*) filter (where ${resourceProgress.status} = 'started')`,
    })
    .from(resourceProgress)
    .where(eq(resourceProgress.userId, studentId));

  const [totalResources] = await db
    .select({ count: sql<number>`count(*)` })
    .from(resource);

  const progressStats = {
    completed: Number(progressCounts?.completed) || 0,
    started: Number(progressCounts?.started) || 0,
    total: Number(totalResources?.count) || 0,
  };

  // Coerce SQL aggregate strings to proper numbers for quiz results and grades
  const normalizedQuizResults = quizResults.map((q) => ({
    ...q,
    score: Number(q.score) || 0,
    totalMarks: Number(q.totalMarks) || 0,
    percentage: q.percentage != null ? Number(q.percentage) : null,
  }));

  const normalizedGrades = grades.map((g) => ({
    ...g,
    totalScore: Number(g.totalScore) || 0,
    maxScore: Number(g.maxScore) || 0,
    percentage: g.percentage != null ? Number(g.percentage) : null,
  }));

  return { quizResults: normalizedQuizResults, grades: normalizedGrades, progressStats };
}

/**
 * Get class-level performance for all regulars belonging to this admin.
 */
export async function getClassPerformance(adminClerkId: string) {
  // Get admin's regulars
  const { getUserByClerkId } = await import("@/lib/actions/auth");
  const admin = await getUserByClerkId(adminClerkId);
  if (!admin) return { students: [], averageScore: 0, completionRate: 0 };

  const regulars = await db
    .select({ regularId: adminRegulars.regularId, email: adminRegulars.regularEmail })
    .from(adminRegulars)
    .where(and(eq(adminRegulars.adminId, admin.id), eq(adminRegulars.isActive, true)));

  const studentIds = regulars.map((r) => r.regularId);
  if (studentIds.length === 0) return { students: [], averageScore: 0, completionRate: 0 };

  // Get total available resources for completion rate
  const [totalResources] = await db
    .select({ count: sql<number>`count(*)` })
    .from(resource);
  const totalResourceCount = Number(totalResources?.count) || 0;

  // Get per-student scores (quiz + submission grades) and progress
  const results = await Promise.all(
    studentIds.map(async (sid) => {
      const [quizAvg] = await db
        .select({
          avgPercentage: sql<number>`coalesce(avg(${aiQuizAttempt.percentage}), 0)`,
          attemptCount: sql<number>`count(*)`,
        })
        .from(aiQuizAttempt)
        .where(eq(aiQuizAttempt.userId, sid));

      const [gradeAvg] = await db
        .select({
          avgPercentage: sql<number>`coalesce(avg(${aiGrade.percentage}), 0)`,
          gradeCount: sql<number>`count(*)`,
        })
        .from(aiGrade)
        .innerJoin(aiSubmission, eq(aiGrade.submissionId, aiSubmission.id))
        .where(eq(aiSubmission.userId, sid));

      const quizCount = Number(quizAvg?.attemptCount) || 0;
      const gradeCount = Number(gradeAvg?.gradeCount) || 0;
      const totalAssessments = quizCount + gradeCount;

      // Combined weighted average of quiz and submission scores
      const quizAvgPct = Number(quizAvg?.avgPercentage) || 0;
      const gradeAvgPct = Number(gradeAvg?.avgPercentage) || 0;
      const combinedAvg =
        totalAssessments > 0
          ? (quizAvgPct * quizCount + gradeAvgPct * gradeCount) / totalAssessments
          : 0;

      // Count completed resources for this student
      const [progressCount] = await db
        .select({
          completed: sql<number>`count(*) filter (where ${resourceProgress.status} = 'completed')`,
        })
        .from(resourceProgress)
        .where(eq(resourceProgress.userId, sid));

      const studentInfo = await db
        .select({ name: user.name, email: user.email })
        .from(user)
        .where(eq(user.id, sid))
        .limit(1);

      return {
        studentId: sid,
        name: studentInfo[0]?.name || "Unknown",
        email: studentInfo[0]?.email || "",
        avgPercentage: combinedAvg,
        attemptCount: quizCount,
        completedResources: Number(progressCount?.completed) || 0,
      };
    })
  );

  // Average score only from students who have at least one quiz attempt or graded submission
  const participatingStudents = results.filter(
    (r) => r.attemptCount > 0 || r.avgPercentage > 0
  );
  const averageScore =
    participatingStudents.length > 0
      ? participatingStudents.reduce((sum, r) => sum + r.avgPercentage, 0) /
        participatingStudents.length
      : 0;

  // Completion rate: average of (completedResources / totalResources) across all students
  const completionRate =
    totalResourceCount > 0 && results.length > 0
      ? (results.reduce((sum, r) => sum + r.completedResources, 0) /
          (results.length * totalResourceCount)) *
        100
      : 0;

  return { students: results, averageScore, completionRate };
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

  return topics.map((t) => ({
    ...t,
    avgPercentage: Number(t.avgPercentage) || 0,
    attemptCount: Number(t.attemptCount) || 0,
    passRate: Number(t.passRate) || 0,
  }));
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
