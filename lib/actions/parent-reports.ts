"use server";

import { db } from "@/lib/db";
import { parentReport, user } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { generateParentReportData } from "@/lib/actions/teacher-analytics";

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

    // Fetch live data so the email matches what the UI shows
    const liveData = await generateParentReportData(report.studentId);

    const perf = liveData.performance;
    const stats = perf.progressStats;
    const quizResults = perf.quizResults ?? [];
    const grades = perf.grades ?? [];
    const studentName = liveData.student?.name || student.name || "Student";
    const completionPct = stats && stats.total && stats.total > 0
      ? Math.round(((stats.completed ?? 0) / stats.total) * 100)
      : 0;

    // Build quiz rows
    const quizRows = quizResults.slice(0, 10).map((q) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${q.quizTitle || "Quiz"}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${q.score ?? 0}/${q.totalMarks ?? 0}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${q.percentage != null ? Math.round(q.percentage) : 0}%</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          <span style="background-color: ${q.passed ? "#dcfce7" : "#fef2f2"}; color: ${q.passed ? "#15803d" : "#b91c1c"}; padding: 2px 8px; border-radius: 9999px; font-size: 12px;">
            ${q.passed ? "Passed" : "Failed"}
          </span>
        </td>
      </tr>
    `).join("");

    // Build grade rows
    const gradeRows = grades.slice(0, 10).map((g) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${g.totalScore ?? 0}/${g.maxScore ?? 0}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${g.percentage != null ? Math.round(g.percentage) : 0}%</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          <span style="background-color: ${g.passed ? "#dcfce7" : "#fef2f2"}; color: ${g.passed ? "#15803d" : "#b91c1c"}; padding: 2px 8px; border-radius: 9999px; font-size: 12px;">
            ${g.passed ? "Passed" : "Failed"}
          </span>
        </td>
      </tr>
    `).join("");

    const periodText = report.period
      ? `${new Date((report.period as { startDate: string }).startDate).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })} – ${new Date((report.period as { endDate: string }).endDate).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}`
      : "";

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
      <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: white; padding: 24px 30px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 22px;">Student Progress Report</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">${studentName}${periodText ? ` &mdash; ${periodText}` : ""}</p>
      </div>

      <div style="border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 24px 30px;">
        ${stats ? `
        <h2 style="font-size: 16px; margin: 0 0 12px 0; color: #374151;">Resource Progress</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="text-align: center; padding: 16px; background-color: #f0fdf4; border-radius: 8px;">
              <div style="font-size: 28px; font-weight: bold; color: #15803d;">${stats.completed ?? 0}</div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Completed</div>
            </td>
            <td style="width: 8px;"></td>
            <td style="text-align: center; padding: 16px; background-color: #eff6ff; border-radius: 8px;">
              <div style="font-size: 28px; font-weight: bold; color: #2563eb;">${stats.started ?? 0}</div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">In Progress</div>
            </td>
            <td style="width: 8px;"></td>
            <td style="text-align: center; padding: 16px; background-color: #f9fafb; border-radius: 8px;">
              <div style="font-size: 28px; font-weight: bold; color: #6b7280;">${stats.total ?? 0}</div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Total</div>
            </td>
          </tr>
        </table>
        <p style="font-size: 13px; color: #6b7280; margin: -16px 0 24px 0;">${completionPct}% of available resources completed</p>
        ` : ""}

        ${quizResults.length > 0 ? `
        <h2 style="font-size: 16px; margin: 0 0 12px 0; color: #374151;">Quiz Results (${quizResults.length})</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
          <thead>
            <tr style="background-color: #f9fafb;">
              <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Quiz</th>
              <th style="padding: 8px 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Score</th>
              <th style="padding: 8px 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">%</th>
              <th style="padding: 8px 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Status</th>
            </tr>
          </thead>
          <tbody>${quizRows}</tbody>
        </table>
        ${quizResults.length > 10 ? `<p style="font-size: 12px; color: #9ca3af;">Showing 10 of ${quizResults.length} results</p>` : ""}
        ` : ""}

        ${grades.length > 0 ? `
        <h2 style="font-size: 16px; margin: 0 0 12px 0; color: #374151;">Submission Grades (${grades.length})</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
          <thead>
            <tr style="background-color: #f9fafb;">
              <th style="padding: 8px 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Score</th>
              <th style="padding: 8px 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">%</th>
              <th style="padding: 8px 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Status</th>
            </tr>
          </thead>
          <tbody>${gradeRows}</tbody>
        </table>
        ${grades.length > 10 ? `<p style="font-size: 12px; color: #9ca3af;">Showing 10 of ${grades.length} results</p>` : ""}
        ` : ""}

        ${quizResults.length === 0 && grades.length === 0 ? `
        <p style="text-align: center; color: #9ca3af; padding: 20px 0;">No quiz or grade data available for this period.</p>
        ` : ""}

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
          Report generated on ${new Date(liveData.generatedAt).toLocaleDateString("en", { dateStyle: "long" })}
        </p>
      </div>
    </div>`;

    await sendEmail({
      to: student.email,
      subject: `Progress Report - ${studentName}`,
      html,
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
