/**
 * =============================================================================
 * Η ΔΙΑΓΡΑΦΗ ΤΟΥ ΥΠΟΚΕΙΜΕΝΟΥ ΑΠΟ ΤΑ ΑΡΧΕΙΑ — ΓΚΠΔ άρθρο 17 (ADR-935 Στάδιο 1)
 * =============================================================================
 *
 * **Το ερώτημα**: *«σβήστε με» — τι σβήνεται, και τι μένει χωρίς εμένα;*
 *
 * | χώρος | υπεύθυνος επεξεργασίας | πράξη |
 * |---|---|---|
 * | προσωπικός (`files_personal`) | το Νέστωρ | **σβήσιμο** — bytes + επιτύμβιο (ό,τι ίσχυε) |
 * | εταιρικός (`files`) | η **εταιρεία** | **ανωνυμοποίηση** των πεδίων δράστη· το περιεχόμενο **μένει** |
 *
 * 🔴 **Γιατί (ADR-935 Ε1)**: η διαδρομή σάρωνε το εταιρικό διαμέρισμα κατά `createdBy` και **έσβηνε οριστικά** κάθε αρχείο που
 *   ανέβασε ο άνθρωπος — ο μηχανικός που έφευγε έπαιρνε μαζί του τις κατόψεις της εταιρείας.
 * 🌐 Microsoft (Azure DevOps: τα τεχνουργήματα **δεν** αλλάζουν με τη διαγραφή ταυτότητας) · Google Workspace (το περιεχόμενο
 *   **μεταφέρεται**) · Figma (ADR-892: οι συνεισφορές **μένουν**). Το ίχνος ακολουθούσε ήδη αυτό το δόγμα — τώρα και οι εγγραφές.
 *
 * 🔑 **Επαναλήψιμο (Ε2)**: δέσμες των `SAFE_BATCH_WRITES` (`flushInBatches` · `deleteInBatches`), και κάθε βήμα είναι ιδεμπότητο —
 *   ήδη `purged` ⇒ παραλείπεται· bytes που λείπουν ⇒ `'absent'`, όχι άρνηση. Δέσμη που αποτυγχάνει **αναφέρεται** (`errors`) και
 *   η ίδια κλήση ξανά ολοκληρώνει ό,τι έμεινε.
 * ⚠️ Αρχείο σε **δέσμευση** μένει **άθικτο** — και η απόδοσή του (άρθρο 17 §3: τεκμήριο).
 *
 * @module server/files/gdpr-erasure.server
 * @see services/file-record/file-subject-scan — οι σαρωτές υποκειμένου
 */

import 'server-only';

import type { DocumentData, Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { ERASED_SUBJECT } from '@/config/domain-constants';
import { deleteInBatches, flushInBatches, type BatchUpdate } from '@/lib/admin-batch-utils';
import { nowISO } from '@/lib/date-local';
import { FILE_COMPANION_POINTER_FIELDS } from '@/lib/files/file-companion-objects';
import { FILE_ACTOR_FIELDS, FILE_ACTOR_NAME_FIELDS } from '@/lib/files/file-actor-fields';
import { deleteStorageObjectForPurge, isFileHeld, purgedRecordFields } from '@/services/file-record/file-purge-helpers';
import {
  findSubjectActivity,
  findSubjectCompanyActorDocs,
  findSubjectFiles,
} from '@/services/file-record/file-subject-scan';
import { refreshListingsAfterFileChanges } from '@/services/listings/listing-media-refresh';

/** Τι έγινε — ανά πράξη, για την απάντηση και για τη γραμμή ίχνους της διαγραφής. */
export interface GdprErasureResults {
  filesDeleted: number;
  filesSkippedHold: number;
  companyFilesAnonymized: number;
  commentsAnonymized: number;
  sharesDeleted: number;
  auditAnonymized: number;
  activityDeleted: number;
}

export interface GdprErasureOutcome {
  readonly results: GdprErasureResults;
  readonly listings: Awaited<ReturnType<typeof refreshListingsAfterFileChanges>>;
  /** Δέσμες που απέτυχαν — μη κενό ⇒ η ίδια κλήση ξανά ολοκληρώνει (όλα τα βήματα ιδεμπότητα). */
  readonly errors: readonly string[];
}

/** Οι δείκτες προς συνοδευτικά (μικρογραφίες, σκηνές) μηδενίζονται μαζί με το `storagePath` — ίδιο μητρώο με τον γραφέα. */
const COMPANION_POINTERS_ERASED = Object.fromEntries(FILE_COMPANION_POINTER_FIELDS.map((field) => [field, null]));

/** Τιμή ένθετου πεδίου (`a.b`) — οι διαδρομές του `FILE_ACTOR_FIELDS` είναι αυτής της μορφής. */
function valueAt(data: DocumentData, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (node, key) => (node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined),
    data,
  );
}

/** Η διόρθωση μιας εγγραφής: **μόνο** τα πεδία όπου τιμή == υποκείμενο (+ το στιγμιότυπο ονόματός τους). Κενό ⇒ καμία. */
export function attributionErasure(data: DocumentData, uid: string): Record<string, string | null> {
  const patch: Record<string, string | null> = {};
  for (const field of FILE_ACTOR_FIELDS) {
    if (valueAt(data, field) !== uid) continue;
    patch[field] = ERASED_SUBJECT.ID;
    const nameField = FILE_ACTOR_NAME_FIELDS[field];
    if (nameField) patch[nameField] = null;
  }
  return patch;
}

/**
 * Εταιρικά αρχεία: ανωνυμοποίηση, **ποτέ** σβήσιμο. Καμία αλλαγή bytes ή `updatedAt` — η διόρθωση απόδοσης δεν είναι πράξη
 * πάνω στο αρχείο (ίδιο δόγμα με ADR-934 Μ-β6/Μ-β7).
 */
async function anonymizeCompanyFiles(
  db: Firestore,
  uid: string,
  retained: Set<string>,
): Promise<{ anonymized: number; held: number; errors: string[] }> {
  const updates: BatchUpdate[] = [];
  let held = 0;
  for (const doc of await findSubjectCompanyActorDocs(db, uid)) {
    const data = doc.data();
    if (isFileHeld(data)) {
      held++;
      retained.add(doc.id);
      continue;
    }
    const patch = attributionErasure(data, uid);
    if (Object.keys(patch).length > 0) updates.push({ ref: doc.ref, data: patch });
  }
  const flushed = await flushInBatches(db, updates, { collections: [COLLECTIONS.FILES] });
  return { anonymized: flushed.written, held, errors: flushed.errors };
}

/** Το επιτύμβιο ΓΚΠΔ ενός προσωπικού αρχείου — ίδιο με τον γραφέα του purge, έξω από το πρόγραμμα του cron. */
function gdprTombstone(): Record<string, unknown> {
  return {
    ...purgedRecordFields(nowISO()),
    displayName: '[GDPR DELETED]',
    description: null,
    downloadUrl: null,
    storagePath: null,
    ...COMPANION_POINTERS_ERASED,
    isDeleted: true,
    purgedBy: 'gdpr-erasure',
  };
}

/** Bytes πρώτα· άρνηση της πλατφόρμας (GCS hold) ⇒ η εγγραφή **δεν** γράφεται ως σβησμένη (ADR-864 §21). */
async function bytesErased(doc: QueryDocumentSnapshot): Promise<boolean> {
  const data = doc.data();
  const storagePath = data.storagePath as string | undefined;
  if (!storagePath) return true;
  return (await deleteStorageObjectForPurge({ ...data, fileId: doc.id, storagePath })) !== 'refused';
}

/** Προσωπικά αρχεία: σβήσιμο (ό,τι ίσχυε), τεμαχισμένο και ιδεμπότητο. */
async function purgePersonalFiles(
  db: Firestore,
  uid: string,
  retained: Set<string>,
): Promise<{ purged: DocumentData[]; written: number; held: number; errors: string[] }> {
  const personal = (await findSubjectFiles(db, uid)).filter(({ custody }) => custody === 'personal');
  const updates: BatchUpdate[] = [];
  const purged: DocumentData[] = [];
  let held = 0;
  for (const { doc } of personal) {
    const data = doc.data();
    if (data.lifecycleState === 'purged') continue;
    if (isFileHeld(data) || !(await bytesErased(doc))) {
      held++;
      retained.add(doc.id);
      continue;
    }
    updates.push({ ref: doc.ref, data: gdprTombstone() });
    purged.push(data);
  }
  const flushed = await flushInBatches(db, updates, { collections: [COLLECTIONS.FILES_PERSONAL] });
  return { purged, written: flushed.written, held, errors: flushed.errors };
}

/** Σχόλια (μόνο εταιρικά — το `file_comments` κρατά πάντα `companyId`): ο συντάκτης φεύγει, το κείμενο μένει στην εταιρεία. */
async function anonymizeComments(db: Firestore, uid: string): Promise<{ anonymized: number; errors: string[] }> {
  const [authored, resolved] = await Promise.all([
    // tenant-scope-exempt: αίτημα ΓΚΠΔ του ΙΔΙΟΥ του υποκειμένου — φίλτρο η επαληθευμένη ταυτότητα (`uid`).
    db.collection(COLLECTIONS.FILE_COMMENTS).where('authorId', '==', uid).get(),
    // tenant-scope-exempt: αίτημα ΓΚΠΔ του ΙΔΙΟΥ του υποκειμένου — φίλτρο η επαληθευμένη ταυτότητα (`uid`).
    db.collection(COLLECTIONS.FILE_COMMENTS).where('resolvedBy', '==', uid).get(),
  ]);
  const patches = new Map<string, BatchUpdate>();
  for (const doc of authored.docs) {
    patches.set(doc.id, { ref: doc.ref, data: { authorId: ERASED_SUBJECT.ID, authorName: ERASED_SUBJECT.DISPLAY_NAME } });
  }
  for (const doc of resolved.docs) {
    const prior = patches.get(doc.id)?.data ?? {};
    patches.set(doc.id, { ref: doc.ref, data: { ...prior, resolvedBy: ERASED_SUBJECT.ID } });
  }
  const flushed = await flushInBatches(db, [...patches.values()], { collections: [COLLECTIONS.FILE_COMMENTS] });
  return { anonymized: flushed.written, errors: flushed.errors };
}

/** Κοινοποιήσεις του υποκειμένου: **ανάκληση** — σύνδεσμος πρόσβασης που έδωσε άνθρωπος που έφυγε δεν μένει ενεργός. */
async function revokeShares(db: Firestore, uid: string): Promise<{ deleted: number; errors: string[] }> {
  // tenant-scope-exempt: αίτημα ΓΚΠΔ του ΙΔΙΟΥ του υποκειμένου — φίλτρο η επαληθευμένη ταυτότητα (`uid`).
  const shares = await db.collection(COLLECTIONS.FILE_SHARES).where(FIELDS.CREATED_BY, '==', uid).get();
  const flushed = await deleteInBatches(db, shares.docs.map((doc) => doc.ref), { collections: [COLLECTIONS.FILE_SHARES] });
  return { deleted: flushed.written, errors: flushed.errors };
}

/**
 * **Η δραστηριότητα του υποκειμένου** (ADR-866 §2.6.11): εταιρικό βιβλίο ⇒ ανωνυμοποίηση (ανήκει στην εταιρεία)· προσωπικό ⇒
 * σβήσιμο, **εκτός** από γραμμές αρχείων που μένουν (δέσμευση — μέρος του τεκμηρίου).
 */
async function eraseActivity(
  db: Firestore,
  uid: string,
  retained: ReadonlySet<string>,
): Promise<{ anonymized: number; deleted: number; errors: string[] }> {
  const anonymize: BatchUpdate[] = [];
  const remove: QueryDocumentSnapshot['ref'][] = [];
  for (const { custody, doc } of await findSubjectActivity(db, uid)) {
    if (custody === 'company') {
      anonymize.push({ ref: doc.ref, data: { performedBy: ERASED_SUBJECT.ID, performedByName: ERASED_SUBJECT.DISPLAY_NAME } });
    } else if (!retained.has(String(doc.data().fileId))) {
      remove.push(doc.ref);
    }
  }
  const [updated, deleted] = await Promise.all([
    flushInBatches(db, anonymize, { collections: [COLLECTIONS.FILE_AUDIT_LOG] }),
    deleteInBatches(db, remove, { collections: [COLLECTIONS.FILE_AUDIT_LOG_PERSONAL] }),
  ]);
  return { anonymized: updated.written, deleted: deleted.written, errors: [...updated.errors, ...deleted.errors] };
}

/**
 * **Η μία είσοδος**: διαγράφει το υποκείμενο από όλα τα αρχεία — με τη σειρά που κρατά το κοινό ειλικρινές: πρώτα οι εγγραφές,
 * αμέσως μετά η επαναπροβολή αγγελιών (σβησμένο υλικό δεν μένει δημόσιο αν αποτύχει κάτι παρακάτω), μετά τα υπόλοιπα.
 */
export async function eraseSubjectFromFiles(db: Firestore, uid: string): Promise<GdprErasureOutcome> {
  const retained = new Set<string>();
  const personal = await purgePersonalFiles(db, uid, retained);
  const company = await anonymizeCompanyFiles(db, uid, retained);
  const listings = await refreshListingsAfterFileChanges(db, personal.purged);
  const comments = await anonymizeComments(db, uid);
  const shares = await revokeShares(db, uid);
  const activity = await eraseActivity(db, uid, retained);
  return {
    results: {
      filesDeleted: personal.written,
      filesSkippedHold: personal.held + company.held,
      companyFilesAnonymized: company.anonymized,
      commentsAnonymized: comments.anonymized,
      sharesDeleted: shares.deleted,
      auditAnonymized: activity.anonymized,
      activityDeleted: activity.deleted,
    },
    listings,
    errors: [...personal.errors, ...company.errors, ...comments.errors, ...shares.errors, ...activity.errors],
  };
}
