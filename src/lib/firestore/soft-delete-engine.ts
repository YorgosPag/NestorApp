/**
 * Soft-Delete Engine — SSOT for soft-delete, restore, permanent-delete
 *
 * ONE mechanism for ALL entities. No copy-paste.
 *
 * Lifecycle:
 *   softDelete()      -> status='deleted', preserves previousStatus
 *   restoreFromTrash() -> restores previousStatus, clears delete fields
 *   permanentDelete()  -> guards status='deleted', then executeDeletion() (ADR-226)
 *
 * @module lib/firestore/soft-delete-engine
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { SOFT_DELETE_CONFIG, TRASHED_STATUS } from "./soft-delete-config";
import type { SoftDeleteEntityConfig } from "./soft-delete-config";
import { executeDeletion } from "./deletion-guard";
import { FIELDS } from "@/config/firestore-field-constants";
import { EntityAuditService, resolveUserDisplayName } from "@/services/entity-audit.service";
import { isCdcAuditDuplicate } from "@/config/audit-cdc-coverage";
// Imported from its defining module rather than through `ApiErrorHandler`,
// which re-exports it but pulls in the whole `next/server` surface with it.
import { ApiError } from "@/lib/api/api-error-types";
import { createModuleLogger } from "@/lib/telemetry";
import { getErrorMessage } from "@/lib/error-utils";
import type { SoftDeletableEntityType } from "@/types/soft-deletable";

const logger = createModuleLogger("SoftDeleteEngine");

/**
 * Καταγραφή αλλαγής κύκλου ζωής στο audit trail (fire-and-forget).
 *
 * ADR-195 Phase 3 — αυτός ο engine εξυπηρετεί **όλες** τις soft-deletable
 * οντότητες, αλλά μόνο οι επαφές έχουν CDC Firestore trigger. Για εκείνες, μια
 * service-side εγγραφή `soft_deleted`/`restored` θα ήταν καθαρό διπλότυπο του
 * `cdc` record. Το μητρώο `audit-cdc-coverage` είναι η ΜΟΝΑΔΙΚΗ πηγή αυτής της
 * γνώσης — μην βάλεις `if (entityType === 'contact')` εδώ.
 *
 * Το `deleted` (οριστική διαγραφή) δεν σιγάζεται ΠΟΤΕ: εκεί η service εγγραφή
 * μεταφέρει forensic δεδομένα που ο CDC δεν μπορεί να παραγάγει.
 */
function recordLifecycleAudit(
  input: Parameters<typeof EntityAuditService.recordChange>[0],
): void {
  if (isCdcAuditDuplicate(input.entityType, input.action)) {
    logger.debug("Audit skipped — CDC trigger already records this event", {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
    });
    return;
  }

  EntityAuditService.recordChange(input).catch((err) => {
    logger.error("Audit trail failed (non-blocking)", {
      entityType: input.entityType,
      entityId: input.entityId,
      error: getErrorMessage(err),
    });
  });
}

// ============================================================================
// SOFT DELETE — Move to trash
// ============================================================================

/**
 * Soft-delete: moves entity to trash (status='deleted').
 * Does NOT delete data — only changes status.
 *
 * @throws ApiError(404) if document not found
 * @throws ApiError(403) if tenant mismatch
 * @throws ApiError(409) if already in trash
 */
export async function softDelete(
  db: FirebaseFirestore.Firestore,
  entityType: SoftDeletableEntityType,
  entityId: string,
  deletedBy: string,
  companyId: string,
  performedByName?: string,
  isSuperAdmin: boolean = false,
): Promise<{ success: true; entityId: string }> {
  // Tenant isolation — bypassed for super admin (route-level guard already validated access)
  const { config, docRef, data } = await loadLifecycleTarget(
    db,
    entityType,
    entityId,
    companyId,
    isSuperAdmin,
  );

  // Idempotency: entity already in trash → desired state achieved, return success
  if (data?.status === TRASHED_STATUS) {
    logger.info(`Soft-delete idempotent — ${entityType} already in trash`, { entityId });
    return { success: true, entityId };
  }

  const previousStatus =
    (data?.status as string) ?? config.defaultRestoreStatus;

  logger.info(`Soft-deleting ${entityType}`, {
    entityId,
    companyId,
    previousStatus,
  });

  const resolvedName = await resolveUserDisplayName(deletedBy, performedByName ?? null);

  await docRef.update({
    status: TRASHED_STATUS,
    previousStatus,
    deletedAt: FieldValue.serverTimestamp(),
    deletedBy,
    updatedAt: FieldValue.serverTimestamp(),
    // ADR-195 Phase 1 CDC: refresh performer stamps so the Cloud Function
    // audit trigger attributes this write to the actual actor (not the
    // stale create-time stamp). Critical when an admin trashes another
    // user's entity — without this the CDC entry would name the creator.
    _lastModifiedBy: deletedBy,
    _lastModifiedByName: resolvedName,
    _lastModifiedAt: FieldValue.serverTimestamp(),
  });

  // Audit trail (fire-and-forget· σιγάζεται όταν το καλύπτει ήδη ο CDC)
  recordLifecycleAudit({
    entityType,
    entityId,
    entityName: extractEntityName(data),
    action: "soft_deleted",
    changes: [
      {
        field: "status",
        oldValue: previousStatus,
        newValue: TRASHED_STATUS,
        label: "status",
      },
    ],
    performedBy: deletedBy,
    performedByName: performedByName ?? null,
    companyId: (data?.companyId as string | undefined) ?? companyId,
  });

  logger.info(`${entityType} soft-deleted`, { entityId });
  return { success: true, entityId };
}

// ============================================================================
// RESTORE — Bring back from trash
// ============================================================================

/**
 * Restore: brings entity back from trash to previous status.
 *
 * @throws ApiError(404) if not found
 * @throws ApiError(403) tenant isolation
 * @throws ApiError(409) if NOT in trash
 */
export async function restoreFromTrash(
  db: FirebaseFirestore.Firestore,
  entityType: SoftDeletableEntityType,
  entityId: string,
  restoredBy: string,
  companyId: string,
  performedByName?: string,
): Promise<{ success: true; entityId: string; restoredStatus: string }> {
  const { config, docRef, data } = await loadLifecycleTarget(
    db,
    entityType,
    entityId,
    companyId,
  );

  if (data?.status !== TRASHED_STATUS) {
    throw new ApiError(409, `${config.labelEn} is not in trash`);
  }

  const restoredStatus =
    (data.previousStatus as string) || config.defaultRestoreStatus;

  logger.info(`Restoring ${entityType} from trash`, {
    entityId,
    restoredStatus,
  });

  const resolvedName = await resolveUserDisplayName(restoredBy, performedByName ?? null);

  await docRef.update({
    status: restoredStatus,
    previousStatus: FieldValue.delete(),
    deletedAt: FieldValue.delete(),
    deletedBy: FieldValue.delete(),
    restoredAt: FieldValue.serverTimestamp(),
    restoredBy,
    updatedAt: FieldValue.serverTimestamp(),
    // ADR-195 Phase 1 CDC: refresh performer stamps (see softDelete above).
    _lastModifiedBy: restoredBy,
    _lastModifiedByName: resolvedName,
    _lastModifiedAt: FieldValue.serverTimestamp(),
  });

  // Audit trail (fire-and-forget· σιγάζεται όταν το καλύπτει ήδη ο CDC)
  recordLifecycleAudit({
    entityType,
    entityId,
    entityName: extractEntityName(data),
    action: "restored",
    changes: [
      {
        field: "status",
        oldValue: TRASHED_STATUS,
        newValue: restoredStatus,
        label: "status",
      },
    ],
    performedBy: restoredBy,
    performedByName: performedByName ?? null,
    companyId,
  });

  return { success: true, entityId, restoredStatus };
}

// ============================================================================
// PERMANENT DELETE — Hard delete from trash only
// ============================================================================

/**
 * Permanent delete: ONLY from trash (status='deleted').
 * Runs full ADR-226 dependency check + cascade + hard delete.
 *
 * @throws ApiError(409) if not in trash or has blocking dependencies
 */
export async function permanentDelete(
  db: FirebaseFirestore.Firestore,
  entityType: SoftDeletableEntityType,
  entityId: string,
  deletedBy: string,
  companyId: string,
): Promise<{ success: true; entityId: string }> {
  const { config, data } = await loadLifecycleTarget(db, entityType, entityId, companyId);

  // MUST be in trash
  if (data?.status !== TRASHED_STATUS) {
    throw new ApiError(
      409,
      `${config.labelEn} must be in trash before permanent deletion`,
    );
  }

  logger.info(`Permanently deleting ${entityType}`, { entityId });

  // Delegate to ADR-226 engine (dependency check + cascade + hard delete + audit)
  await executeDeletion(db, entityType, entityId, deletedBy, companyId);

  logger.info(`${entityType} permanently deleted`, { entityId });
  return { success: true, entityId };
}

// ============================================================================
// LIST TRASHED — Read the bin
// ============================================================================

/**
 * Row as the trash endpoints have always emitted it: the raw document, with its
 * id folded in. Deliberately open-ended — the bin renders whatever the entity
 * happens to carry and no endpoint has ever projected a subset.
 */
export type TrashedEntityRow = FirebaseFirestore.DocumentData & { id: string };

/**
 * List an entity's trashed rows for one company.
 *
 * The fourth lifecycle operation, and the one ADR-281 never centralised: five
 * route files each carried their own copy of this query, differing only in the
 * collection and the sort field. Ordering is applied in memory rather than via
 * `orderBy` on purpose — a composite `companyId + status + name` index does not
 * exist, and adding `orderBy` to the query would make every bin start throwing
 * `FAILED_PRECONDITION` until the index is deployed.
 *
 * @param db         Admin Firestore instance
 * @param entityType Soft-deletable entity; must publish a trash-list contract
 * @param companyId  Effective company, already resolved via `resolveTenantScope`
 * @throws ApiError(500) if the entity publishes no trash-list contract
 */
export async function listTrashed(
  db: FirebaseFirestore.Firestore,
  entityType: SoftDeletableEntityType,
  companyId: string,
): Promise<TrashedEntityRow[]> {
  const config = SOFT_DELETE_CONFIG[entityType];
  const trashList = config.trashList;

  if (!trashList) {
    throw new ApiError(500, `${config.labelEn} does not publish a trash list`);
  }

  const snapshot = await db
    .collection(config.collection)
    .where(FIELDS.COMPANY_ID, "==", companyId)
    .where(FIELDS.STATUS, "==", TRASHED_STATUS)
    .get();

  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => readSortKey(a, trashList.sortField).localeCompare(readSortKey(b, trashList.sortField)));
}

/**
 * Sort key for one row: the configured field when it is a string, otherwise the
 * empty string. Rows missing the field sort first — the behaviour every trash
 * route shipped, preserved rather than improved.
 */
function readSortKey(row: FirebaseFirestore.DocumentData, field: string): string {
  const value: unknown = row[field];
  return typeof value === "string" ? value : "";
}

// ============================================================================
// HELPERS
// ============================================================================

/** An entity resolved and cleared for a lifecycle operation. */
interface LifecycleTarget {
  config: SoftDeleteEntityConfig;
  docRef: FirebaseFirestore.DocumentReference;
  data: FirebaseFirestore.DocumentData | undefined;
}

/**
 * Resolve the document a lifecycle operation is about, and enforce tenancy.
 *
 * All three mutations opened with the same twenty lines — collection lookup,
 * existence check, tenant guard — differing only in whether a super admin may
 * cross tenants. That difference is a parameter here, not three transcriptions.
 *
 * @param isSuperAdmin Only `softDelete` passes this: its route-level guard has
 *                     already validated cross-tenant access. Restore and
 *                     permanent-delete deliberately never bypass — preserved as
 *                     it shipped, not unified.
 * @throws ApiError(404) if the document does not exist
 * @throws ApiError(403) if it belongs to another company
 */
async function loadLifecycleTarget(
  db: FirebaseFirestore.Firestore,
  entityType: SoftDeletableEntityType,
  entityId: string,
  companyId: string,
  isSuperAdmin: boolean = false,
): Promise<LifecycleTarget> {
  const config = SOFT_DELETE_CONFIG[entityType];
  const docRef = db.collection(config.collection).doc(entityId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new ApiError(404, `${config.labelEn} not found`);
  }

  const data = docSnap.data();

  if (!isSuperAdmin && data?.companyId && data.companyId !== companyId) {
    throw new ApiError(
      403,
      `Unauthorized: ${config.labelEn} belongs to different company`,
    );
  }

  return { config, docRef, data };
}

function extractEntityName(
  data: FirebaseFirestore.DocumentData | undefined,
): string {
  if (!data) return "Unknown";
  return (
    data.name ??
    data.title ??
    (data.firstName
      ? `${data.firstName} ${data.lastName ?? ""}`.trim()
      : null) ??
    data.companyName ??
    data.number ??
    data.code ??
    "Unknown"
  );
}
