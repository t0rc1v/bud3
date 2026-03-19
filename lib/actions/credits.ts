"use server";

import { db, pool } from "@/lib/db";
import {
  userCredit,
  creditTransaction,
  creditPurchase,
  user,
  resourceView,
} from "@/lib/db/schema";
import { eq, and, desc, asc, sql, gt, or, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { revalidatePath } from "next/cache";
import { CREDIT_PRICING, DEFAULT_CREDIT_CONFIG } from "@/lib/mpesa";
import { sendCreditGiftEmail } from "@/lib/email";
import { createNotification } from "@/lib/actions/notifications";

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
  type: "purchase" | "usage" | "refund" | "gift" | "bonus" | "transfer";
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
  } else if (data.type === "usage" || data.type === "transfer") {
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
 * Get the active credit balance (excluding expired credits)
 */
export async function getActiveCreditBalance(userId: string): Promise<number> {
  // Single aggregate query instead of fetching all rows and reducing in JS
  const result = await db
    .select({ balance: sql<number>`COALESCE(SUM(${creditTransaction.amount}), 0)` })
    .from(creditTransaction)
    .where(
      and(
        eq(creditTransaction.userId, userId),
        or(
          isNull(creditTransaction.expiresAt),
          gt(creditTransaction.expiresAt, new Date())
        )
      )
    );
  return Math.max(0, Number(result[0]?.balance ?? 0));
}

/**
 * Get detailed credit info including expired and expiring soon counts
 */
export async function getUserCreditDetails(userId: string) {
  const now = new Date();
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + DEFAULT_CREDIT_CONFIG.EXPIRATION_WARNING_DAYS);

  // Single SQL query for expired/expiring-soon aggregates + parallelize balance/credit record
  const [aggregates, activeBalance, creditRecord] = await Promise.all([
    db
      .select({
        expiredCredits: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransaction.expiresAt} < ${now} AND ${creditTransaction.amount} > 0 THEN ${creditTransaction.amount} END), 0)`,
        expiringSoonCredits: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransaction.expiresAt} >= ${now} AND ${creditTransaction.expiresAt} <= ${warningDate} AND ${creditTransaction.amount} > 0 THEN ${creditTransaction.amount} END), 0)`,
        expiringSoonCount: sql<number>`COUNT(CASE WHEN ${creditTransaction.expiresAt} >= ${now} AND ${creditTransaction.expiresAt} <= ${warningDate} AND ${creditTransaction.amount} > 0 THEN 1 END)`,
      })
      .from(creditTransaction)
      .where(eq(creditTransaction.userId, userId)),
    getActiveCreditBalance(userId),
    getOrCreateUserCredit(userId),
  ]);

  return {
    activeBalance,
    totalBalance: creditRecord.balance,
    expiredCredits: Number(aggregates[0]?.expiredCredits ?? 0),
    expiringSoonCredits: Number(aggregates[0]?.expiringSoonCredits ?? 0),
    expiringSoonCount: Number(aggregates[0]?.expiringSoonCount ?? 0),
  };
}

// ============== CREDIT PURCHASES ==============

export async function createCreditPurchase(
  userId: string,
  phoneNumber: string,
  amountKes: number,
  purchaseType: "credits" = "credits"
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

  // For the "completed" path, atomically update the purchase status AND add credits
  // so a partial failure can't leave the purchase as completed without credits being added.
  if (status === "completed" && !wasAlreadyCompleted && currentPurchase.purchaseType === "credits") {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const txDb = drizzle(client);

      // 1. Update purchase status inside transaction
      await txDb
        .update(creditPurchase)
        .set(updateData)
        .where(eq(creditPurchase.id, purchaseId));

      // 2. Get or create user credit record inside transaction
      let creditRecord = await txDb
        .select()
        .from(userCredit)
        .where(eq(userCredit.userId, currentPurchase.userId))
        .limit(1)
        .then(r => r[0] || null);

      if (!creditRecord) {
        [creditRecord] = await txDb
          .insert(userCredit)
          .values({ userId: currentPurchase.userId, balance: 0, totalPurchased: 0, totalUsed: 0 })
          .returning();
      }

      const creditsToAdd = currentPurchase.creditsPurchased;
      const newBalance = creditRecord.balance + creditsToAdd;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + DEFAULT_CREDIT_CONFIG.CREDIT_EXPIRATION_DAYS);

      // 3. Insert credit transaction
      await txDb.insert(creditTransaction).values({
        userId: currentPurchase.userId,
        type: "purchase",
        amount: creditsToAdd,
        balanceAfter: newBalance,
        description: `Purchased ${creditsToAdd} credits via M-Pesa`,
        metadata: {
          purchaseId: currentPurchase.id,
          mpesaReceiptNumber: data?.mpesaReceiptNumber,
          amountKes: currentPurchase.amountKes,
        },
        expiresAt,
      });

      // 4. Update user credit balance
      await txDb
        .update(userCredit)
        .set({
          balance: newBalance,
          totalPurchased: creditRecord.totalPurchased + creditsToAdd,
          updatedAt: new Date(),
        })
        .where(eq(userCredit.userId, currentPurchase.userId));

      await client.query("COMMIT");
      console.log(`Credits added successfully for purchase ${purchaseId}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    // For non-completed or already-completed statuses just update the purchase record
    await db
      .update(creditPurchase)
      .set(updateData)
      .where(eq(creditPurchase.id, purchaseId));
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


export async function getUserCreditPurchases(userId: string, { limit = 20, offset = 0 }: { limit?: number; offset?: number } = {}) {
  return db
    .select()
    .from(creditPurchase)
    .where(eq(creditPurchase.userId, userId))
    .orderBy(desc(creditPurchase.createdAt))
    .limit(limit)
    .offset(offset);
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

  // For super-admins: if expirationDays is null/undefined, credits never expire
  // For regular admins: always use default expiration (30 days) - they can't set custom expiration
  const giftExpirationDays = isSuperAdmin ? expirationDays : undefined;

  // Calculate recipient expiration date
  let recipientExpiresAt: Date | null = null;
  if (giftExpirationDays !== null && giftExpirationDays !== undefined) {
    recipientExpiresAt = new Date();
    recipientExpiresAt.setDate(recipientExpiresAt.getDate() + giftExpirationDays);
  } else if (giftExpirationDays === undefined) {
    recipientExpiresAt = new Date();
    recipientExpiresAt.setDate(recipientExpiresAt.getDate() + DEFAULT_CREDIT_CONFIG.CREDIT_EXPIRATION_DAYS);
  }
  // giftExpirationDays === null → never expires (recipientExpiresAt stays null)

  // Atomically deduct from admin and add to recipient so a partial failure
  // can't leave the admin debited without the recipient being credited.
  let transaction: typeof creditTransaction.$inferSelect;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const txDb = drizzle(client);

    // Re-fetch admin credit record inside transaction to guard against race conditions
    const adminCreditTx = await txDb
      .select()
      .from(userCredit)
      .where(eq(userCredit.userId, adminUserId))
      .limit(1)
      .then(r => r[0] || null);

    if (!adminCreditTx || adminCreditTx.balance < requiredBalance) {
      await client.query("ROLLBACK");
      throw new Error(
        `Insufficient credits. Required: ${requiredBalance} active credits.`
      );
    }

    const adminNewBalance = adminCreditTx.balance - amount;

    // 1. Insert admin deduction
    await txDb.insert(creditTransaction).values({
      userId: adminUserId,
      type: "transfer",
      amount: -amount,
      balanceAfter: adminNewBalance,
      description: `Transferred ${amount} credits to ${targetUserEmail}`,
      metadata: { targetUserId: targetUser.id, targetUserEmail, reason, transferType: "gift_outgoing" },
    });

    // 2. Update admin credit balance
    await txDb
      .update(userCredit)
      .set({ balance: adminNewBalance, totalUsed: adminCreditTx.totalUsed + amount, updatedAt: new Date() })
      .where(eq(userCredit.userId, adminUserId));

    // 3. Get or create recipient credit record
    let recipientCredit = await txDb
      .select()
      .from(userCredit)
      .where(eq(userCredit.userId, targetUser.id))
      .limit(1)
      .then(r => r[0] || null);

    if (!recipientCredit) {
      [recipientCredit] = await txDb
        .insert(userCredit)
        .values({ userId: targetUser.id, balance: 0, totalPurchased: 0, totalUsed: 0 })
        .returning();
    }

    const recipientNewBalance = recipientCredit.balance + amount;

    // 4. Insert recipient gift transaction
    const [insertedTx] = await txDb
      .insert(creditTransaction)
      .values({
        userId: targetUser.id,
        type: "gift",
        amount,
        balanceAfter: recipientNewBalance,
        description: `Received ${amount} credits from ${isSuperAdmin ? "Super Admin" : "Admin"}`,
        metadata: {
          adminUserId,
          adminEmail: adminUserData.email,
          reason,
          transferType: "gift_incoming",
          isFromSuperAdmin: isSuperAdmin,
          expiresInDays: giftExpirationDays,
        },
        expiresAt: recipientExpiresAt,
      })
      .returning();
    transaction = insertedTx;

    // 5. Update recipient credit balance
    await txDb
      .update(userCredit)
      .set({
        balance: recipientNewBalance,
        totalPurchased: recipientCredit.totalPurchased + amount,
        updatedAt: new Date(),
      })
      .where(eq(userCredit.userId, targetUser.id));

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

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

  // Send in-app notification to recipient
  createNotification({
    userId: targetUser.id,
    type: "credit_gift",
    title: "Credits Received",
    body: `You received ${amount} credits from ${senderName}. Reason: ${reason}`,
    metadata: { amount, senderName, reason },
  }).catch(() => {});

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
  chatId?: string,
  modelId?: string
): Promise<{ success: boolean; error?: string; remainingCredits?: number }> {
  try {
    const { getChatCreditCost } = await import('@/lib/ai/credit-costs');
    const creditsPerResponse = getChatCreditCost(modelId);
    
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
  };
}

// ============== LEARNER PROGRESS (5.1) ==============

/**
 * Record that a user opened a resource.
 * Called client-side via a server action when the resource viewer mounts.
 * Duplicate views within the same session are fine — the log is append-only.
 */
export async function recordResourceView(
  userId: string,
  resourceId: string,
  durationSeconds?: number
): Promise<void> {
  try {
    await db.insert(resourceView).values({
      userId,
      resourceId,
      durationSeconds: durationSeconds ?? null,
    });
  } catch {
    // Non-critical — don't propagate errors to the caller
  }
}

