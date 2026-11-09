import 'server-only';

/**
 * =============================================================================
 * ΤΟ ΔΙΧΤΥ ΤΗΣ ΚΑΡΑΝΤΙΝΑΣ ΜΕΣΩΝ (ADR-934 §5.2.2 Μ-β5) — ό,τι έχασε ο κύριος δρόμος
 * =============================================================================
 *
 * Ο κύριος δρόμος αποδεσμεύει στο τέλος της παρτίδας (`releaseFinishedBatchMedia`). Δύο τρόποι να χαθεί:
 *   **Α** — η εγκατάλειψη/το κλείσιμο έγινε, η αποδέσμευση όχι (βλάβη ανάμεσα) ⇒ παρτίδες `closed`/`discarded` που άλλαξαν μέσα
 *          στο παράθυρο ⇒ `releaseBatchMedia` ξανά (ιδεμπότητο).
 *   **Β** — περιεχόμενο που κρατήθηκε αλλά **καμία** λήψη δεν το αναφέρει (βλάβη ανάμεσα σε καραντίνα και κλείσιμο λήψης) ⇒
 *          ορφανό, πρότυπο Akeneo `purge-orphans-file-info` ⇒ κάδος, μόνο αν είναι αρκετά παλιό ώστε να μην είναι λήψη σε εξέλιξη.
 *
 * 🔑 **Παράθυρα, όχι σημαίες**: καμία νέα στήλη στην παρτίδα (που θα έγραφε αναθεώρηση και ίχνος οντότητας για θόρυβο). Το
 *   παράθυρο επικαλύπτει **εννέα** εκτελέσεις, άρα χαμένες μέρες καλύπτονται — και ο monitor του ADR-740 φωνάζει από την πρώτη.
 *   Κάθε κρίση είναι ιδεμπότητη, άρα η επικάλυψη δεν κοστίζει τίποτα πέρα από αναγνώσεις.
 * 🔑 Η οριστική διαγραφή **δεν** ζει εδώ: ο κάδος αδειάζει από τη μία αγωγό (`file-purge`).
 *
 * @module server/catalog/media-quarantine-sweep.server
 */

import type { Firestore } from 'firebase-admin/firestore';

import { ENTITY_TYPES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_COLLECTION } from '@/lib/files/file-custody';
import { IMPORT_FINISHED_BATCH_STATUSES } from '@/subapps/catalog/vocabulary/catalog-import';
import { mediaContentHold, releaseBatchMedia, trashQuarantinedContent } from './media-quarantine-release.server';

const DAY_MS = 86_400_000;

/** Α: παρτίδες που τελείωσαν πριν από [1, 10] ημέρες — η μία ημέρα αφήνει τον κύριο δρόμο να τελειώσει πρώτος. */
export const SWEEP_BATCH_WINDOW_DAYS = { from: 10, to: 1 } as const;
/** Β: ορφανά που γεννήθηκαν πριν από [7, 10] ημέρες — η εβδομάδα ξεχωρίζει το ορφανό από τη λήψη που μόλις έγινε. */
export const SWEEP_ORPHAN_WINDOW_DAYS = { from: 10, to: 7 } as const;
/** Πόσα έγγραφα ανά φάση και εκτέλεση — ό,τι μείνει το πιάνει η επόμενη (το παράθυρο επικαλύπτει). */
export const SWEEP_PAGE_LIMIT = 200;

export interface MediaQuarantineSweepMetrics {
  readonly batches: number;
  readonly released: number;
  readonly held: number;
  readonly orphansChecked: number;
  readonly orphansReleased: number;
}

const windowOf = (nowMs: number, window: { readonly from: number; readonly to: number }) =>
  ({ from: new Date(nowMs - window.from * DAY_MS), to: new Date(nowMs - window.to * DAY_MS) });

/** Α — παρτίδες που τελείωσαν μέσα στο παράθυρο. */
async function sweepFinishedBatches(db: Firestore, nowMs: number): Promise<Pick<MediaQuarantineSweepMetrics, 'batches' | 'released' | 'held'>> {
  const { from, to } = windowOf(nowMs, SWEEP_BATCH_WINDOW_DAYS);
  // tenant-scope-exempt: εργασία συστήματος (cron) που σαρώνει τις παρτίδες **κάθε** χώρου εκ σχεδιασμού — κανείς άνθρωπος δεν
  // «ζητά» την αποδέσμευση· την επιβάλλει ο κύκλος ζωής. Ο χώρος κάθε παρτίδας ταξιδεύει από το ίδιο της το έγγραφο.
  const snapshot = await db.collection(COLLECTIONS.CATALOG_IMPORT_BATCHES)
    .where('status', 'in', [...IMPORT_FINISHED_BATCH_STATUSES])
    .where('updatedAt', '>=', from.toISOString())
    .where('updatedAt', '<=', to.toISOString())
    .limit(SWEEP_PAGE_LIMIT)
    .get();
  let released = 0;
  let held = 0;
  for (const doc of snapshot.docs) {
    const companyId = doc.data().companyId;
    if (typeof companyId !== 'string' || companyId === '') continue;
    const tally = await releaseBatchMedia(companyId, doc.id);
    released += tally.released;
    held += tally.held;
  }
  return { batches: snapshot.size, released, held };
}

/** Β — ζωντανά περιεχόμενα καραντίνας του παραθύρου που **καμία** λήψη δεν αναφέρει. */
async function sweepOrphanContents(db: Firestore, nowMs: number): Promise<Pick<MediaQuarantineSweepMetrics, 'orphansChecked' | 'orphansReleased'>> {
  const { from, to } = windowOf(nowMs, SWEEP_ORPHAN_WINDOW_DAYS);
  // tenant-scope-exempt: εργασία συστήματος (cron) σε **κάθε** χώρο εκ σχεδιασμού· ο χώρος έρχεται από την ίδια την εγγραφή
  // και ξανακρίνεται από τον κριτή κατάστασης μέσα στη συναλλαγή του κάδου.
  const snapshot = await db.collection(COLLECTIONS[FILE_COLLECTION.company])
    .where('entityType', '==', ENTITY_TYPES.CATALOG_MEDIA_CONTENT)
    .where('isDeleted', '==', false)
    .where('createdAt', '>=', from)
    .where('createdAt', '<=', to)
    .limit(SWEEP_PAGE_LIMIT)
    .get();
  let orphansReleased = 0;
  for (const doc of snapshot.docs) {
    const { companyId, entityId } = doc.data();
    if (typeof companyId !== 'string' || typeof entityId !== 'string') continue;
    if ((await mediaContentHold(companyId, doc.id)) !== 'none') continue;
    if (await trashQuarantinedContent({ companyId, reason: 'orphan' }, doc.id, entityId)) orphansReleased++;
  }
  return { orphansChecked: snapshot.size, orphansReleased };
}

/** **Το πέρασμα** — οι δύο φάσεις απαντούν σε διαφορετικό ερώτημα, άρα τρέχουν παράλληλα (πρότυπο `file-purge`). */
export async function sweepMediaQuarantine(db: Firestore, nowMs: number): Promise<MediaQuarantineSweepMetrics> {
  const [batches, orphans] = await Promise.all([sweepFinishedBatches(db, nowMs), sweepOrphanContents(db, nowMs)]);
  return { ...batches, ...orphans };
}
