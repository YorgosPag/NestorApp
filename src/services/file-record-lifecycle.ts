/**
 * 🗑️ ENTERPRISE FILE RECORD LIFECYCLE OPERATIONS
 *
 * Trash system and purge eligibility. Hold is written ONLY by the server
 * (`services/file-record/file-hold.service.ts`, ADR-864 §21).
 * Extracted from file-record.service.ts (ADR-065 SRP split).
 *
 * 3-tier lifecycle: Active → Trashed → Archived → Purged
 * @enterprise ADR-032 - Enterprise Trash System
 */

import {
  doc,
  getDoc,
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
  FILE_LIFECYCLE_STATES,
  DEFAULT_RETENTION_POLICIES,
  TRASH_RETENTION_BY_CATEGORY,
} from '@/config/domain-constants';
import type { FileRecord } from '@/types/file-record';
import { isFileRecord } from '@/types/file-record';
import { createModuleLogger } from '@/lib/telemetry';
import { isHoldActive } from '@/lib/files/file-hold';
import { FILE_COLLECTION, type FileCustody } from '@/lib/files/file-custody';
import {
  custodyKindOfScope,
  custodyScopeFromData,
  type CustodyKind,
  type CustodyScope,
} from '@/lib/workspace/custody-scope';
import { fileOwnerConstraints } from '@/services/file-record-queries';
import { RealtimeService } from '@/services/realtime';
import { commitFileActivity } from '@/services/file-record/file-activity-commit';
import {
  requestSupersession,
  type SupersedeOutcome,
} from '@/services/filesystem/container-transition.client';

const logger = createModuleLogger('FILE_RECORD_LIFECYCLE');

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
 * Load a file document and fail loudly when it does not exist.
 * Single source for the read-then-assert prologue of every mutation below.
 *
 * @param custody Σε ποιο διαμέρισμα ζει (ADR-866 §2.6.8 Β4) — ποτέ «δοκίμασε και τις δύο».
 */
async function loadFileDocOrThrow(fileId: string, custody: CustodyKind): Promise<{
  docRef: DocumentReference;
  data: DocumentData;
  owner: CustodyScope;
}> {
  const docRef = doc(db, COLLECTIONS[FILE_COLLECTION[custody]], fileId);

  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error(`FileRecord not found: ${fileId}`);
  }

  // 📒 ADR-866 §2.6.11 — ο κάτοχος από τα ΔΙΚΑ του πεδία: σε αυτόν πάει η γραμμή δραστηριότητας.
  //    Χωρίς ακριβώς έναν, η πράξη ΑΡΝΕΙΤΑΙ — δεν ξέρουμε σε ποιο βιβλίο θα την έβλεπε κανείς.
  const data = docSnap.data();
  const owner = custodyScopeFromData(data);
  if (owner === null) {
    throw new Error(`FileRecord ${fileId} has no single owner`);
  }

  return { docRef, data, owner };
}

/** Στον κάδο ήδη; — `lifecycleState` **ή** το legacy `isDeleted` (πάνε πάντα μαζί). */
function isInTrash(data: DocumentData): boolean {
  return data.lifecycleState === FILE_LIFECYCLE_STATES.TRASHED || data.isDeleted === true;
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

/** Κάδος/αρχειοθήκη **ενός κατόχου**, προαιρετικά μίας οντότητας. */
interface LifecycleListOptions {
  /** Ο κάτοχος (ADR-866 §5.2) — ορίζει **και** το διαμέρισμα **και** το φίλτρο κατόχου. */
  custody: FileCustody;
  entityType?: EntityType;
  entityId?: string;
}

/**
 * Run a custody-scoped file query with the optional entity filters applied.
 * 🏢 ADR-214 Phase 3: via FirestoreQueryService — φίλτρο κατόχου από το `fileOwnerConstraints`.
 */
async function queryLifecycleFiles(
  baseConstraints: QueryConstraint[],
  options: LifecycleListOptions,
  timestampField: LifecycleTimestampField
): Promise<FileRecord[]> {
  const constraints = [...baseConstraints, ...fileOwnerConstraints(options.custody)];

  if (options.entityType) {
    constraints.push(where('entityType', '==', options.entityType));
  }

  if (options.entityId) {
    constraints.push(where('entityId', '==', options.entityId));
  }

  const result = await firestoreQueryService.getAll<DocumentData>(
    FILE_COLLECTION[custodyKindOfScope(options.custody)],
    { constraints },
  );

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
 * 🗑️ Move file to Trash (soft delete)
 * @enterprise Replaces hard delete with 3-tier lifecycle
 *
 * ⚠️ **Ο κάδος σημαίνει ΑΠΩΛΕΙΑ, και μόνο αυτό** (ADR-862 Φ0 Β10). Όταν το αρχείο φεύγει
 * επειδή **ήρθε νέα έκδοση**, κάλεσε το {@link supersedeFileRecord}: αρχειοθετεί (ποτέ
 * οριστική διαγραφή) μέσω του ΕΝΟΣ γραφέα του διακομιστή.
 */
export async function moveToTrash(fileId: string, custody: CustodyKind, trashedBy: string): Promise<void> {
  logger.info('Moving FileRecord to trash', { fileId, trashedBy });

  const { docRef, data, owner } = await loadFileDocOrThrow(fileId, custody);
  // 🔴 ADR-866 §2.6.11 Β3 — ΙΔΕΜΠΟΤΗΤΑ: μετρημένα, 10 από τις 15 γραμμές `delete` ήταν ζεύγη σε
  //    0,4 s. Δεύτερος κάδος ξανάγραφε `trashedAt`/`purgeAt` (**μετέθετε το ρολόι εκκαθάρισης**) και
  //    δεύτερη γραμμή ιστορικού. Ήδη στον κάδο ⇒ καμία πράξη.
  if (isInTrash(data)) {
    logger.info('FileRecord already in trash — no-op', { fileId });
    return;
  }
  const category = data.category as FileCategory;
  const purgeDate = calculatePurgeDate(category);

  // 🔑 ADR-864 §21 — ΣΙΩΠΗΛΗ ΔΕΣΜΕΥΣΗ (Google Vault · Box · Purview): ο κάδος ΕΠΙΤΡΕΠΕΤΑΙ και σε
  //    αρχείο σε δέσμευση. Αυτό που δεν γίνεται ποτέ είναι η ΟΡΙΣΤΙΚΗ διαγραφή — την αρνούνται ο
  //    κριτής (`isFileHeld` σε κάθε purge), οι κανόνες και η πλατφόρμα (GCS `temporaryHold`).

  await commitFileActivity({
    docRef,
    owner,
    updates: {
      lifecycleState: FILE_LIFECYCLE_STATES.TRASHED,
      trashedAt: serverTimestamp(),
      trashedBy,
      purgeAt: purgeDate.toISOString(),
      isDeleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: trashedBy,
      updatedAt: serverTimestamp(),
    },
    act: { fileId, action: 'delete', performedBy: trashedBy },
    context: 'FileRecord.trashFile',
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
    timestamp: Date.now(),
  });
}

/**
 * 🔁 **Η ΜΙΑ πόρτα της αντικατάστασης** — «αυτό το αρχείο δεν χάθηκε· το πήρε η θέση του
 * το `supersededByFileId`».
 *
 * 🌐 **Η πρακτική** (ADR-862 Φ0 Β10): Aconex «all versions are kept» · Procore «Revision
 * History» · UK BIM Framework Part C §6.3 «Continuous Archiving». Το παλιό γίνεται
 * `SUPERSEDED` και **αρχειοθετείται** — ποτέ κάδος, άρα ποτέ οριστική διαγραφή.
 *
 * 🔴 **Ο ΠΕΛΑΤΗΣ ΖΗΤΑ, Ο ΔΙΑΚΟΜΙΣΤΗΣ ΑΠΟΔΕΙΚΝΥΕΙ.** Μέχρι το Β10 αυτή η πόρτα έγραφε
 * `cdeState` από τον browser· ο κανόνας `cdeCustodyUnchanged()` (Β4) το απορρίπτει σωστά, και
 * **ολόκληρη** η εγγραφή αποτύγχανε σιωπηλά. Τώρα ο ΕΝΑΣ γραφέας κρίνει τη διαδοχή (ίδιο
 * δοχείο · ίδιος μισθωτής · έτοιμος, νεότερος, δικός σου διάδοχος) στην ίδια συναλλαγή.
 *
 * 🔑 **ADR-845 Ο-16 — το γεγονός ΜΕΤΑ την επιβεβαίωση, με ΔΙΚΟ ΤΟΥ όνομα.** Ο συνδρομητής
 * της απώλειας (`useLevelFloorplanSync`) ακούει μόνο `FILE_TRASHED`· το `FILE_SUPERSEDED`
 * δεν έχει δρόμο προς τον καθαρισμό του καμβά — η προστασία είναι **δομική**, όχι σημαία.
 *
 * 🗂️ **ΔΥΟ ΔΙΑΜΕΡΙΣΜΑΤΑ** (ADR-866 2β.3β): το `custody` είναι **υποχρεωτικό** — και τα δύο αρχεία
 * ζουν στο **ίδιο**, αλλιώς δεν είναι εκδόσεις του ίδιου δοχείου (ο γραφέας το αποδεικνύει:
 * ζητά τον διάδοχο **στο ίδιο** διαμέρισμα, και ό,τι ζει αλλού φαίνεται `successor-not-found`).
 * Το είδος το **αποδεικνύει το έγγραφο** (`fileCustodyKindOf`), δεν το μαντεύει η οθόνη.
 *
 * @param previousFileId     Το αρχείο που αντικαθίσταται.
 * @param supersededByFileId Ο διάδοχος που μόλις πήρε τη θέση του.
 * @param custody            Το διαμέρισμα **και των δύο** — από τα πεδία κατόχου του εγγράφου.
 * @returns **Ονομασμένη** έκβαση — ο καλών αποφασίζει τι θα δει ο άνθρωπος, ποτέ σιωπή.
 */
export async function supersedeFileRecord(
  previousFileId: string,
  supersededByFileId: string,
  custody: CustodyKind,
): Promise<SupersedeOutcome> {
  // Ταυτότητα, όχι αντικατάσταση: το αρχείο δεν διαδέχεται τον εαυτό του — ούτε δίκτυο.
  if (previousFileId === supersededByFileId) return { kind: 'noop' };

  const outcome = await requestSupersession(previousFileId, supersededByFileId, custody);
  if (outcome.kind === 'superseded') {
    RealtimeService.dispatch('FILE_SUPERSEDED', {
      fileId: previousFileId,
      supersededByFileId,
      timestamp: Date.now(),
    });
  }
  return outcome;
}

/**
 * ♻️ Restore file from Trash
 * @enterprise Returns file to active state
 */
export async function restoreFromTrash(fileId: string, custody: CustodyKind, restoredBy: string): Promise<void> {
  logger.info('Restoring FileRecord from trash', { fileId, restoredBy });

  const { docRef, data, owner } = await loadFileDocOrThrow(fileId, custody);
  if (!isInTrash(data)) {
    throw new Error(`FileRecord ${fileId} is not in trash`);
  }

  await commitFileActivity({
    docRef,
    owner,
    updates: {
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
    },
    act: { fileId, action: 'restore', performedBy: restoredBy },
    context: 'FileRecord.restoreFile',
  });

  logger.info('FileRecord restored from trash', { fileId, restoredBy });

  RealtimeService.dispatch('FILE_RESTORED', {
    fileId,
    restoredBy,
    timestamp: Date.now(),
  });
}

/**
 * 📂 Get files in Trash for an entity
 * 🏢 ADR-214 Phase 3: via FirestoreQueryService
 */
export async function getTrashedFiles(options: LifecycleListOptions): Promise<FileRecord[]> {
  return queryLifecycleFiles(
    [
      where('isDeleted', '==', true),
    ],
    options,
    'trashedAt'
  );
}

/**
 * 📦 Get archived files for an entity
 * Same pattern as getTrashedFiles but queries lifecycleState=archived
 */
export async function getArchivedFiles(options: LifecycleListOptions): Promise<FileRecord[]> {
  return queryLifecycleFiles(
    [
      where('isDeleted', '==', false),
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
    // Ο ΕΝΑΣ κριτής (ADR-864 §21): δέσμευση ή διατήρηση που δεν έληξε ⇒ παράλειψη.
    if (isHoldActive(raw, Date.now())) {
      logger.info('Skipping held file', { fileId: raw.id });
      continue;
    }

    const normalized = normalizeFileRecord(raw, 'updatedAt');
    if (normalized) {
      eligibleFiles.push(normalized);
    }
  }

  logger.info('Found files eligible for purge', { count: eligibleFiles.length });
  return eligibleFiles;
}
