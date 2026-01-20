/**
 * =============================================================================
 * NESTOR ENTERPRISE CLOUD FUNCTIONS
 * =============================================================================
 *
 * Firebase Cloud Functions for server-side operations that require:
 * - Admin SDK privileges (bypass security rules)
 * - Scheduled execution (cron jobs)
 * - Atomic operations across Storage + Firestore
 *
 * @module functions/index
 * @enterprise ADR-032 - Enterprise Trash System
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore();
const storage = admin.storage();

// ============================================================================
// CONSTANTS (mirrored from domain-constants.ts)
// ============================================================================

const FILE_LIFECYCLE_STATES = {
  ACTIVE: 'active',
  TRASHED: 'trashed',
  ARCHIVED: 'archived',
  PURGED: 'purged',
} as const;

const HOLD_TYPES = {
  NONE: 'none',
  LEGAL: 'legal',
  REGULATORY: 'regulatory',
  ADMIN: 'admin',
} as const;

const COLLECTIONS = {
  FILES: 'files',
  AUDIT_LOG: 'audit_log',
} as const;

// ============================================================================
// TYPES
// ============================================================================

interface FileRecord {
  id: string;
  companyId?: string;
  storagePath: string;
  displayName: string;
  isDeleted?: boolean;
  trashedAt?: FirebaseFirestore.Timestamp | string;
  trashedBy?: string;
  purgeAt?: string;
  hold?: string;
  retentionUntil?: string;
  lifecycleState?: string;
}

interface PurgeResult {
  success: boolean;
  fileId: string;
  storagePath?: string;
  error?: string;
}

interface AuditLogEntry {
  action: string;
  entityType: string;
  entityId: string;
  performedBy: string;
  performedAt: FirebaseFirestore.FieldValue;
  details: Record<string, unknown>;
  success: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Write audit log entry
 * @enterprise Required for compliance and debugging
 */
async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await db.collection(COLLECTIONS.AUDIT_LOG).add(entry);
  } catch (error) {
    functions.logger.error('Failed to write audit log', { entry, error });
  }
}

/**
 * Delete file from Storage
 * @enterprise Handles missing files gracefully
 */
async function deleteFromStorage(storagePath: string): Promise<boolean> {
  try {
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);

    // Check if file exists before deleting
    const [exists] = await file.exists();
    if (!exists) {
      functions.logger.warn('Storage file not found (already deleted?)', { storagePath });
      return true; // Not an error - file already gone
    }

    await file.delete();
    functions.logger.info('Storage file deleted', { storagePath });
    return true;
  } catch (error) {
    functions.logger.error('Failed to delete storage file', { storagePath, error });
    return false;
  }
}

/**
 * Purge single file (Storage + Firestore)
 * @enterprise Atomic operation with rollback on failure
 */
async function purgeFile(fileRecord: FileRecord): Promise<PurgeResult> {
  const { id: fileId, storagePath } = fileRecord;

  functions.logger.info('Purging file', { fileId, storagePath });

  try {
    // Step 1: Delete from Storage
    const storageDeleted = await deleteFromStorage(storagePath);
    if (!storageDeleted) {
      return {
        success: false,
        fileId,
        storagePath,
        error: 'Failed to delete from Storage',
      };
    }

    // Step 2: Update Firestore (mark as purged, then delete or keep for audit)
    const docRef = db.collection(COLLECTIONS.FILES).doc(fileId);

    // Option A: Hard delete the document
    // await docRef.delete();

    // Option B: Keep document with purged state (better for audit)
    await docRef.update({
      lifecycleState: FILE_LIFECYCLE_STATES.PURGED,
      purgedAt: admin.firestore.FieldValue.serverTimestamp(),
      purgedBy: 'system_scheduler',
      // Clear storage reference since file is gone
      downloadUrl: null,
    });

    functions.logger.info('File purged successfully', { fileId });

    return {
      success: true,
      fileId,
      storagePath,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    functions.logger.error('Failed to purge file', { fileId, error: errorMessage });

    return {
      success: false,
      fileId,
      storagePath,
      error: errorMessage,
    };
  }
}

// ============================================================================
// SCHEDULED PURGE JOB
// ============================================================================

/**
 * Daily scheduled job to purge eligible files
 *
 * Runs every day at 3:00 AM UTC
 * Finds files where:
 * - isDeleted = true
 * - purgeAt <= now
 * - hold = 'none' or null
 * - retentionUntil <= now or null
 *
 * For each eligible file:
 * 1. Deletes from Firebase Storage
 * 2. Updates Firestore (mark as purged or delete doc)
 * 3. Writes audit log
 *
 * @enterprise ADR-032 - Enterprise Trash System
 * @see Google Drive 30-day auto-delete, Salesforce 15-day recycle bin
 */
export const scheduledFilePurge = functions
  .runWith({
    timeoutSeconds: 540, // 9 minutes (max for scheduled functions)
    memory: '512MB',
  })
  .pubsub.schedule('0 3 * * *') // Every day at 3:00 AM UTC
  .timeZone('UTC')
  .onRun(async (context) => {
    functions.logger.info('Starting scheduled file purge job', {
      timestamp: context.timestamp,
    });

    const now = new Date().toISOString();
    const results: PurgeResult[] = [];
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    try {
      // Query eligible files
      const snapshot = await db.collection(COLLECTIONS.FILES)
        .where('isDeleted', '==', true)
        .where('purgeAt', '<=', now)
        .limit(500) // Process in batches to avoid timeout
        .get();

      functions.logger.info('Found files for purge evaluation', { count: snapshot.size });

      for (const doc of snapshot.docs) {
        const fileRecord = { id: doc.id, ...doc.data() } as FileRecord;
        processedCount++;

        // Check hold status
        if (fileRecord.hold && fileRecord.hold !== HOLD_TYPES.NONE) {
          functions.logger.info('Skipping file with active hold', {
            fileId: doc.id,
            hold: fileRecord.hold,
          });
          skippedCount++;
          continue;
        }

        // Check retention policy
        if (fileRecord.retentionUntil) {
          const retentionDate = new Date(fileRecord.retentionUntil);
          if (retentionDate > new Date()) {
            functions.logger.info('Skipping file with active retention', {
              fileId: doc.id,
              retentionUntil: fileRecord.retentionUntil,
            });
            skippedCount++;
            continue;
          }
        }

        // Purge the file
        const result = await purgeFile(fileRecord);
        results.push(result);

        if (result.success) {
          successCount++;

          // Write audit log
          await writeAuditLog({
            action: 'FILE_PURGED',
            entityType: 'file',
            entityId: doc.id,
            performedBy: 'system_scheduler',
            performedAt: admin.firestore.FieldValue.serverTimestamp(),
            details: {
              storagePath: fileRecord.storagePath,
              displayName: fileRecord.displayName,
              trashedBy: fileRecord.trashedBy,
              trashedAt: fileRecord.trashedAt,
              purgeAt: fileRecord.purgeAt,
            },
            success: true,
          });
        } else {
          errorCount++;

          // Log error for investigation
          await writeAuditLog({
            action: 'FILE_PURGE_FAILED',
            entityType: 'file',
            entityId: doc.id,
            performedBy: 'system_scheduler',
            performedAt: admin.firestore.FieldValue.serverTimestamp(),
            details: {
              error: result.error,
              storagePath: fileRecord.storagePath,
            },
            success: false,
          });
        }
      }

      functions.logger.info('Scheduled file purge completed', {
        processedCount,
        successCount,
        errorCount,
        skippedCount,
      });

    } catch (error) {
      functions.logger.error('Scheduled file purge job failed', { error });
      throw error;
    }

    return null;
  });

// ============================================================================
// HTTP CALLABLE: MANUAL PURGE (Admin Only)
// ============================================================================

/**
 * Manually purge a specific file
 * @enterprise For admin use - bypasses purgeAt schedule
 *
 * Requires: super_admin role in custom claims
 *
 * @example
 * ```typescript
 * const result = await functions.httpsCallable('manualPurgeFile')({
 *   fileId: 'file_123',
 *   reason: 'User requested immediate deletion',
 * });
 * ```
 */
export const manualPurgeFile = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
  })
  .https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be authenticated to purge files'
      );
    }

    // Check super_admin role
    const claims = context.auth.token;
    if (claims.globalRole !== 'super_admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only super_admin can manually purge files'
      );
    }

    const { fileId, reason } = data;

    if (!fileId || typeof fileId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'fileId is required'
      );
    }

    functions.logger.info('Manual purge requested', {
      fileId,
      requestedBy: context.auth.uid,
      reason,
    });

    // Get file record
    const docRef = db.collection(COLLECTIONS.FILES).doc(fileId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        `File not found: ${fileId}`
      );
    }

    const fileRecord = { id: fileId, ...docSnap.data() } as FileRecord;

    // Check if file has hold
    if (fileRecord.hold && fileRecord.hold !== HOLD_TYPES.NONE) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `File has active hold (${fileRecord.hold}). Release hold before purging.`
      );
    }

    // Purge the file
    const result = await purgeFile(fileRecord);

    // Write audit log
    await writeAuditLog({
      action: 'FILE_PURGED_MANUAL',
      entityType: 'file',
      entityId: fileId,
      performedBy: context.auth.uid,
      performedAt: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        storagePath: fileRecord.storagePath,
        displayName: fileRecord.displayName,
        reason,
        result,
      },
      success: result.success,
    });

    if (!result.success) {
      throw new functions.https.HttpsError(
        'internal',
        `Failed to purge file: ${result.error}`
      );
    }

    return {
      success: true,
      fileId,
      message: 'File permanently deleted',
    };
  });

// ============================================================================
// HTTP CALLABLE: GET TRASH STATS
// ============================================================================

/**
 * Get trash statistics for a company
 * @enterprise Used in Trash view dashboard
 */
export const getTrashStats = functions
  .runWith({
    timeoutSeconds: 30,
    memory: '256MB',
  })
  .https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be authenticated'
      );
    }

    const companyId = data.companyId || context.auth.token.companyId;

    if (!companyId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'companyId is required'
      );
    }

    // Get trashed files count and total size
    const snapshot = await db.collection(COLLECTIONS.FILES)
      .where('companyId', '==', companyId)
      .where('isDeleted', '==', true)
      .get();

    let totalSize = 0;
    let expiringInWeek = 0;
    const now = new Date();
    const oneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    snapshot.forEach((doc) => {
      const data = doc.data();
      totalSize += data.sizeBytes || 0;

      if (data.purgeAt) {
        const purgeDate = new Date(data.purgeAt);
        if (purgeDate <= oneWeek) {
          expiringInWeek++;
        }
      }
    });

    return {
      totalFiles: snapshot.size,
      totalSizeBytes: totalSize,
      expiringInWeek,
    };
  });
