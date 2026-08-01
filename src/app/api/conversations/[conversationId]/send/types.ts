/**
 * @fileoverview Σχήμα αιτήματος/απάντησης της διαδρομής αποστολής μηνύματος
 *
 * Εξήχθη από το `route.ts` (310 γρ. έναντι ορίου 300 για API route, N.7.1) μετά
 * την εξαγωγή του {@link ../store-outbound-message}: οι δηλώσεις σχήματος δεν
 * είναι λογική και δεν έχουν λόγο να καταναλώνουν το όριο του χειριστή.
 */

import type { ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';

// ============================================================================
// TYPES (ADR-055 - Enterprise Attachment System)
// ============================================================================

/**
 * Attachment in request body (already uploaded to Storage)
 * @enterprise ADR-055 - Canonical attachment format
 */
export interface RequestAttachment {
  type: 'image' | 'document' | 'audio' | 'video' | 'location' | 'contact';
  url: string;
  filename?: string;
  mimeType?: string;
  size?: number;
}

export interface SendMessageRequest {
  /** Text content (optional if attachments present) */
  text?: string;
  /** Reply to a specific message */
  replyToMessageId?: string;
  /** Parse mode for Telegram */
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  /** 🏢 ENTERPRISE: Attachments (ADR-055) */
  attachments?: RequestAttachment[];
}

export interface SendMessageResponse {
  success: boolean;
  messageId: string | null;
  providerMessageId: number | null;
  conversationId: string;
  sentAt: string;
}

/** Canonical response envelope (ADR-245). */
export type SendMessageCanonicalResponse = ApiSuccessResponse<SendMessageResponse>;
