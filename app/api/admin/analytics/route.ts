import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  user,
  creditTransaction,
  auditLog,
} from "@/lib/db/schema";
import { eq, desc, gte, sql, inArray, count, and } from "drizzle-orm";
import { getUserByClerkId } from "@/lib/actions/auth";
import { getTopRatedResources } from "@/lib/actions/learner";
import { getSuperAdminAdminIds, getSuperAdminRegularIds } from "@/lib/actions/admin";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await getUserByClerkId(clerkId);
    if (!currentUser || currentUser.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [adminIds, regularIds] = await Promise.all([
      getSuperAdminAdminIds(currentUser.id),
      getSuperAdminRegularIds(currentUser.id),
    ]);
    const allUserIds = [currentUser.id, ...adminIds, ...regularIds];

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      userCounts,
      totalTransactions,
      recentTransactions,
      creditSpendingByDay,
      recentAuditLogs,
      topRatedResources,
    ] = await Promise.all([
      // User counts scoped to institution
      db
        .select({ role: user.role, count: count() })
        .from(user)
        .where(inArray(user.id, allUserIds))
        .groupBy(user.role),

      // Total credit transactions scoped to institution
      db
        .select({ count: count(), total: sql<number>`COALESCE(SUM(ABS(${creditTransaction.amount})), 0)` })
        .from(creditTransaction)
        .where(inArray(creditTransaction.userId, allUserIds)),

      // Credit transactions last 30 days scoped to institution
      db
        .select({ count: count(), total: sql<number>`COALESCE(SUM(ABS(${creditTransaction.amount})), 0)` })
        .from(creditTransaction)
        .where(and(
          inArray(creditTransaction.userId, allUserIds),
          gte(creditTransaction.createdAt, thirtyDaysAgo)
        )),

      // Credit spending by day (last 7 days) scoped to institution
      db
        .select({
          day: sql<string>`DATE(${creditTransaction.createdAt})`,
          credits: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransaction.amount} < 0 THEN ABS(${creditTransaction.amount}) ELSE 0 END), 0)`,
          purchases: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransaction.type} = 'purchase' THEN ${creditTransaction.amount} ELSE 0 END), 0)`,
        })
        .from(creditTransaction)
        .where(and(
          inArray(creditTransaction.userId, allUserIds),
          gte(creditTransaction.createdAt, sevenDaysAgo)
        ))
        .groupBy(sql`DATE(${creditTransaction.createdAt})`)
        .orderBy(sql`DATE(${creditTransaction.createdAt})`),

      // Recent audit log entries scoped to institution
      db
        .select({
          id: auditLog.id,
          action: auditLog.action,
          entityType: auditLog.entityType,
          entityId: auditLog.entityId,
          actorEmail: user.email,
          createdAt: auditLog.createdAt,
        })
        .from(auditLog)
        .leftJoin(user, eq(auditLog.actorId, user.id))
        .where(inArray(auditLog.actorId, allUserIds))
        .orderBy(desc(auditLog.createdAt))
        .limit(50),

      // Top rated resources scoped to institution owners
      getTopRatedResources(10, allUserIds),
    ]);

    const userCountMap = Object.fromEntries(
      userCounts.map((r) => [r.role, r.count])
    );

    return NextResponse.json({
      users: {
        total: userCounts.reduce((sum, r) => sum + r.count, 0),
        regulars: userCountMap["regular"] ?? 0,
        admins: userCountMap["admin"] ?? 0,
        superAdmins: userCountMap["super_admin"] ?? 0,
      },
      credits: {
        totalTransactions: totalTransactions[0]?.count ?? 0,
        totalCreditsFlowed: totalTransactions[0]?.total ?? 0,
        last30dTransactions: recentTransactions[0]?.count ?? 0,
        last30dCreditsFlowed: recentTransactions[0]?.total ?? 0,
      },
      creditSpendingByDay: creditSpendingByDay.map((r) => ({
        day: r.day,
        creditsUsed: r.credits,
        creditsPurchased: r.purchases,
      })),
      recentAuditLogs: recentAuditLogs.map((r) => ({
        id: r.id,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        actorEmail: r.actorEmail ?? null,
        createdAt: r.createdAt,
      })),
      topRatedResources: topRatedResources.map((r) => ({
        resourceId: r.resourceId,
        resourceTitle: r.resourceTitle,
        resourceType: r.resourceType,
        topicTitle: r.topicTitle,
        subjectName: r.subjectName,
        levelTitle: r.levelTitle,
        upCount: Number(r.upCount),
        downCount: Number(r.downCount),
        totalRatings: r.totalRatings,
      })),
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
