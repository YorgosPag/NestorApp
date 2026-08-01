/**
 * =============================================================================
 * CONVERSATION SEND MESSAGE API
 * =============================================================================
 *
 * Enterprise endpoint for sending outbound messages in a conversation.
 * Supports Telegram channel with proper CRM storage.
 *
 * @module api/conversations/[conversationId]/send
 * @enterprise EPIC C - Telegram Operationalization
 * @security Requires authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess } from '@/lib/api/ApiErrorHandler';
// 🔒 RATE LIMITING: STANDARD category (60 req/min)
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

import { COLLECTIONS } from '@/config/firestore-collections';
import { loadOwnedConversation } from '../../_shared/conversation-owned-doc';
import { generateRequestId } from '@/services/enterprise-id.service';
import { sendTelegramMessage } from '@/app/api/communications/webhooks/telegram/telegram/client';
import { storeOutboundMessage } from './store-outbound-message';
import type {
  SendMessageRequest,
  SendMessageResponse,
  SendMessageCanonicalResponse,
} from './types';
import { COMMUNICATION_CHANNELS } from '@/types/communications';
import type { MessageAttachment } from '@/types/conversations';
import type { TelegramSendPayload } from '@/app/api/communications/webhooks/telegram/telegram/types';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('ConversationSendRoute');

// ============================================================================
// FORCE DYNAMIC
// ============================================================================

export const dynamic = 'force-dynamic';

// ============================================================================
// POST - Send Message
// ============================================================================

/**
 * POST /api/conversations/[conversationId]/send
 *
 * Send outbound message in a conversation (Telegram channel).
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: comm:conversations:update
 * - Ownership Validation: Verifies conversation belongs to user's company
 *
 * @rateLimit STANDARD (60 req/min) - Send message to conversation
 */
export const POST = withStandardRateLimit(async function POST(
  request: NextRequest,
  context?: { params: Promise<{ conversationId: string }> }
) {
  const handler = withAuth<SendMessageCanonicalResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      if (!context?.params) {
        throw new ApiError(400, 'Missing route params');
      }
      const { conversationId } = await context.params;
      return handleSendMessage(req, ctx, conversationId);
    },
    { permissions: 'comm:conversations:update' }
  );

  return handler(request);
});

async function handleSendMessage(request: NextRequest, ctx: AuthContext, conversationId: string): Promise<NextResponse<SendMessageCanonicalResponse>> {
  const startTime = Date.now();
  const operationId = generateRequestId();

  if (!conversationId) {
    throw new ApiError(400, 'Conversation ID is required');
  }

  logger.info('[Send] User sending message', { email: ctx.email, companyId: ctx.companyId, conversationId });

  // Parse request body
  const body: SendMessageRequest = await request.json();

  // 🏢 ADR-055: Text is optional if attachments are present
  const hasText = body.text && typeof body.text === 'string' && body.text.trim().length > 0;
  const hasAttachments = body.attachments && Array.isArray(body.attachments) && body.attachments.length > 0;

  if (!hasText && !hasAttachments) {
    throw new ApiError(400, 'Message text or attachments are required');
  }

  // Validate attachments if present
  if (hasAttachments) {
    for (const att of body.attachments!) {
      if (!att.url || typeof att.url !== 'string') {
        throw new ApiError(400, 'Each attachment must have a valid URL');
      }
      if (!att.type || !['image', 'document', 'audio', 'video', 'location', 'contact'].includes(att.type)) {
        throw new ApiError(400, `Invalid attachment type: ${att.type}`);
      }
    }
  }

  // CRITICAL: Ownership validation — φόρτωσε **και** κρίνε σε μία πράξη.
  // Πριν, το 403 «You can only send messages to conversations from your
  // company» **περιέγραφε τον λόγο** της άρνησης, δηλαδή επιβεβαίωνε ότι το id
  // υπάρχει· τώρα είναι δυσδιάκριτο από το γνήσιο «δεν βρέθηκε» (ADR-742 §7decies).
  const { data: convData } = await loadOwnedConversation({
    conversationId,
    caller: ctx,
    action: 'send',
  });

  const channel = convData?.channel;

  // Currently only Telegram is supported
  if (channel !== COMMUNICATION_CHANNELS.TELEGRAM) {
    throw new ApiError(400, `Channel ${channel} not supported for outbound messages yet`);
  }

  // Extract chatId from conversation participants
  const participants = convData?.participants as Array<{ identityId: string; isInternal: boolean }> | undefined;
  const externalParticipant = participants?.find(p => !p.isInternal);

  if (!externalParticipant) {
    throw new ApiError(400, 'No external participant found in conversation');
  }

  // Look up the external identity to get the actual Telegram user ID
  const identityDoc = await getAdminFirestore()
    .collection(COLLECTIONS.EXTERNAL_IDENTITIES)
    .doc(externalParticipant.identityId)
    .get();

  if (!identityDoc.exists) {
    throw new ApiError(404, 'External identity not found');
  }

  const identityData = identityDoc.data();
  const telegramChatId = identityData?.externalUserId;

  if (!telegramChatId) {
    throw new ApiError(400, 'Could not determine Telegram chat ID');
  }

  logger.info('Target Telegram chat resolved', { telegramChatId });

  // 🏢 TENANT ISOLATION: Get companyId from conversation for message storage
  const messageCompanyId = convData?.companyId as string || ctx.companyId;

  // 🏢 ADR-055: Convert request attachments to canonical MessageAttachment format
  const messageAttachments: MessageAttachment[] | undefined = hasAttachments
    ? body.attachments!.map(att => ({
        type: att.type as MessageAttachment['type'],
        url: att.url,
        filename: att.filename,
        mimeType: att.mimeType,
        size: att.size,
      }))
    : undefined;

  // 🏢 ADR-055: Send text message first (if present)
  let providerMessageId: number | null = null;

  if (hasText) {
    // ENTERPRISE: Use centralized Telegram client (no duplicate code)
    const textPayload: TelegramSendPayload = {
      chat_id: telegramChatId,
      text: body.text!.trim(),
      parse_mode: body.parseMode,
    };

    const sendResult = await sendTelegramMessage(textPayload);

    if (!sendResult.success) {
      throw new ApiError(500, `Failed to send message: ${sendResult.error}`);
    }

    // Extract provider message ID from result
    const apiResult = sendResult.result?.result;
    providerMessageId = typeof apiResult === 'object' && apiResult && 'message_id' in apiResult
      ? (apiResult as { message_id: number }).message_id
      : null;
  }

  // 🏢 ADR-055: Send attachments to Telegram
  // For now, send images using sendPhoto method
  if (hasAttachments) {
    for (const att of body.attachments!) {
      let method: string;
      let mediaPayload: Record<string, unknown> = {
        chat_id: telegramChatId,
      };

      switch (att.type) {
        case 'image':
          method = 'sendPhoto';
          mediaPayload.photo = att.url;
          if (att.filename) mediaPayload.caption = att.filename;
          break;
        case 'document':
          method = 'sendDocument';
          mediaPayload.document = att.url;
          if (att.filename) mediaPayload.caption = att.filename;
          break;
        case 'audio':
          method = 'sendAudio';
          mediaPayload.audio = att.url;
          if (att.filename) mediaPayload.caption = att.filename;
          break;
        case 'video':
          method = 'sendVideo';
          mediaPayload.video = att.url;
          if (att.filename) mediaPayload.caption = att.filename;
          break;
        default:
          // For other types, send as document
          method = 'sendDocument';
          mediaPayload.document = att.url;
          if (att.filename) mediaPayload.caption = att.filename;
      }

      const mediaResult = await sendTelegramMessage({
        ...mediaPayload,
        method,
      } as TelegramSendPayload);

      if (!mediaResult.success) {
        logger.warn('Failed to send attachment', { type: att.type, error: mediaResult.error });
        // Continue with other attachments
      } else {
        // Use the last successful message ID for storage
        const mediaApiResult = mediaResult.result?.result;
        if (typeof mediaApiResult === 'object' && mediaApiResult && 'message_id' in mediaApiResult) {
          providerMessageId = (mediaApiResult as { message_id: number }).message_id;
        }
      }
    }
  }

  // Store in CRM (only if we have provider message ID)
  let storedMessageId: string | null = null;
  if (providerMessageId) {
    storedMessageId = await storeOutboundMessage({
      conversationId,
      chatId: telegramChatId,
      text: hasText ? body.text!.trim() : '',
      providerMessageId,
      companyId: messageCompanyId, // 🏢 CRITICAL: Firestore security rules
      attachments: messageAttachments, // 🏢 ADR-055
    });
  }

  const duration = Date.now() - startTime;
  logger.info('[Send] Complete', { durationMs: duration });

  const response: SendMessageResponse = {
    success: true,
    messageId: storedMessageId,
    providerMessageId,
    conversationId,
    sentAt: nowISO(),
  };

  // 🏢 ENTERPRISE: Canonical response format { success: true, data: T }
  return apiSuccess<SendMessageResponse>(response);
}
