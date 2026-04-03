import type { AttachmentType } from '@/types/conversations';
import { ATTACHMENT_TYPES } from '@/types/conversations';
import { FILE_CATEGORIES, type FileCategory } from '@/config/domain-constants';
import { FILE_TYPE_CONFIG, type FileType } from '@/config/file-upload-config';

export function mapAttachmentTypeToCategory(type: AttachmentType): FileCategory {
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

export function mapAttachmentTypeToFileType(type: AttachmentType): FileType {
  switch (type) {
    case ATTACHMENT_TYPES.IMAGE:
      return 'image';
    case ATTACHMENT_TYPES.VIDEO:
      return 'video';
    case ATTACHMENT_TYPES.AUDIO:
      return 'any';
    case ATTACHMENT_TYPES.DOCUMENT:
      return 'document';
    default:
      return 'any';
  }
}

export function getMaxAllowedSize(attachmentType: AttachmentType): number {
  const fileType = mapAttachmentTypeToFileType(attachmentType);
  const configMaxSize = FILE_TYPE_CONFIG[fileType].maxSize;
  const telegramApiLimit = 20 * 1024 * 1024;
  return Math.min(configMaxSize, telegramApiLimit);
}

export function getExtensionFromPath(filePath: string): string {
  const match = filePath.match(/\.([a-zA-Z0-9]+)$/);
  return match ? '.' + match[1] : '';
}

export function getExtensionFromMime(mimeType?: string): string {
  if (!mimeType) {
    return '';
  }

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
