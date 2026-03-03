import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getLevelsFullHierarchy } from "@/lib/actions/admin";
import { checkUserPermission } from "@/lib/actions/admin-permissions";
import { ContentPermissions } from "@/lib/permissions";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Restrict to users with content read permission (admins/super_admins)
    const hasPermission = await checkUserPermission(userId, ContentPermissions.LEVELS_READ);
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const levels = await getLevelsFullHierarchy();

    return NextResponse.json({
      levels: levels.map(level => ({
        id: level.id,
        name: level.title,
        type: "level",
        children: level.subjects?.map(subject => ({
          id: subject.id,
          name: subject.name,
          type: "subject",
          children: subject.topics?.map(topic => ({
            id: topic.id,
            name: topic.title,
            type: "topic",
            children: topic.resources?.map(resource => ({
              id: resource.id,
              name: resource.title,
              type: "resource",
            })) || [],
          })) || [],
        })) || [],
      })),
    });

  } catch (error) {
    console.error("Content hierarchy error:", error);
    return NextResponse.json(
      { error: "Failed to load content hierarchy" },
      { status: 500 }
    );
  }
}
