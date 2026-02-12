import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserCreditDetails, getUserTransactionHistory } from "@/lib/actions/credits";
import { getUserByClerkId } from "@/lib/actions/auth";
import { CREDIT_PRICING, DEFAULT_CREDIT_CONFIG } from "@/lib/mpesa";

export async function GET(req: Request) {
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

    const creditDetails = await getUserCreditDetails(user.id);
    const history = await getUserTransactionHistory(user.id, 10);

    return NextResponse.json({
      success: true,
      balance: creditDetails.activeBalance,
      totalBalance: creditDetails.totalBalance,
      expiredCredits: creditDetails.expiredCredits,
      expiringSoon: {
        count: creditDetails.expiringSoonCount,
        credits: creditDetails.expiringSoonCredits,
      },
      history,
      pricing: {
        minimumPurchase: CREDIT_PRICING.minimumPurchaseKes,
        creditsPerUnit: CREDIT_PRICING.creditsPerUnit,
        kesPerUnit: CREDIT_PRICING.kesPerUnit,
      },
      expiration: {
        days: DEFAULT_CREDIT_CONFIG.CREDIT_EXPIRATION_DAYS,
        warningDays: DEFAULT_CREDIT_CONFIG.EXPIRATION_WARNING_DAYS,
      },
    });

  } catch (error) {
    console.error("Error fetching credit balance:", error);
    return NextResponse.json(
      { error: "Failed to fetch credit balance" },
      { status: 500 }
    );
  }
}
