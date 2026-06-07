/**
 * =============================================================================
 * 🏢 ENTERPRISE: Chunked Firestore batch-delete helper (server-only)
 * =============================================================================
 *
 * Single source of truth for "delete a list of document refs in batches".
 * Firestore caps a write batch at 500 ops; we chunk at 450 to leave headroom.
 *
 * Consumed by the floorplan replace/wipe services
 * (`floorplan-floor-wipe.service`, `floorplan-cascade-delete.service`,
 * `bim-floor-wipe.service`) — ends the copy-pasted `deleteRefsInChunks`.
 *
 * @module services/floorplan-background/firestore-batch-delete
 */

import 'server-only';

import type { Firestore } from '@/lib/firebaseAdmin';

/** Firestore batch hard limit is 500 ops; 450 leaves headroom. */
export const BATCH_DELETE_CHUNK = 450;

/**
 * Delete the given document refs in {@link BATCH_DELETE_CHUNK}-sized batches.
 * Returns the number of refs deleted. Idempotent on an empty list (no-op).
 */
export async function deleteRefsInChunks(
  db: Firestore,
  refs: FirebaseFirestore.DocumentReference[],
): Promise<number> {
  let deleted = 0;
  for (let i = 0; i < refs.length; i += BATCH_DELETE_CHUNK) {
    const chunk = refs.slice(i, i + BATCH_DELETE_CHUNK);
    const batch = db.batch();
    for (const ref of chunk) batch.delete(ref);
    await batch.commit();
    deleted += chunk.length;
  }
  return deleted;
}
