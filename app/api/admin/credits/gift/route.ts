import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { giftCredits } from "@/lib/actions/credits";
import { checkUserPermission } from "@/lib/actions/admin-permissions";
import { getUserByClerkId } from "@/lib/actions/auth";
import { FinancePermissions } from "@/lib/permissions";

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
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
    const { email, amount, reason, expirationDays } = body;

    // Validate inputs
    if (!email || !amount || !reason) {
      return NextResponse.json(
        { error: "Email, amount, and reason are required" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    // Validate expirationDays if provided
    if (expirationDays !== undefined && expirationDays !== null) {
      if (typeof expirationDays !== 'number' || expirationDays < 1 || expirationDays > 365) {
        return NextResponse.json(
          { error: "Expiration days must be between 1 and 365, or null for no expiration" },
          { status: 400 }
        );
      }
    }

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
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to gift credits" 
      },
      { status: 500 }
    );
  }
}
