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
 *   3. If count == 0: hand `files/{fileId}` to the ONE purge pipeline — trash fields with
 *      `purgeAt = now` (`lib/files/file-trash-fields`). The app cron (`file-purge.job`) then
 *      purges it through `purgeFileRecord`: hold judge (`isFileHeld`) · original **and every
 *      companion** (thumbnails, scenes — ADR-899 §2.2) · refusal ⇒ retried next run · tombstone
 *      + activity row in the owner's book.
 *
 * 🔴 ADR-899 §2.2 (2026-10-31): until then this trigger deleted ONLY `storagePath` and then the
 *    `files/{fileId}` doc itself — the companions lost their last pointer and survived forever
 *    (the orphan marker skips companion names by design: "their parent's purge deletes them"),
 *    and no hold was consulted (a held / preserved / record file was deleted outright).
 *
 * Idempotent: a record already in the queue (`isDeleted`) — trashed by a person with its own
 * retention, or already purged — is left exactly as it is.
 *
 * Why a CF and not inline in the API DELETE handler:
 *   - The API runs as the user; deleting `files/{fileId}` cross-references rules.
 *     A trigger runs as Admin and bypasses rules cleanly.
 *   - Failure isolation: if the hand-off fails, Firebase retries the trigger
 *     without blocking the user-facing DELETE.
 *
 * @module functions/floorplan-background/onDeleteFloorplanBackground
 * @enterprise ADR-340 Phase 7 — D4 · ADR-899 §2.2
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { COLLECTIONS } from '../config/firestore-collections';
import { FILE_LIFECYCLE_STATES } from '../generated/config/file-lifecycle-states';
import { fileTrashFields } from '../generated/lib/files/file-trash-fields';

interface FloorplanBackgroundDoc {
  fileId?: string;
  companyId?: string;
}

/** Ο δράστης στο ίχνος — ίδιο ιδίωμα με το `system:cron-purge` του γραφέα. */
export const FLOORPLAN_BACKGROUND_TRASH_ACTOR = 'system:floorplan-background';

/**
 * Ref-count `fileId` κατά της συλλογής `floorplan_backgrounds`· αν 0, το `files/{fileId}` μπαίνει στην ουρά της ΜΙΑΣ
 * αγωγού εκκαθάρισης. Εξαγόμενο για να κρατήσει το ίδιο το trigger callback κάτω από 40 γραμμές (N.7.1).
 */
async function handUnreferencedFileToPurge(
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

  if (fileSnap.get('isDeleted') === true) {
    functions.logger.info('File already in the purge queue — left as it is', { rbgId, fileId });
    return;
  }

  await fileRef.update(
    fileTrashFields({
      trashedState: FILE_LIFECYCLE_STATES.TRASHED,
      by: FLOORPLAN_BACKGROUND_TRASH_ACTOR,
      purgeAt: new Date().toISOString(),
      now: admin.firestore.FieldValue.serverTimestamp(),
    }),
  );
  functions.logger.info('File handed to the purge pipeline', { rbgId, fileId });
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
      await handUnreferencedFileToPurge(admin.firestore(), rbgId, fileId);
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
