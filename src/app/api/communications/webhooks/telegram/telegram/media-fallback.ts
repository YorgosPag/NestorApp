/**
 * FIND-J: Build lightweight attachment stubs when media download fails.
 * Provides enough metadata for the AI to know an attachment was sent,
 * even without the actual file content.
 *
 * @module api/communications/webhooks/telegram/telegram/media-fallback
 */

import type { TelegramMessage } from './types';
import type { MessageAttachment } from '@/types/conversations';

export function buildFallbackAttachments(
  message: TelegramMessage['message']
): MessageAttachment[] {
  if (!message) return [];
  const result: MessageAttachment[] = [];

  if (message.photo && message.photo.length > 0) {
    result.push({
      type: 'image',
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: message.photo[message.photo.length - 1]?.file_size,
    });
  }
  if (message.document) {
    result.push({
      type: 'document',
      filename: message.document.file_name ?? 'document',
      mimeType: message.document.mime_type ?? 'application/octet-stream',
      size: message.document.file_size,
    });
  }
  if (message.audio) {
    result.push({
      type: 'audio',
      filename: message.audio.title ?? 'audio',
      mimeType: message.audio.mime_type ?? 'audio/mpeg',
      size: message.audio.file_size,
    });
  }
  if (message.video) {
    result.push({
      type: 'video',
      filename: 'video.mp4',
      mimeType: message.video.mime_type ?? 'video/mp4',
      size: message.video.file_size,
    });
  }
  // Voice excluded — transcribed to text via Whisper, not stored as file

  return result;
}
