import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { getCurriculumImports } from "@/lib/actions/curriculum-import";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return new Response("User not found", { status: 404 });

  const imports = await getCurriculumImports(user.id);
  return NextResponse.json({ imports });
}
