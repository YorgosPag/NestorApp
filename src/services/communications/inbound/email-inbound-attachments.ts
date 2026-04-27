/**
 * =============================================================================
 * EMAIL INBOUND — ATTACHMENT PROCESSING
 * =============================================================================
 *
 * Handles downloading, uploading to Firebase Storage, AI classification,
 * and Firestore file record management for inbound email attachments.
 *
 * Extracted from email-inbound-service.ts for SRP compliance (ADR-065 Phase 4).
 *
 * @module services/communications/inbound/email-inbound-attachments
 * @see ADR-080 (Pipeline Implementation)
 */

import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getAdminFirestore } from '@/server/admin/admin-guards';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  PLATFORMS,
  FILE_CATEGORIES,
  FILE_STATUS,
  type FileCategory,
} from '@/config/domain-constants';
import {
  ATTACHMENT_TYPES,
  detectAttachmentType,
  type MessageAttachment,
} from '@/types/conversations';
import {
  buildIngestionFileRecordData,
  buildFinalizeFileRecordUpdate,
  type FileSourceMetadata,
} from '@/services/file-record';
import {
  isDocumentClassifyAnalysis,
  type DocumentClassifyAnalysis,
} from '@/schemas/ai-analysis';
import { FILE_TYPE_CONFIG, type FileType } from '@/config/file-upload-config';
import type { IAIAnalysisProvider } from '@/services/ai-analysis/providers/IAIAnalysisProvider';
import type {
  ParsedAddress,
  InboundEmailAttachment,
} from './types';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('EMAIL_INBOUND_ATTACHMENTS');

// ============================================================================
// ATTACHMENT TYPE MAPPERS
// ============================================================================

function mapAttachmentTypeToCategory(type: MessageAttachment['type']): FileCategory {
  switch (type) {
    case ATTACHMENT_TYPES.IMAGE:
      return FILE_CATEGORIES.PHOTOS;
    case ATTACHMENT_TYPES.VIDEO:
      return FILE_CATEGORIES.VIDEOS;
    case ATTACHMENT_TYPES.AUDIO:
      return FILE_CATEGORIES.AUDIO;
    case ATTACHMENT_TYPES.DOCUMENT:
    default:
      return FILE_CATEGORIES.DOCUMENTS;
  }
}

function mapAttachmentTypeToFileType(type: MessageAttachment['type']): FileType {
  switch (type) {
    case ATTACHMENT_TYPES.IMAGE:
      return 'image';
    case ATTACHMENT_TYPES.VIDEO:
      return 'video';
    case ATTACHMENT_TYPES.AUDIO:
      return 'any';
    case ATTACHMENT_TYPES.DOCUMENT:
    default:
      return 'document';
  }
}

function getMaxAllowedSize(attachmentType: MessageAttachment['type']): number {
  const fileType = mapAttachmentTypeToFileType(attachmentType);
  return FILE_TYPE_CONFIG[fileType].maxSize;
}

function shouldClassifyAttachment(attachmentType: MessageAttachment['type']): boolean {
  return attachmentType === ATTACHMENT_TYPES.DOCUMENT || attachmentType === ATTACHMENT_TYPES.IMAGE;
}

// ============================================================================
// FIREBASE STORAGE UPLOAD
// ============================================================================

async function uploadToFirebaseStorage(params: {
  buffer: Buffer;
  storagePath: string;
  contentType: string;
  metadata?: Record<string, string>;
  expectedSize?: number;
}): Promise<{
  downloadUrl: string | null;
  verified: boolean;
  storageSizeBytes?: number;
}> {
  const { buffer, storagePath, contentType, metadata } = params;

  const { uploadPublicFile } = await import('@/services/storage-admin/public-upload.service');
  const { getAdminBucket } = await import('@/lib/firebaseAdmin');

  const { url: downloadUrl } = await uploadPublicFile({
    storagePath,
    buffer,
    contentType,
    customMetadata: metadata,
  });

  const file = getAdminBucket().file(storagePath);
  const [exists] = await file.exists();
  const [fileMetadata] = await file.getMetadata().catch(() => [undefined]);
  const metadataSize = fileMetadata?.size ? Number(fileMetadata.size) : undefined;
  const expectedSize = params.expectedSize;
  const verified =
    exists &&
    (expectedSize === undefined || metadataSize === undefined || metadataSize === expectedSize);

  if (!verified) {
    logger.warn('Storage verification failed for attachment', {
      storagePath,
      expectedSize,
      metadataSize,
    });
  }

  return {
    downloadUrl,
    verified,
    storageSizeBytes: metadataSize,
  };
}

// ============================================================================
// AI CLASSIFICATION
// ============================================================================

async function classifyAttachment(params: {
  aiProvider: IAIAnalysisProvider;
  contentBuffer: Buffer;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<DocumentClassifyAnalysis | null> {
  const analysis = await params.aiProvider.analyze({
    kind: 'document_classify',
    content: params.contentBuffer,
    filename: params.filename,
    mimeType: params.mimeType,
    sizeBytes: params.sizeBytes,
  });

  if (!isDocumentClassifyAnalysis(analysis)) {
    return null;
  }

  return analysis;
}

// ============================================================================
// SINGLE ATTACHMENT INGESTION
// ============================================================================

async function ingestAttachment(params: {
  companyId: string;
  sender: ParsedAddress;
  messageId: string;
  receivedAt?: string;
  attachment: InboundEmailAttachment;
  provider: string;
  aiProvider: IAIAnalysisProvider;
}): Promise<MessageAttachment | null> {
  const { attachment } = params;
  const filename = attachment.filename || `attachment_${params.messageId}`;
  const contentType = attachment.contentType || 'application/octet-stream';
  const sizeBytes = attachment.sizeBytes;

  const attachmentType = detectAttachmentType(contentType);
  const maxAllowedSize = getMaxAllowedSize(attachmentType);
  if (sizeBytes && sizeBytes > maxAllowedSize) {
    logger.warn('Attachment exceeds max allowed size, skipping', {
      filename,
      sizeBytes,
      maxAllowedSize,
    });
    return null;
  }

  const downloadResult = await attachment.download();
  if (!downloadResult) return null;

  const extension = filename.includes('.') ? filename.split('.').pop() || '' : '';
  const cleanExt = extension || 'bin';

  const source: FileSourceMetadata = {
    type: 'email',
    messageId: params.messageId,
    fromUserId: params.sender.email,
    senderName: params.sender.name || params.sender.email,
    receivedAt: params.receivedAt || nowISO(),
    fileUniqueId: params.messageId,
  };

  const category = mapAttachmentTypeToCategory(attachmentType);

  const { fileId, storagePath, recordBase } = buildIngestionFileRecordData({
    companyId: params.companyId,
    category,
    filename,
    contentType,
    ext: cleanExt,
    source,
  });

  const adminDb = getAdminFirestore();
  await adminDb.collection(COLLECTIONS.FILES).doc(fileId).set({
    ...recordBase,
    createdAt: new Date(),
  });

  const classification = shouldClassifyAttachment(attachmentType)
    ? await classifyAttachment({
        aiProvider: params.aiProvider,
        contentBuffer: downloadResult.buffer,
        filename,
        mimeType: contentType,
        sizeBytes: downloadResult.buffer.length,
      })
    : null;

  if (classification) {
    await adminDb.collection(COLLECTIONS.FILES).doc(fileId).update({
      ingestion: {
        ...recordBase.ingestion,
        analysis: classification,
        stateChangedAt: nowISO(),
      },
      updatedAt: new Date(),
    });
  }

  const uploadResult = await uploadToFirebaseStorage({
    buffer: downloadResult.buffer,
    storagePath,
    contentType: downloadResult.contentType,
    metadata: {
      source: PLATFORMS.EMAIL,
      fileRecordId: fileId,
      messageId: params.messageId,
      provider: params.provider,
    },
    expectedSize: downloadResult.buffer.length,
  });

  if (!uploadResult.downloadUrl) return null;

  const finalizeUpdate = buildFinalizeFileRecordUpdate({
    sizeBytes: downloadResult.buffer.length,
    downloadUrl: uploadResult.downloadUrl,
    nextStatus: FILE_STATUS.PENDING,
  });

  await adminDb.collection(COLLECTIONS.FILES).doc(fileId).update({
    ...finalizeUpdate,
    updatedAt: new Date(),
  });

  const attachmentMetadata: Record<string, unknown> = {
    fileRecordId: fileId,
    quarantined: true,
    storageVerified: uploadResult.verified,
  };

  if (uploadResult.storageSizeBytes !== undefined) {
    attachmentMetadata.storageSizeBytes = uploadResult.storageSizeBytes;
  }

  if (classification) {
    attachmentMetadata.analysis = classification;
  }

  return {
    type: attachmentType,
    url: uploadResult.downloadUrl,
    filename,
    mimeType: contentType,
    size: downloadResult.buffer.length,
    metadata: attachmentMetadata,
  };
}

// ============================================================================
// BATCH ATTACHMENT PROCESSING (exported for use by email-inbound-service)
// ============================================================================

export async function processAttachments(params: {
  companyId: string;
  sender: ParsedAddress;
  messageId: string;
  receivedAt?: string;
  attachments?: InboundEmailAttachment[];
  provider: string;
  aiProvider: IAIAnalysisProvider;
}): Promise<MessageAttachment[]> {
  const list = params.attachments || [];
  const results: MessageAttachment[] = [];

  for (const attachment of list) {
    const result = await ingestAttachment({
      companyId: params.companyId,
      sender: params.sender,
      messageId: params.messageId,
      receivedAt: params.receivedAt,
      attachment,
      provider: params.provider,
      aiProvider: params.aiProvider,
    });

    if (result) {
      results.push(result);
    }
  }

  return results;
}
