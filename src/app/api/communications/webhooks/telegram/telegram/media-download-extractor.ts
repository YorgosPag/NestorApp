import type { TelegramMessageObject } from './types';
import type { MessageAttachment } from '@/types/conversations';
import { ATTACHMENT_TYPES } from '@/types/conversations';
import type { TelegramMediaInfo } from './media-download-types';

function buildLocationAttachmentMetadata(message: TelegramMessageObject): Record<string, unknown> | null {
  if (!message.location) {
    return null;
  }

  return {
    latitude: message.location.latitude,
    longitude: message.location.longitude,
    horizontalAccuracy: message.location.horizontal_accuracy,
  };
}

function buildContactAttachmentMetadata(message: TelegramMessageObject): Record<string, unknown> | null {
  if (!message.contact) {
    return null;
  }

  return {
    phoneNumber: message.contact.phone_number,
    firstName: message.contact.first_name,
    lastName: message.contact.last_name,
    userId: message.contact.user_id,
    name: `${message.contact.first_name} ${message.contact.last_name || ''}`.trim(),
    phone: message.contact.phone_number,
  };
}

export function extractMediaFromMessage(message: TelegramMessageObject): TelegramMediaInfo[] {
  const mediaList: TelegramMediaInfo[] = [];

  if (message.photo && message.photo.length > 0) {
    const largestPhoto = message.photo.reduce((prev, curr) =>
      (curr.file_size || 0) > (prev.file_size || 0) ? curr : prev,
    );

    mediaList.push({
      fileId: largestPhoto.file_id,
      fileUniqueId: largestPhoto.file_unique_id,
      type: ATTACHMENT_TYPES.IMAGE,
      mimeType: 'image/jpeg',
      fileSize: largestPhoto.file_size,
      width: largestPhoto.width,
      height: largestPhoto.height,
    });
  }

  if (message.document) {
    mediaList.push({
      fileId: message.document.file_id,
      fileUniqueId: message.document.file_unique_id,
      type: ATTACHMENT_TYPES.DOCUMENT,
      filename: message.document.file_name,
      mimeType: message.document.mime_type,
      fileSize: message.document.file_size,
    });
  }

  if (message.audio) {
    mediaList.push({
      fileId: message.audio.file_id,
      fileUniqueId: message.audio.file_unique_id,
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

  if (message.video) {
    mediaList.push({
      fileId: message.video.file_id,
      fileUniqueId: message.video.file_unique_id,
      type: ATTACHMENT_TYPES.VIDEO,
      filename: message.video.file_name,
      mimeType: message.video.mime_type || 'video/mp4',
      fileSize: message.video.file_size,
      width: message.video.width,
      height: message.video.height,
      duration: message.video.duration,
    });
  }

  if (message.video_note) {
    mediaList.push({
      fileId: message.video_note.file_id,
      fileUniqueId: message.video_note.file_unique_id,
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

  if (message.animation) {
    mediaList.push({
      fileId: message.animation.file_id,
      fileUniqueId: message.animation.file_unique_id,
      type: ATTACHMENT_TYPES.VIDEO,
      filename: message.animation.file_name || `animation_${message.message_id}.mp4`,
      mimeType: message.animation.mime_type || 'video/mp4',
      fileSize: message.animation.file_size,
      width: message.animation.width,
      height: message.animation.height,
      duration: message.animation.duration,
      metadata: { isAnimation: true },
    });
  }

  const locationMetadata = buildLocationAttachmentMetadata(message);
  if (locationMetadata) {
    mediaList.push({
      fileId: '',
      type: ATTACHMENT_TYPES.LOCATION,
      metadata: locationMetadata,
    });
  }

  const contactMetadata = buildContactAttachmentMetadata(message);
  if (contactMetadata) {
    mediaList.push({
      fileId: '',
      type: ATTACHMENT_TYPES.CONTACT,
      metadata: contactMetadata,
    });
  }

  return mediaList;
}

export function hasMedia(message: TelegramMessageObject): boolean {
  return !!(
    message.photo ||
    message.document ||
    message.audio ||
    message.video ||
    message.video_note ||
    message.animation ||
    message.location ||
    message.contact
  );
}

export function createMetadataOnlyAttachment(type: MessageAttachment['type'], metadata?: Record<string, unknown>): MessageAttachment {
  const attachment: MessageAttachment = { type };
  if (metadata && Object.keys(metadata).length > 0) {
    attachment.metadata = metadata;
  }
  return attachment;
}
