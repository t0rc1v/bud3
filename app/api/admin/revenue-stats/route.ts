import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { creditPurchase } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUserByClerkId } from "@/lib/actions/auth";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await getUserByClerkId(clerkId);

    if (!user || user.role !== "super_admin") {
      return NextResponse.json(
        { error: "Forbidden - Super admin access required" },
        { status: 403 }
      );
    }

    // Get all credit purchases
    const purchases = await db
      .select()
      .from(creditPurchase)
      .where(eq(creditPurchase.status, "completed"));

    // Calculate total revenue
    const totalRevenue = purchases.reduce((sum, purchase) => sum + purchase.amountKes, 0);

    return NextResponse.json({
      totalRevenue,
      totalPurchases: purchases.length,
      completedPurchases: purchases.length,
    });
  } catch (error) {
    console.error("Error fetching revenue stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch revenue stats" },
      { status: 500 }
    );
  }
}
