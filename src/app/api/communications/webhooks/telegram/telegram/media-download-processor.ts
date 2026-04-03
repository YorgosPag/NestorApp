import type { MessageAttachment } from '@/types/conversations';
import { ATTACHMENT_TYPES } from '@/types/conversations';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getTelegramFile, downloadTelegramFile } from './media-download-telegram-api';
import { extractMediaFromMessage, createMetadataOnlyAttachment } from './media-download-extractor';
import { getExtensionFromMime, getExtensionFromPath, getMaxAllowedSize, mapAttachmentTypeToCategory, mapAttachmentTypeToFileType } from './media-download-mappers';
import { checkExistingFileRecord, createIngestionFileRecord, resolveCompanyIdFromTelegramWebhook, updateFileRecordAfterUpload, uploadToFirebaseStorage } from './media-download-storage';
import type { TelegramMessageObject } from './types';
import type { TelegramMediaInfo } from './media-download-types';

const logger = createModuleLogger('TelegramMediaProcessor');

async function downloadAndUploadMedia(
  mediaInfo: TelegramMediaInfo,
  chatId: string,
  messageId: number,
  fromUserId: string,
  senderName: string,
): Promise<MessageAttachment | null> {
  if (mediaInfo.type === ATTACHMENT_TYPES.LOCATION || mediaInfo.type === ATTACHMENT_TYPES.CONTACT) {
    return createMetadataOnlyAttachment(mediaInfo.type, mediaInfo.metadata);
  }

  if (!mediaInfo.fileId) {
    logger.warn('No file_id for media, skipping download');
    return null;
  }

  const maxAllowedSize = getMaxAllowedSize(mediaInfo.type);
  if (mediaInfo.fileSize && mediaInfo.fileSize > maxAllowedSize) {
    const fileType = mapAttachmentTypeToFileType(mediaInfo.type);
    logger.warn('File too large, skipping', { fileSize: mediaInfo.fileSize, maxAllowedSize, fileType });
    return null;
  }

  const tenantResult = resolveCompanyIdFromTelegramWebhook();
  if (!tenantResult.companyId) {
    logger.error('Tenant resolution failed', { error: tenantResult.error });
    return null;
  }
  const companyId = tenantResult.companyId;

  const existingFileRecordId = await checkExistingFileRecord({
    companyId,
    chatId,
    messageId: String(messageId),
    fileUniqueId: mediaInfo.fileUniqueId,
  });

  if (existingFileRecordId) {
    return {
      type: mediaInfo.type,
      metadata: {
        fileRecordId: existingFileRecordId,
        quarantined: true,
        deduplicated: true,
      },
    };
  }

  const fileInfo = await getTelegramFile(mediaInfo.fileId);
  if (!fileInfo || !fileInfo.file_path) {
    logger.error('Could not get file path from Telegram');
    return null;
  }

  const buffer = await downloadTelegramFile(fileInfo.file_path);
  if (!buffer) {
    logger.error('Could not download file from Telegram');
    return null;
  }

  const extension = getExtensionFromPath(fileInfo.file_path) || getExtensionFromMime(mediaInfo.mimeType);
  const filename = mediaInfo.filename || `${mediaInfo.type}_${messageId}${extension}`;
  const cleanExt = extension.startsWith('.') ? extension.slice(1) : extension;
  const category = mapAttachmentTypeToCategory(mediaInfo.type);

  const fileRecordResult = await createIngestionFileRecord({
    companyId,
    chatId,
    messageId,
    fromUserId,
    senderName,
    fileUniqueId: mediaInfo.fileUniqueId,
    category,
    filename,
    contentType: mediaInfo.mimeType || 'application/octet-stream',
    ext: cleanExt || 'bin',
  });

  if (!fileRecordResult) {
    logger.error('Failed to create FileRecord, aborting upload');
    return null;
  }

  const downloadUrl = await uploadToFirebaseStorage(
    buffer,
    fileRecordResult.storagePath,
    mediaInfo.mimeType || 'application/octet-stream',
    {
      source: 'telegram',
      fileRecordId: fileRecordResult.fileRecordId,
      chatId,
      messageId: String(messageId),
    },
  );

  if (!downloadUrl) {
    logger.error('Could not upload to Firebase Storage');
    return null;
  }

  await updateFileRecordAfterUpload(fileRecordResult.fileRecordId, buffer.length, downloadUrl);

  const attachment: MessageAttachment = {
    type: mediaInfo.type,
    url: downloadUrl,
    filename,
    size: buffer.length,
  };

  if (mediaInfo.mimeType) attachment.mimeType = mediaInfo.mimeType;
  if (mediaInfo.width !== undefined) attachment.width = mediaInfo.width;
  if (mediaInfo.height !== undefined) attachment.height = mediaInfo.height;
  if (mediaInfo.duration !== undefined) attachment.duration = mediaInfo.duration;
  if (mediaInfo.metadata && Object.keys(mediaInfo.metadata).length > 0) {
    attachment.metadata = mediaInfo.metadata;
  }

  attachment.metadata = {
    ...attachment.metadata,
    fileRecordId: fileRecordResult.fileRecordId,
    quarantined: true,
  };

  logger.info('Media processed (quarantined)', {
    type: mediaInfo.type,
    downloadUrl,
    fileRecordId: fileRecordResult.fileRecordId,
  });

  return attachment;
}

export async function processTelegramMedia(message: TelegramMessageObject): Promise<MessageAttachment[]> {
  const mediaList = extractMediaFromMessage(message);
  if (mediaList.length === 0) {
    return [];
  }

  logger.info('Processing media items from message', { count: mediaList.length, messageId: message.message_id });
  logger.info('QUARANTINE: Files will be stored with PENDING status (Inbox view)');

  const attachments: MessageAttachment[] = [];
  const chatId = String(message.chat.id);
  const fromUserId = message.from?.id ? String(message.from.id) : 'unknown';
  const senderName = message.from?.first_name || message.from?.username || 'Unknown';

  for (const media of mediaList) {
    try {
      const attachment = await downloadAndUploadMedia(
        media,
        chatId,
        message.message_id,
        fromUserId,
        senderName,
      );

      if (attachment) {
        attachments.push(attachment);
      }
    } catch (error) {
      logger.error('Failed to process media', { type: media.type, error });
    }
  }

  logger.info('Processed media items (all quarantined)', {
    processed: attachments.length,
    total: mediaList.length,
  });

  return attachments;
}
