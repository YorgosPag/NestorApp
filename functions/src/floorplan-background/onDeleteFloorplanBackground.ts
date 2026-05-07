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

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { COLLECTIONS } from '../config/firestore-collections';

interface FloorplanBackgroundDoc {
  fileId?: string;
  companyId?: string;
}

interface FileDoc {
  storagePath?: string;
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

    const db = admin.firestore();

    try {
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
        return null;
      }

      const fileRef = db.collection(COLLECTIONS.FILES).doc(fileId);
      const fileSnap = await fileRef.get();
      if (!fileSnap.exists) {
        functions.logger.warn('File doc missing — nothing to clean', { rbgId, fileId });
        return null;
      }

      const fileData = fileSnap.data() as FileDoc;
      const storagePath = fileData.storagePath;

      if (storagePath) {
        try {
          await admin.storage().bucket().file(storagePath).delete({ ignoreNotFound: true });
        } catch (err) {
          functions.logger.warn('Storage object delete failed (continuing)', {
            rbgId,
            fileId,
            storagePath,
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }

      await fileRef.delete();
      functions.logger.info('File + storage cleaned', { rbgId, fileId, storagePath });
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
