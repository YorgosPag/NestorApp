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
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
// 🔒 RATE LIMITING: STANDARD category (60 req/min)
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

// Type alias for canonical response
type SendMessageCanonicalResponse = ApiSuccessResponse<SendMessageResponse>;
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateRequestId } from '@/services/enterprise-id.service';
import { COMMUNICATION_CHANNELS } from '@/types/communications';
import {
  MESSAGE_DIRECTION,
  DELIVERY_STATUS,
  type MessageAttachment,
} from '@/types/conversations';
import {
  BOT_IDENTITY,
  SENDER_TYPES,
  PLATFORMS,
  CONVERSATION_PREVIEW_LENGTH,
} from '@/config/domain-constants';
import { sendTelegramMessage } from '@/app/api/communications/webhooks/telegram/telegram/client';
import { generateMessageDocId } from '@/server/lib/id-generation';
import type { MessageDocument } from '@/server/types/conversations.firestore';
import type { TelegramSendPayload } from '@/app/api/communications/webhooks/telegram/telegram/types';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ConversationSendRoute');

// ============================================================================
// TYPES (ADR-055 - Enterprise Attachment System)
// ============================================================================

/**
 * Attachment in request body (already uploaded to Storage)
 * @enterprise ADR-055 - Canonical attachment format
 */
interface RequestAttachment {
  type: 'image' | 'document' | 'audio' | 'video' | 'location' | 'contact';
  url: string;
  filename?: string;
  mimeType?: string;
  size?: number;
}

interface SendMessageRequest {
  /** Text content (optional if attachments present) */
  text?: string;
  /** Reply to a specific message */
  replyToMessageId?: string;
  /** Parse mode for Telegram */
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  /** 🏢 ENTERPRISE: Attachments (ADR-055) */
  attachments?: RequestAttachment[];
}

interface SendMessageResponse {
  success: boolean;
  messageId: string | null;
  providerMessageId: number | null;
  conversationId: string;
  sentAt: string;
}

// ============================================================================
// STORE OUTBOUND MESSAGE - ENTERPRISE CONTRACTS
// ============================================================================

/**
 * Store outbound message with optional attachments
 * @enterprise ADR-055 - Enhanced for attachment support
 */
async function storeOutboundMessage(
  conversationId: string,
  chatId: string,
  text: string,
  providerMessageId: number,
  companyId: string, // 🏢 TENANT ISOLATION: Required for Firestore security rules
  attachments?: MessageAttachment[] // 🏢 ADR-055: Optional attachments
): Promise<string | null> {
  try {
    const messageDocId = generateMessageDocId(
      COMMUNICATION_CHANNELS.TELEGRAM,
      chatId,
      String(providerMessageId)
    );

    const now = Timestamp.now();

    // 🏢 ADR-055: Build content object with optional attachments
    const content: { text?: string; attachments?: MessageAttachment[] } = {};
    if (text) {
      content.text = text;
    }
    if (attachments && attachments.length > 0) {
      content.attachments = attachments;
    }

    // Store in MESSAGES collection - ENTERPRISE: Using satisfies for type safety
    const messageData: MessageDocument = {
      id: messageDocId,
      companyId, // 🏢 CRITICAL: Tenant isolation field for Firestore security rules
      conversationId,
      direction: MESSAGE_DIRECTION.OUTBOUND,
      channel: COMMUNICATION_CHANNELS.TELEGRAM,
      senderId: BOT_IDENTITY.ID,
      senderName: BOT_IDENTITY.DISPLAY_NAME,
      senderType: SENDER_TYPES.BOT,
      content,
      providerMessageId: String(providerMessageId),
      deliveryStatus: DELIVERY_STATUS.SENT,
      providerMetadata: {
        platform: PLATFORMS.TELEGRAM,
        chatId,
      },
      createdAt: now,
      updatedAt: now,
    };

    await getAdminFirestore().collection(COLLECTIONS.MESSAGES).doc(messageDocId).set(messageData);

    // Update conversation lastMessage - ENTERPRISE: Using constants
    // For attachment-only messages, show "[Attachment]" as preview
    const previewText = text
      ? text.substring(0, CONVERSATION_PREVIEW_LENGTH)
      : attachments && attachments.length > 0
        ? `📎 ${attachments.length} attachment${attachments.length > 1 ? 's' : ''}`
        : '';

    await getAdminFirestore().collection(COLLECTIONS.CONVERSATIONS).doc(conversationId).update({
      'lastMessage.content': previewText,
      'lastMessage.direction': MESSAGE_DIRECTION.OUTBOUND,
      'lastMessage.timestamp': FieldValue.serverTimestamp(),
      messageCount: FieldValue.increment(1),
      'audit.updatedAt': FieldValue.serverTimestamp(),
    });

    logger.info('Outbound message stored', { messageDocId, attachmentCount: attachments?.length || 0 });
    return messageDocId;

  } catch (error) {
    logger.error('Failed to store outbound message', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

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

  // CRITICAL: Ownership validation - verify conversation belongs to user's company
  const convDoc = await getAdminFirestore()
    .collection(COLLECTIONS.CONVERSATIONS)
    .doc(conversationId)
    .get();

  if (!convDoc.exists) {
    throw new ApiError(404, `Conversation ${conversationId} not found`);
  }

  const convData = convDoc.data();

  if (convData?.companyId !== ctx.companyId) {
    logger.warn('[Send] Unauthorized attempt', {
      userId: ctx.uid,
      userCompany: ctx.companyId,
      conversationId,
      conversationCompany: convData?.companyId
    });
    throw new ApiError(403, 'Unauthorized: You can only send messages to conversations from your company');
  }

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
    storedMessageId = await storeOutboundMessage(
      conversationId,
      telegramChatId,
      hasText ? body.text!.trim() : '',
      providerMessageId,
      messageCompanyId, // 🏢 CRITICAL: Pass companyId for Firestore security rules
      messageAttachments // 🏢 ADR-055: Pass attachments
    );
  }

  const duration = Date.now() - startTime;
  logger.info('[Send] Complete', { durationMs: duration });

  const response: SendMessageResponse = {
    success: true,
    messageId: storedMessageId,
    providerMessageId,
    conversationId,
    sentAt: new Date().toISOString(),
  };

  // 🏢 ENTERPRISE: Canonical response format { success: true, data: T }
  return apiSuccess<SendMessageResponse>(response);
}
