/**
 * =============================================================================
 * 🏢 ENTERPRISE: File Audit Trail Service
 * =============================================================================
 *
 * Records every file operation for compliance and traceability.
 * Stores audit entries in Firestore `file_audit_log` collection.
 *
 * Operations tracked:
 * - view, download, upload, rename, classify, delete, restore, rollback
 * - batch operations (batch_delete, batch_classify, batch_download)
 * - AI operations (ai_classify)
 *
 * @module services/file-audit.service
 * @enterprise ADR-191 - Enterprise Document Management System (Phase 3.1)
 * @compliance ISO 27001 §A.12.4 (Logging and Monitoring)
 */

import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  limit as firestoreLimit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('FileAuditService');

// ============================================================================
// TYPES
// ============================================================================

/** All trackable file operations */
export type FileAuditAction =
  | 'view'
  | 'download'
  | 'upload'
  | 'finalize'
  | 'rename'
  | 'description_update'
  | 'classify'
  | 'ai_classify'
  | 'delete'
  | 'restore'
  | 'archive'
  | 'version_create'
  | 'version_rollback'
  | 'link'
  | 'unlink'
  | 'batch_delete'
  | 'batch_download'
  | 'batch_classify'
  | 'share'
  | 'hold_place'
  | 'hold_release';

/** Audit log entry stored in Firestore */
export interface FileAuditEntry {
  /** File ID */
  fileId: string;
  /** Action performed */
  action: FileAuditAction;
  /** Who performed the action */
  performedBy: string;
  /** Timestamp (server) */
  timestamp: ReturnType<typeof serverTimestamp>;
  /** Company ID for tenant isolation */
  companyId?: string;
  /** Additional context */
  metadata?: Record<string, string | number | boolean | null>;
}

/** Query parameters for retrieving audit logs */
export interface FileAuditQuery {
  /** Filter by file ID */
  fileId?: string;
  /** Filter by action type */
  action?: FileAuditAction;
  /** Filter by user */
  performedBy?: string;
  /** Filter by company */
  companyId?: string;
  /** Maximum entries to return */
  maxEntries?: number;
}

/** Audit entry as returned from Firestore (with resolved timestamp) */
export interface FileAuditRecord extends Omit<FileAuditEntry, 'timestamp'> {
  id: string;
  timestamp: Date | string;
}

// ============================================================================
// COLLECTION NAME
// ============================================================================

const FILE_AUDIT_COLLECTION = COLLECTIONS.FILE_AUDIT_LOG;

// ============================================================================
// SERVICE
// ============================================================================

export class FileAuditService {
  /**
   * Record a file operation in the audit log.
   *
   * @param entry - Audit entry (timestamp is added automatically)
   * @returns Firestore document ID
   */
  static async log(
    fileId: string,
    action: FileAuditAction,
    performedBy: string,
    companyId?: string,
    metadata?: Record<string, string | number | boolean | null>,
  ): Promise<string> {
    try {
      const entry: FileAuditEntry = {
        fileId,
        action,
        performedBy,
        timestamp: serverTimestamp(),
        companyId: companyId ?? undefined,
        metadata: metadata ?? undefined,
      };

      // Remove undefined values for Firestore
      const cleanEntry: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(entry)) {
        if (value !== undefined) {
          cleanEntry[key] = value;
        }
      }

      const colRef = collection(db, FILE_AUDIT_COLLECTION);
      const docRef = await addDoc(colRef, cleanEntry);

      return docRef.id;
    } catch (err) {
      // Audit failures should never break the main operation
      logger.error('Failed to record audit entry', {
        fileId,
        action,
        error: err instanceof Error ? err.message : String(err),
      });
      return '';
    }
  }

  /**
   * Record a batch operation (multiple files).
   */
  static async logBatch(
    fileIds: string[],
    action: FileAuditAction,
    performedBy: string,
    companyId?: string,
    metadata?: Record<string, string | number | boolean | null>,
  ): Promise<void> {
    // Log one entry per file for queryability
    await Promise.allSettled(
      fileIds.map((fileId) =>
        FileAuditService.log(fileId, action, performedBy, companyId, {
          ...metadata,
          batchSize: fileIds.length,
        }),
      ),
    );
  }

  /**
   * Retrieve audit history for a file.
   */
  static async getFileHistory(
    fileId: string,
    maxEntries = 50,
  ): Promise<FileAuditRecord[]> {
    const colRef = collection(db, FILE_AUDIT_COLLECTION);
    const q = query(
      colRef,
      where('fileId', '==', fileId),
      orderBy('timestamp', 'desc'),
      firestoreLimit(maxEntries),
    );

    const snap = await getDocs(q);

    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        fileId: data.fileId,
        action: data.action,
        performedBy: data.performedBy,
        timestamp: data.timestamp?.toDate?.() ?? data.timestamp ?? '',
        companyId: data.companyId,
        metadata: data.metadata,
      } as FileAuditRecord;
    });
  }

  /**
   * Retrieve audit history for a user (across all files).
   */
  static async getUserHistory(
    performedBy: string,
    maxEntries = 100,
  ): Promise<FileAuditRecord[]> {
    const colRef = collection(db, FILE_AUDIT_COLLECTION);
    const q = query(
      colRef,
      where('performedBy', '==', performedBy),
      orderBy('timestamp', 'desc'),
      firestoreLimit(maxEntries),
    );

    const snap = await getDocs(q);

    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        fileId: data.fileId,
        action: data.action,
        performedBy: data.performedBy,
        timestamp: data.timestamp?.toDate?.() ?? data.timestamp ?? '',
        companyId: data.companyId,
        metadata: data.metadata,
      } as FileAuditRecord;
    });
  }
}
