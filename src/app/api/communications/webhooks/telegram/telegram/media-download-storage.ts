import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import type { FileCategory } from '@/config/domain-constants';
import { buildIngestionFileRecordData, type FileSourceMetadata } from '@/services/file-record';
import { createModuleLogger } from '@/lib/telemetry';
import type { ServerFileRecordResult, TenantResolutionResult } from './media-download-types';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('TelegramMediaStorage');

export function resolveCompanyIdFromTelegramWebhook(): TenantResolutionResult {
  const companyId = process.env.TELEGRAM_COMPANY_ID;

  if (!companyId) {
    logger.error('TELEGRAM_COMPANY_ID not configured - tenant resolution failed (fail-closed)');
    return {
      companyId: null,
      error: 'Tenant resolution failed: TELEGRAM_COMPANY_ID not configured',
    };
  }

  return { companyId };
}

export async function checkExistingFileRecord(params: {
  companyId: string;
  chatId: string;
  messageId: string;
  fileUniqueId?: string;
}): Promise<string | null> {
  try {
    const { getAdminFirestore } = await import('@/lib/firebaseAdmin');
    const firestore = getAdminFirestore();

    let query = firestore.collection(COLLECTIONS.FILES)
      .where(FIELDS.COMPANY_ID, '==', params.companyId)
      .where('source.chatId', '==', params.chatId)
      .where('source.messageId', '==', params.messageId);

    if (params.fileUniqueId) {
      query = query.where('source.fileUniqueId', '==', params.fileUniqueId);
    }

    const snapshot = await query.limit(1).get();
    if (snapshot.empty) {
      return null;
    }

    const existingId = snapshot.docs[0].id;
    logger.info('Duplicate detected (tenant-scoped) - FileRecord already exists', { existingId });
    return existingId;
  } catch (error) {
    logger.warn('Idempotency check failed, proceeding with upload', { error });
    return null;
  }
}

export async function createIngestionFileRecord(params: {
  companyId: string;
  chatId: string;
  messageId: number;
  fromUserId: string;
  senderName: string;
  fileUniqueId?: string;
  category: FileCategory;
  filename: string;
  contentType: string;
  ext: string;
}): Promise<ServerFileRecordResult | null> {
  try {
    const { getAdminFirestore, FieldValue } = await import('@/lib/firebaseAdmin');
    const firestore = getAdminFirestore();

    const source: FileSourceMetadata = {
      type: 'telegram',
      chatId: params.chatId,
      messageId: String(params.messageId),
      fromUserId: params.fromUserId,
      senderName: params.senderName,
      receivedAt: nowISO(),
      ...(params.fileUniqueId ? { fileUniqueId: params.fileUniqueId } : {}),
    };

    const { fileId, storagePath, displayNameResult, recordBase } = buildIngestionFileRecordData({
      companyId: params.companyId,
      category: params.category,
      filename: params.filename,
      contentType: params.contentType,
      ext: params.ext,
      source,
    });

    const fileRecord = {
      ...recordBase,
      createdAt: FieldValue.serverTimestamp(),
    };

    await firestore.collection(COLLECTIONS.FILES).doc(fileId).set(fileRecord);
    logger.info('FileRecord created (PENDING/quarantine)', { fileId });

    return {
      fileRecordId: fileId,
      storagePath,
      displayName: displayNameResult.displayName,
    };
  } catch (error) {
    logger.error('Failed to create FileRecord', { error });
    return null;
  }
}

export async function uploadToFirebaseStorage(
  buffer: Buffer,
  storagePath: string,
  contentType: string,
  customMetadata?: Record<string, string>,
): Promise<string | null> {
  try {
    const { getAdminStorage } = await import('@/lib/firebaseAdmin');
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

    if (!storageBucket) {
      logger.error('FIREBASE_STORAGE_BUCKET not configured');
      return null;
    }

    const bucket = getAdminStorage().bucket(storageBucket);
    const file = bucket.file(storagePath);
    const metadata = {
      source: 'telegram',
      uploadedAt: nowISO(),
      ...(customMetadata || {}),
    };

    await file.save(buffer, {
      metadata: {
        contentType,
        metadata,
      },
    });

    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${storageBucket}/${storagePath}`;
    logger.info('Uploaded to Firebase Storage', { storagePath });
    return publicUrl;
  } catch (error) {
    logger.error('Firebase Storage upload failed', { error });
    return null;
  }
}

export async function updateFileRecordAfterUpload(fileRecordId: string, sizeBytes: number, downloadUrl: string): Promise<void> {
  try {
    const { getAdminFirestore, FieldValue } = await import('@/lib/firebaseAdmin');
    const firestore = getAdminFirestore();

    await firestore.collection(COLLECTIONS.FILES).doc(fileRecordId).update({
      sizeBytes,
      downloadUrl,
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('FileRecord updated (still PENDING/quarantine)', { fileRecordId });
  } catch (error) {
    logger.warn('Failed to update FileRecord with URL', { error });
  }
}
