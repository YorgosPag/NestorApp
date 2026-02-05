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

/**
 * 🏢 ENTERPRISE: Inbound Email Input
 *
 * Follows Gmail/Outlook/Salesforce pattern:
 * - contentText: Plain text for search/preview/fallback
 * - contentHtml: Rich HTML with formatting (colors, fonts, etc.)
 *
 * @enterprise Dual-content storage for maximum compatibility
 */
export interface InboundEmailInput {
  provider: string;
  providerMessageId: string;
  sender: ParsedAddress;
  recipients: string[];
  subject: string;
  /** Plain text content (for search, preview, fallback) */
  contentText: string;
  /** HTML content with formatting (colors, fonts, styles) - Optional */
  contentHtml?: string;
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

// ============================================================================
// 🏢 ENTERPRISE: MAILGUN STORAGE API (ADR-071 Enhancement)
// ============================================================================

/**
 * Mailgun Storage Information for Deferred Attachment Download
 *
 * Mailgun stores messages for 3 days, allowing the "Store Reference, Fetch Later"
 * pattern used by enterprise email systems (SAP, Salesforce, Microsoft).
 *
 * @see https://documentation.mailgun.com/en/latest/api-sending-messages.html#retrieving-stored-messages
 */
export interface MailgunStorageInfo {
  /** Full URL to retrieve the stored message */
  messageUrl: string;

  /** Storage key extracted from URL */
  storageKey?: string;

  /** Mailgun region (affects API endpoint) */
  region: 'eu' | 'us';
}
