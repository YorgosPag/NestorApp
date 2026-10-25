import 'server-only';

/**
 * @fileoverview **Η ΔΕΥΤΕΡΗ ΠΗΓΗ ΣΗΜΑΔΙΩΝ του mark-and-sweep** (ADR-694 Α1 · ADR-916 Ο24).
 * @related lib/files/storage-orphan-candidate.ts (κλειδί + σχήμα — ο ΙΔΙΟΣ κώδικας με το finalize των Cloud Functions) ·
 *          functions/src/storage/orphan-sweeper.ts (ο ΜΟΝΟΣ που σβήνει)
 * @module server/storage/orphan-candidate-mark.server
 *
 * Το finalize σημαδεύει ό,τι **γράφεται**· δεν βλέπει ποτέ bytes που έμειναν ορφανά επειδή το έγγραφό τους σβήστηκε **εκτός**
 * εφαρμογής. Εδώ η εφαρμογή σημαδεύει **ένα** τέτοιο αντικείμενο, αφού έλυσε τη διατήρησή του — Purview: *eligible for the
 * standard cleanup process*. ⛔ **Καμία διαγραφή εδώ**: ο sweeper ξαναρωτά την κηδεμονία (Φράγμα 4) μετά από 7 ημέρες.
 *
 * 🔑 `firstSeenAt` **μόνο την πρώτη φορά**, σε συναλλαγή: δύο εκτελέσεις δεν «ξαναγεννούν» την ωρίμανση.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FieldValue, getAdminFirestore } from '@/lib/firebaseAdmin';
import type { FileStoragePlacement } from '@/lib/files/file-storage-placement';
import { candidateDocId, orphanCandidateFields } from '@/lib/files/storage-orphan-candidate';
import { fileStorageBucketNames } from '@/server/files/file-record-bucket';

export interface OrphanedFileObject {
  readonly placement: FileStoragePlacement;
  readonly path: string;
  readonly size: number;
  /** Το id της `FileRecord` που κατείχε το όνομα (κανόνας `files`) — μόνο για το log του καλούντος. */
  readonly fileId: string;
}

/** **Σημάδεψε** ένα αντικείμενο ως ορφανό κατά τον κανόνα `files` — ιδεμπότητο. */
export async function markOrphanedFileObject(object: OrphanedFileObject): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.STORAGE_ORPHAN_CANDIDATES).doc(candidateDocId(object.path, object.placement));
  const bucket = fileStorageBucketNames()[object.placement];
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    const fields = orphanCandidateFields(
      { storagePath: object.path, bucket, contentType: null, size: object.size },
      { kind: 'orphaned', rule: 'files' },
      FieldValue.serverTimestamp(),
    );
    tx.set(ref, { ...fields, ...(existing.exists ? {} : { firstSeenAt: FieldValue.serverTimestamp() }) }, { merge: true });
  });
}
