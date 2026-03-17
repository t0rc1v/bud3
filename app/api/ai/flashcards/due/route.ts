import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { getDueFlashcards } from "@/lib/actions/spaced-repetition";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return new Response("User not found", { status: 404 });

  const url = new URL(req.url);
  const flashcardSetId = url.searchParams.get("flashcardSetId") || undefined;

  const due = await getDueFlashcards(user.id, flashcardSetId);
  return NextResponse.json({ due, count: due.length });
}
