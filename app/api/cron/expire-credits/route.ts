import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creditTransaction, user } from "@/lib/db/schema";
import { and, gt, lt, isNotNull, eq, sql } from "drizzle-orm";
import { sendCreditExpirationWarningEmail } from "@/lib/email";

/**
 * GET /api/cron/expire-credits
 *
 * Finds users with credits expiring within 7 days and sends warning emails.
 * Intended to be called once daily by a Vercel Cron job or external scheduler.
 *
 * Requires CRON_SECRET env var to be set. Requests must include:
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Find users who have positive-amount transactions expiring within 7 days
    // Group by userId to get the total expiring credits per user
    const expiringCredits = await db
      .select({
        userId: creditTransaction.userId,
        totalExpiring: sql<number>`SUM(${creditTransaction.amount})`,
        earliestExpiry: sql<Date>`MIN(${creditTransaction.expiresAt})`,
      })
      .from(creditTransaction)
      .where(
        and(
          gt(creditTransaction.amount, 0),
          isNotNull(creditTransaction.expiresAt),
          gt(creditTransaction.expiresAt, now),
          lt(creditTransaction.expiresAt, sevenDaysFromNow)
        )
      )
      .groupBy(creditTransaction.userId);

    if (expiringCredits.length === 0) {
      return NextResponse.json({ message: "No expiring credits found", sent: 0 });
    }

    // Fetch user emails
    const userIds = expiringCredits.map((e) => e.userId);
    const users = await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(
        userIds.length === 1
          ? eq(user.id, userIds[0])
          : sql`${user.id} = ANY(ARRAY[${sql.join(userIds.map(id => sql`${id}::uuid`), sql`, `)}])`
      );

    const userEmailMap = Object.fromEntries(users.map((u) => [u.id, u.email]));

    let sent = 0;
    const errors: string[] = [];

    for (const entry of expiringCredits) {
      const email = userEmailMap[entry.userId];
      if (!email) continue;

      const expiresAt = new Date(entry.earliestExpiry);
      const daysUntilExpiry = Math.max(
        1,
        Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      );

      try {
        await sendCreditExpirationWarningEmail({
          recipientEmail: email,
          creditsAmount: entry.totalExpiring,
          daysUntilExpiry,
          expiresAt,
        });
        sent++;
      } catch (error) {
        errors.push(`Failed to send to ${email}: ${error instanceof Error ? error.message : "unknown"}`);
      }
    }

    return NextResponse.json({
      message: `Sent ${sent} expiration warning emails`,
      sent,
      total: expiringCredits.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Expire credits cron error:", error);
    return NextResponse.json(
      { error: "Failed to process expiring credits" },
      { status: 500 }
    );
  }
}
