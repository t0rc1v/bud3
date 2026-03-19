import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { createTutorSession, getTutorSessionsByUser } from "@/lib/actions/tutor";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return new Response("User not found", { status: 404 });

  const sessions = await getTutorSessionsByUser(user.id);
  return NextResponse.json({ sessions });
}

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  const rl = checkRateLimit(`ai-tutor:${clerkId}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many session requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const user = await getUserByClerkId(clerkId);
  if (!user) return new Response("User not found", { status: 404 });

  const body = await req.json();
  const { chatId: providedChatId, subject, topic, level, mode } = body;

  if (!subject || !topic || !mode) {
    return NextResponse.json(
      { error: "subject, topic, and mode are required" },
      { status: 400 }
    );
  }

  // Auto-create a chat if chatId not provided
  let chatId = providedChatId;
  if (!chatId) {
    const { db } = await import("@/lib/db");
    const { chat } = await import("@/lib/db/schema");
    const [newChat] = await db
      .insert(chat)
      .values({
        userId: user.id,
        title: `Tutor: ${subject} — ${topic}`,
      })
      .returning();
    chatId = newChat.id;
  }

  const session = await createTutorSession({
    userId: user.id,
    chatId,
    subject,
    topic,
    level,
    mode,
  });

  return NextResponse.json({ session });
}
