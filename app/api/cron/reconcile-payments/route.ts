import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creditPurchase } from "@/lib/db/schema";
import { and, eq, lt } from "drizzle-orm";
import { querySTKPush } from "@/lib/mpesa";
import { updateCreditPurchaseStatus } from "@/lib/actions/credits";

/**
 * GET /api/cron/reconcile-payments
 *
 * Queries M-Pesa for payments stuck in "processing" status for > 5 minutes
 * and updates their status based on the query result.
 *
 * Requires CRON_SECRET env var to be set. Requests must include:
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Find payments stuck in processing for > 5 minutes
    const stuckPayments = await db
      .select()
      .from(creditPurchase)
      .where(
        and(
          eq(creditPurchase.status, "processing"),
          lt(creditPurchase.updatedAt, fiveMinutesAgo)
        )
      )
      .limit(50); // Process at most 50 at a time

    if (stuckPayments.length === 0) {
      return NextResponse.json({ message: "No stuck payments found", processed: 0 });
    }

    let resolved = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const payment of stuckPayments) {
      if (!payment.checkoutRequestId) {
        // Can't query without checkoutRequestId — mark as failed
        await updateCreditPurchaseStatus(payment.id, "failed", {
          resultDesc: "Missing checkout request ID — marked failed by reconciliation",
        });
        failed++;
        continue;
      }

      try {
        const queryResult = await querySTKPush({
          checkoutRequestId: payment.checkoutRequestId,
        });

        if (queryResult.success) {
          await updateCreditPurchaseStatus(payment.id, "completed", {
            mpesaReceiptNumber: queryResult.mpesaReceiptNumber,
            resultDesc: queryResult.resultDesc,
          });
          resolved++;
        } else {
          const resultCode = queryResult.resultCode;
          // ResultCode 1032 = request cancelled by user, 1037 = timeout
          const isCancelled = resultCode === "1032";
          const isTimeout = resultCode === "1037";

          await updateCreditPurchaseStatus(
            payment.id,
            isCancelled || isTimeout ? "cancelled" : "failed",
            { resultCode, resultDesc: queryResult.resultDesc ?? queryResult.error }
          );
          failed++;
        }
      } catch (error) {
        errors.push(
          `Payment ${payment.id}: ${error instanceof Error ? error.message : "unknown"}`
        );
      }
    }

    return NextResponse.json({
      message: `Reconciled ${stuckPayments.length} stuck payments`,
      processed: stuckPayments.length,
      resolved,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Reconcile payments cron error:", error);
    return NextResponse.json(
      { error: "Failed to reconcile payments" },
      { status: 500 }
    );
  }
}
