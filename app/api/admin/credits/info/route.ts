import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserCreditDetails, getOrCreateUserCredit } from "@/lib/actions/credits";
import { checkUserPermission } from "@/lib/actions/admin-permissions";
import { FinancePermissions } from "@/lib/permissions";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
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

    // Get user role
    const userData = await db.query.user.findFirst({
      where: eq(user.clerkId, userId),
    });

    if (!userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const isSuperAdmin = userData.role === "super_admin";

    // Get credit details
    const creditDetails = await getUserCreditDetails(userId);
    const creditRecord = await getOrCreateUserCredit(userId);

    return NextResponse.json({
      success: true,
      isSuperAdmin,
      activeBalance: creditDetails.activeBalance,
      totalBalance: creditRecord.balance,
      expiredCredits: creditDetails.expiredCredits,
      expiringSoon: {
        count: creditDetails.expiringSoonCount,
        credits: creditDetails.expiringSoonCredits,
      },
    });

  } catch (error) {
    console.error("Error fetching admin credit info:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin credit info" },
      { status: 500 }
    );
  }
}
