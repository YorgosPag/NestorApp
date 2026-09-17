/**
 * =============================================================================
 * File Purge Helpers — Shared logic for file cleanup operations
 * =============================================================================
 *
 * Reusable functions for purging files from Storage + Firestore.
 * Used by:
 * - Cron file-purge route (Phase A: trash, Phase B: orphan PENDING) — **και τα δύο** διαμερίσματα (ADR-866 §2.6.9)
 * - AI agent discard_pending_file tool
 *
 * @module services/file-record/file-purge-helpers
 * @enterprise ADR-191 Phase 3.2 (File Lifecycle Management)
 */

import 'server-only';

import { getAdminFirestore, getAdminStorage } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_COLLECTION } from '@/lib/files/file-custody';
import type { CustodyKind } from '@/lib/workspace/custody-scope';
import { isHoldActive, type FileHoldSubject } from '@/lib/files/file-hold';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { generateAuditId } from '@/services/enterprise-id.service';
import { nowISO } from '@/lib/date-local';

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
  /**
   * 🔑 **Σε ποιο διαμέρισμα ζει η εγγραφή** — υποχρεωτικό (ADR-866 §2.6.9 Β5): ο μεταγλωττιστής
   * βρίσκει κάθε καλούντα. Ο καλών το ξέρει από το **ερώτημα** που βρήκε το έγγραφο.
   */
  custody: CustodyKind;
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

/** Η έκβαση της διαγραφής των bytes — τρεις απαντήσεις, γιατί η θεραπεία τους διαφέρει. */
export type StorageObjectDeletion = 'deleted' | 'absent' | 'refused';

// =============================================================================
// FUNCTIONS
// =============================================================================

/**
 * Δεσμεύεται το αρχείο (δέσμευση ή ενεργή διατήρηση); — λεπτό περιτύλιγμα του **ενός**
 * καθαρού κριτή (`lib/files/file-hold.ts`) με τον χρόνο του διακομιστή.
 */
export function isFileHeld(data: FileHoldSubject): boolean {
  return isHoldActive(data, Date.now());
}

/**
 * **Σβήσε τα bytes — ή πες ΓΙΑΤΙ όχι.** 🔒 ADR-864 §21: με GCS `temporaryHold` η πλατφόρμα
 * **αρνείται** τη διαγραφή. Πριν, κάθε αποτυχία ήταν «non-blocking» και η εγγραφή γινόταν
 * `purged` ⇒ η βάση θα έλεγε «σβήστηκε» για bytes που **υπάρχουν**. Μόνο το 404 είναι αθώο
 * (τα bytes λείπουν ήδη)· κάθε άλλη αποτυχία αφήνει την εγγραφή όπως ήταν, για τον επόμενο γύρο.
 */
export async function deleteStorageObjectForPurge(storagePath: string): Promise<StorageObjectDeletion> {
  try {
    await getAdminStorage().bucket().file(storagePath).delete();
    return 'deleted';
  } catch (error: unknown) {
    if ((error as { code?: unknown }).code === 404) return 'absent';
    logger.warn('Storage deletion refused — the record stays unpurged', {
      storagePath, error: getErrorMessage(error),
    });
    return 'refused';
  }
}

/**
 * Purge a single file: delete Storage binary, mark Firestore record as purged,
 * and create an audit log entry.
 */
export async function purgeFileRecord(params: PurgeFileParams): Promise<PurgeFileResult> {
  const { fileId, custody, storagePath } = params;
  const db = getAdminFirestore();
  let storageDeleted = false;

  try {
    // Bytes πρώτα — και άρνηση της πλατφόρμας (δέσμευση) ⇒ η εγγραφή ΔΕΝ γίνεται `purged`.
    if (storagePath) {
      const deletion = await deleteStorageObjectForPurge(storagePath);
      if (deletion === 'refused') {
        return { success: false, storageDeleted: false, error: 'storage-deletion-refused' };
      }
      storageDeleted = deletion === 'deleted';
    }

    // Mark FileRecord as purged
    const now = nowISO();
    await db.collection(COLLECTIONS[FILE_COLLECTION[custody]]).doc(fileId).update({
      lifecycleState: 'purged',
      purgedAt: now,
      updatedAt: now,
    });

    await recordPurgeAudit(params, storageDeleted);

    return { success: true, storageDeleted };
  } catch (err) {
    const error = getErrorMessage(err);
    logger.error('Failed to purge file', { fileId, error });
    return { success: false, storageDeleted, error };
  }
}

/**
 * Η γραμμή ίχνους της εκκαθάρισης — **μόνο** για το εταιρικό διαμέρισμα.
 *
 * ⚠️ Το `FILE_AUDIT_LOG` είναι βιβλίο **οργανισμού**: γραμμή προσωπικού αρχείου εκεί θα ανακάτευε
 * διαμερίσματα. Το προσωπικό ίχνος αρχείου είναι το **2β.4** (ADR-866 §3) — ίδιο όριο με το
 * `FileAuditService.logForCustody` του 2β.2. Η εκκαθάριση **καταγράφεται** πάντως στο log διακομιστή.
 */
async function recordPurgeAudit(params: PurgeFileParams, storageDeleted: boolean): Promise<void> {
  if (params.custody !== 'company') {
    logger.info('Personal file purged — file audit ledger deferred (ADR-866 2β.4)', {
      fileId: params.fileId,
      purgeReason: params.purgeReason,
      storageDeleted,
    });
    return;
  }

  await getAdminFirestore().collection(COLLECTIONS.FILE_AUDIT_LOG).doc(generateAuditId()).set({
    fileId: params.fileId,
    action: 'delete',
    performedBy: params.performedBy,
    timestamp: nowISO(),
    metadata: {
      purgeReason: params.purgeReason,
      storageDeleted,
      ...params.metadata,
    },
  });
}
