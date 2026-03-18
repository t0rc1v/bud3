import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { userStreak, user } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { getUserByClerkId } from "@/lib/actions/auth";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await getUserByClerkId(clerkId);
    if (!dbUser || (dbUser.role !== "super_admin" && dbUser.role !== "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get top 50 streaks with user info
    const streaks = await db
      .select({
        userId: userStreak.userId,
        currentStreak: userStreak.currentStreak,
        longestStreak: userStreak.longestStreak,
        lastActiveDate: userStreak.lastActiveDate,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
      })
      .from(userStreak)
      .innerJoin(user, eq(userStreak.userId, user.id))
      .orderBy(desc(userStreak.currentStreak), desc(userStreak.longestStreak))
      .limit(50);

    // Summary stats
    const allStreaks = await db
      .select({
        currentStreak: userStreak.currentStreak,
        longestStreak: userStreak.longestStreak,
      })
      .from(userStreak);

    const totalWithStreaks = allStreaks.filter(s => s.currentStreak > 0).length;
    const avgStreak = allStreaks.length > 0
      ? Math.round(allStreaks.reduce((sum, s) => sum + s.currentStreak, 0) / allStreaks.length * 10) / 10
      : 0;
    const maxStreak = allStreaks.length > 0
      ? Math.max(...allStreaks.map(s => s.longestStreak))
      : 0;

    return NextResponse.json({
      leaderboard: streaks,
      stats: {
        totalTracked: allStreaks.length,
        activeStreaks: totalWithStreaks,
        averageStreak: avgStreak,
        longestEver: maxStreak,
      },
    });
  } catch (error) {
    console.error("Streaks API error:", error);
    return NextResponse.json({ error: "Failed to fetch streaks" }, { status: 500 });
  }
}
