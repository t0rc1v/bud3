import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { createCurriculumImport } from "@/lib/actions/curriculum-import";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return new Response("User not found", { status: 404 });
  if (user.role === "regular") return new Response("Forbidden", { status: 403 });

  const body = await req.json();
  const record = await createCurriculumImport({ userId: user.id, ...body });
  return NextResponse.json({ import: record });
}
