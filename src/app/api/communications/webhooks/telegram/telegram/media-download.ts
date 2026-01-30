/**
 * =============================================================================
 * TELEGRAM MEDIA DOWNLOAD SERVICE (ADR-055)
 * =============================================================================
 *
 * Downloads media files from Telegram servers and uploads to Firebase Storage.
 * Converts Telegram media into canonical MessageAttachment format.
 *
 * @module api/communications/webhooks/telegram/telegram/media-download
 * @enterprise ADR-055 - Enterprise Attachment System Consolidation
 */

import type {
  TelegramMessageObject,
  TelegramPhotoSize,
  TelegramDocument,
  TelegramAudio,
  TelegramVideo,
  TelegramVoice,
  TelegramVideoNote,
  TelegramAnimation,
  TelegramFile,
  TelegramLocation,
  TelegramContact,
} from './types';
import type { MessageAttachment, AttachmentType } from '@/types/conversations';
import { ATTACHMENT_TYPES } from '@/types/conversations';

// ============================================================================
// TYPES
// ============================================================================

/** Result of downloading and uploading a Telegram media file */
interface MediaDownloadResult {
  success: boolean;
  attachment?: MessageAttachment;
  error?: string;
}

/** Media info extracted from Telegram message */
interface TelegramMediaInfo {
  fileId: string;
  type: AttachmentType;
  filename?: string;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Maximum file size to download (20MB - Telegram bot limit) */
const MAX_DOWNLOAD_SIZE = 20 * 1024 * 1024;

/** Storage path prefix for Telegram media */
const TELEGRAM_STORAGE_PREFIX = 'telegram-media';

// ============================================================================
// TELEGRAM API HELPERS
// ============================================================================

/**
 * Get file info from Telegram using getFile API
 * @see https://core.telegram.org/bots/api#getfile
 */
async function getTelegramFile(fileId: string): Promise<TelegramFile | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('❌ TELEGRAM_BOT_TOKEN not configured');
    return null;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    );
    const result = await response.json();

    if (!result.ok || !result.result) {
      console.error('❌ Telegram getFile failed:', result.description);
      return null;
    }

    return result.result as TelegramFile;
  } catch (error) {
    console.error('❌ Error calling Telegram getFile:', error);
    return null;
  }
}

/**
 * Download file from Telegram servers
 */
async function downloadTelegramFile(filePath: string): Promise<Buffer | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('❌ TELEGRAM_BOT_TOKEN not configured');
    return null;
  }

  try {
    const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    console.log(`📥 Downloading from Telegram: ${filePath}`);

    const response = await fetch(downloadUrl);
    if (!response.ok) {
      console.error(`❌ Download failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('❌ Error downloading Telegram file:', error);
    return null;
  }
}

// ============================================================================
// FIREBASE STORAGE UPLOAD
// ============================================================================

/**
 * Upload buffer to Firebase Storage
 * @returns Download URL or null on failure
 */
async function uploadToFirebaseStorage(
  buffer: Buffer,
  storagePath: string,
  contentType: string
): Promise<string | null> {
  try {
    // Dynamic import to avoid bundling issues
    const { getStorage } = await import('firebase-admin/storage');

    // 🏢 ENTERPRISE: Get bucket name from environment (required for Firebase Admin)
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET ||
                          process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

    if (!storageBucket) {
      console.error('❌ FIREBASE_STORAGE_BUCKET not configured');
      return null;
    }

    const bucket = getStorage().bucket(storageBucket);

    const file = bucket.file(storagePath);

    // Upload buffer
    await file.save(buffer, {
      metadata: {
        contentType,
        metadata: {
          source: 'telegram',
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    // Make publicly accessible and get URL
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${storageBucket}/${storagePath}`;

    console.log(`✅ Uploaded to Firebase Storage: ${storagePath}`);
    return publicUrl;
  } catch (error) {
    console.error('❌ Firebase Storage upload failed:', error);
    return null;
  }
}

// ============================================================================
// MEDIA EXTRACTION
// ============================================================================

/**
 * Extract media info from Telegram message
 * @returns Array of media info (empty if no media)
 */
export function extractMediaFromMessage(message: TelegramMessageObject): TelegramMediaInfo[] {
  const mediaList: TelegramMediaInfo[] = [];

  // Photo - get largest size
  if (message.photo && message.photo.length > 0) {
    const largestPhoto = message.photo.reduce((prev, curr) =>
      (curr.file_size || 0) > (prev.file_size || 0) ? curr : prev
    );
    mediaList.push({
      fileId: largestPhoto.file_id,
      type: ATTACHMENT_TYPES.IMAGE,
      mimeType: 'image/jpeg', // Telegram converts to JPEG
      fileSize: largestPhoto.file_size,
      width: largestPhoto.width,
      height: largestPhoto.height,
    });
  }

  // Document
  if (message.document) {
    mediaList.push({
      fileId: message.document.file_id,
      type: ATTACHMENT_TYPES.DOCUMENT,
      filename: message.document.file_name,
      mimeType: message.document.mime_type,
      fileSize: message.document.file_size,
    });
  }

  // Audio
  if (message.audio) {
    mediaList.push({
      fileId: message.audio.file_id,
      type: ATTACHMENT_TYPES.AUDIO,
      filename: message.audio.file_name || `${message.audio.title || 'audio'}.mp3`,
      mimeType: message.audio.mime_type || 'audio/mpeg',
      fileSize: message.audio.file_size,
      duration: message.audio.duration,
      metadata: {
        performer: message.audio.performer,
        title: message.audio.title,
      },
    });
  }

  // Video
  if (message.video) {
    mediaList.push({
      fileId: message.video.file_id,
      type: ATTACHMENT_TYPES.VIDEO,
      filename: message.video.file_name,
      mimeType: message.video.mime_type || 'video/mp4',
      fileSize: message.video.file_size,
      width: message.video.width,
      height: message.video.height,
      duration: message.video.duration,
    });
  }

  // Voice message
  if (message.voice) {
    mediaList.push({
      fileId: message.voice.file_id,
      type: ATTACHMENT_TYPES.AUDIO,
      filename: `voice_${message.message_id}.ogg`,
      mimeType: message.voice.mime_type || 'audio/ogg',
      fileSize: message.voice.file_size,
      duration: message.voice.duration,
      metadata: { isVoiceMessage: true },
    });
  }

  // Video note (circular video)
  if (message.video_note) {
    mediaList.push({
      fileId: message.video_note.file_id,
      type: ATTACHMENT_TYPES.VIDEO,
      filename: `video_note_${message.message_id}.mp4`,
      mimeType: 'video/mp4',
      fileSize: message.video_note.file_size,
      width: message.video_note.length,
      height: message.video_note.length,
      duration: message.video_note.duration,
      metadata: { isVideoNote: true },
    });
  }

  // Animation (GIF)
  if (message.animation) {
    mediaList.push({
      fileId: message.animation.file_id,
      type: ATTACHMENT_TYPES.VIDEO, // GIFs are treated as video
      filename: message.animation.file_name || `animation_${message.message_id}.mp4`,
      mimeType: message.animation.mime_type || 'video/mp4',
      fileSize: message.animation.file_size,
      width: message.animation.width,
      height: message.animation.height,
      duration: message.animation.duration,
      metadata: { isAnimation: true },
    });
  }

  // Location
  if (message.location) {
    mediaList.push({
      fileId: '', // No file to download
      type: ATTACHMENT_TYPES.LOCATION,
      metadata: {
        latitude: message.location.latitude,
        longitude: message.location.longitude,
        horizontalAccuracy: message.location.horizontal_accuracy,
      },
    });
  }

  // Contact
  if (message.contact) {
    mediaList.push({
      fileId: '', // No file to download
      type: ATTACHMENT_TYPES.CONTACT,
      metadata: {
        phoneNumber: message.contact.phone_number,
        firstName: message.contact.first_name,
        lastName: message.contact.last_name,
        userId: message.contact.user_id,
        name: `${message.contact.first_name} ${message.contact.last_name || ''}`.trim(),
        phone: message.contact.phone_number,
      },
    });
  }

  return mediaList;
}

/**
 * Check if message has any media
 */
export function hasMedia(message: TelegramMessageObject): boolean {
  return !!(
    message.photo ||
    message.document ||
    message.audio ||
    message.video ||
    message.voice ||
    message.video_note ||
    message.animation ||
    message.location ||
    message.contact
  );
}

// ============================================================================
// MAIN DOWNLOAD FUNCTION
// ============================================================================

/**
 * Download and upload a single Telegram media file
 * @returns MessageAttachment or null on failure
 */
async function downloadAndUploadMedia(
  mediaInfo: TelegramMediaInfo,
  chatId: string,
  messageId: number
): Promise<MessageAttachment | null> {
  // Location and Contact don't need download
  if (mediaInfo.type === ATTACHMENT_TYPES.LOCATION) {
    return {
      type: ATTACHMENT_TYPES.LOCATION,
      metadata: mediaInfo.metadata,
    };
  }

  if (mediaInfo.type === ATTACHMENT_TYPES.CONTACT) {
    return {
      type: ATTACHMENT_TYPES.CONTACT,
      metadata: mediaInfo.metadata,
    };
  }

  // Need to download file
  if (!mediaInfo.fileId) {
    console.warn('⚠️ No file_id for media, skipping download');
    return null;
  }

  // Check file size
  if (mediaInfo.fileSize && mediaInfo.fileSize > MAX_DOWNLOAD_SIZE) {
    console.warn(`⚠️ File too large (${mediaInfo.fileSize} bytes), skipping`);
    return null;
  }

  // 1. Get file info from Telegram
  const fileInfo = await getTelegramFile(mediaInfo.fileId);
  if (!fileInfo || !fileInfo.file_path) {
    console.error('❌ Could not get file path from Telegram');
    return null;
  }

  // 2. Download file from Telegram
  const buffer = await downloadTelegramFile(fileInfo.file_path);
  if (!buffer) {
    console.error('❌ Could not download file from Telegram');
    return null;
  }

  // 3. Generate storage path
  const extension = getExtensionFromPath(fileInfo.file_path) || getExtensionFromMime(mediaInfo.mimeType);
  const filename = mediaInfo.filename || `${mediaInfo.type}_${messageId}${extension}`;
  const storagePath = `${TELEGRAM_STORAGE_PREFIX}/${chatId}/${messageId}_${filename}`;

  // 4. Upload to Firebase Storage
  const downloadUrl = await uploadToFirebaseStorage(
    buffer,
    storagePath,
    mediaInfo.mimeType || 'application/octet-stream'
  );

  if (!downloadUrl) {
    console.error('❌ Could not upload to Firebase Storage');
    return null;
  }

  // 5. Build MessageAttachment
  const attachment: MessageAttachment = {
    type: mediaInfo.type,
    url: downloadUrl,
    filename: filename,
    mimeType: mediaInfo.mimeType,
    size: buffer.length,
    width: mediaInfo.width,
    height: mediaInfo.height,
    duration: mediaInfo.duration,
    metadata: mediaInfo.metadata,
  };

  console.log(`✅ Media processed: ${mediaInfo.type} -> ${downloadUrl}`);
  return attachment;
}

/**
 * Process all media in a Telegram message
 * @returns Array of MessageAttachment
 */
export async function processTelegramMedia(
  message: TelegramMessageObject
): Promise<MessageAttachment[]> {
  const mediaList = extractMediaFromMessage(message);

  if (mediaList.length === 0) {
    return [];
  }

  console.log(`📎 Processing ${mediaList.length} media item(s) from message ${message.message_id}`);

  const attachments: MessageAttachment[] = [];
  const chatId = String(message.chat.id);

  for (const media of mediaList) {
    try {
      const attachment = await downloadAndUploadMedia(media, chatId, message.message_id);
      if (attachment) {
        attachments.push(attachment);
      }
    } catch (error) {
      console.error(`❌ Failed to process media ${media.type}:`, error);
    }
  }

  console.log(`✅ Processed ${attachments.length}/${mediaList.length} media items`);
  return attachments;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getExtensionFromPath(filePath: string): string {
  const match = filePath.match(/\.([a-zA-Z0-9]+)$/);
  return match ? `.${match[1]}` : '';
}

function getExtensionFromMime(mimeType?: string): string {
  if (!mimeType) return '';
  const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'audio/mpeg': '.mp3',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  };
  return mimeToExt[mimeType] || '';
}
