/**
 * =============================================================================
 * STORAGE: ORPHAN FILE CLEANUP (onFinalize)
 * =============================================================================
 *
 * Triggered when a file upload completes in Firebase Storage.
 * Verifies that a corresponding FileRecord exists in Firestore.
 * If no FileRecord found → deletes the orphan file + logs alert.
 *
 * @enterprise Defense-in-depth — prevents orphan files from accumulating
 * @see Security Hardening Report 2026-04-08 (Ζήτημα 2)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();
const storage = admin.storage();

// SSoT: Collection names from centralized config
import { COLLECTIONS } from '../config/firestore-collections';
import { generateCloudAuditId } from '../config/enterprise-id';

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

    // Check if FileRecord exists in Firestore
    const docRef = db.collection(COLLECTIONS.FILES).doc(fileId);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      return;
    }

    // No FileRecord → orphan file. Delete it.
    functions.logger.warn('Orphan file detected — no FileRecord in Firestore. Deleting.', {
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
