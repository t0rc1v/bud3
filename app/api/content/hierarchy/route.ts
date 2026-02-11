import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getGradesFullHierarchy } from "@/lib/actions/admin";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const grades = await getGradesFullHierarchy();

    return NextResponse.json({
      grades: grades.map(grade => ({
        id: grade.id,
        name: grade.title,
        type: "grade",
        children: grade.subjects?.map(subject => ({
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
