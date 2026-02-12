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
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
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

    // Get user role
    const userData = await db
      .select()
      .from(user)
      .where(eq(user.clerkId, clerkId))
      .limit(1)
      .then(res => res[0] || null);

    if (!userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const isSuperAdmin = userData.role === "super_admin";

    // Get credit details using database user ID
    const creditDetails = await getUserCreditDetails(userData.id);
    const creditRecord = await getOrCreateUserCredit(userData.id);

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
