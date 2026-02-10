import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserCreditBalance, getUserTransactionHistory } from "@/lib/actions/credits";
import { CREDIT_PRICING } from "@/lib/mpesa";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const balance = await getUserCreditBalance(userId);
    const history = await getUserTransactionHistory(userId, 10);

    return NextResponse.json({
      success: true,
      balance,
      history,
      pricing: {
        minimumPurchase: CREDIT_PRICING.minimumPurchaseKes,
        creditsPerUnit: CREDIT_PRICING.creditsPerUnit,
        kesPerUnit: CREDIT_PRICING.kesPerUnit,
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
