/**
 * 🗑️ ENTERPRISE FILE RECORD LIFECYCLE OPERATIONS
 *
 * Trash system, hold management, and purge eligibility.
 * Extracted from file-record.service.ts (ADR-065 SRP split).
 *
 * 3-tier lifecycle: Active → Trashed → Archived → Purged
 * @enterprise ADR-032 - Enterprise Trash System
 */

import {
  doc,
  getDoc,
  updateDoc,
  where,
  serverTimestamp,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { fieldToISO } from '@/lib/date-local';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import {
  type EntityType,
  type FileCategory,
  type HoldType,
  FILE_LIFECYCLE_STATES,
  DEFAULT_RETENTION_POLICIES,
  RETENTION_BY_CATEGORY,
  HOLD_TYPES,
} from '@/config/domain-constants';
import type { FileRecord } from '@/types/file-record';
import { isFileRecord } from '@/types/file-record';
import { createModuleLogger } from '@/lib/telemetry';
import { RealtimeService } from '@/services/realtime';
import { FileAuditService } from '@/services/file-audit.service';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';

const logger = createModuleLogger('FILE_RECORD_LIFECYCLE');

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calculate purge date based on category retention policy
 * @enterprise Uses RETENTION_BY_CATEGORY from domain-constants
 */
function calculatePurgeDate(category: FileCategory): Date {
  const retentionDays = RETENTION_BY_CATEGORY[category] ?? DEFAULT_RETENTION_POLICIES.TRASH_RETENTION_DAYS;
  const purgeDate = new Date();
  purgeDate.setDate(purgeDate.getDate() + retentionDays);
  return purgeDate;
}

// ============================================================================
// TRASH OPERATIONS
// ============================================================================

/**
 * 🗑️ Move file to Trash (soft delete)
 * @enterprise Replaces hard delete with 3-tier lifecycle
 */
export async function moveToTrash(fileId: string, trashedBy: string): Promise<void> {
  logger.info('Moving FileRecord to trash', { fileId, trashedBy });

  const docRef = doc(db, COLLECTIONS.FILES, fileId);

  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error(`FileRecord not found: ${fileId}`);
  }

  const data = docSnap.data();
  const category = data.category as FileCategory;
  const purgeDate = calculatePurgeDate(category);

  if (data.hold && data.hold !== HOLD_TYPES.NONE) {
    throw new Error(`Cannot trash file ${fileId}: Active hold (${data.hold}) prevents deletion. Contact administrator.`);
  }

  await updateDoc(docRef, {
    lifecycleState: FILE_LIFECYCLE_STATES.TRASHED,
    trashedAt: serverTimestamp(),
    trashedBy,
    purgeAt: purgeDate.toISOString(),
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: trashedBy,
    updatedAt: serverTimestamp(),
  });

  logger.info('FileRecord moved to trash', {
    fileId,
    purgeAt: purgeDate.toISOString(),
    retentionDays: RETENTION_BY_CATEGORY[category] ?? DEFAULT_RETENTION_POLICIES.TRASH_RETENTION_DAYS,
  });

  RealtimeService.dispatch('FILE_TRASHED', {
    fileId,
    trashedBy,
    purgeAt: purgeDate.toISOString(),
    timestamp: Date.now(),
  });

  safeFireAndForget(FileAuditService.log(fileId, 'delete', trashedBy), 'FileRecord.trashFile', { fileId });
}

/**
 * ♻️ Restore file from Trash
 * @enterprise Returns file to active state
 */
export async function restoreFromTrash(fileId: string, restoredBy: string): Promise<void> {
  logger.info('Restoring FileRecord from trash', { fileId, restoredBy });

  const docRef = doc(db, COLLECTIONS.FILES, fileId);

  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error(`FileRecord not found: ${fileId}`);
  }

  const data = docSnap.data();
  if (data.lifecycleState !== FILE_LIFECYCLE_STATES.TRASHED && data.isDeleted !== true) {
    throw new Error(`FileRecord ${fileId} is not in trash`);
  }

  await updateDoc(docRef, {
    lifecycleState: FILE_LIFECYCLE_STATES.ACTIVE,
    isDeleted: false,
    trashedAt: null,
    trashedBy: null,
    purgeAt: null,
    deletedAt: null,
    deletedBy: null,
    restoredAt: serverTimestamp(),
    restoredBy,
    updatedAt: serverTimestamp(),
  });

  logger.info('FileRecord restored from trash', { fileId, restoredBy });

  RealtimeService.dispatch('FILE_RESTORED', {
    fileId,
    restoredBy,
    timestamp: Date.now(),
  });

  safeFireAndForget(FileAuditService.log(fileId, 'restore', restoredBy), 'FileRecord.restoreFile', { fileId });
}

/**
 * 📂 Get files in Trash for an entity
 * 🏢 ADR-214 Phase 3: via FirestoreQueryService
 */
export async function getTrashedFiles(options: {
  companyId: string;
  entityType?: EntityType;
  entityId?: string;
}): Promise<FileRecord[]> {
  const constraints = [
    where('isDeleted', '==', true),
  ];

  if (options.entityType) {
    constraints.push(where('entityType', '==', options.entityType));
  }

  if (options.entityId) {
    constraints.push(where('entityId', '==', options.entityId));
  }

  const result = await firestoreQueryService.getAll<DocumentData>('FILES', { constraints });

  const trashedFiles: FileRecord[] = [];
  for (const raw of result.documents) {
    const normalized = {
      ...raw,
      id: raw.id as string,
      createdAt: fieldToISO(raw as Record<string, unknown>, 'createdAt') || raw.createdAt,
      trashedAt: fieldToISO(raw as Record<string, unknown>, 'trashedAt') || raw.trashedAt,
    };

    if (isFileRecord(normalized)) {
      trashedFiles.push(normalized);
    }
  }

  return trashedFiles;
}

/**
 * 📋 Get files eligible for purge
 * 🏢 ADR-214 Phase 3: tenantOverride: 'skip' — server-side, sees ALL files
 */
export async function getFilesEligibleForPurge(): Promise<FileRecord[]> {
  const now = new Date().toISOString();

  const constraints = [
    where('isDeleted', '==', true),
    where('purgeAt', '<=', now),
  ];

  const result = await firestoreQueryService.getAll<DocumentData>('FILES', {
    constraints,
    tenantOverride: 'skip',
  });

  const eligibleFiles: FileRecord[] = [];
  for (const raw of result.documents) {
    if (raw.hold && raw.hold !== HOLD_TYPES.NONE) {
      logger.info('Skipping file with active hold', { fileId: raw.id, hold: raw.hold });
      continue;
    }

    if (raw.retentionUntil) {
      const retentionDate = new Date(raw.retentionUntil as string);
      if (retentionDate > new Date()) {
        logger.info('Skipping file with active retention', { fileId: raw.id, retentionUntil: raw.retentionUntil });
        continue;
      }
    }

    const normalized = {
      ...raw,
      id: raw.id as string,
      createdAt: fieldToISO(raw as Record<string, unknown>, 'createdAt') || raw.createdAt,
      updatedAt: fieldToISO(raw as Record<string, unknown>, 'updatedAt') || raw.updatedAt,
    };

    if (isFileRecord(normalized)) {
      eligibleFiles.push(normalized);
    }
  }

  logger.info('Found files eligible for purge', { count: eligibleFiles.length });
  return eligibleFiles;
}

// ============================================================================
// HOLD OPERATIONS
// ============================================================================

/**
 * 🔒 Place hold on file (prevents deletion)
 * @enterprise For legal/regulatory compliance
 */
export async function placeHold(
  fileId: string,
  holdType: HoldType,
  placedBy: string,
  reason: string
): Promise<void> {
  logger.info('Placing hold on FileRecord', { fileId, holdType, placedBy, reason });

  const docRef = doc(db, COLLECTIONS.FILES, fileId);

  await updateDoc(docRef, {
    hold: holdType,
    holdPlacedBy: placedBy,
    holdPlacedAt: serverTimestamp(),
    holdReason: reason,
    updatedAt: serverTimestamp(),
  });

  logger.info('Hold placed on FileRecord', { fileId, holdType });

  safeFireAndForget(FileAuditService.log(fileId, 'hold_place', placedBy, undefined, { holdType, reason }), 'FileRecord.holdPlace', { fileId });
}

/**
 * 🔓 Release hold on file
 * @enterprise Allows file to be deleted again
 */
export async function releaseHold(fileId: string, releasedBy: string): Promise<void> {
  logger.info('Releasing hold on FileRecord', { fileId, releasedBy });

  const docRef = doc(db, COLLECTIONS.FILES, fileId);

  await updateDoc(docRef, {
    hold: HOLD_TYPES.NONE,
    holdReleasedBy: releasedBy,
    holdReleasedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  logger.info('Hold released on FileRecord', { fileId });

  safeFireAndForget(FileAuditService.log(fileId, 'hold_release', releasedBy), 'FileRecord.holdRelease', { fileId });
}
