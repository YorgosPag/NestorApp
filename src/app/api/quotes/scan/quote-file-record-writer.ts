/**
 * Quote scan FileRecord writer — canonical `files` collection (server-side).
 *
 * Quote scan upload writes the binary to Storage AND a FileRecord to the
 * `files` collection so the SSoT file system (EntityFilesManager,
 * useEntityFiles, FilePreviewRenderer) sees quote attachments uniformly
 * with every other entity (contact, building, project, …).
 *
 * Mirrors the proven `cad-files/dual-write-to-files.ts` pattern. Errors
 * propagate — the caller decides whether the scan request should fail.
 *
 * @see ADR-031 — Canonical File Storage System
 * @see ADR-191 — Enterprise Document Management System
 * @see ADR-327 §Phase G — Original Document SSoT Integration
 */

import 'server-only';

import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  ENTITY_TYPES,
  FILE_DOMAINS,
  FILE_CATEGORIES,
  FILE_STATUS,
  FILE_LIFECYCLE_STATES,
} from '@/config/domain-constants';
import { buildFileDisplayName } from '@/services/upload/utils/file-display-name';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('QuoteFileRecordWriter');

export interface WriteQuoteFileRecordParams {
  fileId: string;
  quoteId: string;
  projectId: string;
  companyId: string;
  createdBy: string;
  uploaderName?: string | null;
  storagePath: string;
  downloadUrl: string;
  originalFilename: string;
  ext: string;
  contentType: string;
  sizeBytes: number;
  /** Quote display number used as entityLabel in display name. */
  quoteDisplayNumber: string | null;
}

/**
 * Write the FileRecord for a quote scan attachment to the `files` collection.
 * Idempotent: uses set with merge so a retry of the same fileId updates rather
 * than duplicates.
 */
export async function writeQuoteFileRecord(params: WriteQuoteFileRecordParams): Promise<void> {
  const {
    fileId,
    quoteId,
    projectId,
    companyId,
    createdBy,
    uploaderName,
    storagePath,
    downloadUrl,
    originalFilename,
    ext,
    contentType,
    sizeBytes,
    quoteDisplayNumber,
  } = params;

  try {
    const { displayName } = buildFileDisplayName({
      entityType: ENTITY_TYPES.QUOTE,
      entityId: quoteId,
      domain: FILE_DOMAINS.SALES,
      category: FILE_CATEGORIES.DOCUMENTS,
      entityLabel: quoteDisplayNumber ?? quoteId,
      purpose: 'quote-scan',
      ext,
      originalFilename,
    });

    const fileRecord = {
      id: fileId,
      companyId,
      projectId,
      entityType: ENTITY_TYPES.QUOTE,
      entityId: quoteId,
      domain: FILE_DOMAINS.SALES,
      category: FILE_CATEGORIES.DOCUMENTS,
      purpose: 'quote-scan',
      storagePath,
      downloadUrl,
      displayName,
      originalFilename,
      ext,
      contentType,
      sizeBytes,
      status: FILE_STATUS.READY,
      lifecycleState: FILE_LIFECYCLE_STATES.ACTIVE,
      isDeleted: false,
      createdBy,
      ...(uploaderName ? { uploaderName } : {}),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const adminDb = getAdminFirestore();
    await adminDb.collection(COLLECTIONS.FILES).doc(fileId).set(fileRecord, { merge: true });

    logger.info('FileRecord written for quote scan', {
      fileId,
      quoteId,
      companyId,
      sizeBytes,
    });
  } catch (error) {
    logger.error('Failed to write quote scan FileRecord', {
      fileId,
      quoteId,
      error: getErrorMessage(error),
    });
    throw error;
  }
}
