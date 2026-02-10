import { NextResponse } from "next/server";
import { parseCallbackData, CallbackData } from "@/lib/mpesa";
import { 
  updateCreditPurchaseStatus, 
  getCreditPurchaseByCheckoutId 
} from "@/lib/actions/credits";

export async function POST(req: Request) {
  try {
    const callbackBody: CallbackData = await req.json();
    
    console.log("M-Pesa Callback received:", JSON.stringify(callbackBody, null, 2));

    const parsedData = parseCallbackData(callbackBody);
    
    if (!parsedData.checkoutRequestId) {
      console.error("Invalid callback data: missing checkoutRequestId");
      return NextResponse.json({ success: false, error: "Invalid callback data" }, { status: 400 });
    }

    // Find the purchase record
    const purchase = await getCreditPurchaseByCheckoutId(parsedData.checkoutRequestId);
    
    if (!purchase) {
      console.error(`Purchase not found for checkoutRequestId: ${parsedData.checkoutRequestId}`);
      return NextResponse.json({ success: false, error: "Purchase not found" }, { status: 404 });
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
      
      console.log(`✅ Payment completed successfully for purchase ${purchase.id}`);
    } else if (resultCode === 1032) {
      // User cancelled
      await updateCreditPurchaseStatus(purchase.id, "cancelled", {
        resultCode: resultCodeStr,
        resultDesc: parsedData.resultDesc || "Request cancelled by user",
      });
      
      console.log(`🚫 Payment cancelled by user for purchase ${purchase.id}`);
    } else {
      // Actual failure
      await updateCreditPurchaseStatus(purchase.id, "failed", {
        resultCode: resultCodeStr,
        resultDesc: parsedData.resultDesc,
      });
      
      console.log(`❌ Payment failed for purchase ${purchase.id}: ${parsedData.resultDesc} (Code: ${resultCodeStr})`);
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
