import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkUserPermission } from "@/lib/actions/admin-permissions";
import { ContentPermissions } from "@/lib/permissions";
import { getLevelsFullHierarchy } from "@/lib/actions/admin";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasPermission = await checkUserPermission(clerkId, ContentPermissions.LEVELS_READ);
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const levels = await getLevelsFullHierarchy();

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      levels: levels.map((level) => ({
        title: level.title,
        subjects: (level.subjects || []).map((subject) => ({
          name: subject.name,
          topics: (subject.topics || []).map((topic) => ({
            title: topic.title,
            resources: (topic.resources || []).map((resource) => ({
              title: resource.title,
              description: resource.description,
              type: resource.type,
              url: resource.url,
              isLocked: resource.isLocked,
              visibility: resource.visibility,
              status: resource.status,
            })),
          })),
        })),
      })),
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="content-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("Content export error:", error);
    return NextResponse.json({ error: "Failed to export content" }, { status: 500 });
  }
}
