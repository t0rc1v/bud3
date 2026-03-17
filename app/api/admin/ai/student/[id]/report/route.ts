import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { generateParentReportData } from "@/lib/actions/teacher-analytics";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user || user.role === "regular") return new Response("Forbidden", { status: 403 });

  const { id } = await params;
  const report = await generateParentReportData(id);
  return NextResponse.json({ report });
}
