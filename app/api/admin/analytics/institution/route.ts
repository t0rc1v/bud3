import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { getMyLearners } from "@/lib/actions/admin";
import { db } from "@/lib/db";
import { resourceProgress, resource, resourceView } from "@/lib/db/schema";
import { eq, inArray, sql, desc } from "drizzle-orm";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserByClerkId(clerkId);
  if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const learners = await getMyLearners(user.id);
  const learnerIds = learners.map(l => l.regularId);

  if (learnerIds.length === 0) {
    return NextResponse.json({
      totalLearners: 0,
      completionStats: { completed: 0, inProgress: 0 },
      popularContent: [],
      recentActivity: [],
    });
  }

  // Progress stats
  const progressStats = await db
    .select({
      status: resourceProgress.status,
      count: sql<number>`COUNT(*)`,
    })
    .from(resourceProgress)
    .where(inArray(resourceProgress.userId, learnerIds))
    .groupBy(resourceProgress.status);

  const completed = Number(progressStats.find(s => s.status === "completed")?.count ?? 0);
  const inProgress = Number(progressStats.find(s => s.status === "started")?.count ?? 0);

  // Popular content (most viewed resources among learners)
  const popularContent = await db
    .select({
      resourceId: resourceView.resourceId,
      title: resource.title,
      viewCount: sql<number>`COUNT(*)`,
    })
    .from(resourceView)
    .leftJoin(resource, eq(resourceView.resourceId, resource.id))
    .where(inArray(resourceView.userId, learnerIds))
    .groupBy(resourceView.resourceId, resource.title)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(10);

  // Recent completions
  const recentActivity = await db
    .select({
      userId: resourceProgress.userId,
      resourceId: resourceProgress.resourceId,
      status: resourceProgress.status,
      completedAt: resourceProgress.updatedAt,
      resourceTitle: resource.title,
    })
    .from(resourceProgress)
    .leftJoin(resource, eq(resourceProgress.resourceId, resource.id))
    .where(inArray(resourceProgress.userId, learnerIds))
    .orderBy(desc(resourceProgress.updatedAt))
    .limit(20);

  return NextResponse.json({
    totalLearners: learnerIds.length,
    completionStats: { completed, inProgress },
    popularContent,
    recentActivity,
  });
}
