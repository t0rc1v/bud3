import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { analyzeWeaknesses, getWeaknessProfile } from "@/lib/actions/weakness-analysis";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  const rl = checkRateLimit(`ai-weakness:${clerkId}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const user = await getUserByClerkId(clerkId);
  if (!user) return new Response("User not found", { status: 404 });

  const url = new URL(req.url);
  const refresh = url.searchParams.get("refresh") === "true";

  if (refresh) {
    await analyzeWeaknesses(user.id);
  }

  const profile = await getWeaknessProfile(user.id);
  return NextResponse.json({ profile });
}
