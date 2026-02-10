import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { giftCredits } from "@/lib/actions/credits";
import { checkUserPermission } from "@/lib/actions/admin-permissions";
import { FinancePermissions } from "@/lib/permissions";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user has permission to gift credits
    const hasPermission = await checkUserPermission(userId, FinancePermissions.CREDITS_GIFT);
    
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Forbidden - You don't have permission to gift credits" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { email, amount, reason } = body;

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

    // Execute gift
    const result = await giftCredits(userId, email, amount, reason);

    return NextResponse.json(result);

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
