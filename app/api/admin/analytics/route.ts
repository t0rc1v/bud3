import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  user,
  creditTransaction,
  creditPurchase,
  unlockedContent,
  unlockFee,
  resource,
  topic,
  subject,
  level,
  auditLog,
} from "@/lib/db/schema";
import { eq, desc, gte, sql, and, count } from "drizzle-orm";
import { getUserByClerkId } from "@/lib/actions/auth";
import { getTopRatedResources } from "@/lib/actions/learner";

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

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      userCounts,
      totalTransactions,
      recentTransactions,
      completedPayments,
      recentPayments,
      topUnlockedResources,
      creditSpendingByDay,
      recentAuditLogs,
      topRatedResources,
    ] = await Promise.all([
      // User counts by role
      db
        .select({ role: user.role, count: count() })
        .from(user)
        .groupBy(user.role),

      // Total credit transactions
      db
        .select({ count: count(), total: sql<number>`COALESCE(SUM(ABS(${creditTransaction.amount})), 0)` })
        .from(creditTransaction),

      // Credit transactions last 30 days
      db
        .select({ count: count(), total: sql<number>`COALESCE(SUM(ABS(${creditTransaction.amount})), 0)` })
        .from(creditTransaction)
        .where(gte(creditTransaction.createdAt, thirtyDaysAgo)),

      // Completed payments all time
      db
        .select({
          count: count(),
          total: sql<number>`COALESCE(SUM(${creditPurchase.amountKes}), 0)`,
        })
        .from(creditPurchase)
        .where(eq(creditPurchase.status, "completed")),

      // Completed payments last 30 days
      db
        .select({
          count: count(),
          total: sql<number>`COALESCE(SUM(${creditPurchase.amountKes}), 0)`,
        })
        .from(creditPurchase)
        .where(
          and(
            eq(creditPurchase.status, "completed"),
            gte(creditPurchase.createdAt, thirtyDaysAgo)
          )
        ),

      // Most unlocked resources (top 10)
      db
        .select({
          unlockFeeId: unlockedContent.unlockFeeId,
          unlockCount: count(),
          resourceTitle: resource.title,
          resourceType: resource.type,
          topicTitle: topic.title,
          subjectName: subject.name,
          levelTitle: level.title,
        })
        .from(unlockedContent)
        .leftJoin(unlockFee, eq(unlockedContent.unlockFeeId, unlockFee.id))
        .leftJoin(resource, eq(unlockFee.resourceId, resource.id))
        .leftJoin(topic, eq(resource.topicId, topic.id))
        .leftJoin(subject, eq(topic.subjectId, subject.id))
        .leftJoin(level, eq(subject.levelId, level.id))
        .groupBy(
          unlockedContent.unlockFeeId,
          resource.title,
          resource.type,
          topic.title,
          subject.name,
          level.title
        )
        .orderBy(desc(sql`count(*)`))
        .limit(10),

      // Credit spending by day (last 7 days)
      db
        .select({
          day: sql<string>`DATE(${creditTransaction.createdAt})`,
          credits: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransaction.amount} < 0 THEN ABS(${creditTransaction.amount}) ELSE 0 END), 0)`,
          purchases: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransaction.type} = 'purchase' THEN ${creditTransaction.amount} ELSE 0 END), 0)`,
        })
        .from(creditTransaction)
        .where(gte(creditTransaction.createdAt, sevenDaysAgo))
        .groupBy(sql`DATE(${creditTransaction.createdAt})`)
        .orderBy(sql`DATE(${creditTransaction.createdAt})`),

      // Recent audit log entries (last 50)
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
        .orderBy(desc(auditLog.createdAt))
        .limit(50),

      // Top rated resources
      getTopRatedResources(10),
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
      payments: {
        totalCompleted: completedPayments[0]?.count ?? 0,
        totalRevenueKes: completedPayments[0]?.total ?? 0,
        last30dCompleted: recentPayments[0]?.count ?? 0,
        last30dRevenueKes: recentPayments[0]?.total ?? 0,
      },
      topUnlockedResources: topUnlockedResources.map((r) => ({
        unlockFeeId: r.unlockFeeId,
        unlockCount: r.unlockCount,
        resourceTitle: r.resourceTitle ?? "Unknown Resource",
        resourceType: r.resourceType,
        topicTitle: r.topicTitle,
        subjectName: r.subjectName,
        levelTitle: r.levelTitle,
      })),
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
