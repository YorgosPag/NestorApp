/**
 * =============================================================================
 * TELEGRAM UPDATE PROCESSING — Main orchestrator for webhook updates
 * =============================================================================
 *
 * Handles the core logic of processing a Telegram webhook update:
 * - Booking flow interception
 * - Super admin detection
 * - Contact recognition
 * - Callback query handling
 * - Voice transcription triggering
 * - CRM storage of outbound messages
 *
 * Extracted from handler.ts per ADR file-size standards (max 500 lines).
 *
 * @module api/communications/webhooks/telegram/telegram-processing
 * @enterprise ADR-029 - Omnichannel Conversation Model
 */

import { isFirebaseAvailable } from './firebase/availability';
import { processMessage } from './message/process-message';
import { handleBookingFlow } from './message/booking-interceptor';
import { handleCallbackQuery } from './message/callback-query';
import type { SuggestionCallbackResult } from './message/callback-query';
import { sendTelegramMessage } from './telegram/client';
import { storeMessageInCRM } from './crm/store';
import { BOT_IDENTITY } from '@/config/domain-constants';
import type { TelegramMessage, TelegramSendPayload } from './telegram/types';
import type { MessageAttachment } from '@/types/conversations';
import { transcribeVoiceMessage } from './telegram/whisper-transcription';
// ADR-055: Media download for Telegram attachments (photos, documents)
import { hasMedia, processTelegramMedia } from './telegram/media-download';
import { buildFallbackAttachments } from './telegram/media-fallback';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { feedTelegramToPipeline, feedSuggestionToPipeline } from './telegram-pipeline';

const logger = createModuleLogger('TelegramProcessing');

/** Return type for processTelegramUpdate — signals if pipeline re-feed is needed */
export interface ProcessUpdateResult {
  /** True if a suggestion callback triggered pipeline re-feed */
  needsPipelineBatch: boolean;
}

/**
 * Main orchestrator for handling incoming Telegram webhook updates.
 *
 * Processes message content (text, voice, contact), detects admin users,
 * resolves known contacts, handles callback queries, feeds to AI pipeline,
 * and stores outbound messages in CRM.
 */
export async function processTelegramUpdate(
  webhookData: TelegramMessage
): Promise<ProcessUpdateResult> {
  let telegramResponse: TelegramSendPayload | null = null;

  if (webhookData.message) {
    // ADR-055: Download media attachments once, share between CRM + pipeline
    let mediaAttachments: MessageAttachment[] | undefined;
    const messageHasMedia = hasMedia(webhookData.message);
    if (isFirebaseAvailable() && messageHasMedia) {
      try {
        mediaAttachments = await processTelegramMedia(webhookData.message);
        logger.info('Media downloaded for pipeline', { count: mediaAttachments?.length ?? 0 });
      } catch (mediaError) {
        logger.error('Media download failed (non-fatal)', { error: getErrorMessage(mediaError) });
      }
    }

    // FIND-J: Fallback — if media detected but download failed/skipped,
    // build lightweight attachment stubs so AI knows media was sent
    if (messageHasMedia && (!mediaAttachments || mediaAttachments.length === 0)) {
      mediaAttachments = buildFallbackAttachments(webhookData.message);
    }

    telegramResponse = await processMessagePayload(webhookData, mediaAttachments);

    // ── ADR-132: Feed to AI Pipeline ──
    // Await enqueue to ensure item is in queue before after() batch runs.
    // Non-fatal: pipeline failure should never break the Telegram bot.
    const effectiveText = extractEffectiveText(webhookData);
    const isBotCommand = effectiveText.startsWith('/');
    const hasMediaContent = hasMedia(webhookData.message);
    if (!isBotCommand && (effectiveText.trim().length > 0 || hasMediaContent) && isFirebaseAvailable()) {
      await feedTelegramToPipeline(webhookData.message, effectiveText, mediaAttachments);
    }
  }

  // Phase 6F: Track suggestion callbacks for pipeline re-feed
  let suggestionResult: SuggestionCallbackResult | null = null;

  if (webhookData.callback_query) {
    logger.info('Processing callback query');
    const callbackResult = await handleCallbackQuery(webhookData.callback_query);

    if (callbackResult && 'type' in callbackResult && callbackResult.type === 'suggestion') {
      // Suggestion callback — send ack and trigger pipeline re-feed
      suggestionResult = callbackResult;
      telegramResponse = {
        chat_id: callbackResult.chatId,
        text: '\u23F3 \u0395\u03C0\u03B5\u03BE\u03B5\u03C1\u03B3\u03AC\u03B6\u03BF\u03BC\u03B1\u03B9...',
      };
    } else {
      telegramResponse = callbackResult as TelegramSendPayload | null;
    }
  }

  // Phase 6F: Feed suggestion text to pipeline as a new user message
  let didFeedSuggestion = false;
  if (suggestionResult) {
    try {
      await feedSuggestionToPipeline(
        String(suggestionResult.chatId),
        suggestionResult.userId,
        suggestionResult.suggestionText
      );
      didFeedSuggestion = true;
    } catch (error) {
      logger.warn('[Suggestion->Pipeline] Non-fatal error', {
        error: getErrorMessage(error),
      });
    }
  }

  // Send response to Telegram if we have one
  if (telegramResponse) {
    await sendAndStoreResponse(telegramResponse);
  }

  return { needsPipelineBatch: didFeedSuggestion };
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Process the message portion of a Telegram update.
 * Handles voice transcription, booking flow, admin detection, contact recognition.
 */
async function processMessagePayload(
  webhookData: TelegramMessage,
  mediaAttachments?: MessageAttachment[]
): Promise<TelegramSendPayload | null> {
  const message = webhookData.message;
  if (!message) return null;

  let telegramResponse: TelegramSendPayload | null = null;
  const messageText = message.text ?? '';

  // ── ADR-156: Voice Transcription ──
  let effectiveMessageText = messageText;
  let isVoiceTranscription = false;

  if (!effectiveMessageText && message.voice) {
    logger.info('Voice message detected - attempting Whisper transcription');
    const transcription = await transcribeVoiceMessage(message.voice.file_id);
    if (transcription.success && transcription.text) {
      effectiveMessageText = transcription.text;
      isVoiceTranscription = true;
      logger.info('Transcription OK', { preview: effectiveMessageText.substring(0, 80) });
    } else {
      effectiveMessageText = '[Voice message]';
      logger.warn('Transcription failed', { error: transcription.error });
    }
  }

  // Caption fallback for photos/documents without text
  if (!effectiveMessageText && message.caption) {
    effectiveMessageText = message.caption;
  }

  // Suppress unused variable warning — isVoiceTranscription reserved for future use
  void isVoiceTranscription;

  const isBotCommand = effectiveMessageText.startsWith('/');

  // ── Booking Session: Contact info collection ──
  if (!isBotCommand) {
    const bookingResponse = await handleBookingFlow(webhookData, effectiveMessageText);
    if (bookingResponse) return bookingResponse;
  }

  // ── ADR-145: Super Admin Detection ──
  const isAdminSender = await detectSuperAdmin(webhookData, effectiveMessageText, isBotCommand);

  if (isAdminSender) {
    await handleAdminMessage(webhookData, effectiveMessageText, mediaAttachments);
  } else {
    telegramResponse = await handleContactRecognition(
      webhookData, effectiveMessageText, isBotCommand
    );
  }

  return telegramResponse;
}


/**
 * Detect if the sender is a super admin.
 */
async function detectSuperAdmin(
  webhookData: TelegramMessage,
  effectiveMessageText: string,
  isBotCommand: boolean
): Promise<boolean> {
  if (isBotCommand || effectiveMessageText.trim().length === 0 || !isFirebaseAvailable()) {
    return false;
  }

  try {
    const userId = String(webhookData.message?.from?.id ?? '');
    if (userId && userId !== 'unknown') {
      const { isSuperAdminTelegram } = await import(
        '@/services/ai-pipeline/shared/super-admin-resolver'
      );
      const adminResolution = await isSuperAdminTelegram(userId);
      return adminResolution !== null;
    }
  } catch {
    // Non-fatal: if admin check fails, proceed as normal customer
  }
  return false;
}

/**
 * Handle an admin message: send ack + store in CRM.
 */
async function handleAdminMessage(
  webhookData: TelegramMessage,
  effectiveMessageText: string,
  mediaAttachments?: MessageAttachment[]
): Promise<void> {
  const message = webhookData.message;
  if (!message) return;

  logger.info('Super admin detected - skipping bot response, pipeline will handle');
  const adminFirstName = message.from?.first_name;
  await sendTelegramMessage({
    chat_id: message.chat.id,
    text: adminFirstName
      ? `⏳ Γεια σου ${adminFirstName}, επεξεργάζομαι...`
      : '⏳ Επεξεργάζομαι την εντολή σας...',
  });

  // Store admin inbound message in CRM (conversations + messages collections)
  // processMessage() is skipped for admins, so we must store explicitly
  const firebaseReady = isFirebaseAvailable();
  logger.info('[CRM-DIAG] Admin CRM store check', {
    firebaseReady,
    hasFrom: !!message.from,
    chatId: message.chat.id,
    messageId: message.message_id,
    text: effectiveMessageText.substring(0, 50),
  });

  if (firebaseReady && message.from) {
    try {
      const result = await storeMessageInCRM({
        from: {
          id: message.from.id,
          first_name: message.from.first_name,
          username: message.from.username,
        },
        chat: { id: message.chat.id },
        text: effectiveMessageText,
        message_id: message.message_id,
        // ADR-055: Include media attachments in CRM store
        attachments: mediaAttachments,
        caption: message.caption,
      }, 'inbound');
      logger.info('[CRM-DIAG] Admin inbound CRM store result', {
        success: result !== null,
        docRef: result ? 'created' : 'null (failed silently)',
      });
    } catch (error) {
      logger.error('[CRM-DIAG] Admin inbound CRM store THREW', { error });
    }
  }
}

/**
 * Handle contact recognition for non-admin users.
 * Returns the appropriate Telegram response payload.
 */
async function handleContactRecognition(
  webhookData: TelegramMessage,
  effectiveMessageText: string,
  isBotCommand: boolean
): Promise<TelegramSendPayload | null> {
  const message = webhookData.message;
  if (!message) return null;

  const senderId = String(message.from?.id ?? '');
  const senderName = [message.from?.first_name, message.from?.last_name]
    .filter(Boolean).join(' ');

  let resolvedContact: import('@/services/contact-recognition/contact-linker').ResolvedContact | null = null;
  if (senderId && isFirebaseAvailable()) {
    try {
      const { resolveContactFromTelegram } = await import('@/services/contact-recognition/contact-linker');
      resolvedContact = await resolveContactFromTelegram(senderId, senderName);
    } catch {
      // Non-fatal
    }
  }

  if (resolvedContact) {
    logger.info('Known contact detected', {
      contactId: resolvedContact.contactId,
      name: resolvedContact.displayName,
      personas: resolvedContact.activePersonas,
      isBotCommand,
    });

    if (isBotCommand && effectiveMessageText.startsWith('/start')) {
      const { createPersonaAwareResponse } = await import('./message/responses');
      return createPersonaAwareResponse(
        message.chat.id,
        resolvedContact,
        effectiveMessageText,
      );
    } else if (isBotCommand) {
      return processMessage(message, effectiveMessageText);
    } else {
      const { createPersonaAwareResponse } = await import('./message/responses');
      return createPersonaAwareResponse(
        message.chat.id,
        resolvedContact,
        effectiveMessageText,
      );
    }
  }

  // ADR-259C: Contact not recognized — send explicit user message
  logger.info('Unknown contact — sending recognition failure message', {
    senderId,
    senderName,
  });
  if (!isBotCommand) {
    const { createContactNotRecognizedResponse } = await import('./message/responses');
    await sendTelegramMessage(createContactNotRecognizedResponse(message.chat.id));
  }
  // Still process message for bot commands (/start, /help) and pipeline enqueue
  return processMessage(message, effectiveMessageText);
}

/**
 * Send a Telegram response and store the outbound message in CRM.
 */
async function sendAndStoreResponse(
  telegramResponse: TelegramSendPayload
): Promise<void> {
  const sentResult = await sendTelegramMessage(telegramResponse);
  logger.info('Telegram response sent', { success: sentResult.success });

  // Store outbound message if Firebase is available - using domain constants (B3 fix)
  // B6 FIX: Use REAL provider message_id from Telegram response, not Date.now()
  if (sentResult.success && isFirebaseAvailable() && telegramResponse.text) {
    // Extract real message_id from Telegram API response
    const apiResult = sentResult.result?.result;
    const providerMessageId = typeof apiResult === 'object' && apiResult && 'message_id' in apiResult
      ? apiResult.message_id
      : null;

    // Only store outbound message if we have a real provider message_id
    // This ensures proper idempotency and traceability
    if (providerMessageId) {
      await storeMessageInCRM({
        chat: { id: telegramResponse.chat_id },
        from: { id: BOT_IDENTITY.ID, first_name: BOT_IDENTITY.DISPLAY_NAME },
        text: telegramResponse.text,
        message_id: providerMessageId
      }, 'outbound');
    } else {
      logger.warn('Outbound message not stored: no provider message_id in response');
    }
  }
}

/**
 * Extract effective text from a webhook update (text → voice transcription → caption).
 * Used by the handler to decide whether to feed to pipeline.
 */
function extractEffectiveText(webhookData: TelegramMessage): string {
  return webhookData.message?.text
    ?? webhookData.message?.caption
    ?? '';
}

