/**
 * =============================================================================
 * File Purge Helpers — Shared logic for file cleanup operations
 * =============================================================================
 *
 * Reusable functions for purging files from Storage + Firestore.
 * Used by:
 * - Cron file-purge route (Phase A: trash, Phase B: orphan PENDING)
 * - AI agent discard_pending_file tool
 *
 * @module services/file-record/file-purge-helpers
 * @enterprise ADR-191 Phase 3.2 (File Lifecycle Management)
 */

import 'server-only';

import { getAdminFirestore, getAdminStorage } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { HOLD_TYPES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { generateAuditId } from '@/services/enterprise-id.service';

const logger = createModuleLogger('FilePurgeHelpers');

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_PENDING_TTL_HOURS = 48;

/** TTL for orphan PENDING files (configurable via env var) */
export const PENDING_FILE_TTL_MS = (() => {
  const hours = parseInt(process.env.PENDING_FILE_TTL_HOURS ?? '', 10);
  return (Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_PENDING_TTL_HOURS) * 60 * 60 * 1000;
})();

// =============================================================================
// TYPES
// =============================================================================

export interface PurgeFileParams {
  fileId: string;
  storagePath: string | undefined;
  performedBy: string;
  purgeReason: 'ttl_expired' | 'user_discard' | 'cron_trash';
  metadata?: Record<string, string | number | boolean | null>;
}

export interface PurgeFileResult {
  success: boolean;
  storageDeleted: boolean;
  error?: string;
}

interface FirestoreDocData {
  hold?: string;
  retentionUntil?: string;
}

// =============================================================================
// FUNCTIONS
// =============================================================================

/** Check if a file has an active hold or retention that blocks deletion */
export function isFileHeld(data: FirestoreDocData): boolean {
  if (data.hold && data.hold !== HOLD_TYPES.NONE) {
    return true;
  }
  if (data.retentionUntil) {
    return new Date(data.retentionUntil) > new Date();
  }
  return false;
}

/**
 * Purge a single file: delete Storage binary, mark Firestore record as purged,
 * and create an audit log entry.
 */
export async function purgeFileRecord(params: PurgeFileParams): Promise<PurgeFileResult> {
  const { fileId, storagePath, performedBy, purgeReason, metadata } = params;
  const db = getAdminFirestore();
  let storageDeleted = false;

  try {
    // Delete binary from Firebase Storage
    if (storagePath) {
      try {
        const bucket = getAdminStorage().bucket();
        await bucket.file(storagePath).delete();
        storageDeleted = true;
      } catch (storageErr) {
        logger.warn('Storage file deletion failed (non-blocking)', {
          fileId, storagePath, error: getErrorMessage(storageErr),
        });
      }
    }

    // Mark FileRecord as purged
    const now = new Date().toISOString();
    await db.collection(COLLECTIONS.FILES).doc(fileId).update({
      lifecycleState: 'purged',
      purgedAt: now,
      updatedAt: now,
    });

    // Audit log
    await db.collection(COLLECTIONS.FILE_AUDIT_LOG).doc(generateAuditId()).set({
      fileId,
      action: 'delete',
      performedBy,
      timestamp: new Date().toISOString(),
      metadata: {
        purgeReason,
        storageDeleted,
        ...metadata,
      },
    });

    return { success: true, storageDeleted };
  } catch (err) {
    const error = getErrorMessage(err);
    logger.error('Failed to purge file', { fileId, error });
    return { success: false, storageDeleted, error };
  }
}
