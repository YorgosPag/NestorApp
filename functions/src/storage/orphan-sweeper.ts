/**
 * =============================================================================
 * STORAGE: ORPHAN SWEEPER (scheduled) — ADR-694 Απόφαση Α3
 * =============================================================================
 *
 * Η πλευρά «sweep» του mark-and-sweep, και **ο μοναδικός κώδικας σε ολόκληρο το
 * σύστημα που επιτρέπεται να διαγράψει αντικείμενο Storage αυτόματα**.
 *
 * ## Τέσσερις σωρευτικές προϋποθέσεις — όλες υποχρεωτικές
 *
 *   1. **Ρητή άδεια λειτουργίας** (`ORPHAN_SWEEP_ENABLED === 'true'`). Χωρίς αυτή
 *      τρέχει σε **dry-run**: μετρά και καταγράφει τι ΘΑ έσβηνε, χωρίς να αγγίξει
 *      τίποτα. Ένας νέος destructive automaton δεν ξεκινά ποτέ «ζωντανός» —
 *      πρώτα αποδεικνύει τι θα έκανε.
 *   2. **Θετική απόδειξη ορφανότητας** (`custodyKind === 'orphaned'`): ρητός κανόνας
 *      custody αναγνώρισε το path ΚΑΙ ο ιδιοκτήτης δεν υπάρχει. Το `unknown` δεν
 *      φτάνει ποτέ εδώ.
 *   3. **Ωρίμανση** ≥ {@link RETENTION_DAYS} ημέρες από την **πρώτη** παρατήρηση.
 *   4. **Επανέλεγχος τη στιγμή της διαγραφής** — το σημάδι μπορεί να είναι ημερών·
 *      ο ιδιοκτήτης μπορεί να δημιουργήθηκε στο μεταξύ. Χωρίς αυτό, ο sweeper θα
 *      ενεργούσε πάνω σε μπαγιάτικη γνώση.
 *
 * ## Πρότυπα
 *
 * - **GitLab LFS**: orphan cleanup = **ημερήσιο batch**, DB-first, ποτέ per-upload.
 * - **Docker/OCI registry GC**: mark και sweep είναι ΔΥΟ ξεχωριστά, auditable στάδια·
 *   ταυτόχρονη σάρωση+διαγραφή με ενεργά uploads = τεκμηριωμένος κίνδυνος διαφθοράς.
 * - **AWS S3**: retention 7 ημερών ακόμη και για αναμφισβήτητα ορφανά multipart uploads.
 *
 * ## Τι μένει ως τελευταίο δίχτυ
 *
 * Ο bucket έχει **soft delete 7 ημερών** (`retentionDurationSeconds: 604800`). Ακόμη
 * και μια λανθασμένη διαγραφή από εδώ είναι ανακτήσιμη. **ΜΗΝ το απενεργοποιήσεις.**
 *
 * @module functions/storage/orphan-sweeper
 * @enterprise ADR-694 Α3 — ο μόνος destructive δρόμος, με 4 φράγματα
 * @see ./storage-path-custody.ts — η απόδειξη ορφανότητας
 * @see ./orphan-cleanup.ts — η πλευρά «mark»
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

import { COLLECTIONS } from '../config/firestore-collections';
import { generateCloudAuditId } from '../config/enterprise-id';
import { resolveCustody } from './storage-path-custody';

/** Ημέρες ωρίμανσης πριν ένας υποψήφιος γίνει επιλέξιμος (S3 lifecycle parity). */
const RETENTION_DAYS = 7;

/** Ανώτατο πλήθος διαγραφών ανά εκτέλεση — μια regression δεν αδειάζει τον bucket. */
const MAX_DELETIONS_PER_RUN = 50;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Το πόρισμα μιας εκτέλεσης (επιστρέφεται για tests/observability). */
export interface SweepSummary {
  readonly examined: number;
  readonly deleted: number;
  readonly healed: number;
  readonly skipped: number;
  readonly dryRun: boolean;
}

/** Χωρίς ρητό opt-in ο sweeper παρατηρεί μόνο. Default = **ασφαλές**. */
function isSweepEnabled(): boolean {
  return process.env.ORPHAN_SWEEP_ENABLED === 'true';
}

/** Γράφει την εγγραφή ελέγχου της διαγραφής (τροφοδοτεί το ADR-327 spike alert). */
async function writeAudit(
  db: admin.firestore.Firestore,
  filePath: string,
  ownerId: string,
  rule: string,
): Promise<void> {
  await db
    .collection(COLLECTIONS.CLOUD_FUNCTION_AUDIT_LOG)
    .doc(generateCloudAuditId())
    .set({
      action: 'ORPHAN_FILE_DELETED',
      entityType: 'file',
      entityId: ownerId,
      performedBy: 'system_orphanSweeper',
      performedAt: admin.firestore.FieldValue.serverTimestamp(),
      details: { storagePath: filePath, custodyRule: rule, retentionDays: RETENTION_DAYS },
      success: true,
    });
}

/**
 * Επεξεργάζεται ΕΝΑΝ ώριμο υποψήφιο. Επιστρέφει τι συνέβη, ώστε ο caller να μετρά
 * χωρίς να ξέρει λεπτομέρειες.
 */
async function sweepOne(
  db: admin.firestore.Firestore,
  bucket: ReturnType<ReturnType<typeof admin.storage>['bucket']>,
  doc: admin.firestore.QueryDocumentSnapshot,
  dryRun: boolean,
): Promise<'deleted' | 'healed' | 'skipped'> {
  const filePath = doc.get('storagePath') as string | undefined;
  if (!filePath) {
    await doc.ref.delete();
    return 'skipped';
  }

  // Φράγμα 4 — επανέλεγχος. Το σημάδι είναι ημερών· ο κόσμος μπορεί να άλλαξε.
  const custody = await resolveCustody(db, filePath);
  if (custody.kind !== 'orphaned') {
    await doc.ref.delete();
    functions.logger.info('OrphanSweeper: candidate no longer orphaned, released', {
      filePath,
      custodyKind: custody.kind,
    });
    return 'healed';
  }

  if (dryRun) {
    functions.logger.warn('OrphanSweeper: DRY-RUN would delete', {
      filePath,
      custodyRule: custody.rule,
      ownerId: custody.ownerId,
    });
    return 'skipped';
  }

  await bucket.file(filePath).delete();
  await writeAudit(db, filePath, custody.ownerId, custody.rule);
  await doc.ref.delete();
  functions.logger.warn('OrphanSweeper: orphan reclaimed', {
    filePath,
    custodyRule: custody.rule,
    ownerId: custody.ownerId,
  });
  return 'deleted';
}

/**
 * Ο πυρήνας, εξαγόμενος ώστε να ελέγχεται χωρίς scheduler. Σαρώνει τους ώριμους
 * `orphaned` υποψηφίους και εφαρμόζει τα φράγματα 2–4.
 */
export async function runOrphanSweep(
  db: admin.firestore.Firestore,
  storage: ReturnType<typeof admin.storage>,
  now: Date,
): Promise<SweepSummary> {
  const dryRun = !isSweepEnabled();
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * MS_PER_DAY);

  const snap = await db
    .collection(COLLECTIONS.STORAGE_ORPHAN_CANDIDATES)
    .where('custodyKind', '==', 'orphaned')
    .where('firstSeenAt', '<=', admin.firestore.Timestamp.fromDate(cutoff))
    .limit(MAX_DELETIONS_PER_RUN)
    .get();

  const bucket = storage.bucket();
  let deleted = 0;
  let healed = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    try {
      const result = await sweepOne(db, bucket, doc, dryRun);
      if (result === 'deleted') deleted += 1;
      else if (result === 'healed') healed += 1;
      else skipped += 1;
    } catch (error) {
      skipped += 1;
      functions.logger.error('OrphanSweeper: failed to process candidate', {
        docId: doc.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const summary: SweepSummary = { examined: snap.size, deleted, healed, skipped, dryRun };
  functions.logger.info('OrphanSweeper: run complete', { ...summary, retentionDays: RETENTION_DAYS });
  return summary;
}

export const orphanSweeper = functions
  .runWith({ timeoutSeconds: 540, memory: '256MB' })
  .pubsub.schedule('30 3 * * *')
  .timeZone('UTC')
  .onRun(async () => {
    await runOrphanSweep(admin.firestore(), admin.storage(), new Date());
    return null;
  });
