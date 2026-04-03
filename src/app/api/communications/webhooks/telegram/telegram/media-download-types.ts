import type { MessageAttachment, AttachmentType } from '@/types/conversations';

export interface MediaDownloadResult {
  success: boolean;
  attachment?: MessageAttachment;
  error?: string;
}

export interface TelegramMediaInfo {
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

export interface ServerFileRecordResult {
  fileRecordId: string;
  storagePath: string;
  displayName: string;
}

export interface TenantResolutionResult {
  companyId: string | null;
  error?: string;
}
