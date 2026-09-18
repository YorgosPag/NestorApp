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
import {
  custodyKindOfScope,
  custodyScopeFromData,
  type CustodyKind,
  type CustodyScope,
} from '@/lib/workspace/custody-scope';
import { isHoldActive, type FileHoldSubject } from '@/lib/files/file-hold';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';
import { recordFileAudit } from '@/services/file-audit-admin.service';

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
  const ref = getAdminFirestore().collection(COLLECTIONS[FILE_COLLECTION[custody]]).doc(fileId);
  let storageDeleted = false;

  try {
    // 🔑 ADR-866 §2.6.11 — η εγγραφή διαβάζεται ΠΡΩΤΑ, στο διαμέρισμα όπου ζητήθηκε: (α) ο κάτοχος
    //    του βιβλίου δραστηριότητας έρχεται από τα ΔΙΚΑ της πεδία, (β) εγγραφή που ΔΕΝ υπάρχει εκεί
    //    δεν κοστίζει τα bytes της — πριν, τα bytes σβήνονταν και μετά αποτύγχανε η ενημέρωση.
    const snap = await ref.get();
    if (!snap.exists) return { success: false, storageDeleted: false, error: 'record-not-found' };
    const owner = custodyScopeFromData(snap.data() ?? {});

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
    await ref.update({
      lifecycleState: 'purged',
      purgedAt: now,
      updatedAt: now,
    });

    await recordPurgeAudit(params, owner, storageDeleted);

    return { success: true, storageDeleted };
  } catch (err) {
    const error = getErrorMessage(err);
    logger.error('Failed to purge file', { fileId, error });
    return { success: false, storageDeleted, error };
  }
}

/**
 * Η γραμμή δραστηριότητας της εκκαθάρισης — στο βιβλίο **του κατόχου του αρχείου** (ADR-866 §2.6.11).
 *
 * 📒 Εταιρικό αρχείο ⇒ `file_audit_log`· προσωπικό ⇒ `file_audit_log_personal`, που το διαβάζει ο
 * κάτοχος. Μέσω του **ενός** γραφέα διακομιστή (`recordFileAudit`): χρόνος διακομιστή και **πεδίο
 * κατόχου**. 🔴 Ως τις 2026-09-18 η εταιρική γραμμή γραφόταν εδώ με το χέρι, **χωρίς** `companyId`
 * και με `nowISO()` — δηλαδή **καμία** εταιρική εκκαθάριση δεν ήταν ποτέ ορατή σε άνθρωπο (§2.6.11 Β2).
 *
 * ⚠️ Κάτοχος που **δεν** ανήκει στο διαμέρισμα όπου βρέθηκε το έγγραφο ⇒ **καμία** γραμμή, με σφάλμα
 * στο log: η γραμμή θα πήγαινε σε βιβλίο που ο κάτοχος του αρχείου δεν διαβάζει.
 */
async function recordPurgeAudit(
  params: PurgeFileParams,
  owner: CustodyScope | null,
  storageDeleted: boolean,
): Promise<void> {
  if (owner === null || custodyKindOfScope(owner) !== params.custody) {
    logger.error('Purged record has no single owner in its partition — no activity row', {
      fileId: params.fileId,
      custody: params.custody,
    });
    return;
  }

  await recordFileAudit({
    fileId: params.fileId,
    action: 'delete',
    performedBy: params.performedBy,
    ...owner,
    metadata: { purgeReason: params.purgeReason, storageDeleted, ...params.metadata },
  });
}
