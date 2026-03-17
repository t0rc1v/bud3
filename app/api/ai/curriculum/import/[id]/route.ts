import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { getCurriculumImportById } from "@/lib/actions/curriculum-import";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return new Response("User not found", { status: 404 });

  const { id } = await params;
  const record = await getCurriculumImportById(id);
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ import: record });
}
