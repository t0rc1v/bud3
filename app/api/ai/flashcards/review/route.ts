import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { reviewFlashcard } from "@/lib/actions/spaced-repetition";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return new Response("User not found", { status: 404 });

  const body = await req.json();
  const { flashcardSetId, cardId, rating } = body;

  if (!flashcardSetId || !cardId || !rating) {
    return NextResponse.json(
      { error: "flashcardSetId, cardId, and rating are required" },
      { status: 400 }
    );
  }

  const review = await reviewFlashcard({
    flashcardSetId,
    userId: user.id,
    cardId,
    rating,
  });

  return NextResponse.json({ review });
}
