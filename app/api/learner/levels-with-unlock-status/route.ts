import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getLevelsFullHierarchy } from "@/lib/actions/admin";
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

    const levels = await getLevelsFullHierarchy();

    // Check unlock status for each resource
    const levelsWithUnlockStatus = await Promise.all(
      levels.map(async (level) => ({
        id: level.id,
        title: level.title,
        subjects: await Promise.all(
          (level.subjects || []).map(async (subject) => ({
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
      levels: levelsWithUnlockStatus,
    });

  } catch (error) {
    console.error("Levels with unlock status error:", error);
    return NextResponse.json(
      { error: "Failed to load content" },
      { status: 500 }
    );
  }
}
