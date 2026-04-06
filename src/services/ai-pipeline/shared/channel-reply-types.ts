/**
 * =============================================================================
 * CHANNEL REPLY DISPATCHER — TYPES & CHANNEL ID EXTRACTION
 * =============================================================================
 *
 * Types and utilities for the channel reply dispatcher.
 * Extracted from channel-reply-dispatcher.ts for SRP compliance (ADR-065).
 *
 * @module services/ai-pipeline/shared/channel-reply-types
 * @see ADR-132 (UC Modules Expansion + Telegram Channel)
 * @see ADR-080 (Pipeline Implementation)
 */

import type { PipelineChannelValue, PipelineContext } from '@/types/ai-pipeline';

// ============================================================================
// TYPES
// ============================================================================

/** Parameters for sending a reply via any channel */
export interface ChannelReplyParams {
  /** The channel to send the reply through */
  channel: PipelineChannelValue;
  /** Recipient email address (required for email channel) */
  recipientEmail?: string;
  /** Telegram chat ID (required for telegram channel) */
  telegramChatId?: string;
  /** WhatsApp phone number (required for whatsapp channel) */
  whatsappPhone?: string;
  /** Messenger PSID (required for messenger channel) */
  messengerPsid?: string;
  /** Instagram IGSID (required for instagram channel) */
  instagramIgsid?: string;
  /** In-app voice command document ID (required for in_app channel) */
  inAppCommandId?: string;
  /** Email subject (email only) */
  subject?: string;
  /** Reply text body */
  textBody: string;
  /** HTML body (email only — branded template) */
  htmlBody?: string;
  /** File attachments (email only) */
  attachments?: Array<{ filename: string; content: Buffer | Blob; contentType: string }>;
  /** Pipeline request ID for correlation */
  requestId: string;
}

/** Parameters for sending a media file via any channel (SPEC-257F) */
export interface ChannelMediaReplyParams {
  /** The channel to send the media through */
  channel: PipelineChannelValue;
  /** Telegram chat ID (required for telegram channel) */
  telegramChatId?: string;
  /** Recipient email address (required for email channel) */
  recipientEmail?: string;
  /** WhatsApp phone number (required for whatsapp channel) */
  whatsappPhone?: string;
  /** Messenger PSID (required for messenger channel) */
  messengerPsid?: string;
  /** Instagram IGSID (required for instagram channel) */
  instagramIgsid?: string;
  /** In-app voice command document ID (required for in_app channel) */
  inAppCommandId?: string;
  /** Direct download URL of the media file */
  mediaUrl: string;
  /** Media type: photo for images, document for PDFs/files */
  mediaType: 'photo' | 'document';
  /** Caption to accompany the media */
  caption?: string;
  /** Filename for document attachments */
  filename?: string;
  /** MIME content type (e.g. image/jpeg, application/pdf) */
  contentType?: string;
  /** Pipeline request ID for correlation */
  requestId: string;
}

/** Result of sending a channel reply */
export interface ChannelReplyResult {
  /** Whether the reply was sent successfully */
  success: boolean;
  /** Provider-specific message ID */
  messageId?: string;
  /** Error message if failed */
  error?: string;
  /** Channel used for sending */
  channel: PipelineChannelValue;
}

// ============================================================================
// CHANNEL ID EXTRACTION — SSoT for all sendChannelReply() callers
// ============================================================================

/** Channel-specific IDs extracted from PipelineContext */
export type ChannelIds = Pick<ChannelReplyParams,
  | 'recipientEmail' | 'telegramChatId' | 'whatsappPhone'
  | 'messengerPsid' | 'instagramIgsid' | 'inAppCommandId'
>;

/**
 * Extract all channel-specific IDs from a PipelineContext.
 * SSoT: ONE place to add new channels — used by orchestrator + all UC modules.
 *
 * @example
 * ```ts
 * await sendChannelReply({
 *   ...extractChannelIds(ctx),
 *   channel: ctx.intake.channel,
 *   textBody: 'Hello!',
 *   requestId: ctx.requestId,
 * });
 * ```
 */
export function extractChannelIds(ctx: PipelineContext): ChannelIds {
  return {
    recipientEmail: ctx.intake.normalized.sender.email,
    telegramChatId: ctx.intake.normalized.sender.telegramId
      ?? (ctx.intake.rawPayload?.chatId as string | undefined),
    whatsappPhone: ctx.intake.normalized.sender.whatsappPhone
      ?? (ctx.intake.rawPayload?.phoneNumber as string | undefined),
    messengerPsid: ctx.intake.normalized.sender.messengerUserId
      ?? (ctx.intake.rawPayload?.psid as string | undefined),
    instagramIgsid: ctx.intake.normalized.sender.instagramUserId
      ?? (ctx.intake.rawPayload?.igsid as string | undefined),
    // ADR-164: In-app voice command ID
    inAppCommandId: ctx.intake.rawPayload?.commandId as string | undefined,
  };
}
