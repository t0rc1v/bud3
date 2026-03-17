import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import {
  initiateSTKPush,
  isValidPhoneNumber,
  formatPhoneNumber,
  CREDIT_PRICING
} from "@/lib/mpesa";
import { createCreditPurchase, updateCreditPurchaseStatus } from "@/lib/actions/credits";
import { getUserByClerkId } from "@/lib/actions/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const initiatePaymentSchema = z.object({
  phoneNumber: z.string().min(1, "Phone number is required").regex(/^(?:\+?254|0)\d{9}$/, "Invalid Kenyan phone number"),
  amount: z.number().finite().positive("Amount must be positive"),
});

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Rate limit: 5 payment initiations per 2 minutes per user
    const rateLimit = checkRateLimit(`payment:${clerkId}`, 5, 2 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many payment requests. Please wait a moment before trying again." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
        }
      );
    }

    // Get database user record (creditPurchase expects UUID, not Clerk ID)
    const dbUser = await getUserByClerkId(clerkId);
    if (!dbUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parsed = initiatePaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid request body" },
        { status: 400 }
      );
    }
    const { phoneNumber, amount } = parsed.data;
    const type = "credits" as const;

    // Validate amount against pricing rules
    if (!CREDIT_PRICING.isValidAmount(amount)) {
      return NextResponse.json(
        { error: `Minimum purchase amount is Ksh ${CREDIT_PRICING.minimumPurchaseKes}` },
        { status: 400 }
      );
    }

    // Validate phone number format
    if (!isValidPhoneNumber(phoneNumber)) {
      return NextResponse.json(
        { error: "Invalid phone number. Please provide a valid Kenyan phone number" },
        { status: 400 }
      );
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);
    const credits = CREDIT_PRICING.calculateCredits(amount);

    // Create purchase record using database UUID, not Clerk ID
    const purchase = await createCreditPurchase(dbUser.id, formattedPhone, amount, type);

    // Initiate STK Push — include secret token so the callback endpoint can reject spoofed requests
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/callback?token=${process.env.MPESA_CALLBACK_SECRET}`;
    
    const stkResponse = await initiateSTKPush({
      phoneNumber: formattedPhone,
      amount,
      accountReference: `BUD${purchase.id.slice(-6)}`,
      transactionDesc: "AI Credits",
      callbackUrl,
    });

    if (!stkResponse.success) {
      return NextResponse.json(
        { 
          error: stkResponse.error || "Failed to initiate payment",
          purchaseId: purchase.id,
        },
        { status: 500 }
      );
    }

    // Update purchase with request IDs
    await updateCreditPurchaseStatus(purchase.id, "processing", {
      checkoutRequestId: stkResponse.checkoutRequestId,
      merchantRequestId: stkResponse.merchantRequestId,
    });

    return NextResponse.json({
      success: true,
      purchaseId: purchase.id,
      checkoutRequestId: stkResponse.checkoutRequestId,
      merchantRequestId: stkResponse.merchantRequestId,
      message: "Payment initiated. Please check your phone and enter your M-Pesa PIN",
      credits: credits,
      amount: amount,
    });

  } catch (error) {
    console.error("Payment initiation error:", error);
    return NextResponse.json(
      { error: "Failed to initiate payment" },
      { status: 500 }
    );
  }
}
