import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getGradesFullHierarchy } from "@/lib/actions/teacher";
import { hasUserUnlockedContent, getUnlockFeeByResource } from "@/lib/actions/credits";
import { DEFAULT_CREDIT_CONFIG } from "@/lib/mpesa";

/**
 * GET /api/content/hierarchy-with-unlock-status
 * Returns content hierarchy with unlock status for the current user
 * Works for both learners and teachers
 */
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

    // Check unlock status for each resource
    const gradesWithUnlockStatus = await Promise.all(
      grades.map(async (grade) => ({
        id: grade.id,
        title: grade.title,
        subjects: await Promise.all(
          (grade.subjects || []).map(async (subject) => ({
            id: subject.id,
            name: subject.name,
            topics: await Promise.all(
              (subject.topics || []).map(async (topic) => ({
                id: topic.id,
                title: topic.title,
                resources: await Promise.all(
                  (topic.resources || []).map(async (resource) => {
                    // Get unlock fee for this resource
                    const unlockFee = await getUnlockFeeByResource(resource.id);
                    
                    // Use default values if no unlock fee exists
                    const feeAmount = unlockFee?.feeAmount || DEFAULT_CREDIT_CONFIG.defaultUnlockFeeKes;

                    // Check if user has unlocked this resource
                    let isUnlocked = false;
                    if (unlockFee) {
                      isUnlocked = await hasUserUnlockedContent(userId, unlockFee.id);
                    }

                    return {
                      id: resource.id,
                      title: resource.title,
                      type: resource.type,
                      url: resource.url,
                      description: resource.description,
                      unlockFee: feeAmount,
                      isUnlocked,
                    };
                  })
                ),
              }))
            ),
          }))
        ),
      }))
    );

    return NextResponse.json({
      grades: gradesWithUnlockStatus,
    });

  } catch (error) {
    console.error("Content hierarchy with unlock status error:", error);
    return NextResponse.json(
      { error: "Failed to load content" },
      { status: 500 }
    );
  }
}
