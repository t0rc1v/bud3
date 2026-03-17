import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { resource, topic, subject, level } from "@/lib/db/schema";
import { sql, eq, and } from "drizzle-orm";
import { getUserByClerkId } from "@/lib/actions/auth";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Full-text search over resources using Postgres to_tsvector.
 * Query param: ?q=<search term>&limit=20
 * Only returns published resources visible to the requesting user's role.
 */
export async function GET(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 60 search requests per minute per user
    const rl = checkRateLimit(`search:${clerkId}`, 60, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many search requests. Please slow down." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const dbUser = await getUserByClerkId(clerkId);
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const limitParam = parseInt(searchParams.get("limit") ?? "20", 10);
    const limit = Math.min(Math.max(limitParam, 1), 50);

    if (!q) {
      return NextResponse.json({ results: [] });
    }

    // Sanitize query: replace non-alphanumeric (except spaces) with space, trim
    const sanitized = q.replace(/[^\w\s]/g, " ").trim();
    if (!sanitized) return NextResponse.json({ results: [] });

    const isAdmin = dbUser.role === "admin" || dbUser.role === "super_admin";

    // websearch_to_tsquery handles stop words and edge cases gracefully
    const tsvectorExpr = sql`to_tsvector('english', coalesce(${resource.title}, '') || ' ' || coalesce(${resource.description}, ''))`;
    const tsqueryExpr = sql`websearch_to_tsquery('english', ${sanitized})`;

    const results = await db
      .select({
        id: resource.id,
        title: resource.title,
        description: resource.description,
        type: resource.type,
        topicTitle: topic.title,
        subjectName: subject.name,
        levelTitle: level.title,
        rank: sql<number>`ts_rank(${tsvectorExpr}, ${tsqueryExpr})`,
      })
      .from(resource)
      .leftJoin(topic, eq(resource.topicId, topic.id))
      .leftJoin(subject, eq(topic.subjectId, subject.id))
      .leftJoin(level, eq(subject.levelId, level.id))
      .where(
        isAdmin
          ? and(
              sql`${tsvectorExpr} @@ ${tsqueryExpr}`,
              eq(resource.isActive, true)
            )
          : and(
              sql`${tsvectorExpr} @@ ${tsqueryExpr}`,
              eq(resource.status, "published"),
              eq(resource.isActive, true),
              sql`${resource.visibility} IN ('public', 'admin_and_regulars', 'regular_only')`
            )
      )
      .orderBy(sql`rank DESC`)
      .limit(limit);

    // Fuzzy fallback via pg_trgm similarity when full-text returns no results
    if (results.length === 0) {
      try {
        const roleFilter = isAdmin
          ? eq(resource.isActive, true)
          : and(
              eq(resource.status, "published"),
              eq(resource.isActive, true),
              sql`${resource.visibility} IN ('public', 'admin_and_regulars', 'regular_only')`
            );

        const fuzzyResults = await db
          .select({
            id: resource.id,
            title: resource.title,
            description: resource.description,
            type: resource.type,
            topicTitle: topic.title,
            subjectName: subject.name,
            levelTitle: level.title,
            rank: sql<number>`similarity(${resource.title}, ${sanitized})`,
          })
          .from(resource)
          .leftJoin(topic, eq(resource.topicId, topic.id))
          .leftJoin(subject, eq(topic.subjectId, subject.id))
          .leftJoin(level, eq(subject.levelId, level.id))
          .where(
            and(
              sql`similarity(${resource.title}, ${sanitized}) > 0.1`,
              roleFilter
            )
          )
          .orderBy(sql`similarity(${resource.title}, ${sanitized}) DESC`)
          .limit(limit);

        return NextResponse.json({ results: fuzzyResults, fuzzy: true });
      } catch {
        // pg_trgm extension may not be available — return empty
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Content search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
