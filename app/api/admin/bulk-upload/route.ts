import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getUserByClerkId } from "@/lib/actions/auth";
import { db } from "@/lib/db";
import { level, subject, topic, resource } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

const rowSchema = z.object({
  level: z.string().min(1),
  subject: z.string().min(1),
  topic: z.string().min(1),
  resourceTitle: z.string().min(1),
  resourceType: z.enum(["notes", "video", "audio", "image"]),
  resourceUrl: z.string().url(),
  description: z.string().optional(),
});

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    return obj;
  });
}

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserByClerkId(clerkId);
  if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCsv(text);

  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV is empty or has no data rows" }, { status: 400 });
  }

  const created: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  // Cache IDs to reuse
  const levelCache = new Map<string, string>();
  const subjectCache = new Map<string, string>();
  const topicCache = new Map<string, string>();

  for (let i = 0; i < rows.length; i++) {
    const parsed = rowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      errors.push(`Row ${i + 2}: ${parsed.error.issues[0]?.message}`);
      continue;
    }
    const row = parsed.data;

    try {
      // Find or create level
      const levelKey = row.level.toLowerCase();
      let levelId = levelCache.get(levelKey);
      if (!levelId) {
        const existing = await db.select().from(level)
          .where(and(eq(level.title, row.level), eq(level.ownerId, user.id)))
          .limit(1);
        if (existing[0]) {
          levelId = existing[0].id;
        } else {
          // Get next level number
          const maxLevelNum = await db.select({ max: sql<number>`COALESCE(MAX(${level.levelNumber}), 0)` }).from(level);
          const nextLevelNum = Number(maxLevelNum[0]?.max ?? 0) + 1;
          const [created] = await db.insert(level)
            .values({ title: row.level, ownerId: user.id, ownerRole: user.role, order: 0, color: "#6366f1", levelNumber: nextLevelNum })
            .returning();
          levelId = created.id;
        }
        levelCache.set(levelKey, levelId);
      }

      // Find or create subject
      const subjectKey = `${levelId}:${row.subject.toLowerCase()}`;
      let subjectId = subjectCache.get(subjectKey);
      if (!subjectId) {
        const existing = await db.select().from(subject)
          .where(and(eq(subject.name, row.subject), eq(subject.levelId, levelId)))
          .limit(1);
        if (existing[0]) {
          subjectId = existing[0].id;
        } else {
          const [created] = await db.insert(subject)
            .values({ name: row.subject, levelId, icon: "BookOpen", color: "#6366f1" })
            .returning();
          subjectId = created.id;
        }
        subjectCache.set(subjectKey, subjectId);
      }

      // Find or create topic
      const topicKey = `${subjectId}:${row.topic.toLowerCase()}`;
      let topicId = topicCache.get(topicKey);
      if (!topicId) {
        const existing = await db.select().from(topic)
          .where(and(eq(topic.title, row.topic), eq(topic.subjectId, subjectId)))
          .limit(1);
        if (existing[0]) {
          topicId = existing[0].id;
        } else {
          const [created] = await db.insert(topic)
            .values({ title: row.topic, subjectId, order: 0 })
            .returning();
          topicId = created.id;
        }
        topicCache.set(topicKey, topicId);
      }

      // Check for duplicate resource
      const existingResource = await db.select().from(resource)
        .where(and(eq(resource.title, row.resourceTitle), eq(resource.topicId, topicId)))
        .limit(1);
      if (existingResource[0]) {
        skipped.push(`Row ${i + 2}: "${row.resourceTitle}" already exists`);
        continue;
      }

      // Create resource
      await db.insert(resource).values({
        title: row.resourceTitle,
        type: row.resourceType,
        url: row.resourceUrl,
        description: row.description || "",
        topicId,
        subjectId,
        ownerId: user.id,
        ownerRole: user.role,
        status: "published",
      });

      created.push(row.resourceTitle);
    } catch (err) {
      errors.push(`Row ${i + 2}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return NextResponse.json({
    created: created.length,
    skipped: skipped.length,
    errors: errors.length,
    details: { created, skipped, errors },
  });
}
