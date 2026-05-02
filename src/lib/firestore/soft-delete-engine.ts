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
import { SOFT_DELETE_CONFIG } from "./soft-delete-config";
import { executeDeletion } from "./deletion-guard";
import { EntityAuditService } from "@/services/entity-audit.service";
import { ApiError } from "@/lib/api/ApiErrorHandler";
import { createModuleLogger } from "@/lib/telemetry";
import { getErrorMessage } from "@/lib/error-utils";
import type { SoftDeletableEntityType } from "@/types/soft-deletable";

const logger = createModuleLogger("SoftDeleteEngine");

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
  const config = SOFT_DELETE_CONFIG[entityType];
  const docRef = db.collection(config.collection).doc(entityId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new ApiError(404, `${config.labelEn} not found`);
  }

  const data = docSnap.data();

  // Tenant isolation — bypassed for super admin (route-level guard already validated access)
  if (!isSuperAdmin && data?.companyId && data.companyId !== companyId) {
    throw new ApiError(
      403,
      `Unauthorized: ${config.labelEn} belongs to different company`,
    );
  }

  // Idempotency: entity already in trash → desired state achieved, return success
  if (data?.status === "deleted") {
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

  await docRef.update({
    status: "deleted",
    previousStatus,
    deletedAt: FieldValue.serverTimestamp(),
    deletedBy,
    updatedAt: FieldValue.serverTimestamp(),
    // ADR-195 Phase 1 CDC: refresh performer stamps so the Cloud Function
    // audit trigger attributes this write to the actual actor (not the
    // stale create-time stamp). Critical when an admin trashes another
    // user's entity — without this the CDC entry would name the creator.
    _lastModifiedBy: deletedBy,
    _lastModifiedByName: performedByName ?? null,
    _lastModifiedAt: FieldValue.serverTimestamp(),
  });

  // Audit trail (fire-and-forget)
  EntityAuditService.recordChange({
    entityType,
    entityId,
    entityName: extractEntityName(data),
    action: "soft_deleted",
    changes: [
      {
        field: "status",
        oldValue: previousStatus,
        newValue: "deleted",
        label: "status",
      },
    ],
    performedBy: deletedBy,
    performedByName: performedByName ?? null,
    companyId: (data?.companyId as string | undefined) ?? companyId,
  }).catch((err) => {
    logger.error("Audit trail failed (non-blocking)", {
      entityType,
      entityId,
      error: getErrorMessage(err),
    });
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
  const config = SOFT_DELETE_CONFIG[entityType];
  const docRef = db.collection(config.collection).doc(entityId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new ApiError(404, `${config.labelEn} not found`);
  }

  const data = docSnap.data();

  if (data?.companyId && data.companyId !== companyId) {
    throw new ApiError(
      403,
      `Unauthorized: ${config.labelEn} belongs to different company`,
    );
  }

  if (data?.status !== "deleted") {
    throw new ApiError(409, `${config.labelEn} is not in trash`);
  }

  const restoredStatus =
    (data.previousStatus as string) || config.defaultRestoreStatus;

  logger.info(`Restoring ${entityType} from trash`, {
    entityId,
    restoredStatus,
  });

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
    _lastModifiedByName: performedByName ?? null,
    _lastModifiedAt: FieldValue.serverTimestamp(),
  });

  // Audit trail (fire-and-forget)
  EntityAuditService.recordChange({
    entityType,
    entityId,
    entityName: extractEntityName(data),
    action: "restored",
    changes: [
      {
        field: "status",
        oldValue: "deleted",
        newValue: restoredStatus,
        label: "status",
      },
    ],
    performedBy: restoredBy,
    performedByName: performedByName ?? null,
    companyId,
  }).catch((err) => {
    logger.error("Audit trail failed (non-blocking)", {
      entityType,
      entityId,
      error: getErrorMessage(err),
    });
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
  const config = SOFT_DELETE_CONFIG[entityType];
  const docRef = db.collection(config.collection).doc(entityId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new ApiError(404, `${config.labelEn} not found`);
  }

  const data = docSnap.data();

  if (data?.companyId && data.companyId !== companyId) {
    throw new ApiError(
      403,
      `Unauthorized: ${config.labelEn} belongs to different company`,
    );
  }

  // MUST be in trash
  if (data?.status !== "deleted") {
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
// HELPERS
// ============================================================================

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
