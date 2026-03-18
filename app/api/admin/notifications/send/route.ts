import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { user, notification } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { checkUserPermission } from "@/lib/actions/admin-permissions";
import { getUserByClerkId } from "@/lib/actions/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const sendNotificationSchema = z.object({
  // "all" | "regulars" | "admins" | "specific"
  audience: z.enum(["all", "regulars", "admins", "specific"]),
  // Only required when audience === "specific"
  userIds: z.array(z.string().uuid()).optional(),
  title: z.string().min(1, "Title is required").max(255),
  body: z.string().max(2000).optional(),
  type: z.string().min(1).max(50).default("announcement"),
});

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit(`send-notification:${clerkId}`, 10, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } }
      );
    }

    const dbUser = await getUserByClerkId(clerkId);
    if (!dbUser || dbUser.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Also check granular permission
    const hasPermission = await checkUserPermission(clerkId, "users:bulk_actions");
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden - missing users:bulk_actions permission" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = sendNotificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid request" },
        { status: 400 }
      );
    }

    const { audience, userIds, title, body: notifBody, type } = parsed.data;

    // Resolve target user IDs
    let targetUserIds: string[];

    if (audience === "specific") {
      if (!userIds || userIds.length === 0) {
        return NextResponse.json({ error: "userIds required for specific audience" }, { status: 400 });
      }
      targetUserIds = userIds;
    } else {
      const roleFilter =
        audience === "regulars" ? eq(user.role, "regular") :
        audience === "admins" ? eq(user.role, "admin") :
        undefined; // "all"

      const users = roleFilter
        ? await db.select({ id: user.id }).from(user).where(roleFilter)
        : await db.select({ id: user.id }).from(user);

      targetUserIds = users.map(u => u.id);
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json({ error: "No users found for the selected audience" }, { status: 400 });
    }

    // Batch insert notifications (chunks of 500)
    let created = 0;
    for (let i = 0; i < targetUserIds.length; i += 500) {
      const chunk = targetUserIds.slice(i, i + 500);
      const rows = chunk.map(uid => ({
        userId: uid,
        type,
        title,
        body: notifBody ?? null,
        metadata: { sentBy: dbUser.id, audience } as Record<string, unknown>,
      }));
      await db.insert(notification).values(rows);
      created += chunk.length;
    }

    return NextResponse.json({ success: true, sent: created });
  } catch (error) {
    console.error("Send notification error:", error);
    return NextResponse.json({ error: "Failed to send notifications" }, { status: 500 });
  }
}
