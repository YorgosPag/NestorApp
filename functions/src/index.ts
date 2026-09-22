/**
 * Nestor Enterprise Cloud Functions — Admin SDK, scheduled, atomic ops.
 * ADR-032 (Trash) · ADR-029 (Search)
 */

// 🔍 SEARCH INDEX TRIGGERS (ADR-029) — single writer of search_documents per entity type.
// Handoff: docs/handoffs/2026-04-22-search-ssot-refactor.md
export {
  onProjectWrite, onBuildingWrite, onFloorWrite, onPropertyWrite, onContactWrite,
  onFileWrite, onParkingWrite, onStorageWrite, onOpportunityWrite,
  onCommunicationWrite, onTaskWrite,
} from './search/indexTriggers';

// 📜 ENTITY AUDIT CDC TRIGGERS (ADR-195 Phase 1 PoC) — dual-write with source='cdc'
// for coverage comparison against the service-layer audit during rollout.
export { auditContactWrite } from './audit/contact-audit-trigger';
// 🧱 PROCUREMENT (ADR-330 Phase 4.5) — material price sync on PO → delivered.
export { materialPriceSyncOnPODelivery } from './procurement/material-price-sync.cf';

// 🖼️ FLOORPLAN BACKGROUND (ADR-340 Phase 7, D4) — ref-count fileId on background
// delete; if 0 references remain, delete files/{fileId} + Storage object.
export { onDeleteFloorplanBackground } from './floorplan-background/onDeleteFloorplanBackground';

// 🏢 FLOOR · UNITS COUNTER (ADR-236) — maintain floors.units on property write.
export { onPropertyWriteFloorUnits } from './aggregation/floorUnitsAggregation';

import * as functions from 'firebase-functions/v1';
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

// SSoT: Collection names from centralized config
import { COLLECTIONS } from './config/firestore-collections';
import { generateCloudAuditId } from './config/enterprise-id';

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
    const auditId = generateCloudAuditId();
    await db.collection(COLLECTIONS.CLOUD_FUNCTION_AUDIT_LOG).doc(auditId).set(entry);
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

// ΑΦΑΙΡΕΘΗΚΑΝ (ADR-873 Φάση 0): callables `manualPurgeFile` + `getTrashStats` —
// μηδέν καταναλωτές, και το `getTrashStats` δεχόταν `data.companyId` από τον
// πελάτη (διαρροή μεταξύ εταιρειών). Η αφαίρεση από τον κώδικα ΔΕΝ τα σβήνει
// από το cloud: το `firebase deploy --only functions` ρωτά για διαγραφή (το
// `--force` διαγράφει χωρίς ερώτηση) — απόφαση Giorgio, ADR-873 §5.

// STORAGE TRIGGERS (ADR-694 mark-and-sweep — ΜΟΝΟ ο sweeper διαγράφει):
//  - onStorageFinalize  → mark-only παρατηρητής, ΜΗΔΕΝ διαγραφή (Α1)
//  - orphanSweeper      → ο μοναδικός destructive δρόμος· dry-run χωρίς
//                         `ORPHAN_SWEEP_ENABLED=true` (Α3)
//  - orphanSpikeAlert   → ADR-327 Layer 3 observability
//  - onDxfProcessedFinalize → DXF thumbnail (άσχετο με custody)
export { onStorageFinalize } from './storage/orphan-cleanup';
export { orphanSweeper } from './storage/orphan-sweeper';
export { onDxfProcessedFinalize } from './storage/dxf-thumbnail-onfinalize';
export { orphanSpikeAlert } from './storage/orphan-spike-alert';
