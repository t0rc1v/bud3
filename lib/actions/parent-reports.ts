"use server";

import { db } from "@/lib/db";
import { parentReport, user } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

export async function generateParentReport(params: {
  studentId: string;
  generatedBy: string;
  reportType: string;
  period: { startDate: string; endDate: string };
  content: unknown;
}) {
  const [report] = await db
    .insert(parentReport)
    .values({
      studentId: params.studentId,
      generatedBy: params.generatedBy,
      reportType: params.reportType,
      period: params.period,
      content: params.content,
    })
    .returning();

  await logAudit(
    params.generatedBy,
    "parent_report.generated",
    "parent_report",
    report.id,
    { studentId: params.studentId, reportType: params.reportType }
  );

  return report;
}

export async function sendParentReportEmail(reportId: string) {
  const [report] = await db
    .select()
    .from(parentReport)
    .where(eq(parentReport.id, reportId));

  if (!report) throw new Error("Report not found");

  // Get student's email (or parent email if stored)
  const [student] = await db
    .select({ email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, report.studentId));

  if (!student) throw new Error("Student not found");

  try {
    const { sendEmail } = await import("@/lib/email");

    const content = report.content as { summary?: string };
    await sendEmail({
      to: student.email,
      subject: `Student Report - ${student.name || "Student"}`,
      html: `
        <h2>Student Progress Report</h2>
        <p>${content.summary || "Please find the detailed report attached."}</p>
      `,
    });

    await db
      .update(parentReport)
      .set({ emailSent: true, emailSentAt: new Date() })
      .where(eq(parentReport.id, reportId));

    return { success: true };
  } catch (error) {
    console.error("Failed to send parent report email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getParentReports(generatedBy: string) {
  return db
    .select()
    .from(parentReport)
    .where(
      and(eq(parentReport.generatedBy, generatedBy), eq(parentReport.isActive, true))
    )
    .orderBy(desc(parentReport.createdAt));
}

export async function getParentReportById(reportId: string) {
  const [report] = await db
    .select()
    .from(parentReport)
    .where(eq(parentReport.id, reportId));
  return report || null;
}
