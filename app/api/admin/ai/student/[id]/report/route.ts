import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { generateParentReportData } from "@/lib/actions/teacher-analytics";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user || user.role === "regular") return new Response("Forbidden", { status: 403 });

  const { id } = await params;

  // Support email-based lookup via query param: /api/admin/ai/student/_/report?email=...
  let studentId = id;
  if (id === "_") {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    if (!email) {
      return NextResponse.json({ error: "email query param required when id is _" }, { status: 400 });
    }
    const [student] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, email))
      .limit(1);
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
    studentId = student.id;
  }

  const report = await generateParentReportData(studentId);
  return NextResponse.json({ report });
}
