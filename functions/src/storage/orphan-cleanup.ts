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
 * @enterprise Defense-in-depth — prevents orphan files from accumulating
 * @see Security Hardening Report 2026-04-08 (Ζήτημα 2), ADR-312
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();
const storage = admin.storage();

// SSoT: Collection names + ownership resolver
import { COLLECTIONS } from '../config/firestore-collections';
import { generateCloudAuditId } from '../config/enterprise-id';
import { findFileOwner } from '../shared/file-ownership-resolver';

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

    const fileId = fileName.split('.')[0];
    if (!fileId) return;

    // Ownership lookup via SSoT resolver — checks every registered provider.
    const claim = await findFileOwner(db, fileId);
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
