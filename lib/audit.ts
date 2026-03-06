"use server";

import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

/**
 * Write a structured audit log entry.
 * Call this inside server actions and API route handlers after successful mutations.
 *
 * @param actorId  - DB UUID of the user performing the action (null for system events)
 * @param action   - Dot-namespaced event name, e.g. "resource.created"
 * @param entityType - The kind of entity affected, e.g. "resource", "user", "level"
 * @param entityId   - The affected row's ID as a string (nullable)
 * @param metadata   - Any additional structured context (old values, diffs, etc.)
 */
export async function logAudit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorId: actorId ?? null,
      action,
      entityType,
      entityId: entityId ?? null,
      metadata: metadata ?? null,
    });
  } catch (err) {
    // Audit failures must never crash the main operation
    console.error(
      JSON.stringify({ source: "audit", action, entityType, entityId, error: String(err) })
    );
  }
}
