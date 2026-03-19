import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { publishGrade } from "@/lib/actions/grading";
import { getSubmissionById } from "@/lib/actions/grading";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminRegulars, superAdminRegulars } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  const user = await getUserByClerkId(clerkId);
  if (!user) return new Response("User not found", { status: 404 });
  if (user.role !== "admin" && user.role !== "super_admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const { id: submissionId } = await params;
  const submission = await getSubmissionById(submissionId);
  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  // Verify admin owns this student
  if (user.role === "admin") {
    const [owned] = await db
      .select({ id: adminRegulars.id })
      .from(adminRegulars)
      .where(
        and(eq(adminRegulars.adminId, user.id), eq(adminRegulars.regularId, submission.userId))
      )
      .limit(1);
    if (!owned) return new Response("Forbidden", { status: 403 });
  } else if (user.role === "super_admin") {
    const [owned] = await db
      .select({ id: superAdminRegulars.id })
      .from(superAdminRegulars)
      .where(
        and(eq(superAdminRegulars.superAdminId, user.id), eq(superAdminRegulars.regularId, submission.userId))
      )
      .limit(1);
    if (!owned) return new Response("Forbidden", { status: 403 });
  }

  const body = await req.json();
  const { gradeId } = body;

  if (!gradeId) {
    return NextResponse.json({ error: "gradeId is required" }, { status: 400 });
  }

  const grade = await publishGrade(gradeId, user.id);

  return NextResponse.json({ grade });
}
