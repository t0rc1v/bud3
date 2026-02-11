"use server";

import { db } from "@/lib/db";
import { 
  userCredit, 
  creditTransaction, 
  creditPurchase, 
  unlockFee, 
  unlockedContent,
  user,
  resource,
  topic,
  subject,
} from "@/lib/db/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { CREDIT_PRICING, DEFAULT_CREDIT_CONFIG } from "@/lib/mpesa";
import { sendCreditGiftEmail, sendResourceUnlockEmail } from "@/lib/email";

// ============== USER CREDIT MANAGEMENT ==============

export async function getOrCreateUserCredit(userId: string) {
  let credit = await db.query.userCredit.findFirst({
    where: eq(userCredit.userId, userId),
  });

  if (!credit) {
    const [newCredit] = await db
      .insert(userCredit)
      .values({
        userId,
        balance: 0,
        totalPurchased: 0,
        totalUsed: 0,
      })
      .returning();
    credit = newCredit;
  }

  return credit;
}

export async function getUserCreditBalance(userId: string): Promise<number> {
  const credit = await getOrCreateUserCredit(userId);
  return credit.balance;
}

export async function hasEnoughCredits(userId: string, amount: number): Promise<boolean> {
  const balance = await getUserCreditBalance(userId);
  return balance >= amount;
}

// ============== CREDIT TRANSACTIONS ==============

export interface TransactionData {
  userId: string;
  type: "purchase" | "usage" | "refund" | "gift" | "unlock" | "bonus";
  amount: number; // positive for credits added, negative for credits used
  description: string;
  metadata?: Record<string, unknown>;
}

export async function createCreditTransaction(data: TransactionData) {
  const credit = await getOrCreateUserCredit(data.userId);
  const newBalance = credit.balance + data.amount;

  if (newBalance < 0) {
    throw new Error("Insufficient credits");
  }

  // Create transaction record
  const [transaction] = await db
    .insert(creditTransaction)
    .values({
      userId: data.userId,
      type: data.type,
      amount: data.amount,
      balanceAfter: newBalance,
      description: data.description,
      metadata: data.metadata || {},
    })
    .returning();

  // Update user credit balance
  const updateData: Record<string, number | Date> = {
    balance: newBalance,
    updatedAt: new Date(),
  };

  // Update totals based on transaction type
  if (data.type === "purchase" || data.type === "gift" || data.type === "bonus") {
    updateData.totalPurchased = credit.totalPurchased + data.amount;
  } else if (data.type === "usage" || data.type === "unlock") {
    updateData.totalUsed = credit.totalUsed + Math.abs(data.amount);
  }

  await db
    .update(userCredit)
    .set(updateData)
    .where(eq(userCredit.userId, data.userId));

  revalidatePath("/regular");
  revalidatePath("/api/credits");

  return transaction;
}

export async function deductCredits(
  userId: string, 
  amount: number, 
  description: string,
  metadata?: Record<string, unknown>
) {
  return createCreditTransaction({
    userId,
    type: "usage",
    amount: -amount, // negative for deduction
    description,
    metadata,
  });
}

export async function addCredits(
  userId: string, 
  amount: number, 
  type: "purchase" | "gift" | "bonus" | "refund",
  description: string,
  metadata?: Record<string, unknown>
) {
  return createCreditTransaction({
    userId,
    type,
    amount, // positive for addition
    description,
    metadata,
  });
}

// ============== CREDIT PURCHASES ==============

export async function createCreditPurchase(
  userId: string,
  phoneNumber: string,
  amountKes: number,
  purchaseType: "credits" | "unlock" = "credits"
) {
  const credits = purchaseType === "credits" ? CREDIT_PRICING.calculateCredits(amountKes) : 0;

  const [purchase] = await db
    .insert(creditPurchase)
    .values({
      userId,
      phoneNumber,
      amountKes,
      creditsPurchased: credits,
      purchaseType,
      status: "pending",
    })
    .returning();

  return purchase;
}

export async function updateCreditPurchaseStatus(
  purchaseId: string,
  status: "pending" | "processing" | "completed" | "failed" | "cancelled" | "refunded",
  data?: {
    mpesaReceiptNumber?: string;
    resultCode?: string;
    resultDesc?: string;
    checkoutRequestId?: string;
    merchantRequestId?: string;
    transactionDate?: Date;
  }
) {
  // First, get the current purchase to check its current status
  const currentPurchase = await db.query.creditPurchase.findFirst({
    where: eq(creditPurchase.id, purchaseId),
  });

  if (!currentPurchase) {
    console.error(`Purchase ${purchaseId} not found`);
    return;
  }

  const wasAlreadyCompleted = currentPurchase.status === "completed";

  const updateData: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };

  if (data?.mpesaReceiptNumber) updateData.mpesaReceiptNumber = data.mpesaReceiptNumber;
  if (data?.resultCode) updateData.resultCode = data.resultCode;
  if (data?.resultDesc) updateData.resultDesc = data.resultDesc;
  if (data?.checkoutRequestId) updateData.checkoutRequestId = data.checkoutRequestId;
  if (data?.merchantRequestId) updateData.merchantRequestId = data.merchantRequestId;
  if (data?.transactionDate) updateData.transactionDate = data.transactionDate;

  await db
    .update(creditPurchase)
    .set(updateData)
    .where(eq(creditPurchase.id, purchaseId));

  // If completed and wasn't already completed, add credits to user (only for credit purchases, not unlocks)
  if (status === "completed" && !wasAlreadyCompleted && currentPurchase.purchaseType === "credits") {
    console.log(`Adding ${currentPurchase.creditsPurchased} credits to user ${currentPurchase.userId}`);
    await addCredits(
      currentPurchase.userId,
      currentPurchase.creditsPurchased,
      "purchase",
      `Purchased ${currentPurchase.creditsPurchased} credits via M-Pesa`,
      {
        purchaseId: currentPurchase.id,
        mpesaReceiptNumber: data?.mpesaReceiptNumber,
        amountKes: currentPurchase.amountKes,
      }
    );
    console.log(`Credits added successfully`);
  }
}

export async function getCreditPurchaseByCheckoutId(checkoutRequestId: string) {
  return db.query.creditPurchase.findFirst({
    where: eq(creditPurchase.checkoutRequestId, checkoutRequestId),
  });
}

export async function getUserCreditPurchases(userId: string) {
  return db.query.creditPurchase.findMany({
    where: eq(creditPurchase.userId, userId),
    orderBy: [desc(creditPurchase.createdAt)],
  });
}

// ============== TRANSACTION HISTORY ==============

export async function getUserTransactionHistory(userId: string, limit: number = 50) {
  return db.query.creditTransaction.findMany({
    where: eq(creditTransaction.userId, userId),
    orderBy: [desc(creditTransaction.createdAt)],
    limit,
  });
}

// ============== UNLOCK FEE MANAGEMENT ==============

export async function getUnlockFeeByResource(resourceId: string) {
  return db.query.unlockFee.findFirst({
    where: and(
      eq(unlockFee.resourceId, resourceId),
      eq(unlockFee.isActive, true)
    ),
  });
}

export async function getUnlockFeeByTopic(topicId: string) {
  return db.query.unlockFee.findFirst({
    where: and(
      eq(unlockFee.topicId, topicId),
      eq(unlockFee.isActive, true)
    ),
  });
}

export async function getUnlockFeeBySubject(subjectId: string) {
  return db.query.unlockFee.findFirst({
    where: and(
      eq(unlockFee.subjectId, subjectId),
      eq(unlockFee.isActive, true)
    ),
  });
}

export async function createUnlockFee(data: {
  type: "resource" | "topic" | "subject";
  resourceId?: string;
  topicId?: string;
  subjectId?: string;
  feeAmount?: number;
  creditsRequired?: number;
}) {
  const [fee] = await db
    .insert(unlockFee)
    .values({
      type: data.type,
      resourceId: data.resourceId,
      topicId: data.topicId,
      subjectId: data.subjectId,
      feeAmount: data.feeAmount || DEFAULT_CREDIT_CONFIG.defaultUnlockFeeKes,
      creditsRequired: data.creditsRequired || DEFAULT_CREDIT_CONFIG.defaultUnlockCredits,
      isActive: true,
    })
    .returning();

  return fee;
}

export async function updateUnlockFee(
  feeId: string,
  updates: {
    feeAmount?: number;
    creditsRequired?: number;
    isActive?: boolean;
  }
) {
  await db
    .update(unlockFee)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(unlockFee.id, feeId));
}

export async function deleteUnlockFee(feeId: string) {
  await db.delete(unlockFee).where(eq(unlockFee.id, feeId));
}

export async function getAllUnlockFees() {
  return db.query.unlockFee.findMany({
    orderBy: [desc(unlockFee.createdAt)],
    with: {
      resource: true,
      topic: true,
      subject: true,
    },
  });
}

// ============== CONTENT UNLOCKING ==============

export async function hasUserUnlockedContent(userId: string, unlockFeeId: string): Promise<boolean> {
  const unlocked = await db.query.unlockedContent.findFirst({
    where: and(
      eq(unlockedContent.userId, userId),
      eq(unlockedContent.unlockFeeId, unlockFeeId)
    ),
  });

  return !!unlocked;
}

/**
 * @deprecated This function is deprecated. All unlocks are now done via direct M-Pesa payment.
 * Use the API endpoint POST /api/content/unlock instead.
 */
export async function unlockContent(
  userId: string,
  unlockFeeId: string
) {
  throw new Error(
    "Credit-based unlocks are no longer supported. All unlocks must be done via direct M-Pesa payment."
  );
}

export async function getUserUnlockedContent(userId: string) {
  return db.query.unlockedContent.findMany({
    where: eq(unlockedContent.userId, userId),
    orderBy: [desc(unlockedContent.unlockedAt)],
    with: {
      unlockFee: {
        with: {
          resource: true,
          topic: true,
          subject: true,
        },
      },
    },
  });
}

// ============== ADMIN: GIFT CREDITS ==============

export async function giftCredits(
  adminUserId: string,
  targetUserEmail: string,
  amount: number,
  reason: string
) {
  // Find user by email
  const targetUser = await db.query.user.findFirst({
    where: eq(user.email, targetUserEmail),
  });

  if (!targetUser) {
    throw new Error(`User with email ${targetUserEmail} not found`);
  }

  if (amount <= 0) {
    throw new Error("Gift amount must be positive");
  }

  const transaction = await addCredits(
    targetUser.clerkId,
    amount,
    "gift",
    `Gifted ${amount} credits by admin`,
    {
      adminUserId,
      reason,
      targetUserEmail,
    }
  );

  // Get admin name for email
  const adminUser = await db.query.user.findFirst({
    where: eq(user.clerkId, adminUserId),
  });
  const senderName = adminUser?.institutionName || adminUser?.email || "Admin";

  // Send email notification
  try {
    await sendCreditGiftEmail({
      recipientEmail: targetUserEmail,
      amount,
      senderName,
      message: reason,
    });
  } catch (emailError) {
    console.error("Failed to send credit gift email:", emailError);
    // Don't throw - email failure shouldn't break the gift operation
  }

  revalidatePath("/admin/manage-credits");

  return {
    success: true,
    transaction,
    userId: targetUser.clerkId,
    email: targetUser.email,
  };
}

// ============== AI RESPONSE CREDIT CHECK ==============

export async function checkAndDeductCreditsForAIResponse(
  userId: string,
  chatId?: string
): Promise<{ success: boolean; error?: string; remainingCredits?: number }> {
  try {
    const creditsPerResponse = DEFAULT_CREDIT_CONFIG.creditsPerAIResponse;
    
    // Check if user has enough credits
    const hasEnough = await hasEnoughCredits(userId, creditsPerResponse);
    
    if (!hasEnough) {
      const balance = await getUserCreditBalance(userId);
      return {
        success: false,
        error: `Insufficient credits. You need ${creditsPerResponse} credits for an AI response. Your current balance is ${balance} credits.`,
        remainingCredits: balance,
      };
    }

    // Deduct credits
    await deductCredits(
      userId,
      creditsPerResponse,
      "AI response generation",
      {
        chatId,
        creditsPerResponse,
      }
    );

    const remainingCredits = await getUserCreditBalance(userId);

    return {
      success: true,
      remainingCredits,
    };
  } catch (error) {
    console.error("Error checking/deducting credits:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to process credits",
    };
  }
}

// ============== CREDIT CONFIGURATION ==============

export async function getCreditPricing() {
  return {
    ...CREDIT_PRICING,
    packages: DEFAULT_CREDIT_CONFIG.creditPackages,
    creditsPerAIResponse: DEFAULT_CREDIT_CONFIG.creditsPerAIResponse,
    defaultUnlockFeeKes: DEFAULT_CREDIT_CONFIG.defaultUnlockFeeKes,
    defaultUnlockCredits: DEFAULT_CREDIT_CONFIG.defaultUnlockCredits,
  };
}

// ============== ADMIN: UNLOCK CONTENT FOR USER ==============

export interface UnlockContentForUserParams {
  userId: string;
  resourceId?: string;
  topicId?: string;
  subjectId?: string;
  unlockedBy: string;
  reason?: string;
}

export async function unlockContentForUser(params: UnlockContentForUserParams) {
  const { userId, resourceId, topicId, subjectId, unlockedBy, reason } = params;

  // Determine unlock fee based on provided ID
  let feeRecord: typeof unlockFee.$inferSelect | null | undefined = null;
  let contentType: string = "";
  let contentName: string = "";
  let contentId: string = "";

  if (resourceId) {
    // Get resource name first
    const resourceData = await db.query.resource.findFirst({
      where: eq(resource.id, resourceId),
    });
    contentName = resourceData?.title || "Resource";
    contentId = resourceId;
    contentType = "resource";
    
    // Find or create unlock fee
    const foundFee = await db.query.unlockFee.findFirst({
      where: and(
        eq(unlockFee.resourceId, resourceId),
        eq(unlockFee.isActive, true)
      ),
    });
    feeRecord = foundFee || null;
  } else if (topicId) {
    const topicData = await db.query.topic.findFirst({
      where: eq(topic.id, topicId),
    });
    contentName = topicData?.title || "Topic";
    contentId = topicId;
    contentType = "topic";
    
    const foundFee = await db.query.unlockFee.findFirst({
      where: and(
        eq(unlockFee.topicId, topicId),
        eq(unlockFee.isActive, true)
      ),
    });
    feeRecord = foundFee || null;
  } else if (subjectId) {
    const subjectData = await db.query.subject.findFirst({
      where: eq(subject.id, subjectId),
    });
    contentName = subjectData?.name || "Subject";
    contentId = subjectId;
    contentType = "subject";
    
    const foundFee = await db.query.unlockFee.findFirst({
      where: and(
        eq(unlockFee.subjectId, subjectId),
        eq(unlockFee.isActive, true)
      ),
    });
    feeRecord = foundFee || null;
  }

  // If no unlock fee exists, create a default one
  let finalFeeRecord = feeRecord;
  if (!finalFeeRecord) {
    const newFeeData = {
      type: contentType as "resource" | "topic" | "subject",
      feeAmount: DEFAULT_CREDIT_CONFIG.defaultUnlockFeeKes,
      creditsRequired: DEFAULT_CREDIT_CONFIG.defaultUnlockCredits,
      isActive: true,
      resourceId: resourceId || null,
      topicId: topicId || null,
      subjectId: subjectId || null,
    };

    const [newFee] = await db
      .insert(unlockFee)
      .values(newFeeData)
      .returning();
    
    finalFeeRecord = newFee;
  }

  if (!finalFeeRecord) {
    throw new Error("Failed to create or find unlock fee");
  }

  // Check if already unlocked
  const alreadyUnlocked = await hasUserUnlockedContent(userId, finalFeeRecord.id);
  if (alreadyUnlocked) {
    throw new Error(`User has already unlocked this ${contentType}`);
  }

  // Create a gift transaction (no credits deducted since admin is unlocking)
  const transaction = await createCreditTransaction({
    userId,
    type: "gift",
    amount: 0, // No credits deducted
    description: `Admin unlocked ${contentName} (${contentType})`,
    metadata: {
      unlockFeeId: finalFeeRecord.id,
      unlockedBy,
      reason,
      contentType,
      contentName,
      creditsRequired: finalFeeRecord.creditsRequired,
      adminUnlock: true,
    },
  });

  // Create unlocked content record
  // Note: Admin unlocks are done without payment, so paymentReference is null
  const [unlocked] = await db
    .insert(unlockedContent)
    .values({
      userId,
      unlockFeeId: finalFeeRecord.id,
      paymentReference: null, // Admin unlock - no payment reference
      amountPaidKes: 0, // No payment for admin unlock
    })
    .returning();

  // Get recipient email and admin name for notification
  const recipient = await db.query.user.findFirst({
    where: eq(user.clerkId, userId),
  });
  
  const unlockedByUser = await db.query.user.findFirst({
    where: eq(user.clerkId, unlockedBy),
  });
  
  const senderName = unlockedByUser?.institutionName || unlockedByUser?.email || "Admin";

  // Send email notification for resource unlocks only (not topics/subjects)
  if (recipient?.email && contentType === "resource") {
    try {
      await sendResourceUnlockEmail({
        recipientEmail: recipient.email,
        resourceName: contentName,
        senderName,
      });
    } catch (emailError) {
      console.error("Failed to send resource unlock email:", emailError);
      // Don't throw - email failure shouldn't break the unlock operation
    }
  }

  revalidatePath("/admin/rewards");
  revalidatePath("/regular");

  return {
    success: true,
    unlockId: unlocked.id,
    contentType,
    contentName,
    userId,
  };
}
