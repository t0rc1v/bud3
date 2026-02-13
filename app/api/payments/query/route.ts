import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { querySTKPush } from "@/lib/mpesa";
import { 
  getCreditPurchaseByCheckoutId,
  updateCreditPurchaseStatus 
} from "@/lib/actions/credits";
import { getUserByClerkId } from "@/lib/actions/auth";

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get database user record to compare with purchase.userId (UUID)
    const dbUser = await getUserByClerkId(clerkId);
    if (!dbUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { checkoutRequestId } = body;

    if (!checkoutRequestId) {
      return NextResponse.json(
        { error: "Checkout request ID is required" },
        { status: 400 }
      );
    }

    // Get purchase record
    const purchase = await getCreditPurchaseByCheckoutId(checkoutRequestId);
    
    if (!purchase) {
      return NextResponse.json(
        { error: "Purchase not found" },
        { status: 404 }
      );
    }

    // Verify user owns this purchase (compare database UUIDs)
    if (purchase.userId !== dbUser.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // If already completed, cancelled, or failed, return current status
    if (purchase.status === "completed" || purchase.status === "cancelled" || purchase.status === "failed") {
      return NextResponse.json({
        success: purchase.status === "completed",
        status: purchase.status,
        purchaseId: purchase.id,
        credits: purchase.creditsPurchased,
        mpesaReceiptNumber: purchase.mpesaReceiptNumber,
        error: purchase.status === "cancelled" ? "Payment was cancelled by user" : 
               purchase.status === "failed" ? purchase.resultDesc || "Payment failed" : undefined,
      });
    }

    // Query M-Pesa for status
    const queryResult = await querySTKPush({ checkoutRequestId });

    // M-Pesa result codes:
    // 0: Success
    // 1032: Request cancelled by user  
    // 1037: Transaction not found / still processing
    // 2001: Wrong PIN
    // 1: Other errors
    
    const resultCodeStr = String(queryResult.resultCode);
    const isSuccess = resultCodeStr === "0";
    const isPending = resultCodeStr === "1037" || !queryResult.resultCode || queryResult.resultDesc?.toLowerCase().includes("pending");
    const isCancelled = resultCodeStr === "1032" || queryResult.resultDesc?.toLowerCase().includes("cancel");
    const isWrongPin = resultCodeStr === "2001" || queryResult.resultDesc?.toLowerCase().includes("pin");

    if (isSuccess) {
      // Update to completed
      await updateCreditPurchaseStatus(purchase.id, "completed", {
        mpesaReceiptNumber: queryResult.mpesaReceiptNumber,
        resultCode: String(queryResult.resultCode),
        resultDesc: queryResult.resultDesc,
        transactionDate: queryResult.transactionDate ? new Date(queryResult.transactionDate) : new Date(),
      });

      return NextResponse.json({
        success: true,
        status: "completed",
        purchaseId: purchase.id,
        credits: purchase.creditsPurchased,
        mpesaReceiptNumber: queryResult.mpesaReceiptNumber,
      });
    } else if (isPending) {
      // Still processing - don't mark as failed yet
      return NextResponse.json({
        success: true,
        status: "pending",
        purchaseId: purchase.id,
        message: "Payment is still being processed. Please wait for the confirmation SMS.",
      });
    } else if (isCancelled) {
      // User cancelled
      await updateCreditPurchaseStatus(purchase.id, "cancelled", {
        resultCode: String(queryResult.resultCode),
        resultDesc: queryResult.resultDesc || "Cancelled by user",
      });

      return NextResponse.json({
        success: false,
        status: "cancelled",
        purchaseId: purchase.id,
        error: "Payment was cancelled by user",
      });
    } else {
      // Actual failure
      await updateCreditPurchaseStatus(purchase.id, "failed", {
        resultCode: String(queryResult.resultCode),
        resultDesc: queryResult.resultDesc,
      });

      let errorMessage = queryResult.resultDesc || "Payment failed";
      if (isWrongPin) {
        errorMessage = "Incorrect PIN entered. Please try again.";
      }

      return NextResponse.json({
        success: false,
        status: "failed",
        purchaseId: purchase.id,
        error: errorMessage,
      });
    }

  } catch (error) {
    console.error("Payment query error:", error);
    return NextResponse.json(
      { error: "Failed to query payment status" },
      { status: 500 }
    );
  }
}
