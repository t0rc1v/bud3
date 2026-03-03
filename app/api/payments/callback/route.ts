import { NextResponse } from "next/server";
import { parseCallbackData, CallbackData } from "@/lib/mpesa";
import {
  updateCreditPurchaseStatus,
  getCreditPurchaseByCheckoutId
} from "@/lib/actions/credits";

export async function POST(req: Request) {
  try {
    // Validate callback secret token to reject spoofed requests
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const expectedToken = process.env.MPESA_CALLBACK_SECRET;

    if (!expectedToken || token !== expectedToken) {
      return NextResponse.json({ ResultCode: 1, ResultDesc: "Unauthorized" }, { status: 401 });
    }

    const callbackBody: CallbackData = await req.json();

    const parsedData = parseCallbackData(callbackBody);

    if (!parsedData.checkoutRequestId) {
      console.error("Invalid callback data: missing checkoutRequestId");
      return NextResponse.json({ success: false, error: "Invalid callback data" }, { status: 400 });
    }

    // Find the purchase record
    const purchase = await getCreditPurchaseByCheckoutId(parsedData.checkoutRequestId);

    if (!purchase) {
      // Log internally but don't expose checkout IDs in responses
      console.error("Purchase not found for the provided checkoutRequestId");
      return NextResponse.json({ success: false, error: "Purchase not found" }, { status: 404 });
    }

    // Guard: reject callbacks for purchases that are already in a terminal state
    // This prevents replay attacks from re-completing a cancelled/failed purchase
    if (purchase.status === "completed" || purchase.status === "refunded") {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Already processed" });
    }

    // Guard: validate the paid amount matches what was requested (success path only)
    if (parsedData.isSuccessful && parsedData.amount !== undefined) {
      const expectedAmount = Math.ceil(purchase.amountKes);
      const receivedAmount = Math.ceil(parsedData.amount as number);
      if (receivedAmount < expectedAmount) {
        console.error(`Amount mismatch on purchase ${purchase.id}: expected ${expectedAmount}, received ${receivedAmount}`);
        await updateCreditPurchaseStatus(purchase.id, "failed", {
          resultCode: "AMOUNT_MISMATCH",
          resultDesc: "Received amount is less than required",
        });
        return NextResponse.json({ ResultCode: 0, ResultDesc: "Amount mismatch recorded" });
      }
    }

    const resultCode = parsedData.resultCode;
    const resultCodeStr = String(resultCode);

    if (parsedData.isSuccessful) {
      await updateCreditPurchaseStatus(purchase.id, "completed", {
        mpesaReceiptNumber: parsedData.mpesaReceiptNumber,
        resultCode: resultCodeStr,
        resultDesc: parsedData.resultDesc,
        transactionDate: parsedData.transactionDate ? new Date(parsedData.transactionDate) : new Date(),
      });
    } else if (resultCode === 1032) {
      await updateCreditPurchaseStatus(purchase.id, "cancelled", {
        resultCode: resultCodeStr,
        resultDesc: parsedData.resultDesc || "Request cancelled by user",
      });
    } else {
      console.error(`Payment failed for purchase ${purchase.id} (code: ${resultCodeStr}): ${parsedData.resultDesc}`);
      await updateCreditPurchaseStatus(purchase.id, "failed", {
        resultCode: resultCodeStr,
        resultDesc: parsedData.resultDesc,
      });
    }

    // Always return success to M-Pesa to acknowledge receipt
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: "Callback processed successfully",
    });

  } catch (error) {
    console.error("Callback processing error:", error);

    // Return success to M-Pesa anyway to prevent retries
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: "Callback received",
    });
  }
}
