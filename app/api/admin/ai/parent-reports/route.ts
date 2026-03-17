import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { generateParentReport, getParentReports } from "@/lib/actions/parent-reports";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user || user.role === "regular") return new Response("Forbidden", { status: 403 });

  const reports = await getParentReports(user.id);
  return NextResponse.json({ reports });
}

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user || user.role === "regular") return new Response("Forbidden", { status: 403 });

  const body = await req.json();
  const report = await generateParentReport({
    generatedBy: user.id,
    ...body,
  });
  return NextResponse.json({ report });
}
