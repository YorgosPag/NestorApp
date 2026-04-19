/**
 * =============================================================================
 * CHANNEL MEDIA DISPATCHER — SPEC-257F
 * =============================================================================
 *
 * Dispatches media files (photos, documents) through the appropriate channel.
 * Extracted from channel-reply-dispatcher.ts for SRP compliance (ADR-065).
 *
 * @module services/ai-pipeline/shared/channel-media-dispatcher
 * @see SPEC-257F (Photo & Floorplan Delivery)
 * @see ADR-132 (UC Modules Expansion + Telegram Channel)
 */

import 'server-only';

import { PipelineChannel } from '@/types/ai-pipeline';
import { sendReplyViaMailgun } from './mailgun-sender';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import type { ChannelMediaReplyParams, ChannelReplyResult } from './channel-reply-types';
import { sendChannelReply } from './channel-reply-dispatcher';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('CHANNEL_MEDIA_DISPATCHER');

// ============================================================================
// MEDIA REPLY DISPATCHER
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

// Telegram's URL-mode `sendPhoto` fails on Firebase Storage download-token
// URLs with `Bad Request: wrong remote file identifier specified: Wrong string
// length` — Telegram's downloader can't parse the tokenized URL and falls back
// to `file_id` interpretation. We sidestep the URL parser entirely by
// downloading the binary ourselves and uploading via multipart/form-data
// (ADR-312 Phase 9.14). Telegram limits: 10 MB photo / 50 MB document.
const TELEGRAM_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const TELEGRAM_DOCUMENT_MAX_BYTES = 50 * 1024 * 1024;

function filenameFromUrl(mediaUrl: string, fallbackExt: string): string {
  try {
    const pathname = new URL(mediaUrl).pathname;
    const last = pathname.split('/').pop();
    if (last && last.includes('.')) return decodeURIComponent(last);
  } catch {
    /* fall through */
  }
  return `attachment.${fallbackExt}`;
}

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
    const response = await fetch(mediaUrl);
    if (!response.ok) {
      const err = `Αποτυχία λήψης αρχείου (HTTP ${response.status})`;
      logger.warn('Telegram media fetch failed', { requestId, status: response.status });
      return { success: false, error: err, channel: PipelineChannel.TELEGRAM };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const maxBytes = mediaType === 'photo' ? TELEGRAM_PHOTO_MAX_BYTES : TELEGRAM_DOCUMENT_MAX_BYTES;
    if (buffer.byteLength > maxBytes) {
      const mb = (buffer.byteLength / 1024 / 1024).toFixed(1);
      const limitMb = (maxBytes / 1024 / 1024).toFixed(0);
      return {
        success: false,
        error: `Το αρχείο είναι ${mb}MB — το Telegram επιτρέπει έως ${limitMb}MB για αυτό τον τύπο.`,
        channel: PipelineChannel.TELEGRAM,
      };
    }

    const contentType =
      params.contentType ?? response.headers.get('content-type') ?? 'application/octet-stream';

    // A photo dispatch with a non-image payload is always a caller bug — e.g.
    // the showcase share-token URL (`/shared/{token}`) being passed in place
    // of an image URL. Telegram responds with a cryptic
    // `Bad Request: IMAGE_PROCESS_FAILED`; we short-circuit with a clear,
    // routable error instead (ADR-312 Phase 9.15).
    if (mediaType === 'photo' && !/^image\//i.test(contentType)) {
      logger.warn('Telegram photo dispatch aborted: non-image content-type', {
        requestId,
        contentType,
        mediaUrl,
      });
      return {
        success: false,
        error: `NOT_AN_IMAGE:${contentType}`,
        channel: PipelineChannel.TELEGRAM,
      };
    }

    const filename =
      params.filename ?? filenameFromUrl(mediaUrl, mediaType === 'photo' ? 'jpg' : 'bin');

    const { sendTelegramMediaMultipart } = await import(
      '@/app/api/communications/webhooks/telegram/telegram/client'
    );

    const method = mediaType === 'photo' ? 'sendPhoto' : 'sendDocument';
    const mediaKey = mediaType === 'photo' ? 'photo' : 'document';

    const result = await sendTelegramMediaMultipart({
      method,
      chatId: Number(telegramChatId),
      media: buffer,
      mediaKey,
      filename,
      contentType,
      caption,
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
        completedAt: nowISO(),
      });

    return { success: true, messageId: inAppCommandId, channel: PipelineChannel.IN_APP };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error('In-app media dispatch error', { requestId, error: errorMessage });
    return { success: false, error: `In-app media error: ${errorMessage}`, channel: PipelineChannel.IN_APP };
  }
}
