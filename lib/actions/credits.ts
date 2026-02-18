"use server";

import { db, pool } from "@/lib/db";
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
import { eq, and, desc, asc, sql, gt, or, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { revalidatePath } from "next/cache";
import { CREDIT_PRICING, DEFAULT_CREDIT_CONFIG } from "@/lib/mpesa";
import { sendCreditGiftEmail, sendResourceUnlockEmail } from "@/lib/email";

// ============== USER CREDIT MANAGEMENT ==============

export async function getOrCreateUserCredit(userId: string) {
  let credit = await db
    .select()
    .from(userCredit)
    .where(eq(userCredit.userId, userId))
    .limit(1)
    .then(res => res[0] || null);

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
  const activeBalance = await getActiveCreditBalance(userId);
  return activeBalance >= amount;
}

// ============== CREDIT TRANSACTIONS ==============

export interface TransactionData {
  userId: string;
  type: "purchase" | "usage" | "refund" | "gift" | "unlock" | "bonus" | "transfer";
  amount: number; // positive for credits added, negative for credits used
  description: string;
  metadata?: Record<string, unknown>;
  expiresAt?: Date | null; // null means never expires (super-admin gifts)
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
      expiresAt: data.expiresAt || null,
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
  } else if (data.type === "usage" || data.type === "unlock" || data.type === "transfer") {
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
  metadata?: Record<string, unknown>,
  expirationDays?: number | null
) {
  // Calculate expiration date
  let expiresAt: Date | null = null;
  
  if (expirationDays !== null && expirationDays !== undefined) {
    // Use custom expiration days if provided
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);
  } else if (type === "purchase") {
    // Purchases always expire after 30 days
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DEFAULT_CREDIT_CONFIG.CREDIT_EXPIRATION_DAYS);
  }
  // For gifts: if expirationDays is null, credits never expire (super-admin only)
  // If expirationDays is undefined, default to 30 days
  else if (type === "gift" && expirationDays === undefined) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DEFAULT_CREDIT_CONFIG.CREDIT_EXPIRATION_DAYS);
  }

  return createCreditTransaction({
    userId,
    type,
    amount, // positive for addition
    description,
    metadata,
    expiresAt,
  });
}

// ============== ACTIVE CREDIT MANAGEMENT ==============

/**
 * Get all non-expired credit transactions for a user
 * Returns transactions where expiresAt is null (never expires) or in the future
 */
export async function getUserActiveTransactions(userId: string) {
  const now = new Date();

  console.log("user in transaction", userId);
  
  return db
    .select()
    .from(creditTransaction)
    .where(
      and(
        eq(creditTransaction.userId, userId),
        or(
          isNull(creditTransaction.expiresAt),
          gt(creditTransaction.expiresAt, now)
        )
      )
    )
    .orderBy(asc(creditTransaction.createdAt));
}

/**
 * Get the active credit balance (excluding expired credits)
 */
export async function getActiveCreditBalance(userId: string): Promise<number> {
  const activeTransactions = await getUserActiveTransactions(userId);
  
  // Sum up all active credits (positive amounts only)
  const activeCredits = activeTransactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  
  // Subtract used credits (negative amounts)
  const usedCredits = activeTransactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  return Math.max(0, activeCredits - usedCredits);
}

/**
 * Get detailed credit info including expired and expiring soon counts
 */
export async function getUserCreditDetails(userId: string) {
  const now = new Date();
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + DEFAULT_CREDIT_CONFIG.EXPIRATION_WARNING_DAYS);
  
  // Get all transactions
  const allTransactions = await db
    .select()
    .from(creditTransaction)
    .where(eq(creditTransaction.userId, userId))
    .orderBy(desc(creditTransaction.createdAt));
  
  // Calculate expired credits
  const expiredTransactions = allTransactions.filter(
    t => t.expiresAt && t.expiresAt < now && t.amount > 0
  );
  const expiredCredits = expiredTransactions.reduce((sum, t) => sum + t.amount, 0);
  
  // Calculate expiring soon credits
  const expiringSoonTransactions = allTransactions.filter(
    t => t.expiresAt && t.expiresAt >= now && t.expiresAt <= warningDate && t.amount > 0
  );
  const expiringSoonCredits = expiringSoonTransactions.reduce((sum, t) => sum + t.amount, 0);
  
  // Calculate active balance
  const activeBalance = await getActiveCreditBalance(userId);
  
  // Get total balance from userCredit record
  const creditRecord = await getOrCreateUserCredit(userId);
  
  return {
    activeBalance,
    totalBalance: creditRecord.balance,
    expiredCredits,
    expiringSoonCredits,
    expiringSoonCount: expiringSoonTransactions.length,
  };
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
  const currentPurchase = await db
    .select()
    .from(creditPurchase)
    .where(eq(creditPurchase.id, purchaseId))
    .limit(1)
    .then(res => res[0] || null);

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
  return db
    .select()
    .from(creditPurchase)
    .where(eq(creditPurchase.checkoutRequestId, checkoutRequestId))
    .limit(1)
    .then(res => res[0] || null);
}

export async function getCreditPurchaseByMpesaReceipt(mpesaReceiptNumber: string) {
  return db
    .select()
    .from(creditPurchase)
    .where(eq(creditPurchase.mpesaReceiptNumber, mpesaReceiptNumber))
    .limit(1)
    .then(res => res[0] || null);
}

export async function verifyPaymentForResource(
  paymentReference: string,
  expectedAmountKes: number,
  userId: string
): Promise<{ isValid: boolean; error?: string }> {
  const purchase = await getCreditPurchaseByMpesaReceipt(paymentReference);
  
  if (!purchase) {
    return { isValid: false, error: "Payment not found" };
  }
  
  if (purchase.status !== "completed") {
    return { isValid: false, error: `Payment status is ${purchase.status}, not completed` };
  }
  
  if (purchase.userId !== userId) {
    return { isValid: false, error: "Payment does not belong to this user" };
  }
  
  if (purchase.amountKes < expectedAmountKes) {
    return { 
      isValid: false, 
      error: `Payment amount (${purchase.amountKes} KES) is less than required (${expectedAmountKes} KES)` 
    };
  }
  
  return { isValid: true };
}

export async function getUserCreditPurchases(userId: string) {
  return db
    .select()
    .from(creditPurchase)
    .where(eq(creditPurchase.userId, userId))
    .orderBy(desc(creditPurchase.createdAt));
}

// ============== TRANSACTION HISTORY ==============

export async function getUserTransactionHistory(userId: string, limit: number = 50) {
  return db
    .select()
    .from(creditTransaction)
    .where(eq(creditTransaction.userId, userId))
    .orderBy(desc(creditTransaction.createdAt))
    .limit(limit);
}

// ============== UNLOCK FEE MANAGEMENT ==============

export async function getUnlockFeeByResource(resourceId: string) {
  return db
    .select()
    .from(unlockFee)
    .where(and(
      eq(unlockFee.resourceId, resourceId),
      eq(unlockFee.isActive, true)
    ))
    .limit(1)
    .then(res => res[0] || null);
}

export async function getUnlockFeeByTopic(topicId: string) {
  return db
    .select()
    .from(unlockFee)
    .where(and(
      eq(unlockFee.topicId, topicId),
      eq(unlockFee.isActive, true)
    ))
    .limit(1)
    .then(res => res[0] || null);
}

export async function getUnlockFeeBySubject(subjectId: string) {
  return db
    .select()
    .from(unlockFee)
    .where(and(
      eq(unlockFee.subjectId, subjectId),
      eq(unlockFee.isActive, true)
    ))
    .limit(1)
    .then(res => res[0] || null);
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

/**
 * Get the definitive unlock fee for a resource
 * SINGLE SOURCE OF TRUTH: Always returns unlockFee.feeAmount, never resource.unlockFee
 * Auto-creates unlockFee record if missing
 * @param resourceId - The resource ID
 * @returns Object with feeAmount, creditsRequired, and unlockFeeId
 */
export async function getResourceUnlockFee(resourceId: string): Promise<{
  feeAmount: number;
  creditsRequired: number;
  unlockFeeId: string | null;
}> {
  const { calculateCreditsRequired } = await import("@/lib/calculator");
  
  // Try to get existing unlock fee
  let feeRecord = await getUnlockFeeByResource(resourceId);
  
  if (feeRecord) {
    return {
      feeAmount: feeRecord.feeAmount,
      creditsRequired: feeRecord.creditsRequired,
      unlockFeeId: feeRecord.id,
    };
  }
  
  // No unlock fee exists - check if resource has a price set
  const resourceData = await db
    .select()
    .from(resource)
    .where(eq(resource.id, resourceId))
    .limit(1)
    .then(res => res[0] || null);
  
  // Determine the fee amount (ignore resource.unlockFee, use unlockFee table only)
  // This enforces single source of truth
  const feeAmount = resourceData?.unlockFee > 0 
    ? resourceData.unlockFee 
    : DEFAULT_CREDIT_CONFIG.defaultUnlockFeeKes;
  
  const creditsRequired = calculateCreditsRequired(feeAmount);
  
  // Create the unlock fee record for consistency
  const newFee = await createUnlockFee({
    type: "resource",
    resourceId,
    feeAmount,
    creditsRequired,
  });
  
  return {
    feeAmount: newFee.feeAmount,
    creditsRequired: newFee.creditsRequired,
    unlockFeeId: newFee.id,
  };
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
  const feesWithRelations = await db
    .select({
      unlockFee: unlockFee,
      resource: resource,
      topic: topic,
      subject: subject,
    })
    .from(unlockFee)
    .leftJoin(resource, eq(unlockFee.resourceId, resource.id))
    .leftJoin(topic, eq(unlockFee.topicId, topic.id))
    .leftJoin(subject, eq(unlockFee.subjectId, subject.id))
    .orderBy(desc(unlockFee.createdAt));

  // Transform the flat result into the nested structure expected by consumers
  return feesWithRelations.map(({ unlockFee, resource, topic, subject }) => ({
    ...unlockFee,
    resource: resource || null,
    topic: topic || null,
    subject: subject || null,
  }));
}

// ============== CONTENT UNLOCKING ==============

export async function hasUserUnlockedContent(userId: string, unlockFeeId: string): Promise<boolean> {
  const unlocked = await db
    .select()
    .from(unlockedContent)
    .where(and(
      eq(unlockedContent.userId, userId),
      eq(unlockedContent.unlockFeeId, unlockFeeId)
    ))
    .limit(1)
    .then(res => res[0] || null);

  return !!unlocked;
}

/**
 * Unlock content using credits
 * This function handles credit-based unlocking when user chooses to pay with credits
 * @param userId - The user's database ID
 * @param unlockFeeId - The unlock fee record ID
 * @param kesPrice - The price of content in KES (to calculate credits required)
 * @returns Object with success status and unlock details
 */
export async function unlockContentWithCredits(
  userId: string,
  unlockFeeId: string,
  kesPrice: number
) {
  const { calculateCreditsRequired } = await import("@/lib/calculator");
  const creditsRequired = calculateCreditsRequired(kesPrice);
  
  // ATOMIC TRANSACTION: Wrap credit check, deduction, and unlock in a transaction
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const txDb = drizzle(client);
    
    // Check if user has enough active credits within transaction
    const now = new Date();
    const activeTransactions = await txDb
      .select()
      .from(creditTransaction)
      .where(
        and(
          eq(creditTransaction.userId, userId),
          or(
            isNull(creditTransaction.expiresAt),
            gt(creditTransaction.expiresAt, now)
          )
        )
      );
    
    const activeCredits = activeTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    const usedCredits = activeTransactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const currentBalance = Math.max(0, activeCredits - usedCredits);
    
    if (currentBalance < creditsRequired) {
      await client.query('ROLLBACK');
      throw new Error(`Insufficient credits. You need ${creditsRequired} credits but only have ${currentBalance} active credits.`);
    }
    
    // Check if already unlocked within transaction (prevents race condition)
    const existingUnlock = await txDb
      .select()
      .from(unlockedContent)
      .where(and(
        eq(unlockedContent.userId, userId),
        eq(unlockedContent.unlockFeeId, unlockFeeId)
      ))
      .limit(1);
    
    if (existingUnlock.length > 0) {
      await client.query('ROLLBACK');
      throw new Error("You have already unlocked this content");
    }
    
    // Get unlock fee details within transaction
    const feeRecord = await txDb
      .select()
      .from(unlockFee)
      .where(eq(unlockFee.id, unlockFeeId))
      .limit(1)
      .then(res => res[0] || null);

    if (!feeRecord) {
      await client.query('ROLLBACK');
      throw new Error("Unlock fee record not found");
    }
    
    // Get current credit record
    const creditRecord = await txDb
      .select()
      .from(userCredit)
      .where(eq(userCredit.userId, userId))
      .limit(1)
      .then(res => res[0] || null);
    
    if (!creditRecord) {
      await client.query('ROLLBACK');
      throw new Error("User credit record not found");
    }
    
    // Calculate new balance
    const newBalance = creditRecord.balance - creditsRequired;
    
    // Deduct credits for unlock
    const [transaction] = await txDb
      .insert(creditTransaction)
      .values({
        userId,
        type: "unlock",
        amount: -creditsRequired,
        balanceAfter: newBalance,
        description: `Unlocked ${feeRecord.type} with credits`,
        metadata: {
          unlockFeeId,
          creditsUsed: creditsRequired,
          kesEquivalent: kesPrice,
          contentType: feeRecord.type,
          paymentMethod: "credits",
        },
      })
      .returning();
    
    // Update user credit balance
    await txDb
      .update(userCredit)
      .set({
        balance: newBalance,
        totalUsed: creditRecord.totalUsed + creditsRequired,
        updatedAt: new Date(),
      })
      .where(eq(userCredit.userId, userId));
    
    // Create unlocked content record
    const [unlocked] = await txDb
      .insert(unlockedContent)
      .values({
        userId,
        unlockFeeId,
        paymentReference: null,
        amountPaidKes: 0,
      })
      .returning();
    
    await client.query('COMMIT');
    
    revalidatePath("/regular");
    revalidatePath("/api/content");

    return {
      success: true,
      unlockId: unlocked.id,
      creditsUsed: creditsRequired,
      contentType: feeRecord.type,
      contentName: feeRecord.type,
      transactionId: transaction.id,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getUserUnlockedContent(userId: string) {
  const unlockedWithRelations = await db
    .select({
      unlockedContent: unlockedContent,
      unlockFee: unlockFee,
      resource: resource,
      topic: topic,
      subject: subject,
    })
    .from(unlockedContent)
    .innerJoin(unlockFee, eq(unlockedContent.unlockFeeId, unlockFee.id))
    .leftJoin(resource, eq(unlockFee.resourceId, resource.id))
    .leftJoin(topic, eq(unlockFee.topicId, topic.id))
    .leftJoin(subject, eq(unlockFee.subjectId, subject.id))
    .where(eq(unlockedContent.userId, userId))
    .orderBy(desc(unlockedContent.unlockedAt));

  // Transform the flat result into the nested structure expected by consumers
  return unlockedWithRelations.map(({ unlockedContent, unlockFee, resource, topic, subject }) => ({
    ...unlockedContent,
    unlockFee: {
      ...unlockFee,
      resource: resource || null,
      topic: topic || null,
      subject: subject || null,
    },
  }));
}

// ============== ADMIN: GIFT CREDITS ==============

export async function giftCredits(
  adminUserId: string,
  targetUserEmail: string,
  amount: number,
  reason: string,
  expirationDays?: number | null
) {
  // Find target user by email
  const targetUser = await db
    .select()
    .from(user)
    .where(eq(user.email, targetUserEmail))
    .limit(1)
    .then(res => res[0] || null);

  if (!targetUser) {
    throw new Error(`User with email ${targetUserEmail} not found`);
  }

  // Get admin user data
  const adminUserData = await db
    .select()
    .from(user)
    .where(eq(user.id, adminUserId))
    .limit(1)
    .then(res => res[0] || null);

  if (!adminUserData) {
    throw new Error("Admin user not found");
  }

  // Prevent non-super-admin users from gifting to themselves
  if (targetUser.id === adminUserId && adminUserData.role !== "super_admin") {
    throw new Error("Admins cannot gift credits to their own account");
  }

  if (amount <= 0) {
    throw new Error("Gift amount must be positive");
  }

  const isSuperAdmin = adminUserData.role === "super_admin";
  const minimumBalance = DEFAULT_CREDIT_CONFIG.minimumAdminCreditBalance;

  // Check admin's credit balance (applies to all admin types including super-admins)
  // Check active credits (not total balance)
  const adminCredit = await getOrCreateUserCredit(adminUserId);
  const activeBalance = await getActiveCreditBalance(adminUserId);
  const requiredBalance = amount + minimumBalance;

  if (activeBalance < amount) {
    // Not enough active credits - block the action with detailed warning
    const expiredAmount = adminCredit.balance - activeBalance;
    throw new Error(
      `Insufficient active credits. You have ${activeBalance} active credits available, ` +
      `but ${expiredAmount > 0 ? `${expiredAmount} credits have expired` : 'all credits are expired'}. ` +
      `You need ${amount} credits to gift and must maintain a minimum balance of ${minimumBalance} credits. ` +
      `Please purchase more credits to continue.`
    );
  }

  if (activeBalance < requiredBalance) {
    // Enough active credits but would violate minimum balance requirement
    throw new Error(
      `Insufficient credits. You have ${activeBalance} active credits, but need ${amount} credits to gift ` +
      `and must maintain a minimum balance of ${minimumBalance} active credits. ` +
      `Required: ${requiredBalance} active credits.`
    );
  }

  // Deduct credits from admin (transfer transaction)
  await createCreditTransaction({
    userId: adminUserId,
    type: "transfer",
    amount: -amount,
    description: `Transferred ${amount} credits to ${targetUserEmail}`,
    metadata: {
      targetUserId: targetUser.id,
      targetUserEmail,
      reason,
      transferType: "gift_outgoing",
    },
  });

  // For super-admins: if expirationDays is null/undefined, credits never expire
  // For regular admins: always use default expiration (30 days) - they can't set custom expiration
  const giftExpirationDays = isSuperAdmin ? expirationDays : undefined;

  // Add credits to target user (gift transaction)
  const transaction = await addCredits(
    targetUser.id,
    amount,
    "gift",
    `Received ${amount} credits from ${isSuperAdmin ? "Super Admin" : "Admin"}`,
    {
      adminUserId,
      adminEmail: adminUserData.email,
      reason,
      transferType: "gift_incoming",
      isFromSuperAdmin: isSuperAdmin,
      expiresInDays: giftExpirationDays,
    },
    giftExpirationDays
  );

  // Get admin name for email
  const senderName = adminUserData.institutionName || adminUserData.email || "Admin";

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

  revalidatePath("/admin/rewards");

  return {
    success: true,
    transaction,
    userId: targetUser.id,
    email: targetUser.email,
    deductedFromAdmin: true,
    adminBalanceAfter: await getUserCreditBalance(adminUserId),
    expiresAt: transaction.expiresAt,
  };
}

// ============== AI RESPONSE CREDIT CHECK ==============

export async function checkAndDeductCreditsForAIResponse(
  userId: string,
  chatId?: string
): Promise<{ success: boolean; error?: string; remainingCredits?: number }> {
  try {
    const creditsPerResponse = DEFAULT_CREDIT_CONFIG.creditsPerAIResponse;
    
    // Check if user has enough active credits
    const hasEnough = await hasEnoughCredits(userId, creditsPerResponse);
    
    if (!hasEnough) {
      const creditDetails = await getUserCreditDetails(userId);
      let errorMessage = `Insufficient credits. You need ${creditsPerResponse} credits for an AI response. Your active balance is ${creditDetails.activeBalance} credits.`;
      
      if (creditDetails.expiredCredits > 0) {
        errorMessage += ` ${creditDetails.expiredCredits} credits have expired.`;
      }
      
      return {
        success: false,
        error: errorMessage,
        remainingCredits: creditDetails.activeBalance,
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

    const remainingCredits = await getActiveCreditBalance(userId);

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
    const resourceData = await db
      .select()
      .from(resource)
      .where(eq(resource.id, resourceId))
      .limit(1)
      .then(res => res[0] || null);
    contentName = resourceData?.title || "Resource";
    contentId = resourceId;
    contentType = "resource";
    
    // Find or create unlock fee
    const foundFee = await db
      .select()
      .from(unlockFee)
      .where(and(
        eq(unlockFee.resourceId, resourceId),
        eq(unlockFee.isActive, true)
      ))
      .limit(1)
      .then(res => res[0] || null);
    feeRecord = foundFee || null;
  } else if (topicId) {
    const topicData = await db
      .select()
      .from(topic)
      .where(eq(topic.id, topicId))
      .limit(1)
      .then(res => res[0] || null);
    contentName = topicData?.title || "Topic";
    contentId = topicId;
    contentType = "topic";
    
    const foundFee = await db
      .select()
      .from(unlockFee)
      .where(and(
        eq(unlockFee.topicId, topicId),
        eq(unlockFee.isActive, true)
      ))
      .limit(1)
      .then(res => res[0] || null);
    feeRecord = foundFee || null;
  } else if (subjectId) {
    const subjectData = await db
      .select()
      .from(subject)
      .where(eq(subject.id, subjectId))
      .limit(1)
      .then(res => res[0] || null);
    contentName = subjectData?.name || "Subject";
    contentId = subjectId;
    contentType = "subject";
    
    const foundFee = await db
      .select()
      .from(unlockFee)
      .where(and(
        eq(unlockFee.subjectId, subjectId),
        eq(unlockFee.isActive, true)
      ))
      .limit(1)
      .then(res => res[0] || null);
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
  const recipient = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
    .then(res => res[0] || null);
  
  const unlockedByUser = await db
    .select()
    .from(user)
    .where(eq(user.id, unlockedBy))
    .limit(1)
    .then(res => res[0] || null);
  
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

// ============== SYNC UNLOCK FEES WITH RESOURCE PRICES ==============

/**
 * Sync all unlock fee records with their corresponding resource prices
 * This ensures unlock fees match the resource.unlockFee field
 * Useful for fixing pricing discrepancies after the credit unlock feature was added
 */
export async function syncUnlockFeesWithResourcePrices() {
  const { calculateCreditsRequired } = await import("@/lib/calculator");
  
  // Get all unlock fees that are linked to resources
  const resourceFees = await db
    .select({
      unlockFee: unlockFee,
      resource: resource,
    })
    .from(unlockFee)
    .leftJoin(resource, eq(unlockFee.resourceId, resource.id))
    .where(eq(unlockFee.type, "resource"));

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  for (const { unlockFee: fee, resource: res } of resourceFees) {
    if (!res) {
      skippedCount++;
      continue;
    }

    // If resource has a specific unlockFee set (> 0), use that
    // Otherwise keep the current fee (don't change it)
    if (res.unlockFee > 0 && fee.feeAmount !== res.unlockFee) {
      try {
        await updateUnlockFee(fee.id, {
          feeAmount: res.unlockFee,
          creditsRequired: calculateCreditsRequired(res.unlockFee),
        });
        updatedCount++;
      } catch (error) {
        errorCount++;
        errors.push(`Failed to update fee ${fee.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      skippedCount++;
    }
  }

  return {
    success: true,
    updated: updatedCount,
    skipped: skippedCount,
    errors: errorCount,
    errorDetails: errors,
    total: resourceFees.length,
  };
}

/**
 * Sync unlock fee for a specific resource
 * Updates the unlock fee record to match the resource's unlockFee field
 */
export async function syncUnlockFeeForResource(resourceId: string) {
  const { calculateCreditsRequired } = await import("@/lib/calculator");
  
  // Get the resource
  const resourceData = await db
    .select()
    .from(resource)
    .where(eq(resource.id, resourceId))
    .limit(1)
    .then(res => res[0] || null);

  if (!resourceData) {
    throw new Error(`Resource ${resourceId} not found`);
  }

  // Get the unlock fee record
  const unlockFeeRecord = await getUnlockFeeByResource(resourceId);

  if (!unlockFeeRecord) {
    // No unlock fee exists yet - create one
    if (resourceData.unlockFee > 0) {
      const newFee = await createUnlockFee({
        type: "resource",
        resourceId,
        feeAmount: resourceData.unlockFee,
        creditsRequired: calculateCreditsRequired(resourceData.unlockFee),
      });
      return {
        success: true,
        action: "created",
        feeAmount: newFee.feeAmount,
        creditsRequired: newFee.creditsRequired,
      };
    } else {
      return {
        success: false,
        action: "none",
        message: "Resource has no unlock fee set and no record exists",
      };
    }
  }

  // Update existing unlock fee if resource price has changed
  if (resourceData.unlockFee > 0 && unlockFeeRecord.feeAmount !== resourceData.unlockFee) {
    await updateUnlockFee(unlockFeeRecord.id, {
      feeAmount: resourceData.unlockFee,
      creditsRequired: calculateCreditsRequired(resourceData.unlockFee),
    });
    
    return {
      success: true,
      action: "updated",
      previousFeeAmount: unlockFeeRecord.feeAmount,
      newFeeAmount: resourceData.unlockFee,
      newCreditsRequired: calculateCreditsRequired(resourceData.unlockFee),
    };
  }

  return {
    success: true,
    action: "no_change",
    feeAmount: unlockFeeRecord.feeAmount,
    creditsRequired: unlockFeeRecord.creditsRequired,
  };
}
