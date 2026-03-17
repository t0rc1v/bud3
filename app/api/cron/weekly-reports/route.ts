import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminRegulars, user } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Weekly cron job to auto-generate parent reports for all admin-student pairs.
 * Triggered by Vercel Cron.
 */
export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { generateParentReport, sendParentReportEmail } = await import(
      "@/lib/actions/parent-reports"
    );
    const { generateParentReportData } = await import(
      "@/lib/actions/teacher-analytics"
    );

    // Get all active admin-regular pairs
    const pairs = await db
      .select({
        adminId: adminRegulars.adminId,
        regularId: adminRegulars.regularId,
      })
      .from(adminRegulars)
      .where(eq(adminRegulars.isActive, true));

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let generated = 0;
    let sent = 0;

    for (const pair of pairs) {
      try {
        const reportData = await generateParentReportData(pair.regularId);

        const report = await generateParentReport({
          studentId: pair.regularId,
          generatedBy: pair.adminId,
          reportType: "weekly",
          period: {
            startDate: weekAgo.toISOString(),
            endDate: now.toISOString(),
          },
          content: reportData,
        });

        generated++;

        const emailResult = await sendParentReportEmail(report.id);
        if (emailResult.success) sent++;
      } catch (error) {
        console.error(
          `Failed to generate report for student ${pair.regularId}:`,
          error
        );
      }
    }

    return NextResponse.json({
      success: true,
      generated,
      sent,
      total: pairs.length,
    });
  } catch (error) {
    console.error("Weekly report cron failed:", error);
    return NextResponse.json(
      { error: "Failed to run weekly reports" },
      { status: 500 }
    );
  }
}
