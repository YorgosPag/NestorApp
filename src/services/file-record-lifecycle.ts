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
  where,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import { fieldToISO } from '@/lib/date-local';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import {
  type EntityType,
  FILE_LIFECYCLE_STATES,
} from '@/config/domain-constants';
import type { FileRecord } from '@/types/file-record';
import { isFileRecord } from '@/types/file-record';
import { createModuleLogger } from '@/lib/telemetry';
import { FILE_COLLECTION, type FileCustody } from '@/lib/files/file-custody';
import { custodyKindOfScope, type CustodyKind } from '@/lib/workspace/custody-scope';
import { fileOwnerConstraints } from '@/services/file-record-queries';
import { RealtimeService } from '@/services/realtime';
import {
  requestSupersession,
  type SupersedeOutcome,
} from '@/services/filesystem/container-transition.client';
import { requestFileTrash } from '@/services/filesystem/file-trash.client';

const logger = createModuleLogger('FILE_RECORD_LIFECYCLE');

// ============================================================================
// HELPERS
// ============================================================================

/** Lifecycle timestamp that accompanies `createdAt` when normalizing a raw doc */
type LifecycleTimestampField = 'trashedAt' | 'archivedAt' | 'updatedAt';

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
 * Η άρνηση του διακομιστή γίνεται **ρίψη με όνομα** — όπως πριν το `permission-denied` των κανόνων.
 * Σιωπηλή μερική επιτυχία θα έλεγε στον άνθρωπο «έγινε» για αρχείο που **έμεινε** όπως ήταν.
 */
function throwIfRefused(code: string, errors: readonly string[]): void {
  if (errors.length === 0) return;
  logger.error('File trash request refused for some files', { code, errors });
  throw new Error(`${code}: ${errors[0]}`);
}

/**
 * 🗑️ **Κάδος αρχείων ΕΝΟΣ διαμερίσματος — ένα αίτημα για όλη τη δέσμη** (ADR-845 §7.17 Α2 · ADR-920 §14.11 Ζ3b).
 *
 * 🔑 **Το γεγονός ΜΕΤΑ την επιβεβαίωση, και μόνο για ό,τι άλλαξε πραγματικά**: οι συνδρομητές
 * (`useLevelFloorplanSync` · `useEntityFiles` · `GlobalFileUploadToast` · `useFloorsTabState`)
 * αδειάζουν καμβά και λίστες — ένα `FILE_TRASHED` για αρχείο που ο διακομιστής **αρνήθηκε** θα
 * έσβηνε από την οθόνη κάτι που υπάρχει. Γι' αυτό πρώτα τα γεγονότα, μετά η ρίψη της άρνησης.
 */
async function trashFiles(fileIds: readonly string[], custody: CustodyKind, trashedBy: string): Promise<void> {
  if (fileIds.length === 0) return;
  const result = await requestFileTrash(fileIds, 'trash', custody);

  for (const file of result.files) {
    RealtimeService.dispatch('FILE_TRASHED', {
      fileId: file.fileId,
      trashedBy,
      purgeAt: file.purgeAt ?? undefined,
      displayName: file.displayName,
      entityId: file.entityId,
      entityType: file.entityType,
      timestamp: Date.now(),
    });
  }

  throwIfRefused('FILE_TRASH_REFUSED', result.errors);
}

/** ♻️ Επαναφορά αρχείου — ο διακομιστής κρίνει· το γεγονός μετά την επιβεβαίωση. */
async function restoreFile(fileId: string, custody: CustodyKind, restoredBy: string): Promise<void> {
  const result = await requestFileTrash([fileId], 'restore', custody);

  for (const file of result.files) {
    RealtimeService.dispatch('FILE_RESTORED', { fileId: file.fileId, restoredBy, timestamp: Date.now() });
  }

  throwIfRefused('FILE_RESTORE_REFUSED', result.errors);
}

/** Ένα αρχείο προς τον κάδο, **με το διαμέρισμά του** — το αποδεικνύει το ίδιο το έγγραφο. */
export interface TrashTarget {
  readonly id: string;
  readonly custody: CustodyKind;
}

/** Τα ids ενός διαμερίσματος από μια μεικτή επιλογή. */
function idsOf(targets: readonly TrashTarget[], custody: CustodyKind): string[] {
  return targets.filter((target) => target.custody === custody).map((target) => target.id);
}

/**
 * 🗑️ **Μαζικός κάδος** — **ένα** αίτημα ανά διαμέρισμα.
 *
 * 🔴 Ως την Α2 ήταν `Promise.all` ένα-ένα: 30 φωτογραφίες του ίδιου ακινήτου = 30 αιτήματα, και
 * με τον κάδο στον διακομιστή θα ήταν **30 επαναπροβολές της ίδιας αγγελίας**. Από το Ζ3b το ίδιο
 * ισχύει και για τα προσωπικά: 30 φωτογραφίες του φακέλου = **μία** επαναπροβολή της αγγελίας ιδιοκτήτη.
 */
export async function moveManyToTrash(targets: readonly TrashTarget[], trashedBy: string): Promise<void> {
  await Promise.all([
    trashFiles(idsOf(targets, 'company'), 'company', trashedBy),
    trashFiles(idsOf(targets, 'personal'), 'personal', trashedBy),
  ]);
}

/**
 * 🗑️ Move file to Trash (soft delete)
 * @enterprise Replaces hard delete with 3-tier lifecycle
 *
 * 🔴 **ΠΡΑΞΗ ΔΙΑΚΟΜΙΣΤΗ ΚΑΙ ΣΤΑ ΔΥΟ ΔΙΑΜΕΡΙΣΜΑΤΑ** (ADR-845 §7.17 Α2 · ADR-920 §14.11 Ζ3b): κρίση, γραφή,
 * γραμμή Δραστηριότητας και επαναπροβολή αγγελίας στο ίδιο αίτημα. Ο δεύτερος κάδος είναι ιδεμπότητος
 * (ADR-866 §2.6.11 Β3) — τον κρίνει πλέον ο διακομιστής, όχι μια ανάγνωση του browser.
 *
 * ⚠️ **Ο κάδος σημαίνει ΑΠΩΛΕΙΑ, και μόνο αυτό** (ADR-862 Φ0 Β10). Όταν το αρχείο φεύγει
 * επειδή **ήρθε νέα έκδοση**, κάλεσε το {@link supersedeFileRecord}: αρχειοθετεί (ποτέ
 * οριστική διαγραφή) μέσω του ΕΝΟΣ γραφέα του διακομιστή.
 */
export async function moveToTrash(fileId: string, custody: CustodyKind, trashedBy: string): Promise<void> {
  logger.info('Moving FileRecord to trash', { fileId, custody, trashedBy });
  await trashFiles([fileId], custody, trashedBy);
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
  logger.info('Restoring FileRecord from trash', { fileId, custody, restoredBy });
  // 🔴 ADR-845 §7.17 Α2 · ADR-920 §14.11 Ζ3b — ο διακομιστής (η επαναφορά υλικού αγγελίας το ξαναβγάζει στο κοινό).
  await restoreFile(fileId, custody, restoredBy);
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

// 🔴 ΔΙΑΓΡΑΦΗΚΕ 2026-09-20 (ADR-869 §7): `getFilesEligibleForPurge()`.
//
// Ήταν **δομικά ανίκανο** να κάνει αυτό που δήλωνε. Το σχόλιό του έλεγε «server-side», αλλά
// περνούσε από το `firestoreQueryService` (client SDK), όπου το `buildLeadingPaths` προσθέτει
// ΠΑΝΤΑ τους δρόμους ανάγνωσης του `files` (`cdeReadReach ==` / `createdBy ==`) από το
// `requireAuthContext().uid` — ταυτότητα που ένα cron **δεν έχει**. Το `tenantOverride:'skip'`
// μηδενίζει τον μισθωτή, **όχι** τους δρόμους.
//
// Μετρημένα: **0 καλούντες** σε όλο το δέντρο, και ζωντανή δοκιμή του πραγματικού του
// σχήματος (`cdeReadReach == · isDeleted == · purgeAt <=`) επιστρέφει `FAILED_PRECONDITION`.
// Ο ΕΝΑΣ ζωντανός εκκαθαριστής είναι το `src/lib/cron/jobs/file-purge.job.ts` (Admin SDK,
// χωρίς δρόμους ανάγνωσης) — και γι' αυτό του αρκεί ο δείκτης `(isDeleted, purgeAt)` που
// υπάρχει ήδη. Δύο εκκαθαριστές δεν χρειάζονται· χρειάζεται **ένας που δουλεύει**.
