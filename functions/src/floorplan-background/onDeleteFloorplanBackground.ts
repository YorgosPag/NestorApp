/**
 * =============================================================================
 * CLOUD FUNCTION — onDeleteFloorplanBackground (ADR-340 Phase 7, D4)
 * =============================================================================
 *
 * Firestore `onDelete` trigger on `floorplan_backgrounds/{rbgId}`.
 *
 * Behavior:
 *   1. Read the deleted doc's `fileId`.
 *   2. Count remaining backgrounds referencing that fileId (across ALL companies).
 *      Phase 7 keeps the model strictly 1-background-per-file (no sharing), but
 *      we still ref-count defensively so future sharing patterns don't strand
 *      orphan binaries.
 *   3. If count == 0:
 *        a. Read `files/{fileId}.storagePath`
 *        b. Delete the Storage object
 *        c. Delete `files/{fileId}` Firestore doc
 *
 * Idempotent: deleting an already-cleaned file is a no-op (CF logs warn, returns).
 *
 * Why a CF and not inline in the API DELETE handler:
 *   - The API runs as the user; deleting `files/{fileId}` cross-references rules.
 *     A trigger runs as Admin and bypasses rules cleanly.
 *   - Failure isolation: if Storage cleanup fails, Firebase retries the trigger
 *     without blocking the user-facing DELETE.
 *
 * @module functions/floorplan-background/onDeleteFloorplanBackground
 * @enterprise ADR-340 Phase 7 — D4
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { COLLECTIONS } from '../config/firestore-collections';
import { fileRecordBucket } from '../storage/file-record-bucket';

interface FloorplanBackgroundDoc {
  fileId?: string;
  companyId?: string;
}

interface FileDoc {
  storagePath?: string;
  storagePlacement?: unknown;
}

/**
 * Διαγράφει τα bytes στον κάδο ΤΗΣ εγγραφής (ADR-895 Α7). Επιστρέφει `true` ΜΟΝΟ όταν
 * είναι ασφαλές να σβηστεί το `files/{fileId}` — τα bytes επιβεβαιωμένα έφυγαν, ή έλειπαν
 * ήδη ΕΚΕΙ που λέει η εγγραφή (404 στον σωστό κάδο). Οτιδήποτε άλλο (άγνωστη θέση, ή το
 * delete πέτυχε σφάλμα διαφορετικό από 404) ⇒ `false`: το `files/{fileId}` είναι ο ΜΟΝΟΣ
 * δείκτης προς τα bytes· αν σβηστεί ενώ τα bytes μένουν, χάνεται για πάντα (ADR-895 Ρ3).
 */
async function deleteStorageBytesHonestly(
  fileData: FileDoc,
  storagePath: string,
  ctx: { rbgId: string; fileId: string },
): Promise<boolean> {
  let bucket: ReturnType<ReturnType<typeof admin.storage>['bucket']>;
  try {
    bucket = fileRecordBucket(fileData);
  } catch (err) {
    functions.logger.warn('Unknown storage placement — keeping files/{id} for retry', {
      ...ctx,
      storagePath,
      err: err instanceof Error ? err.message : String(err),
    });
    return false;
  }

  try {
    await bucket.file(storagePath).delete();
    return true;
  } catch (err) {
    const code = (err as { code?: number } | undefined)?.code;
    if (code === 404) return true; // απόν ΕΚΕΙ που λέει η εγγραφή — ασφαλές (Α3)
    functions.logger.warn('Storage object delete failed — keeping files/{id} for retry', {
      ...ctx,
      storagePath,
      bucketName: bucket.name,
      err: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Ref-count `fileId` κατά της συλλογής `floorplan_backgrounds`· αν 0, σβήνει τα bytes
 * (στον κάδο ΤΗΣ εγγραφής, βλ. {@link deleteStorageBytesHonestly}) και το `files/{fileId}`.
 * Εξαγόμενο για να κρατήσει το ίδιο το trigger callback κάτω από 40 γραμμές (N.7.1).
 */
async function purgeFileIfUnreferenced(
  db: admin.firestore.Firestore,
  rbgId: string,
  fileId: string,
): Promise<void> {
  const remaining = await db
    .collection(COLLECTIONS.FLOORPLAN_BACKGROUNDS)
    .where('fileId', '==', fileId)
    .count()
    .get();

  if (remaining.data().count > 0) {
    functions.logger.info('File still referenced — keeping', {
      rbgId,
      fileId,
      remaining: remaining.data().count,
    });
    return;
  }

  const fileRef = db.collection(COLLECTIONS.FILES).doc(fileId);
  const fileSnap = await fileRef.get();
  if (!fileSnap.exists) {
    functions.logger.warn('File doc missing — nothing to clean', { rbgId, fileId });
    return;
  }

  const fileData = fileSnap.data() as FileDoc;
  const storagePath = fileData.storagePath;

  if (storagePath) {
    const safeToDeleteDoc = await deleteStorageBytesHonestly(fileData, storagePath, { rbgId, fileId });
    if (!safeToDeleteDoc) return;
  }

  await fileRef.delete();
  functions.logger.info('File + storage cleaned', { rbgId, fileId, storagePath });
}

export const onDeleteFloorplanBackground = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .firestore.document(`${COLLECTIONS.FLOORPLAN_BACKGROUNDS}/{rbgId}`)
  .onDelete(async (snap, context) => {
    const rbgId = context.params.rbgId as string;
    const data = snap.data() as FloorplanBackgroundDoc | undefined;
    const fileId = data?.fileId;
    if (!fileId) {
      functions.logger.warn('onDeleteFloorplanBackground: no fileId on deleted doc', { rbgId });
      return null;
    }

    try {
      await purgeFileIfUnreferenced(admin.firestore(), rbgId, fileId);
      return null;
    } catch (err) {
      functions.logger.error('onDeleteFloorplanBackground failed', {
        rbgId,
        fileId,
        err: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  });
