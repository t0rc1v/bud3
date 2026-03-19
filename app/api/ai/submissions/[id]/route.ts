import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { getSubmissionById, getGrade } from "@/lib/actions/grading";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminRegulars, superAdminRegulars } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  const user = await getUserByClerkId(clerkId);
  if (!user) return new Response("User not found", { status: 404 });

  const { id } = await params;
  const submission = await getSubmissionById(id);
  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  // Owner can always view their own submission
  if (submission.userId !== user.id) {
    if (user.role === "regular") {
      return new Response("Forbidden", { status: 403 });
    }

    // Admin/super-admin must own the regular who made the submission
    if (user.role === "admin") {
      const [owned] = await db
        .select({ id: adminRegulars.id })
        .from(adminRegulars)
        .where(
          and(
            eq(adminRegulars.adminId, user.id),
            eq(adminRegulars.regularId, submission.userId)
          )
        )
        .limit(1);
      if (!owned) return new Response("Forbidden", { status: 403 });
    } else if (user.role === "super_admin") {
      const [owned] = await db
        .select({ id: superAdminRegulars.id })
        .from(superAdminRegulars)
        .where(
          and(
            eq(superAdminRegulars.superAdminId, user.id),
            eq(superAdminRegulars.regularId, submission.userId)
          )
        )
        .limit(1);
      if (!owned) return new Response("Forbidden", { status: 403 });
    }
  }

  const grade = await getGrade(id);

  // Fetch assessment title and questions for display
  let assessmentTitle = "";
  let questions: unknown[] = [];
  if (submission.examId) {
    const { aiExam } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const { db } = await import("@/lib/db");
    const [exam] = await db
      .select({ title: aiExam.title, sections: aiExam.sections, answerKey: aiExam.answerKey })
      .from(aiExam)
      .where(eq(aiExam.id, submission.examId));
    assessmentTitle = exam?.title ?? "";
    if (exam?.sections) {
      // Flatten sections into a single questions array
      questions = (exam.sections as Array<{ sectionTitle?: string; questions: unknown[] }>)
        .flatMap((s) => s.questions);
    }
  } else if (submission.assignmentId) {
    const { aiAssignment } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const { db } = await import("@/lib/db");
    const [assignment] = await db
      .select({ title: aiAssignment.title, questions: aiAssignment.questions, answerKey: aiAssignment.answerKey })
      .from(aiAssignment)
      .where(eq(aiAssignment.id, submission.assignmentId));
    assessmentTitle = assignment?.title ?? "";
    if (assignment?.questions) {
      questions = assignment.questions as unknown[];
    }
  }

  return NextResponse.json({ submission, grade, assessmentTitle, questions });
}
