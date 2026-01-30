/**
 * =============================================================================
 * TELEGRAM MEDIA DOWNLOAD SERVICE (ADR-055)
 * =============================================================================
 *
 * Downloads media files from Telegram servers and uploads to Firebase Storage.
 * Converts Telegram media into canonical MessageAttachment format.
 *
 * 🏢 ENTERPRISE UPGRADE (ADR-055 Phase 2):
 * - Uses canonical buildStoragePath for ID-only paths
 * - Creates FileRecord in Firestore for file management
 * - Implements QUARANTINE GATE: files stay PENDING until classified
 * - Stores source metadata for traceability (chatId, messageId, fileUniqueId)
 *
 * @module api/communications/webhooks/telegram/telegram/media-download
 * @enterprise ADR-055 - Enterprise Attachment Ingestion System
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
import {
  FILE_CATEGORIES,
  FILE_STATUS,
  type FileCategory,
} from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_TYPE_CONFIG, type FileType } from '@/config/file-upload-config';
// 🏢 ENTERPRISE: SSoT Core module for FileRecord schema (ADR-055)
import {
  buildIngestionFileRecordData,
  buildFinalizeFileRecordUpdate,
  type FileSourceMetadata,
} from '@/services/file-record';

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
  fileUniqueId?: string;
  type: AttachmentType;
  filename?: string;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

/** 🏢 ENTERPRISE: FileRecord creation result for server context */
interface ServerFileRecordResult {
  fileRecordId: string;
  storagePath: string;
  displayName: string;
}

/** 🏢 ENTERPRISE: Tenant resolution result */
interface TenantResolutionResult {
  companyId: string | null;
  error?: string;
}

// ============================================================================
// 🏢 ENTERPRISE: CATEGORY/TYPE MAPPING (kept here for webhook context)
// ============================================================================
// Note: generateFileId, buildIngestionStoragePath now come from SSoT core module

/**
 * 🏢 ENTERPRISE: Map attachment type to file category
 * @enterprise Centralized mapping for consistent categorization
 */
function mapAttachmentTypeToCategory(type: AttachmentType): FileCategory {
  switch (type) {
    case ATTACHMENT_TYPES.IMAGE:
      return FILE_CATEGORIES.PHOTOS;
    case ATTACHMENT_TYPES.VIDEO:
      return FILE_CATEGORIES.VIDEOS;
    case ATTACHMENT_TYPES.AUDIO:
      return FILE_CATEGORIES.AUDIO;
    case ATTACHMENT_TYPES.DOCUMENT:
      return FILE_CATEGORIES.DOCUMENTS;
    default:
      return FILE_CATEGORIES.DOCUMENTS;
  }
}

/**
 * 🏢 ENTERPRISE: Map attachment type to FILE_TYPE_CONFIG key
 * @enterprise Uses SSoT file-upload-config.ts for policy (no duplicate limits)
 */
function mapAttachmentTypeToFileType(type: AttachmentType): FileType {
  switch (type) {
    case ATTACHMENT_TYPES.IMAGE:
      return 'image';
    case ATTACHMENT_TYPES.VIDEO:
      return 'video';
    case ATTACHMENT_TYPES.AUDIO:
      return 'any'; // No specific audio config, use 'any'
    case ATTACHMENT_TYPES.DOCUMENT:
      return 'document';
    default:
      return 'any';
  }
}

/**
 * 🏢 ENTERPRISE: Get max allowed file size from SSoT config
 *
 * Uses FILE_TYPE_CONFIG[type].maxSize as the policy limit.
 * Telegram Bot API has a 20MB limit for getFile - this is a TECHNICAL
 * constraint, not policy. Files > 20MB need alternative download methods.
 *
 * @enterprise No duplicate policy systems - single source from file-upload-config.ts
 */
function getMaxAllowedSize(attachmentType: AttachmentType): number {
  const fileType = mapAttachmentTypeToFileType(attachmentType);
  const configMaxSize = FILE_TYPE_CONFIG[fileType].maxSize;

  // Telegram Bot API technical limit (20MB for getFile)
  // This is NOT policy - it's API constraint
  const TELEGRAM_API_LIMIT = 20 * 1024 * 1024;

  // Return the smaller of policy limit and API constraint
  // For video (200MB policy), we're limited by Telegram API (20MB)
  // For image (5MB policy), we're limited by policy (5MB)
  return Math.min(configMaxSize, TELEGRAM_API_LIMIT);
}

/**
 * 🏢 ENTERPRISE: Resolve companyId from Telegram webhook context
 *
 * FAIL-CLOSED APPROACH:
 * - Uses server-side environment variable (NOT NEXT_PUBLIC_*)
 * - Returns null if not configured → caller must return 401/400
 * - NO hardcoded fallbacks (e.g., 'pagonis-company')
 *
 * Future: Could lookup BOT_CONFIGS collection for bot → company mapping
 */
function resolveCompanyIdFromTelegramWebhook(): TenantResolutionResult {
  // 🏢 ENTERPRISE: Server-side only env var (no NEXT_PUBLIC_ prefix)
  const companyId = process.env.TELEGRAM_COMPANY_ID;

  if (!companyId) {
    console.error('❌ TELEGRAM_COMPANY_ID not configured - tenant resolution failed (fail-closed)');
    return {
      companyId: null,
      error: 'Tenant resolution failed: TELEGRAM_COMPANY_ID not configured',
    };
  }

  return { companyId };
}

/**
 * 🏢 ENTERPRISE: Check if file already exists (idempotency/deduplication)
 *
 * Telegram may retry webhooks - we must not create duplicate FileRecords.
 * Checks for existing record with same (companyId, chatId, messageId, fileUniqueId).
 *
 * CRITICAL: Query MUST include companyId for tenant isolation!
 * Without it, chatId/messageId from another company could cause false duplicates.
 *
 * Required Firestore composite index:
 * Collection: files
 * Fields: companyId (asc), source.chatId (asc), source.messageId (asc)
 * Optional: source.fileUniqueId (asc) for more precise matching
 *
 * @returns Existing fileRecordId if found, null otherwise
 */
async function checkExistingFileRecord(params: {
  companyId: string;
  chatId: string;
  messageId: string;
  fileUniqueId?: string;
}): Promise<string | null> {
  try {
    const { getFirestore } = await import('firebase-admin/firestore');
    const firestore = getFirestore();

    // 🏢 ENTERPRISE: Query MUST include companyId for tenant isolation
    let query = firestore.collection(COLLECTIONS.FILES)
      .where('companyId', '==', params.companyId) // 🔒 CRITICAL: Tenant isolation
      .where('source.chatId', '==', params.chatId)
      .where('source.messageId', '==', params.messageId);

    // If fileUniqueId is available, use it for more precise matching
    if (params.fileUniqueId) {
      query = query.where('source.fileUniqueId', '==', params.fileUniqueId);
    }

    const snapshot = await query.limit(1).get();

    if (!snapshot.empty) {
      const existingId = snapshot.docs[0].id;
      console.log(`⏭️ Duplicate detected (tenant-scoped) - FileRecord already exists: ${existingId}`);
      return existingId;
    }

    return null;
  } catch (error) {
    // On query failure, proceed with upload (fail-open for idempotency check only)
    console.warn('⚠️ Idempotency check failed, proceeding with upload:', error);
    return null;
  }
}

/**
 * 🏢 ENTERPRISE: Create FileRecord in Firestore (server context)
 *
 * Uses SSoT core module for schema construction.
 * Uses firebase-admin for server-side Firestore operations.
 * Creates record with PENDING status (QUARANTINE GATE).
 *
 * @enterprise ADR-055 - SSoT FileRecord schema via file-record-core.ts
 */
async function createIngestionFileRecord(params: {
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
    // Dynamic import for firebase-admin (server context)
    const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
    const firestore = getFirestore();

    // =========================================================================
    // 🏢 ENTERPRISE: USE SSoT CORE MODULE FOR SCHEMA CONSTRUCTION
    // =========================================================================
    // All FileRecord schema logic lives in file-record-core.ts
    // This adapter only handles admin SDK specifics (timestamps, Firestore write)
    const source: FileSourceMetadata = {
      type: 'telegram',
      chatId: params.chatId,
      messageId: String(params.messageId),
      fromUserId: params.fromUserId,
      senderName: params.senderName,
      receivedAt: new Date().toISOString(),
      ...(params.fileUniqueId && { fileUniqueId: params.fileUniqueId }),
    };

    const { fileId, storagePath, displayNameResult, recordBase } =
      buildIngestionFileRecordData({
        companyId: params.companyId,
        category: params.category,
        filename: params.filename,
        contentType: params.contentType,
        ext: params.ext,
        source,
      });

    // =========================================================================
    // 🏢 ENTERPRISE: ADMIN SDK ADAPTER - Add timestamps and write
    // =========================================================================
    // Core provides schema, adapter provides SDK-specific operations
    const fileRecord = {
      ...recordBase,
      createdAt: FieldValue.serverTimestamp(), // Admin SDK timestamp
    };

    // Write to Firestore
    await firestore.collection(COLLECTIONS.FILES).doc(fileId).set(fileRecord);

    console.log(`✅ FileRecord created (PENDING/quarantine): ${fileId}`);

    return {
      fileRecordId: fileId,
      storagePath,
      displayName: displayNameResult.displayName,
    };
  } catch (error) {
    console.error('❌ Failed to create FileRecord:', error);
    return null;
  }
}

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
 * 🏢 ENTERPRISE: Upload buffer to Firebase Storage with metadata
 * @param buffer - File content
 * @param storagePath - Canonical path (IDs only)
 * @param contentType - MIME type
 * @param customMetadata - Optional metadata for traceability
 * @returns Download URL or null on failure
 */
async function uploadToFirebaseStorage(
  buffer: Buffer,
  storagePath: string,
  contentType: string,
  customMetadata?: Record<string, string>
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

    // 🏢 ENTERPRISE: Merge custom metadata with standard fields
    const metadata = {
      source: 'telegram',
      uploadedAt: new Date().toISOString(),
      ...(customMetadata || {}),
    };

    // Upload buffer
    await file.save(buffer, {
      metadata: {
        contentType,
        metadata,
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
 * 🏢 ENTERPRISE: Extract media info from Telegram message
 * Includes file_unique_id for deduplication
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
      fileUniqueId: largestPhoto.file_unique_id, // 🏢 For deduplication
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
      fileUniqueId: message.document.file_unique_id, // 🏢 For deduplication
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
      fileUniqueId: message.audio.file_unique_id, // 🏢 For deduplication
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
      fileUniqueId: message.video.file_unique_id, // 🏢 For deduplication
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
      fileUniqueId: message.voice.file_unique_id, // 🏢 For deduplication
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
      fileUniqueId: message.video_note.file_unique_id, // 🏢 For deduplication
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
      fileUniqueId: message.animation.file_unique_id, // 🏢 For deduplication
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
 * 🏢 ENTERPRISE: Download and upload a single Telegram media file
 *
 * QUARANTINE GATE IMPLEMENTATION:
 * - Creates FileRecord in PENDING status
 * - Does NOT finalize to READY (stays in quarantine)
 * - Files visible in Inbox view for classification
 * - Uses canonical storage path with INGESTION domain
 *
 * @returns MessageAttachment or null on failure
 */
async function downloadAndUploadMedia(
  mediaInfo: TelegramMediaInfo,
  chatId: string,
  messageId: number,
  fromUserId: string,
  senderName: string
): Promise<MessageAttachment | null> {
  // Location and Contact don't need download - 🏢 CRITICAL: Only include metadata if present
  if (mediaInfo.type === ATTACHMENT_TYPES.LOCATION) {
    const locationAttachment: MessageAttachment = { type: ATTACHMENT_TYPES.LOCATION };
    if (mediaInfo.metadata && Object.keys(mediaInfo.metadata).length > 0) {
      locationAttachment.metadata = mediaInfo.metadata;
    }
    return locationAttachment;
  }

  if (mediaInfo.type === ATTACHMENT_TYPES.CONTACT) {
    const contactAttachment: MessageAttachment = { type: ATTACHMENT_TYPES.CONTACT };
    if (mediaInfo.metadata && Object.keys(mediaInfo.metadata).length > 0) {
      contactAttachment.metadata = mediaInfo.metadata;
    }
    return contactAttachment;
  }

  // Need to download file
  if (!mediaInfo.fileId) {
    console.warn('⚠️ No file_id for media, skipping download');
    return null;
  }

  // 🏢 ENTERPRISE: Check file size using SSoT config (FILE_TYPE_CONFIG)
  // No duplicate policy - uses centralized config with Telegram API constraint
  const maxAllowedSize = getMaxAllowedSize(mediaInfo.type);
  if (mediaInfo.fileSize && mediaInfo.fileSize > maxAllowedSize) {
    const fileType = mapAttachmentTypeToFileType(mediaInfo.type);
    console.warn(`⚠️ File too large: ${mediaInfo.fileSize} bytes > ${maxAllowedSize} (type: ${fileType}), skipping`);
    return null;
  }

  // 1. 🏢 ENTERPRISE: Tenant resolution (FAIL-CLOSED - no fallback!)
  const tenantResult = resolveCompanyIdFromTelegramWebhook();
  if (!tenantResult.companyId) {
    console.error(`❌ Tenant resolution failed: ${tenantResult.error}`);
    return null; // Fail-closed: do not process without valid company
  }
  const companyId = tenantResult.companyId;

  // 2. 🏢 ENTERPRISE: Idempotency check (prevent duplicates on webhook retries)
  // CRITICAL: Query includes companyId for tenant isolation
  const existingFileRecordId = await checkExistingFileRecord({
    companyId, // 🔒 Tenant-scoped deduplication
    chatId,
    messageId: String(messageId),
    fileUniqueId: mediaInfo.fileUniqueId,
  });
  if (existingFileRecordId) {
    console.log(`⏭️ Skipping duplicate - using existing FileRecord: ${existingFileRecordId}`);
    // Return minimal attachment with existing fileRecordId
    return {
      type: mediaInfo.type,
      metadata: {
        fileRecordId: existingFileRecordId,
        quarantined: true,
        deduplicated: true,
      },
    } as MessageAttachment;
  }

  // 3. Get file info from Telegram
  const fileInfo = await getTelegramFile(mediaInfo.fileId);
  if (!fileInfo || !fileInfo.file_path) {
    console.error('❌ Could not get file path from Telegram');
    return null;
  }

  // 4. Download file from Telegram
  const buffer = await downloadTelegramFile(fileInfo.file_path);
  if (!buffer) {
    console.error('❌ Could not download file from Telegram');
    return null;
  }

  // 5. 🏢 ENTERPRISE: Generate filename and extension
  const extension = getExtensionFromPath(fileInfo.file_path) || getExtensionFromMime(mediaInfo.mimeType);
  const filename = mediaInfo.filename || `${mediaInfo.type}_${messageId}${extension}`;
  const cleanExt = extension.startsWith('.') ? extension.slice(1) : extension;

  // 6. 🏢 ENTERPRISE: Map attachment type to file category
  const category = mapAttachmentTypeToCategory(mediaInfo.type);

  // 7. 🏢 ENTERPRISE: Create FileRecord (QUARANTINE - PENDING status)
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
    console.error('❌ Failed to create FileRecord, aborting upload');
    return null;
  }

  // 7. 🏢 ENTERPRISE: Upload to canonical storage path
  const downloadUrl = await uploadToFirebaseStorage(
    buffer,
    fileRecordResult.storagePath,
    mediaInfo.mimeType || 'application/octet-stream',
    {
      source: 'telegram',
      fileRecordId: fileRecordResult.fileRecordId,
      chatId,
      messageId: String(messageId),
    }
  );

  if (!downloadUrl) {
    console.error('❌ Could not upload to Firebase Storage');
    // TODO: Mark FileRecord as failed
    return null;
  }

  // 8. 🏢 ENTERPRISE: Update FileRecord with size and URL (but keep PENDING!)
  // QUARANTINE GATE: We update metadata but do NOT change status to READY
  try {
    const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
    const firestore = getFirestore();

    await firestore.collection(COLLECTIONS.FILES).doc(fileRecordResult.fileRecordId).update({
      sizeBytes: buffer.length,
      downloadUrl,
      updatedAt: FieldValue.serverTimestamp(),
      // 🏢 CRITICAL: Status stays PENDING (quarantine gate)
      // status: FILE_STATUS.READY, // <-- NOT setting this!
    });

    console.log(`📋 FileRecord updated (still PENDING/quarantine): ${fileRecordResult.fileRecordId}`);
  } catch (updateError) {
    console.warn('⚠️ Failed to update FileRecord with URL:', updateError);
  }

  // 9. Build MessageAttachment - 🏢 CRITICAL: Remove undefined values (Firestore rejects them)
  const attachment: MessageAttachment = {
    type: mediaInfo.type,
    url: downloadUrl,
    filename: filename,
    size: buffer.length,
  };

  // Only add optional fields if they have values (Firestore doesn't accept undefined)
  if (mediaInfo.mimeType) attachment.mimeType = mediaInfo.mimeType;
  if (mediaInfo.width !== undefined) attachment.width = mediaInfo.width;
  if (mediaInfo.height !== undefined) attachment.height = mediaInfo.height;
  if (mediaInfo.duration !== undefined) attachment.duration = mediaInfo.duration;
  if (mediaInfo.metadata && Object.keys(mediaInfo.metadata).length > 0) {
    attachment.metadata = mediaInfo.metadata;
  }

  // 🏢 ENTERPRISE: Add fileRecordId to metadata for linking
  attachment.metadata = {
    ...attachment.metadata,
    fileRecordId: fileRecordResult.fileRecordId,
    quarantined: true, // Indicates file is in quarantine
  };

  console.log(`✅ Media processed (quarantined): ${mediaInfo.type} -> ${downloadUrl}`);
  console.log(`   FileRecord: ${fileRecordResult.fileRecordId} (PENDING)`);
  return attachment;
}

/**
 * 🏢 ENTERPRISE: Process all media in a Telegram message
 *
 * QUARANTINE GATE: All files are stored with PENDING status.
 * They appear in Inbox view for classification before becoming READY.
 *
 * @returns Array of MessageAttachment (with fileRecordId in metadata)
 */
export async function processTelegramMedia(
  message: TelegramMessageObject
): Promise<MessageAttachment[]> {
  const mediaList = extractMediaFromMessage(message);

  if (mediaList.length === 0) {
    return [];
  }

  console.log(`📎 Processing ${mediaList.length} media item(s) from message ${message.message_id}`);
  console.log(`🏢 QUARANTINE: Files will be stored with PENDING status (Inbox view)`);

  const attachments: MessageAttachment[] = [];
  const chatId = String(message.chat.id);

  // 🏢 ENTERPRISE: Extract sender info for source metadata
  const fromUserId = message.from?.id ? String(message.from.id) : 'unknown';
  const senderName = message.from?.first_name || message.from?.username || 'Unknown';

  for (const media of mediaList) {
    try {
      const attachment = await downloadAndUploadMedia(
        media,
        chatId,
        message.message_id,
        fromUserId,
        senderName
      );
      if (attachment) {
        attachments.push(attachment);
      }
    } catch (error) {
      console.error(`❌ Failed to process media ${media.type}:`, error);
    }
  }

  console.log(`✅ Processed ${attachments.length}/${mediaList.length} media items (all quarantined)`);
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
