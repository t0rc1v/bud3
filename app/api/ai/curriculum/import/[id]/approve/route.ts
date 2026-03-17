import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { applyCurriculumStructure } from "@/lib/actions/curriculum-import";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return new Response("User not found", { status: 404 });
  if (user.role === "regular") return new Response("Forbidden", { status: 403 });

  const { id } = await params;
  const entities = await applyCurriculumStructure(id, user.id);
  return NextResponse.json({ applied: entities });
}
