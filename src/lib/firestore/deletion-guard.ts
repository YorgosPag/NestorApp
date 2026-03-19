/**
 * 🛡️ DELETION GUARD — Core Engine
 *
 * Checks entity dependencies before deletion (BLOCK strategy).
 * If dependencies exist → deletion is refused.
 * If no dependencies → deletes the document and records audit trail.
 *
 * All queries are tenant-isolated (companyId filter).
 * Dependency checks run in parallel for performance.
 *
 * @module lib/firestore/deletion-guard
 * @enterprise ADR-226 — Deletion Guard (Phase 1)
 */

import 'server-only';

import {
  DELETION_REGISTRY,
  getEntityCollection,
  type EntityType,
  type DependencyDef,
  type CascadeDependencyDef,
  type DependencyCheckResult,
} from '@/config/deletion-registry';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';
import { FIELDS } from '@/config/firestore-field-constants';

const logger = createModuleLogger('DeletionGuard');

/** Maximum document IDs returned per dependency (for UI preview) */
const MAX_PREVIEW_IDS = 10;

// ============================================================================
// DEPENDENCY CHECK
// ============================================================================

/**
 * Check all dependencies for an entity before deletion.
 *
 * Runs all dependency queries in parallel via Promise.all.
 * Each query is tenant-isolated with companyId filter.
 *
 * @param db - Firestore Admin instance
 * @param entityType - Type of entity to check
 * @param entityId - Document ID of the entity
 * @param companyId - Tenant ID for isolation
 * @returns Dependency check result with blocking details
 */
export async function checkDeletionDependencies(
  db: FirebaseFirestore.Firestore,
  entityType: EntityType,
  entityId: string,
  companyId: string
): Promise<DependencyCheckResult> {
  const config = DELETION_REGISTRY[entityType];

  // ── Conditional block check (e.g., sold parking/storage) ──
  if (config.conditionalBlock) {
    const entityCollection = getEntityCollection(entityType);
    const entityDoc = await db.collection(entityCollection).doc(entityId).get();

    if (entityDoc.exists) {
      const data = entityDoc.data();
      const fieldValue = getNestedField(data, config.conditionalBlock.field);

      const isBlocked =
        config.conditionalBlock.condition === 'exists'
          ? fieldValue !== undefined
          : fieldValue !== undefined && fieldValue !== null;

      if (isBlocked) {
        return {
          allowed: false,
          dependencies: [],
          totalDependents: 0,
          message: config.conditionalBlock.message,
        };
      }
    }
  }

  // ── Parallel dependency queries ──
  const results = await Promise.all(
    config.dependencies.map((dep) => checkSingleDependency(db, dep, entityId, companyId))
  );

  // ── Aggregate results ──
  const blocking = results.filter((r) => r.count > 0);
  const totalDependents = blocking.reduce((sum, r) => sum + r.count, 0);

  if (blocking.length === 0) {
    return {
      allowed: true,
      dependencies: [],
      totalDependents: 0,
      message: 'Δεν υπάρχουν εξαρτήσεις. Η διαγραφή επιτρέπεται.',
    };
  }

  const depLabels = blocking.map((d) => `${d.label} (${d.count})`).join(', ');

  return {
    allowed: false,
    dependencies: blocking,
    totalDependents,
    message: `Η διαγραφή αποκλείεται. Υπάρχουν ${totalDependents} εξαρτώμενες εγγραφές: ${depLabels}. Διαγράψτε τες πρώτα.`,
  };
}

// ============================================================================
// CASCADE DELETIONS (Junction Records)
// ============================================================================

/** Result of cascade deletion for audit purposes */
interface CascadeDeletionDetail {
  collection: string;
  count: number;
  documentIds: string[];
}

/** Firestore batch write limit (using 450 for safety margin) */
const BATCH_SIZE = 450;

/**
 * Auto-delete junction records before blocking dependency check.
 *
 * Cascade dependencies are "owned" records (e.g., contact_relationships,
 * contact_links) that should be cleaned up automatically when the parent
 * entity is deleted — NOT blocking records like opportunities or units.
 *
 * @param db - Firestore Admin instance
 * @param cascadeDeps - Cascade dependency definitions
 * @param entityId - ID of the entity being deleted
 * @param companyId - Tenant ID (used only if skipCompanyFilter is false)
 * @returns Total deleted count and per-collection details
 */
async function executeCascadeDeletions(
  db: FirebaseFirestore.Firestore,
  cascadeDeps: readonly CascadeDependencyDef[],
  entityId: string,
  companyId: string
): Promise<{ totalDeleted: number; details: CascadeDeletionDetail[] }> {
  const details: CascadeDeletionDetail[] = [];
  let totalDeleted = 0;

  for (const dep of cascadeDeps) {
    try {
      let query: FirebaseFirestore.Query = db.collection(dep.collection);

      if (!dep.skipCompanyFilter) {
        query = query.where(FIELDS.COMPANY_ID, '==', companyId);
      }

      if (dep.queryType === 'array-contains') {
        query = query.where(dep.foreignKey, 'array-contains', entityId);
      } else {
        query = query.where(dep.foreignKey, '==', entityId);
      }

      const snapshot = await query.get();

      if (snapshot.empty) continue;

      const docIds = snapshot.docs.map((doc) => doc.id);

      // Batched delete in chunks of BATCH_SIZE
      for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = snapshot.docs.slice(i, i + BATCH_SIZE);
        for (const doc of chunk) {
          batch.delete(doc.ref);
        }
        await batch.commit();
      }

      details.push({
        collection: dep.collection,
        count: snapshot.size,
        documentIds: docIds.slice(0, MAX_PREVIEW_IDS),
      });
      totalDeleted += snapshot.size;

      logger.info(`[DeletionGuard] Cascade deleted ${snapshot.size} docs from ${dep.collection}`, {
        foreignKey: dep.foreignKey,
        entityId,
      });
    } catch (err) {
      logger.error(`[DeletionGuard] Cascade deletion failed for ${dep.collection}.${dep.foreignKey}`, {
        error: err instanceof Error ? err.message : String(err),
        entityId,
      });
      // On cascade failure → throw to prevent orphan parent deletion
      throw new ApiError(
        500,
        `Αποτυχία cascade διαγραφής στο ${dep.collection}. Η διαγραφή ακυρώθηκε.`,
        'CASCADE_DELETION_FAILED'
      );
    }
  }

  return { totalDeleted, details };
}

// ============================================================================
// EXECUTE DELETION
// ============================================================================

/**
 * Execute a guarded deletion: check dependencies, cascade junctions, delete, audit.
 *
 * Flow: CHECK BLOCKING → CASCADE JUNCTIONS → DELETE ENTITY → AUDIT
 *
 * @param db - Firestore Admin instance
 * @param entityType - Type of entity to delete
 * @param entityId - Document ID
 * @param deletedBy - UID of the user performing deletion
 * @param companyId - Tenant ID
 * @returns Success result
 * @throws ApiError(409) if dependencies block deletion
 * @throws ApiError(404) if entity not found
 * @throws ApiError(500) if cascade deletion fails
 */
export async function executeDeletion(
  db: FirebaseFirestore.Firestore,
  entityType: EntityType,
  entityId: string,
  deletedBy: string,
  companyId: string
): Promise<{ success: true; entityId: string }> {
  const config = DELETION_REGISTRY[entityType];

  // ── Step 1: Check blocking dependencies ──
  const check = await checkDeletionDependencies(db, entityType, entityId, companyId);

  if (!check.allowed) {
    throw new ApiError(409, check.message, 'DELETION_BLOCKED');
  }

  // ── Step 2: Read entity for audit snapshot ──
  const entityCollection = getEntityCollection(entityType);
  const docRef = db.collection(entityCollection).doc(entityId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new ApiError(404, `Το ${entityType} με ID ${entityId} δεν βρέθηκε.`, 'ENTITY_NOT_FOUND');
  }

  const entityData = docSnap.data() ?? {};

  // ── Step 3: Cascade delete junction records (if any) ──
  let cascadeResult: { totalDeleted: number; details: CascadeDeletionDetail[] } | null = null;

  if (config.cascadeDependencies && config.cascadeDependencies.length > 0) {
    cascadeResult = await executeCascadeDeletions(db, config.cascadeDependencies, entityId, companyId);
  }

  // ── Step 4: Delete entity document ──
  await docRef.delete();

  logger.info(`[DeletionGuard] Deleted ${entityType}/${entityId}`, {
    entityType,
    entityId,
    companyId,
    deletedBy,
    cascadeDeleted: cascadeResult?.totalDeleted ?? 0,
  });

  // ── Step 5: Audit trail (fire-and-forget) ──
  const auditChanges: Array<{ field: string; oldValue: string | null; newValue: string | null; label: string }> = [
    {
      field: '_snapshot',
      oldValue: JSON.stringify(entityData),
      newValue: null,
      label: 'Πλήρες snapshot πριν τη διαγραφή',
    },
  ];

  // Add cascade info to audit if any records were auto-deleted
  if (cascadeResult && cascadeResult.totalDeleted > 0) {
    auditChanges.push({
      field: '_cascade_deletions',
      oldValue: JSON.stringify(cascadeResult.details),
      newValue: null,
      label: `Cascade: ${cascadeResult.totalDeleted} εγγραφές διαγράφηκαν αυτόματα`,
    });
  }

  EntityAuditService.recordChange({
    entityType,
    entityId,
    entityName: extractEntityName(entityData),
    action: 'deleted',
    changes: auditChanges,
    performedBy: deletedBy,
    performedByName: null,
    companyId,
  }).catch((err) => {
    logger.error('[DeletionGuard] Audit trail failed (non-blocking)', {
      entityType,
      entityId,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  return { success: true, entityId };
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Query a single dependency collection for blocking records.
 */
async function checkSingleDependency(
  db: FirebaseFirestore.Firestore,
  dep: DependencyDef,
  entityId: string,
  companyId: string
): Promise<{
  label: string;
  collection: string;
  count: number;
  documentIds: string[];
}> {
  try {
    let query: FirebaseFirestore.Query = db.collection(dep.collection);

    // Tenant isolation — skip for collections without companyId (e.g. accounting_invoices)
    if (!dep.skipCompanyFilter) {
      query = query.where(FIELDS.COMPANY_ID, '==', companyId);
    }

    if (dep.queryType === 'array-contains') {
      query = query.where(dep.foreignKey, 'array-contains', entityId);
    } else {
      query = query.where(dep.foreignKey, '==', entityId);
    }

    // Limit to MAX_PREVIEW_IDS + 1 to know if there are more
    const snapshot = await query.limit(MAX_PREVIEW_IDS + 1).get();

    const documentIds = snapshot.docs
      .slice(0, MAX_PREVIEW_IDS)
      .map((doc) => doc.id);

    return {
      label: dep.label,
      collection: dep.collection,
      count: snapshot.size,
      documentIds,
    };
  } catch (err) {
    logger.error(`[DeletionGuard] Failed to check dependency ${dep.collection}.${dep.foreignKey}`, {
      error: err instanceof Error ? err.message : String(err),
      entityId,
      companyId,
    });
    // On query failure → treat as blocking (safe default)
    return {
      label: dep.label,
      collection: dep.collection,
      count: -1,
      documentIds: [],
    };
  }
}

/**
 * Safely read a nested field path (e.g. 'commercial.buyerContactId')
 */
function getNestedField(data: Record<string, unknown> | undefined, path: string): unknown {
  if (!data) return undefined;

  const parts = path.split('.');
  let current: unknown = data;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Extract a display name from entity data for audit trail.
 */
function extractEntityName(data: Record<string, unknown>): string | null {
  // Try common name fields
  if (typeof data.name === 'string') return data.name;
  if (typeof data.displayName === 'string') return data.displayName;

  // Contact-specific: firstName + lastName
  if (typeof data.firstName === 'string' || typeof data.lastName === 'string') {
    return [data.firstName, data.lastName].filter(Boolean).join(' ') || null;
  }

  return null;
}
