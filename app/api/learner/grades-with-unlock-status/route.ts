import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getGradesFullHierarchy } from "@/lib/actions/admin";
import { hasUserUnlockedContent, getUnlockFeeByResource } from "@/lib/actions/credits";
import { DEFAULT_CREDIT_CONFIG } from "@/lib/mpesa";

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
                    // In our system, all resources require unlock fee by default
                    const unlockFee = await getUnlockFeeByResource(resource.id);
                    
                    // Use default values if no unlock fee exists
                    const feeAmount = unlockFee?.feeAmount || DEFAULT_CREDIT_CONFIG.defaultUnlockFeeKes;

                    // Check if user has unlocked this resource
                    let isUnlocked = false;
                    if (unlockFee) {
                      isUnlocked = await hasUserUnlockedContent(userId, unlockFee.id);
                    }

                    // In our system, resources are considered "locked" (require unlock fee)
                    // isUnlocked indicates if the user has already paid for access
                    // DO NOT include url - must use proxy endpoint for security
                    return {
                      id: resource.id,
                      title: resource.title,
                      type: resource.type,
                      unlockFee: feeAmount,
                      isUnlocked, // true if user has paid, false if locked/unpaid
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
    console.error("Grades with unlock status error:", error);
    return NextResponse.json(
      { error: "Failed to load content" },
      { status: 500 }
    );
  }
}
