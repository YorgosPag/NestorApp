/**
 * =============================================================================
 * 🏢 ENTERPRISE: CHANNEL REPLY DISPATCHER
 * =============================================================================
 *
 * Centralized dispatcher that routes outbound replies to the appropriate
 * channel (Email via Mailgun, Telegram, etc.).
 *
 * Eliminates channel-specific coupling in UC modules — modules call
 * sendChannelReply() and the dispatcher handles the rest.
 *
 * @module services/ai-pipeline/shared/channel-reply-dispatcher
 * @see ADR-132 (UC Modules Expansion + Telegram Channel)
 * @see ADR-080 (Pipeline Implementation)
 */

import 'server-only';

import { PipelineChannel } from '@/types/ai-pipeline';
import type { PipelineChannelValue, PipelineContext } from '@/types/ai-pipeline';
import { sendReplyViaMailgun } from './mailgun-sender';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('CHANNEL_REPLY_DISPATCHER');

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

// ============================================================================
// DISPATCHER
// ============================================================================

/**
 * Send a reply through the appropriate channel.
 *
 * Routes to:
 * - `email` → sendReplyViaMailgun()
 * - `telegram` → sendTelegramMessage() (dynamic import)
 * - Other → error (unsupported_channel)
 *
 * @param params Channel-agnostic reply parameters
 * @returns Result with success status and optional messageId
 */
export async function sendChannelReply(
  params: ChannelReplyParams
): Promise<ChannelReplyResult> {
  const { channel, requestId } = params;

  logger.info('Dispatching reply', {
    requestId,
    channel,
    hasEmail: !!params.recipientEmail,
    hasTelegramChat: !!params.telegramChatId,
    hasInAppCommand: !!params.inAppCommandId,
    hasWhatsAppPhone: !!params.whatsappPhone,
    hasMessengerPsid: !!params.messengerPsid,
    hasInstagramIgsid: !!params.instagramIgsid,
  });

  switch (channel) {
    case PipelineChannel.EMAIL:
      return dispatchEmail(params);

    case PipelineChannel.TELEGRAM:
      return dispatchTelegram(params);

    case PipelineChannel.WHATSAPP:
      return dispatchWhatsApp(params);

    case PipelineChannel.MESSENGER:
      return dispatchMessenger(params);

    case PipelineChannel.INSTAGRAM:
      return dispatchInstagram(params);

    case PipelineChannel.IN_APP:
      return dispatchInApp(params);

    default:
      logger.warn('Unsupported channel for reply dispatch', {
        requestId,
        channel,
      });
      return {
        success: false,
        error: `Unsupported reply channel: ${channel}`,
        channel,
      };
  }
}

// ============================================================================
// CHANNEL-SPECIFIC DISPATCHERS
// ============================================================================

/**
 * Dispatch reply via Mailgun email
 */
async function dispatchEmail(params: ChannelReplyParams): Promise<ChannelReplyResult> {
  const { recipientEmail, subject, textBody, htmlBody, requestId } = params;

  if (!recipientEmail) {
    logger.warn('Email dispatch: no recipient email', { requestId });
    return {
      success: false,
      error: 'No recipient email for email channel',
      channel: PipelineChannel.EMAIL,
    };
  }

  const result = await sendReplyViaMailgun({
    to: recipientEmail,
    subject: subject ?? 'Απάντηση',
    textBody,
    htmlBody,
    attachments: params.attachments,
  });

  return {
    success: result.success,
    messageId: result.messageId,
    error: result.error,
    channel: PipelineChannel.EMAIL,
  };
}

/**
 * Dispatch reply via Telegram Bot API
 * Uses dynamic import to avoid build issues with telegram client
 */
async function dispatchTelegram(params: ChannelReplyParams): Promise<ChannelReplyResult> {
  const { telegramChatId, textBody, requestId } = params;

  if (!telegramChatId) {
    logger.warn('Telegram dispatch: no chat ID', { requestId });
    return {
      success: false,
      error: 'No Telegram chat ID for telegram channel',
      channel: PipelineChannel.TELEGRAM,
    };
  }

  try {
    // Dynamic import to avoid circular dependencies and build issues
    const { sendTelegramMessage } = await import(
      '@/app/api/communications/webhooks/telegram/telegram/client'
    );

    const result = await sendTelegramMessage({
      chat_id: Number(telegramChatId),
      text: textBody,
    });

    if (result.success) {
      logger.info('Telegram reply sent', {
        requestId,
        chatId: telegramChatId,
      });
      return {
        success: true,
        messageId: String(telegramChatId),
        channel: PipelineChannel.TELEGRAM,
      };
    }

    logger.warn('Telegram reply failed', {
      requestId,
      error: result.error,
    });
    return {
      success: false,
      error: result.error ?? 'Telegram send failed',
      channel: PipelineChannel.TELEGRAM,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error('Telegram dispatch error', {
      requestId,
      error: errorMessage,
    });
    return {
      success: false,
      error: `Telegram dispatch error: ${errorMessage}`,
      channel: PipelineChannel.TELEGRAM,
    };
  }
}

/**
 * Dispatch reply via WhatsApp Cloud API
 * Uses dynamic import to avoid build issues with WhatsApp client
 *
 * @see ADR-174 (Meta Omnichannel — WhatsApp)
 */
async function dispatchWhatsApp(params: ChannelReplyParams): Promise<ChannelReplyResult> {
  const { whatsappPhone, textBody, requestId } = params;

  if (!whatsappPhone) {
    logger.warn('WhatsApp dispatch: no phone number', { requestId });
    return {
      success: false,
      error: 'No WhatsApp phone number for whatsapp channel',
      channel: PipelineChannel.WHATSAPP,
    };
  }

  try {
    // Dynamic import to avoid circular dependencies and build issues
    const { sendWhatsAppMessage } = await import(
      '@/app/api/communications/webhooks/whatsapp/whatsapp-client'
    );

    const result = await sendWhatsAppMessage(whatsappPhone, textBody);

    if (result.success) {
      logger.info('WhatsApp reply sent', {
        requestId,
        phone: whatsappPhone.slice(-4), // Privacy: last 4 digits only
      });
      return {
        success: true,
        messageId: result.messageId ?? undefined,
        channel: PipelineChannel.WHATSAPP,
      };
    }

    logger.warn('WhatsApp reply failed', {
      requestId,
      error: result.error,
    });
    return {
      success: false,
      error: result.error ?? 'WhatsApp send failed',
      channel: PipelineChannel.WHATSAPP,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error('WhatsApp dispatch error', {
      requestId,
      error: errorMessage,
    });
    return {
      success: false,
      error: `WhatsApp dispatch error: ${errorMessage}`,
      channel: PipelineChannel.WHATSAPP,
    };
  }
}

/**
 * Dispatch reply via Facebook Messenger Send API
 * Uses dynamic import to avoid build issues with Messenger client
 *
 * @see ADR-174 (Meta Omnichannel — Messenger)
 */
async function dispatchMessenger(params: ChannelReplyParams): Promise<ChannelReplyResult> {
  const { messengerPsid, textBody, requestId } = params;

  if (!messengerPsid) {
    logger.warn('Messenger dispatch: no PSID', { requestId });
    return {
      success: false,
      error: 'No Messenger PSID for messenger channel',
      channel: PipelineChannel.MESSENGER,
    };
  }

  try {
    const { sendMessengerMessage } = await import(
      '@/app/api/communications/webhooks/messenger/messenger-client'
    );

    const result = await sendMessengerMessage(messengerPsid, textBody);

    if (result.success) {
      logger.info('Messenger reply sent', {
        requestId,
        psid: messengerPsid.slice(-4),
      });
      return {
        success: true,
        messageId: result.messageId ?? undefined,
        channel: PipelineChannel.MESSENGER,
      };
    }

    logger.warn('Messenger reply failed', {
      requestId,
      error: result.error,
    });
    return {
      success: false,
      error: result.error ?? 'Messenger send failed',
      channel: PipelineChannel.MESSENGER,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error('Messenger dispatch error', {
      requestId,
      error: errorMessage,
    });
    return {
      success: false,
      error: `Messenger dispatch error: ${errorMessage}`,
      channel: PipelineChannel.MESSENGER,
    };
  }
}

/**
 * Dispatch reply via Instagram Messaging API
 * Uses dynamic import to avoid build issues with Instagram client
 *
 * @see ADR-174 (Meta Omnichannel — Instagram)
 */
async function dispatchInstagram(params: ChannelReplyParams): Promise<ChannelReplyResult> {
  const { instagramIgsid, textBody, requestId } = params;

  if (!instagramIgsid) {
    logger.warn('Instagram dispatch: no IGSID', { requestId });
    return {
      success: false,
      error: 'No Instagram IGSID for instagram channel',
      channel: PipelineChannel.INSTAGRAM,
    };
  }

  try {
    const { sendInstagramMessage } = await import(
      '@/app/api/communications/webhooks/instagram/instagram-client'
    );

    const result = await sendInstagramMessage(instagramIgsid, textBody);

    if (result.success) {
      logger.info('Instagram reply sent', {
        requestId,
        igsid: instagramIgsid.slice(-4),
      });
      return {
        success: true,
        messageId: result.messageId ?? undefined,
        channel: PipelineChannel.INSTAGRAM,
      };
    }

    logger.warn('Instagram reply failed', {
      requestId,
      error: result.error,
    });
    return {
      success: false,
      error: result.error ?? 'Instagram send failed',
      channel: PipelineChannel.INSTAGRAM,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error('Instagram dispatch error', {
      requestId,
      error: errorMessage,
    });
    return {
      success: false,
      error: `Instagram dispatch error: ${errorMessage}`,
      channel: PipelineChannel.INSTAGRAM,
    };
  }
}

/**
 * Dispatch reply via In-App voice command update (ADR-164)
 * Updates the voice_commands Firestore document with the AI response.
 */
async function dispatchInApp(params: ChannelReplyParams): Promise<ChannelReplyResult> {
  const { inAppCommandId, textBody, requestId } = params;

  if (!inAppCommandId) {
    logger.warn('In-app dispatch: no command ID', { requestId });
    return {
      success: false,
      error: 'No in-app command ID for in_app channel',
      channel: PipelineChannel.IN_APP,
    };
  }

  try {
    const adminDb = getAdminFirestore();
    await adminDb
      .collection(COLLECTIONS.VOICE_COMMANDS)
      .doc(inAppCommandId)
      .update({
        status: 'completed',
        aiResponse: textBody,
        completedAt: new Date().toISOString(),
      });

    logger.info('In-app reply dispatched', {
      requestId,
      commandId: inAppCommandId,
    });

    return {
      success: true,
      messageId: inAppCommandId,
      channel: PipelineChannel.IN_APP,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error('In-app dispatch error', {
      requestId,
      commandId: inAppCommandId,
      error: errorMessage,
    });
    return {
      success: false,
      error: `In-app dispatch error: ${errorMessage}`,
      channel: PipelineChannel.IN_APP,
    };
  }
}

// ============================================================================
// SPEC-257F: MEDIA REPLY DISPATCHER
// ============================================================================

/**
 * Send a media file (photo/document) through the appropriate channel.
 *
 * Routes to:
 * - `telegram` → sendPhoto / sendDocument via Bot API
 * - `email` → download file + attach via Mailgun
 * - Other channels → text fallback with download link
 *
 * @param params Channel-agnostic media reply parameters
 * @returns Result with success status
 *
 * @see SPEC-257F (Photo & Floorplan Delivery)
 */
export async function sendChannelMediaReply(
  params: ChannelMediaReplyParams
): Promise<ChannelReplyResult> {
  const { channel, requestId } = params;

  logger.info('Dispatching media reply', {
    requestId,
    channel,
    mediaType: params.mediaType,
    hasCaption: !!params.caption,
  });

  switch (channel) {
    case PipelineChannel.TELEGRAM:
      return dispatchTelegramMedia(params);

    case PipelineChannel.EMAIL:
      return dispatchEmailMedia(params);

    case PipelineChannel.WHATSAPP:
      return dispatchTextFallback(params, 'whatsapp');

    case PipelineChannel.MESSENGER:
      return dispatchTextFallback(params, 'messenger');

    case PipelineChannel.INSTAGRAM:
      if (params.mediaType === 'document') {
        return {
          success: false,
          error: 'Τα αρχεία PDF δεν υποστηρίζονται στο Instagram. Ζητήστε μέσω email ή Telegram.',
          channel: PipelineChannel.INSTAGRAM,
        };
      }
      return dispatchTextFallback(params, 'instagram');

    case PipelineChannel.IN_APP:
      return dispatchInAppMedia(params);

    default:
      return {
        success: false,
        error: `Unsupported media channel: ${channel}`,
        channel,
      };
  }
}

// ── Telegram: Native sendPhoto / sendDocument ──

async function dispatchTelegramMedia(
  params: ChannelMediaReplyParams
): Promise<ChannelReplyResult> {
  const { telegramChatId, mediaUrl, mediaType, caption, requestId } = params;

  if (!telegramChatId) {
    return {
      success: false,
      error: 'No Telegram chat ID for media dispatch',
      channel: PipelineChannel.TELEGRAM,
    };
  }

  try {
    const { sendTelegramMessage } = await import(
      '@/app/api/communications/webhooks/telegram/telegram/client'
    );

    const method = mediaType === 'photo' ? 'sendPhoto' : 'sendDocument';
    const mediaKey = mediaType === 'photo' ? 'photo' : 'document';

    const result = await sendTelegramMessage({
      method,
      chat_id: Number(telegramChatId),
      [mediaKey]: mediaUrl,
      ...(caption ? { caption } : {}),
    });

    if (result.success) {
      logger.info('Telegram media sent', { requestId, mediaType, chatId: telegramChatId });
      return { success: true, messageId: String(telegramChatId), channel: PipelineChannel.TELEGRAM };
    }

    logger.warn('Telegram media send failed', { requestId, error: result.error });
    return { success: false, error: result.error ?? 'Telegram media send failed', channel: PipelineChannel.TELEGRAM };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error('Telegram media dispatch error', { requestId, error: errorMessage });
    return { success: false, error: `Telegram media error: ${errorMessage}`, channel: PipelineChannel.TELEGRAM };
  }
}

// ── Email: Download file + attach via Mailgun ──

async function dispatchEmailMedia(
  params: ChannelMediaReplyParams
): Promise<ChannelReplyResult> {
  const { recipientEmail, mediaUrl, caption, filename, contentType, requestId } = params;

  if (!recipientEmail) {
    return {
      success: false,
      error: 'No recipient email for media dispatch',
      channel: PipelineChannel.EMAIL,
    };
  }

  try {
    // Download file to Buffer
    const response = await fetch(mediaUrl);
    if (!response.ok) {
      return { success: false, error: `Αποτυχία λήψης αρχείου (HTTP ${response.status})`, channel: PipelineChannel.EMAIL };
    }
    const buffer = Buffer.from(await response.arrayBuffer());

    const result = await sendReplyViaMailgun({
      to: recipientEmail,
      subject: caption ?? 'Αρχείο από Pagonis Nestor',
      textBody: caption ?? 'Σας αποστέλλουμε το ζητούμενο αρχείο.',
      attachments: [{
        filename: filename ?? 'attachment',
        content: buffer,
        contentType: contentType ?? 'application/octet-stream',
      }],
    });

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
      channel: PipelineChannel.EMAIL,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error('Email media dispatch error', { requestId, error: errorMessage });
    return { success: false, error: `Email media error: ${errorMessage}`, channel: PipelineChannel.EMAIL };
  }
}

// ── Text Fallback: Send caption + download link (WhatsApp, Messenger, Instagram) ──

async function dispatchTextFallback(
  params: ChannelMediaReplyParams,
  channelName: 'whatsapp' | 'messenger' | 'instagram'
): Promise<ChannelReplyResult> {
  const { caption, mediaUrl, requestId } = params;
  const textBody = caption
    ? `${caption}\n\n📎 ${mediaUrl}`
    : `📎 ${mediaUrl}`;

  return sendChannelReply({
    channel: channelName,
    telegramChatId: params.telegramChatId,
    recipientEmail: params.recipientEmail,
    whatsappPhone: params.whatsappPhone,
    messengerPsid: params.messengerPsid,
    instagramIgsid: params.instagramIgsid,
    inAppCommandId: params.inAppCommandId,
    textBody,
    requestId,
  });
}

// ── In-App: Store file URL in voice command document ──

async function dispatchInAppMedia(
  params: ChannelMediaReplyParams
): Promise<ChannelReplyResult> {
  const { inAppCommandId, caption, mediaUrl, requestId } = params;

  if (!inAppCommandId) {
    return {
      success: false,
      error: 'No in-app command ID for media dispatch',
      channel: PipelineChannel.IN_APP,
    };
  }

  try {
    const adminDb = getAdminFirestore();
    await adminDb
      .collection(COLLECTIONS.VOICE_COMMANDS)
      .doc(inAppCommandId)
      .update({
        status: 'completed',
        aiResponse: caption ?? 'Αρχείο',
        fileUrl: mediaUrl,
        completedAt: new Date().toISOString(),
      });

    return { success: true, messageId: inAppCommandId, channel: PipelineChannel.IN_APP };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error('In-app media dispatch error', { requestId, error: errorMessage });
    return { success: false, error: `In-app media error: ${errorMessage}`, channel: PipelineChannel.IN_APP };
  }
}
