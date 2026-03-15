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
import { createModuleLogger } from '@/lib/telemetry';
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

      const entry = removeUndefinedValues({
        entityType: params.entityType,
        entityId: params.entityId,
        entityName: params.entityName ?? null,
        action: params.action,
        changes: params.changes,
        performedBy: params.performedBy,
        performedByName: params.performedByName ?? null,
        companyId: params.companyId,
        timestamp: FieldValue.serverTimestamp(),
      });

      const docRef = await db
        .collection(COLLECTIONS.ENTITY_AUDIT_TRAIL)
        .add(entry);

      return docRef.id;
    } catch (err) {
      logger.error('Failed to record audit entry', {
        entityType: params.entityType,
        entityId: params.entityId,
        error: err instanceof Error ? err.message : String(err),
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
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return JSON.stringify(value);
}
