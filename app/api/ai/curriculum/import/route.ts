import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { createCurriculumImport } from "@/lib/actions/curriculum-import";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  const rl = checkRateLimit(`ai-curriculum:${clerkId}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many import requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const user = await getUserByClerkId(clerkId);
  if (!user) return new Response("User not found", { status: 404 });
  if (user.role === "regular") return new Response("Forbidden", { status: 403 });

  const body = await req.json();
  const record = await createCurriculumImport({ userId: user.id, ...body });
  return NextResponse.json({ import: record });
}
