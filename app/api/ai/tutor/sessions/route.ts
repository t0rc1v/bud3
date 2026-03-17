import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { createTutorSession, getTutorSessionsByUser } from "@/lib/actions/tutor";
import { NextResponse } from "next/server";

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
  const user = await getUserByClerkId(clerkId);
  if (!user) return new Response("User not found", { status: 404 });

  const body = await req.json();
  const { chatId, subject, topic, level, mode } = body;

  if (!chatId || !subject || !topic || !mode) {
    return NextResponse.json(
      { error: "chatId, subject, topic, and mode are required" },
      { status: 400 }
    );
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
