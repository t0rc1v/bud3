import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getLevelsFullHierarchy } from "@/lib/actions/admin";
import { getUserByClerkId } from "@/lib/actions/auth";

export async function GET(req: Request) {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const dbUser = await getUserByClerkId(clerkId);
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const levels = await getLevelsFullHierarchy({ publishedOnly: true });

    const levelsData = levels.map(level => ({
      id: level.id,
      title: level.title,
      subjects: (level.subjects || []).map(subject => ({
        id: subject.id,
        name: subject.name,
        topics: (subject.topics || []).map(topic => ({
          id: topic.id,
          title: topic.title,
          resources: (topic.resources || []).map(resource => ({
            id: resource.id,
            title: resource.title,
            type: resource.type,
            url: resource.url,
          })),
        })),
      })),
    }));

    return NextResponse.json({ levels: levelsData });

  } catch (error) {
    console.error("Levels with unlock status error:", error);
    return NextResponse.json(
      { error: "Failed to load content" },
      { status: 500 }
    );
  }
}
