import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { generateParentReport, getParentReports } from "@/lib/actions/parent-reports";
import { generateParentReportData } from "@/lib/actions/teacher-analytics";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user || user.role === "regular") return new Response("Forbidden", { status: 403 });

  const reports = await getParentReports(user.id);

  // Batch-resolve student emails
  const studentIds = [...new Set(reports.map((r) => r.studentId))];
  const emailMap = new Map<string, string>();
  if (studentIds.length > 0) {
    const students = await db
      .select({ id: userTable.id, email: userTable.email })
      .from(userTable)
      .where(inArray(userTable.id, studentIds));
    for (const s of students) emailMap.set(s.id, s.email);
  }

  const enriched = reports.map((r) => ({
    ...r,
    studentEmail: emailMap.get(r.studentId) ?? null,
  }));

  return NextResponse.json({ reports: enriched });
}

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user || user.role === "regular") return new Response("Forbidden", { status: 403 });

  const body = await req.json();

  // Resolve studentEmail to DB UUID if provided instead of studentId
  let studentId = body.studentId;
  if (!studentId && body.studentEmail) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(body.studentEmail)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }
    const [student] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, body.studentEmail))
      .limit(1);
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
    studentId = student.id;
  }

  if (!studentId) {
    return NextResponse.json({ error: "studentEmail or studentId is required" }, { status: 400 });
  }

  // Generate the report content from actual student data
  const reportData = await generateParentReportData(studentId);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const report = await generateParentReport({
    generatedBy: user.id,
    studentId,
    reportType: body.reportType || "custom",
    period: body.period || {
      startDate: weekAgo.toISOString(),
      endDate: now.toISOString(),
    },
    content: reportData,
  });
  return NextResponse.json({ report });
}
