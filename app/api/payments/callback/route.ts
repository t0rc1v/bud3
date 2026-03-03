import { NextResponse } from "next/server";
import { parseCallbackData, CallbackData } from "@/lib/mpesa";
import { 
  updateCreditPurchaseStatus, 
  getCreditPurchaseByCheckoutId 
} from "@/lib/actions/credits";

export async function POST(req: Request) {
  try {
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
      console.warn(`Callback received for already-terminal purchase ${purchase.id} (status: ${purchase.status})`);
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

    // Update purchase status based on result
    // M-Pesa Result Codes:
    // 0: Success
    // 1032: Request cancelled by user
    // 1037: Transaction not found / still processing
    // 2001: Wrong PIN
    // 1: Other errors (e.g., insufficient funds)

    const resultCode = parsedData.resultCode;
    const resultCodeStr = String(resultCode);

    if (parsedData.isSuccessful) {
      // Success
      await updateCreditPurchaseStatus(purchase.id, "completed", {
        mpesaReceiptNumber: parsedData.mpesaReceiptNumber,
        resultCode: resultCodeStr,
        resultDesc: parsedData.resultDesc,
        transactionDate: parsedData.transactionDate ? new Date(parsedData.transactionDate) : new Date(),
      });
      
      console.log(`Payment completed for purchase ${purchase.id}`);
    } else if (resultCode === 1032) {
      // User cancelled
      await updateCreditPurchaseStatus(purchase.id, "cancelled", {
        resultCode: resultCodeStr,
        resultDesc: parsedData.resultDesc || "Request cancelled by user",
      });
      console.log(`Payment cancelled for purchase ${purchase.id}`);
    } else {
      // Actual failure
      await updateCreditPurchaseStatus(purchase.id, "failed", {
        resultCode: resultCodeStr,
        resultDesc: parsedData.resultDesc,
      });
      console.log(`Payment failed for purchase ${purchase.id} (code: ${resultCodeStr})`);
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

// Also handle GET requests for testing
export async function GET(req: Request) {
  return NextResponse.json({ 
    message: "M-Pesa callback endpoint is active. Use POST to receive callbacks." 
  });
}
