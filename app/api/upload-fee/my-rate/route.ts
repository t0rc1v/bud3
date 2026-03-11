import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUserByClerkId } from "@/lib/actions/auth";
import { calculateEffectiveUploadFee } from "@/lib/actions/upload-fee";
import { getActiveCreditBalance } from "@/lib/actions/credits";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await getUserByClerkId(clerkId);
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [feeResult, balance] = await Promise.all([
    calculateEffectiveUploadFee(dbUser.id),
    getActiveCreditBalance(dbUser.id),
  ]);

  return NextResponse.json({
    isEnabled: feeResult.isEnabled,
    baseFee: feeResult.baseFee,
    effectiveFee: feeResult.effectiveFee,
    discountPercent: feeResult.discountPercent,
    uploadCount: feeResult.uploadCount,
    balance,
    canAfford: !feeResult.isEnabled || balance >= feeResult.effectiveFee,
    nextTier: feeResult.nextTier,
  });
}
