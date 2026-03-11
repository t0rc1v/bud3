"use server";

import { db } from "@/lib/db";
import { resource } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

// ============== TYPES ==============

export interface DiscountTier {
  threshold: number;      // minimum total uploads to qualify
  discountPercent: number; // 0–100
}

export interface UploadFeeConfig {
  isEnabled: boolean;
  baseFeeCredits: number;
  discountTiers: DiscountTier[];
}

export interface EffectiveFeeResult {
  isEnabled: boolean;
  baseFee: number;
  discountPercent: number;
  effectiveFee: number;   // Math.ceil(baseFee * (1 - discountPercent/100))
  uploadCount: number;
  nextTier: { threshold: number; discountPercent: number } | null;
}

// ============== CONFIG LOADER ==============

export async function getUploadFeeConfig(): Promise<UploadFeeConfig> {
  const isEnabled = process.env.UPLOAD_FEE_ENABLED !== "false";
  const baseFeeCredits = Math.max(
    0,
    parseInt(process.env.UPLOAD_FEE_CREDITS ?? "10", 10) || 10
  );

  let discountTiers: DiscountTier[] = [
    { threshold: 10, discountPercent: 10 },
    { threshold: 50, discountPercent: 25 },
    { threshold: 100, discountPercent: 50 },
  ];

  try {
    const raw = process.env.UPLOAD_FEE_TIERS;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        discountTiers = parsed.filter(
          (t): t is DiscountTier =>
            typeof t === "object" &&
            typeof t.threshold === "number" &&
            typeof t.discountPercent === "number"
        );
      }
    }
  } catch {
    // keep defaults on parse error
  }

  return { isEnabled, baseFeeCredits, discountTiers };
}

// ============== UPLOAD COUNT ==============

/**
 * Count all resources ever uploaded by a DB user ID.
 * Includes inactive/deleted rows so milestones are permanent once reached.
 */
export async function countResourcesByOwner(userId: string): Promise<number> {
  const result = await db
    .select({ total: count() })
    .from(resource)
    .where(eq(resource.ownerId, userId));
  return Number(result[0]?.total ?? 0);
}

// ============== EFFECTIVE FEE CALCULATION ==============

export async function calculateEffectiveUploadFee(
  userId: string
): Promise<EffectiveFeeResult> {
  const config = await getUploadFeeConfig();

  if (!config.isEnabled) {
    const uploadCount = await countResourcesByOwner(userId);
    return {
      isEnabled: false,
      baseFee: config.baseFeeCredits,
      discountPercent: 0,
      effectiveFee: 0,
      uploadCount,
      nextTier: null,
    };
  }

  const uploadCount = await countResourcesByOwner(userId);

  // Sort tiers ascending by threshold
  const sortedTiers = [...config.discountTiers].sort(
    (a, b) => a.threshold - b.threshold
  );

  // Find highest qualifying tier
  let discountPercent = 0;
  for (const tier of sortedTiers) {
    if (uploadCount >= tier.threshold) {
      discountPercent = tier.discountPercent;
    }
  }

  const effectiveFee = Math.max(
    0,
    Math.ceil(config.baseFeeCredits * (1 - discountPercent / 100))
  );

  // Next tier the user hasn't yet reached
  const nextTier =
    sortedTiers.find((t) => uploadCount < t.threshold) ?? null;

  return {
    isEnabled: true,
    baseFee: config.baseFeeCredits,
    discountPercent,
    effectiveFee,
    uploadCount,
    nextTier,
  };
}
