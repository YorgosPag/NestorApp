import type { MessageAttachment } from '@/types/conversations';

export interface ParsedAddress {
  email: string;
  name?: string;
}

export interface InboundAttachmentDownload {
  buffer: Buffer;
  contentType: string;
}

export interface InboundEmailAttachment {
  filename: string;
  contentType: string;
  sizeBytes?: number;
  download: () => Promise<InboundAttachmentDownload | null>;
}

export interface InboundEmailInput {
  provider: string;
  providerMessageId: string;
  sender: ParsedAddress;
  recipients: string[];
  subject: string;
  contentText: string;
  receivedAt?: string;
  attachments?: InboundEmailAttachment[];
  raw?: Record<string, unknown>;
}

export interface InboundEmailResult {
  processed: boolean;
  skipped: boolean;
  reason?: string;
  communicationId?: string;
  attachments?: MessageAttachment[];
}

export interface InboundRoutingRule {
  pattern: string;
  companyId: string;
  isActive?: boolean;
}

export interface RoutingResolution {
  companyId: string | null;
  matchedPattern?: string;
}
