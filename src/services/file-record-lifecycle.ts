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
  type DocumentReference,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { fieldToISO, nowISO } from '@/lib/date-local';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import {
  type EntityType,
  type FileCategory,
  type HoldType,
  FILE_LIFECYCLE_STATES,
  DEFAULT_RETENTION_POLICIES,
  TRASH_RETENTION_BY_CATEGORY,
  HOLD_TYPES,
} from '@/config/domain-constants';
import type { FileRecord } from '@/types/file-record';
import { isFileRecord } from '@/types/file-record';
// 🌐 ISO 19650 §10.2 — ΕΝΑ λεξιλόγιο καταστάσεων CDE (ADR-373). Type-only import: μηδέν
// runtime εξάρτηση, αλλά το `satisfies` παρακάτω σπάει τη μεταγλώττιση αν η κατάσταση
// φύγει ποτέ από τον κατάλογο — δεν είναι καρφωτή συμβολοσειρά, είναι δεμένη.
import type { CdeState } from '@/config/iso19650-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { RealtimeService } from '@/services/realtime';
import { FileAuditService } from '@/services/file-audit.service';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';

const logger = createModuleLogger('FILE_RECORD_LIFECYCLE');

/** 🌐 ISO 19650 §10.2 — «Αντικαταστάθηκε». Δεμένη στον κατάλογο, όχι καρφωμένη. */
const SUPERSEDED_CDE_STATE = 'SUPERSEDED' as const satisfies CdeState;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calculate purge date based on category retention policy
 * @enterprise Uses TRASH_RETENTION_BY_CATEGORY from domain-constants
 */
function calculatePurgeDate(category: FileCategory): Date {
  const retentionDays = TRASH_RETENTION_BY_CATEGORY[category] ?? DEFAULT_RETENTION_POLICIES.TRASH_RETENTION_DAYS;
  const purgeDate = new Date();
  purgeDate.setDate(purgeDate.getDate() + retentionDays);
  return purgeDate;
}

/** Lifecycle timestamp that accompanies `createdAt` when normalizing a raw doc */
type LifecycleTimestampField = 'trashedAt' | 'archivedAt' | 'updatedAt';

/**
 * Load a FILES document and fail loudly when it does not exist.
 * Single source for the read-then-assert prologue of every mutation below.
 */
async function loadFileDocOrThrow(fileId: string): Promise<{
  docRef: DocumentReference;
  data: DocumentData;
}> {
  const docRef = doc(db, COLLECTIONS.FILES, fileId);

  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error(`FileRecord not found: ${fileId}`);
  }

  return { docRef, data: docSnap.data() };
}

/**
 * Normalize a raw Firestore doc into a FileRecord (ISO timestamps), or null
 * when it fails the runtime shape guard.
 */
function normalizeFileRecord(
  raw: DocumentData,
  timestampField: LifecycleTimestampField
): FileRecord | null {
  const normalized = {
    ...raw,
    id: raw.id as string,
    createdAt: fieldToISO(raw as Record<string, unknown>, 'createdAt') || raw.createdAt,
    [timestampField]: fieldToISO(raw as Record<string, unknown>, timestampField) || raw[timestampField],
  };

  return isFileRecord(normalized) ? normalized : null;
}

/**
 * Run a tenant-scoped FILES query with the optional entity filters applied.
 * 🏢 ADR-214 Phase 3: via FirestoreQueryService (companyId comes from the caller's constraints)
 */
async function queryLifecycleFiles(
  baseConstraints: QueryConstraint[],
  options: { entityType?: EntityType; entityId?: string },
  timestampField: LifecycleTimestampField
): Promise<FileRecord[]> {
  const constraints = [...baseConstraints];

  if (options.entityType) {
    constraints.push(where('entityType', '==', options.entityType));
  }

  if (options.entityId) {
    constraints.push(where('entityId', '==', options.entityId));
  }

  const result = await firestoreQueryService.getAll<DocumentData>('FILES', { constraints });

  const files: FileRecord[] = [];
  for (const raw of result.documents) {
    const normalized = normalizeFileRecord(raw, timestampField);
    if (normalized) {
      files.push(normalized);
    }
  }

  return files;
}

// ============================================================================
// TRASH OPERATIONS
// ============================================================================

/**
 * Πρόθεση της αποχώρησης ενός αρχείου από την ενεργή ζωή.
 *
 * 🌐 ISO 19650 §10.2: «αντικαταστάθηκε» ({@link CDE_STATES}.SUPERSEDED) και «διαγράφηκε»
 * είναι **δύο διαφορετικά γεγονότα**, όχι δύο ονόματα του ίδιου. Στο πρώτο υπάρχει
 * διάδοχος και ο αναγνώστης οφείλει να τον βρει· στο δεύτερο δεν υπάρχει τίποτα.
 */
export interface MoveToTrashOptions {
  /**
   * Το αρχείο που **παίρνει τη θέση** αυτού. Παρόν ⇒ αντικατάσταση, όχι απώλεια.
   * Ταξιδεύει ΚΑΙ στο έγγραφο ΚΑΙ στο `FILE_TRASHED` — δες
   * {@link FileRecord.supersededByFileId} για το γιατί χρειάζονται και τα δύο.
   */
  readonly supersededByFileId?: string;
}

/**
 * 🗑️ Move file to Trash (soft delete)
 * @enterprise Replaces hard delete with 3-tier lifecycle
 *
 * ⚠️ Όταν το αρχείο φεύγει επειδή **αντικαταστάθηκε**, μην καλείς αυτή τη συνάρτηση με
 * σκέτο options bag — κάλεσε το {@link supersedeFileRecord}, που **ονομάζει** την πρόθεση.
 * Η ονομασία είναι η άμυνα: ένα `{ supersededByFileId }` που ξεχνιέται δεν φαίνεται σε
 * code review, ένα `moveToTrash` στη θέση ενός `supersede` φαίνεται.
 */
export async function moveToTrash(
  fileId: string,
  trashedBy: string,
  options?: MoveToTrashOptions,
): Promise<void> {
  const supersededByFileId = options?.supersededByFileId;
  logger.info('Moving FileRecord to trash', { fileId, trashedBy, supersededByFileId: supersededByFileId ?? null });

  const { docRef, data } = await loadFileDocOrThrow(fileId);
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
    // 🌐 ISO 19650 — η διαδοχή γράφεται στο ΕΓΓΡΑΦΟ (μόνιμη καταγωγή), όχι μόνο στο
    // γεγονός (εφήμερο). Το `cdeState` είναι το υπάρχον SSoT πεδίο του ADR-373.
    ...(supersededByFileId
      ? {
          supersededByFileId,
          supersededAt: serverTimestamp(),
          cdeState: SUPERSEDED_CDE_STATE,
        }
      : {}),
  });

  logger.info('FileRecord moved to trash', {
    fileId,
    purgeAt: purgeDate.toISOString(),
    retentionDays: TRASH_RETENTION_BY_CATEGORY[category] ?? DEFAULT_RETENTION_POLICIES.TRASH_RETENTION_DAYS,
  });

  RealtimeService.dispatch('FILE_TRASHED', {
    fileId,
    trashedBy,
    purgeAt: purgeDate.toISOString(),
    displayName: (data.displayName as string | undefined) ?? undefined,
    entityId: (data.entityId as string | undefined) ?? undefined,
    entityType: (data.entityType as string | undefined) ?? undefined,
    ...(supersededByFileId ? { supersededByFileId } : {}),
    timestamp: Date.now(),
  });

  safeFireAndForget(FileAuditService.log(fileId, 'delete', trashedBy), 'FileRecord.trashFile', { fileId });
}

/**
 * 🔁 **Η ΜΙΑ πόρτα της αντικατάστασης** — «αυτό το αρχείο δεν χάθηκε· το πήρε η θέση του
 * το `supersededByFileId`».
 *
 * 🌐 ISO 19650 §10.2: ένα superseded έγγραφο είναι **μη χρησιμοποιήσιμο**, ΟΧΙ ανύπαρκτο —
 * και ο διάδοχός του πρέπει να είναι **ευρέσιμος**. Ίδιο lifecycle με τον κάδο (soft,
 * ανακτήσιμο, ίδια πολιτική διατήρησης) — αλλά **δηλωμένη** πρόθεση, ώστε κανένας
 * συνδρομητής να μη χρειαστεί να τη μαντέψει.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (ADR-845 Ο-16, μετρημένο 2026-09-09): η αντικατάσταση κάτοψης γραφόταν
 * σε **δύο** σημεία ως σκέτο `moveToTrash` (`StepUpload.performUpload` +
 * `useSceneState.linkSceneFileToLevel` — δίδυμα, N.18). Ο συνδρομητής
 * `useLevelFloorplanSync` — φτιαγμένος για **εξωτερική** διαγραφή — δεν είχε τρόπο να
 * ξεχωρίσει τα δύο και **καθάριζε τον καμβά που η ίδια η εισαγωγή μόλις είχε γεμίσει**.
 * Ο γραφέας ήταν σωστός, ο αναγνώστης ήταν σωστός· **η ραφή τους δεν ήταν ποτέ ερώτηση**.
 *
 * @param previousFileId    Το αρχείο που αποσύρεται.
 * @param supersededByFileId Ο διάδοχος που μόλις πήρε τη θέση του.
 * @param actorUid          Ποιος έκανε την αντικατάσταση.
 */
export async function supersedeFileRecord(
  previousFileId: string,
  supersededByFileId: string,
  actorUid: string,
): Promise<void> {
  // Ταυτότητα, όχι αντικατάσταση: το αρχείο δεν διαδέχεται τον εαυτό του.
  if (previousFileId === supersededByFileId) return;
  return moveToTrash(previousFileId, actorUid, { supersededByFileId });
}

/**
 * ♻️ Restore file from Trash
 * @enterprise Returns file to active state
 */
export async function restoreFromTrash(fileId: string, restoredBy: string): Promise<void> {
  logger.info('Restoring FileRecord from trash', { fileId, restoredBy });

  const { docRef, data } = await loadFileDocOrThrow(fileId);
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
  return queryLifecycleFiles(
    [
      where('isDeleted', '==', true),
      where('companyId', '==', options.companyId),
    ],
    options,
    'trashedAt'
  );
}

/**
 * 📦 Get archived files for an entity
 * Same pattern as getTrashedFiles but queries lifecycleState=archived
 */
export async function getArchivedFiles(options: {
  companyId: string;
  entityType?: EntityType;
  entityId?: string;
}): Promise<FileRecord[]> {
  return queryLifecycleFiles(
    [
      where('isDeleted', '==', false),
      where('companyId', '==', options.companyId),
      where('lifecycleState', '==', FILE_LIFECYCLE_STATES.ARCHIVED),
    ],
    options,
    'archivedAt'
  );
}

/**
 * 📋 Get files eligible for purge
 * 🏢 ADR-214 Phase 3: tenantOverride: 'skip' — server-side, sees ALL files
 */
export async function getFilesEligibleForPurge(): Promise<FileRecord[]> {
  const now = nowISO();

  const constraints = [
    where('isDeleted', '==', true),
    where('purgeAt', '<=', now),
  ];

  // tenant-scope-exempt: εργασία συντήρησης server-side (ADR-214 Φάση 3) — ο εκκαθαριστής
  // οφείλει να δει τα ληγμένα αρχεία ΟΛΩΝ των μισθωτών, αλλιώς όσα ανήκουν σε άλλη εταιρεία
  // δεν σβήνονται ποτέ. Δεν εξυπηρετεί αίτημα χρήστη και δεν επιστρέφει δεδομένα σε UI.
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

    const normalized = normalizeFileRecord(raw, 'updatedAt');
    if (normalized) {
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
