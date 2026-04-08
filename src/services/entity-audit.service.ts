/**
 * 📜 Entity Audit Trail Service (Server-Only)
 *
 * Records entity-level changes for compliance and traceability.
 * Uses Firebase Admin SDK — cannot be imported from client code.
 *
 * Pattern: Static class (same as FileAuditService)
 * Writes are fire-and-forget — audit failures never break entity operations.
 *
 * @module services/entity-audit.service
 * @enterprise ADR-195 — Entity Audit Trail
 */

import 'server-only';

import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateEntityAuditId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type {
  AuditEntityType,
  AuditAction,
  AuditFieldChange,
} from '@/types/audit-trail';
import { flattenForTracking } from '@/config/audit-tracked-fields';

const logger = createModuleLogger('EntityAuditService');

// ============================================================================
// TYPES
// ============================================================================

interface RecordChangeParams {
  entityType: AuditEntityType;
  entityId: string;
  entityName: string | null;
  action: AuditAction;
  changes: AuditFieldChange[];
  performedBy: string;
  performedByName: string | null;
  companyId: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Remove undefined values from object before Firestore write.
 * Firestore rejects `undefined` but accepts `null`.
 */
function removeUndefinedValues(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Resolve a user UID to "DisplayName (email)" for audit trail display.
 *
 * Strategy:
 * - If currentName is a non-email string (e.g. "Σύστημα", "[GDPR ANONYMIZED]") → keep as-is
 * - If currentName is null or an email → lookup /users/{uid} for displayName + email
 * - Returns "DisplayName (email)" or falls back to currentName
 *
 * Non-blocking: errors return currentName unchanged.
 */
async function resolvePerformerDisplayName(
  uid: string,
  currentName: string | null,
): Promise<string | null> {
  // Keep special names as-is (not an email, not null)
  if (currentName && !currentName.includes('@')) return currentName;

  try {
    const db = getAdminFirestore();
    if (!db) return currentName;

    const userDoc = await db.collection(COLLECTIONS.USERS).doc(uid).get();
    if (!userDoc.exists) return currentName;

    const data = userDoc.data();
    const displayName = (data?.displayName as string | undefined)?.trim() || null;
    const email = (data?.email as string | undefined)?.trim() || null;

    if (displayName && email) return `${displayName} (${email})`;
    if (displayName) return displayName;
    if (email) return email;
    return currentName;
  } catch (err) {
    logger.warn('Failed to resolve performer display name', {
      uid,
      error: getErrorMessage(err),
    });
    return currentName;
  }
}

// ============================================================================
// SERVICE
// ============================================================================

export class EntityAuditService {
  /**
   * Record an entity change in the audit trail.
   *
   * Fire-and-forget: never throws, logs errors internally.
   * Uses FieldValue.serverTimestamp() for consistent timestamps.
   */
  static async recordChange(params: RecordChangeParams): Promise<string | null> {
    try {
      const db = getAdminFirestore();
      if (!db) {
        logger.warn('Firestore not available, skipping audit entry');
        return null;
      }

      // Auto-resolve "DisplayName (email)" from /users/{uid}
      const resolvedName = await resolvePerformerDisplayName(
        params.performedBy,
        params.performedByName,
      );

      const entry = removeUndefinedValues({
        entityType: params.entityType,
        entityId: params.entityId,
        entityName: params.entityName ?? null,
        action: params.action,
        changes: params.changes,
        performedBy: params.performedBy,
        performedByName: resolvedName ?? null,
        companyId: params.companyId,
        timestamp: FieldValue.serverTimestamp(),
      });

      const auditId = generateEntityAuditId();
      await db
        .collection(COLLECTIONS.ENTITY_AUDIT_TRAIL)
        .doc(auditId)
        .set(entry);

      return auditId;
    } catch (err) {
      logger.error('Failed to record audit entry', {
        entityType: params.entityType,
        entityId: params.entityId,
        error: getErrorMessage(err),
      });
      return null;
    }
  }

  /**
   * Compute field-level diffs between old and new document states.
   * Supports dot-notation fields (e.g. 'commercial.askingPrice').
   *
   * @param oldDoc - Document state before update
   * @param newDoc - Fields being updated (partial)
   * @param trackedFields - Map of field name → human-readable label
   * @returns Array of field changes (only fields that actually changed)
   */
  static diffFields(
    oldDoc: Record<string, unknown>,
    newDoc: Record<string, unknown>,
    trackedFields: Record<string, string>,
  ): AuditFieldChange[] {
    // Flatten both docs for dot-notation support
    const flatOld = flattenForTracking(oldDoc, trackedFields);
    const flatNew = flattenForTracking(newDoc, trackedFields);

    const changes: AuditFieldChange[] = [];

    for (const [field, label] of Object.entries(trackedFields)) {
      // Only process fields present in the update payload
      if (!(field in flatNew)) continue;

      const oldValue = flatOld[field] ?? null;
      const newValue = flatNew[field] ?? null;

      // Normalize to comparable primitives
      const oldStr = serializeValue(oldValue);
      const newStr = serializeValue(newValue);

      if (oldStr !== newStr) {
        changes.push({
          field,
          oldValue: oldStr,
          newValue: newStr,
          label,
        });
      }
    }

    return changes;
  }

  /**
   * Compute field-level diffs with async ID→name resolution.
   * Use this when tracked fields contain IDs that need human-readable names
   * (e.g. buildingId → "ΚΤΙΡΙΟ Α").
   *
   * @param oldDoc - Document state before update
   * @param newDoc - Fields being updated (partial)
   * @param trackedFields - Map of field name → human-readable label
   * @param resolvers - Map of field name → async function that resolves an ID to a display name
   * @returns Array of field changes with resolved names
   */
  static async diffFieldsWithResolution(
    oldDoc: Record<string, unknown>,
    newDoc: Record<string, unknown>,
    trackedFields: Record<string, string>,
    resolvers: Record<string, (id: unknown) => Promise<string | null>>,
  ): Promise<AuditFieldChange[]> {
    const changes = this.diffFields(oldDoc, newDoc, trackedFields);

    // Resolve IDs to names for fields that have resolvers
    const resolved = await Promise.all(
      changes.map(async (change) => {
        const resolver = resolvers[change.field];
        if (!resolver) return change;

        const [oldName, newName] = await Promise.all([
          change.oldValue ? resolver(change.oldValue).catch(() => null) : Promise.resolve(null),
          change.newValue ? resolver(change.newValue).catch(() => null) : Promise.resolve(null),
        ]);

        return {
          ...change,
          oldValue: oldName ?? change.oldValue,
          newValue: newName ?? change.newValue,
        };
      }),
    );

    return resolved;
  }
}

/**
 * Serialize a value to a comparable primitive for diffing.
 */
function serializeValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return JSON.stringify(value);
}
