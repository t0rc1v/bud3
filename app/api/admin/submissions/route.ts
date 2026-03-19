import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiSubmission, aiGrade, aiExam, aiAssignment, user, adminRegulars, superAdminRegulars } from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  const currentUser = await getUserByClerkId(clerkId);
  if (!currentUser) return new Response("User not found", { status: 404 });

  if (currentUser.role !== "admin" && currentUser.role !== "super_admin") {
    return new Response("Forbidden", { status: 403 });
  }

  // Get owned regular IDs based on role
  let regularIds: string[] = [];

  if (currentUser.role === "admin") {
    const rows = await db
      .select({ regularId: adminRegulars.regularId })
      .from(adminRegulars)
      .where(eq(adminRegulars.adminId, currentUser.id));
    regularIds = rows.map((r) => r.regularId);
  } else {
    const rows = await db
      .select({ regularId: superAdminRegulars.regularId })
      .from(superAdminRegulars)
      .where(eq(superAdminRegulars.superAdminId, currentUser.id));
    regularIds = rows.map((r) => r.regularId);
  }

  if (regularIds.length === 0) {
    return NextResponse.json({ submissions: [] });
  }

  // Fetch submissions with user info, grade, and assessment title
  const submissions = await db
    .select({
      id: aiSubmission.id,
      userId: aiSubmission.userId,
      type: aiSubmission.type,
      status: aiSubmission.status,
      submittedAt: aiSubmission.submittedAt,
      examId: aiSubmission.examId,
      assignmentId: aiSubmission.assignmentId,
      userName: user.name,
      userEmail: user.email,
      gradeId: aiGrade.id,
      totalScore: aiGrade.totalScore,
      maxScore: aiGrade.maxScore,
      percentage: aiGrade.percentage,
      passed: aiGrade.passed,
      gradedBy: aiGrade.gradedBy,
    })
    .from(aiSubmission)
    .innerJoin(user, eq(aiSubmission.userId, user.id))
    .leftJoin(aiGrade, eq(aiGrade.submissionId, aiSubmission.id))
    .where(
      and(
        inArray(aiSubmission.userId, regularIds),
        eq(aiSubmission.isActive, true)
      )
    )
    .orderBy(desc(aiSubmission.submittedAt));

  // Batch-fetch assessment titles
  const examIds = [...new Set(submissions.filter((s) => s.examId).map((s) => s.examId!))];
  const assignmentIds = [...new Set(submissions.filter((s) => s.assignmentId).map((s) => s.assignmentId!))];

  const examTitles = new Map<string, string>();
  const assignmentTitles = new Map<string, string>();

  if (examIds.length > 0) {
    const exams = await db
      .select({ id: aiExam.id, title: aiExam.title })
      .from(aiExam)
      .where(inArray(aiExam.id, examIds));
    for (const e of exams) examTitles.set(e.id, e.title);
  }

  if (assignmentIds.length > 0) {
    const assignments = await db
      .select({ id: aiAssignment.id, title: aiAssignment.title })
      .from(aiAssignment)
      .where(inArray(aiAssignment.id, assignmentIds));
    for (const a of assignments) assignmentTitles.set(a.id, a.title);
  }

  const enriched = submissions.map((s) => ({
    id: s.id,
    userId: s.userId,
    type: s.type,
    status: s.status,
    submittedAt: s.submittedAt,
    userName: s.userName,
    userEmail: s.userEmail,
    assessmentTitle: s.examId
      ? examTitles.get(s.examId) ?? "Unknown Exam"
      : s.assignmentId
        ? assignmentTitles.get(s.assignmentId) ?? "Unknown Assignment"
        : "Unknown",
    grade: s.gradeId
      ? {
          totalScore: s.totalScore,
          maxScore: s.maxScore,
          percentage: s.percentage,
          passed: s.passed,
          gradedBy: s.gradedBy,
        }
      : null,
  }));

  return NextResponse.json({ submissions: enriched });
}
