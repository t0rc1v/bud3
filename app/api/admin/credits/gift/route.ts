import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { giftCredits } from "@/lib/actions/credits";
import { checkUserPermission } from "@/lib/actions/admin-permissions";
import { getUserByClerkId } from "@/lib/actions/auth";
import { FinancePermissions } from "@/lib/permissions";
import { checkRateLimit } from "@/lib/rate-limit";

const giftCreditsSchema = z.object({
  email: z.string().email("Invalid email format").regex(/\.[a-zA-Z]{2,}$/, "Invalid email TLD"),
  amount: z.number().positive("Amount must be greater than 0"),
  reason: z.string().min(1, "Reason is required"),
  expirationDays: z.number().int().min(1).max(365).nullable().optional(),
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

    // Rate limit: 20 gift-credit requests per minute per user
    const rateLimit = checkRateLimit(`gift-credits:${clerkId}`, 20, 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
        }
      );
    }

    // Get the database user ID from the clerk ID
    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if user has permission to gift credits
    const hasPermission = await checkUserPermission(clerkId, FinancePermissions.CREDITS_GIFT);
    
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Forbidden - You don't have permission to gift credits" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = giftCreditsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid request body" },
        { status: 400 }
      );
    }
    const { email, amount, reason, expirationDays } = parsed.data;

    // Execute gift with database user ID
    const result = await giftCredits(user.id, email, amount, reason, expirationDays);

    return NextResponse.json({
      ...result,
      message: result.deductedFromAdmin
        ? `Successfully gifted ${amount} credits to ${email}. ${amount} credits have been deducted from your account.`
        : `Successfully gifted ${amount} credits to ${email}.`,
    });

  } catch (error) {
    console.error("Gift credits error:", error);
    // Surface intentional business-logic messages (insufficient credits, user not found, etc.)
    // but never leak raw DB or stack details to the client.
    const knownPrefixes = [
      "Insufficient", "User with email", "Admin user", "Admins cannot",
      "Gift amount", "Expiration",
    ];
    const message = error instanceof Error ? error.message : "";
    const isSafeMessage = knownPrefixes.some(p => message.startsWith(p));
    return NextResponse.json(
      {
        success: false,
        error: isSafeMessage ? message : "Failed to gift credits",
      },
      { status: 500 }
    );
  }
}
