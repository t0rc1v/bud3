import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { db } from "@/lib/db";
import { aiExam, aiAssignment, adminRegulars } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return new Response("User not found", { status: 404 });

  // Find exams/assignments created by the user's admins
  const adminLinks = await db
    .select({ adminId: adminRegulars.adminId })
    .from(adminRegulars)
    .where(
      and(eq(adminRegulars.regularId, user.id), eq(adminRegulars.isActive, true))
    );

  const adminIds = adminLinks.map((l) => l.adminId);

  // Also include the user's own assessments (self-generated via AI chat)
  const ownerIds = [user.id, ...adminIds];

  const [exams, assignments] = await Promise.all([
    ownerIds.length > 0
      ? db
          .select({
            id: aiExam.id,
            title: aiExam.title,
            subject: aiExam.subject,
            level: aiExam.level,
            totalMarks: aiExam.totalMarks,
            timeLimit: aiExam.timeLimit,
            sections: aiExam.sections,
          })
          .from(aiExam)
          .where(
            and(inArray(aiExam.userId, ownerIds), eq(aiExam.isActive, true))
          )
      : [],
    ownerIds.length > 0
      ? db
          .select({
            id: aiAssignment.id,
            title: aiAssignment.title,
            subject: aiAssignment.subject,
            level: aiAssignment.level,
            totalMarks: aiAssignment.totalMarks,
            timeLimit: aiAssignment.timeLimit,
            questions: aiAssignment.questions,
          })
          .from(aiAssignment)
          .where(
            and(
              inArray(aiAssignment.userId, ownerIds),
              eq(aiAssignment.isActive, true)
            )
          )
      : [],
  ]);

  return NextResponse.json({ exams, assignments });
}
