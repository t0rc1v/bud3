import { auth } from "@clerk/nextjs/server";
import { getClassPerformance } from "@/lib/actions/teacher-analytics";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  const data = await getClassPerformance(clerkId);
  return NextResponse.json(data);
}
