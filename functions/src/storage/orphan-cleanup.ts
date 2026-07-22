/**
 * =============================================================================
 * STORAGE: ORPHAN FILE CLEANUP (onFinalize)
 * =============================================================================
 *
 * Triggered when a file upload completes in Firebase Storage.
 * Delegates ownership verification to the SSoT `findFileOwner()` resolver,
 * which checks every registered claim provider (FILES, FILE_SHARES, ...).
 * If no provider claims the fileId → orphan → delete + audit.
 *
 * WHY A RESOLVER (not a hardcoded FILES check):
 * Different domains own files in different collections (e.g. showcase PDFs
 * live only in FILE_SHARES per ADR-312). A single hardcoded check caused
 * the 2026-04-17 incident where legitimate showcase PDFs were deleted
 * milliseconds after upload. See `shared/file-ownership-resolver.ts`.
 *
 * WHY A GRACE WINDOW (not a single lookup):
 * Some producers write their ownership claim AFTER the bytes land — the
 * imported-mesh import uploads the `.glb` first, then a debounced auto-save
 * persists the entity docs whose `params.uploadId` is the claim (ADR-683 §11).
 * `onFinalize` fires on the upload, so a single synchronous lookup races the
 * claim write and mis-deletes the legitimate file (incident 2026-07-22 — same
 * class as 2026-04-17). We re-check with a short backoff before deleting.
 *
 * @enterprise Defense-in-depth — prevents orphan files from accumulating
 * @see Security Hardening Report 2026-04-08 (Ζήτημα 2), ADR-312, ADR-683 §11
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();
const storage = admin.storage();

// SSoT: Collection names + ownership resolver
import { COLLECTIONS } from '../config/firestore-collections';
import { generateCloudAuditId } from '../config/enterprise-id';
import { findFileOwner, type FileOwnershipClaim } from '../shared/file-ownership-resolver';

/**
 * Grace backoff (ms) applied ONLY on the null path — before each re-check, after
 * an unclaimed lookup (ADR-683 §11, incident 2026-07-22). A file with an eager
 * claim (canonical FILES record written with the upload) hits on the first,
 * zero-delay lookup and pays nothing. Only racing async-claims (imported meshes)
 * and genuine orphans wait; the latter are still deleted once the window closes.
 * Total ≤ 12s, well under the 30s function timeout.
 */
const ORPHAN_GRACE_BACKOFF_MS: readonly number[] = [2000, 4000, 6000];

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * SSoT ownership lookup with a grace window: re-check `findFileOwner` across the
 * backoff schedule so a claim written just after upload can still be seen before
 * we classify the file as an orphan. Returns the first claim found, or null once
 * every attempt (initial + all backoffs) comes back empty.
 */
async function findFileOwnerWithGrace(fileId: string): Promise<FileOwnershipClaim | null> {
  let claim = await findFileOwner(db, fileId);
  for (const backoff of ORPHAN_GRACE_BACKOFF_MS) {
    if (claim) return claim;
    await delay(backoff);
    claim = await findFileOwner(db, fileId);
  }
  return claim;
}

export const onStorageFinalize = functions
  .runWith({
    timeoutSeconds: 30,
    memory: '256MB',
  })
  .storage.object()
  .onFinalize(async (object) => {
    const filePath = object.name;
    if (!filePath) return;

    // Only check enterprise paths (companies/...) — temp/ and cad/ are excluded
    if (!filePath.startsWith('companies/')) return;

    // Extract fileId from path: .../files/{fileId}.{ext}
    const segments = filePath.split('/');
    const fileName = segments[segments.length - 1];
    if (!fileName) return;

    // Skip companion thumbnails — convention: {fileId}_thumb.{ext}
    // Their fileId (extracted below) would include '_thumb' suffix → no Firestore claim → false orphan.
    if (fileName.includes('_thumb.')) return;

    const fileId = fileName.split('.')[0];
    if (!fileId) return;

    // Ownership lookup via SSoT resolver — checks every registered provider,
    // with a grace window for producers that claim ownership AFTER upload
    // (imported meshes — ADR-683 §11). Genuine orphans fall through the window.
    const claim = await findFileOwnerWithGrace(fileId);
    if (claim) {
      return;
    }

    // No claim from any provider → orphan file. Delete it.
    functions.logger.warn('Orphan file detected — no ownership claim in any provider. Deleting.', {
      filePath,
      fileId,
      contentType: object.contentType,
      size: object.size,
    });

    try {
      const bucket = storage.bucket();
      await bucket.file(filePath).delete();

      const auditId = generateCloudAuditId();
      await db.collection(COLLECTIONS.CLOUD_FUNCTION_AUDIT_LOG).doc(auditId).set({
        action: 'ORPHAN_FILE_DELETED',
        entityType: 'file',
        entityId: fileId,
        performedBy: 'system_onFinalize',
        performedAt: admin.firestore.FieldValue.serverTimestamp(),
        details: {
          storagePath: filePath,
          contentType: object.contentType ?? null,
          size: object.size ?? null,
        },
        success: true,
      });
    } catch (error) {
      functions.logger.error('Failed to delete orphan file', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
