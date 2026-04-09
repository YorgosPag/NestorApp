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
  doc,
  getDoc,
  setDoc,
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
import { getErrorMessage } from '@/lib/error-utils';

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
  | 'hold_release'
  | 'approval_request'
  | 'approval_approve'
  | 'approval_reject'
  | 'approval_cancel'
  | 'comment'
  | 'move';

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
    metadata?: Record<string, string | number | boolean | null>,
  ): Promise<string>;
  static async log(
    fileId: string,
    action: FileAuditAction,
    performedBy: string,
    companyId?: string,
    metadata?: Record<string, string | number | boolean | null>,
  ): Promise<string>;
  static async log(
    fileId: string,
    action: FileAuditAction,
    performedBy: string,
    companyIdOrMetadata?: string | Record<string, string | number | boolean | null>,
    metadata?: Record<string, string | number | boolean | null>,
  ): Promise<string> {
    // Resolve overloaded parameters
    let companyId: string | undefined;
    let resolvedMetadata: Record<string, string | number | boolean | null> | undefined;

    if (typeof companyIdOrMetadata === 'string') {
      companyId = companyIdOrMetadata;
      resolvedMetadata = metadata;
    } else if (typeof companyIdOrMetadata === 'object' && companyIdOrMetadata !== null) {
      resolvedMetadata = companyIdOrMetadata;
    }

    try {
      // Resolve companyId from FileRecord when not provided (tenant isolation)
      if (!companyId && fileId) {
        try {
          const fileSnap = await getDoc(doc(db, COLLECTIONS.FILES, fileId));
          if (fileSnap.exists()) {
            companyId = (fileSnap.data().companyId as string) || undefined;
          }
        } catch {
          // Best-effort — continue without companyId if lookup fails
        }
      }

      const entry: FileAuditEntry = {
        fileId,
        action,
        performedBy,
        timestamp: serverTimestamp(),
        companyId: companyId ?? undefined,
        metadata: resolvedMetadata ?? undefined,
      };

      // Remove undefined values for Firestore
      const cleanEntry: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(entry)) {
        if (value !== undefined) {
          cleanEntry[key] = value;
        }
      }

      const { generateAuditId } = await import('@/services/enterprise-id.service');
      const enterpriseId = generateAuditId();
      const docRef = doc(db, FILE_AUDIT_COLLECTION, enterpriseId);
      await setDoc(docRef, cleanEntry);

      return enterpriseId;
    } catch (err) {
      // Audit failures should never break the main operation
      logger.error('Failed to record audit entry', {
        fileId,
        action,
        error: getErrorMessage(err),
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
