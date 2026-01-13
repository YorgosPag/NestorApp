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

import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { withErrorHandling, apiSuccess, ApiError } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS } from '@/config/firestore-collections';
import { requireStaffContext, audit } from '@/server/admin/admin-guards';
import { generateRequestId } from '@/services/enterprise-id.service';
import { COMMUNICATION_CHANNELS } from '@/types/communications';
import { MESSAGE_DIRECTION, DELIVERY_STATUS } from '@/types/conversations';
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

// ============================================================================
// TYPES
// ============================================================================

interface SendMessageRequest {
  text: string;
  replyToMessageId?: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
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

async function storeOutboundMessage(
  conversationId: string,
  chatId: string,
  text: string,
  providerMessageId: number
): Promise<string | null> {
  try {
    const messageDocId = generateMessageDocId(
      COMMUNICATION_CHANNELS.TELEGRAM,
      chatId,
      String(providerMessageId)
    );

    const now = Timestamp.now();

    // Store in MESSAGES collection - ENTERPRISE: Using satisfies for type safety
    const messageData: MessageDocument = {
      id: messageDocId,
      conversationId,
      direction: MESSAGE_DIRECTION.OUTBOUND,
      channel: COMMUNICATION_CHANNELS.TELEGRAM,
      senderId: BOT_IDENTITY.ID,
      senderName: BOT_IDENTITY.DISPLAY_NAME,
      senderType: SENDER_TYPES.BOT,
      content: { text },
      providerMessageId: String(providerMessageId),
      deliveryStatus: DELIVERY_STATUS.SENT,
      providerMetadata: {
        platform: PLATFORMS.TELEGRAM,
        chatId,
      },
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection(COLLECTIONS.MESSAGES).doc(messageDocId).set(messageData);

    // Update conversation lastMessage - ENTERPRISE: Using constants
    await adminDb.collection(COLLECTIONS.CONVERSATIONS).doc(conversationId).update({
      'lastMessage.content': text.substring(0, CONVERSATION_PREVIEW_LENGTH),
      'lastMessage.direction': MESSAGE_DIRECTION.OUTBOUND,
      'lastMessage.timestamp': FieldValue.serverTimestamp(),
      messageCount: FieldValue.increment(1),
      'audit.updatedAt': FieldValue.serverTimestamp(),
    });

    console.log(`✅ Outbound message stored: ${messageDocId}`);
    return messageDocId;

  } catch (error) {
    console.error('❌ Failed to store outbound message:', error);
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

export const POST = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) => {
  const startTime = Date.now();
  const operationId = generateRequestId();

  // 🔒 SECURITY: Staff-only access (admin/broker/builder roles)
  const authResult = await requireStaffContext(request, operationId);
  if (!authResult.success) {
    audit(operationId, 'SEND_MESSAGE_DENIED', { error: authResult.error });
    throw new ApiError(403, authResult.error || 'Staff access required', 'STAFF_REQUIRED');
  }

  const { conversationId } = await params;

  if (!conversationId) {
    throw new ApiError(400, 'Conversation ID is required');
  }

  audit(operationId, 'SEND_MESSAGE_START', { user: authResult.context?.email, conversationId });
  console.log(`📤 [Send] User ${authResult.context?.email} sending message to: ${conversationId}`);

  // Parse request body
  const body: SendMessageRequest = await request.json();

  if (!body.text || typeof body.text !== 'string' || body.text.trim().length === 0) {
    throw new ApiError(400, 'Message text is required');
  }

  // Get conversation to find chatId
  const convDoc = await adminDb
    .collection(COLLECTIONS.CONVERSATIONS)
    .doc(conversationId)
    .get();

  if (!convDoc.exists) {
    throw new ApiError(404, `Conversation ${conversationId} not found`);
  }

  const convData = convDoc.data();
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
  const identityDoc = await adminDb
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

  console.log(`📱 Target Telegram chat: ${telegramChatId}`);

  // ENTERPRISE: Use centralized Telegram client (no duplicate code)
  const payload: TelegramSendPayload = {
    chat_id: telegramChatId,
    text: body.text.trim(),
    parse_mode: body.parseMode,
  };

  const sendResult = await sendTelegramMessage(payload);

  if (!sendResult.success) {
    throw new ApiError(500, `Failed to send message: ${sendResult.error}`);
  }

  // Extract provider message ID from result
  const apiResult = sendResult.result?.result;
  const providerMessageId = typeof apiResult === 'object' && apiResult && 'message_id' in apiResult
    ? (apiResult as { message_id: number }).message_id
    : null;

  // Store in CRM (only if we have provider message ID)
  let storedMessageId: string | null = null;
  if (providerMessageId) {
    storedMessageId = await storeOutboundMessage(
      conversationId,
      telegramChatId,
      body.text.trim(),
      providerMessageId
    );
  }

  const duration = Date.now() - startTime;
  console.log(`✅ [Send] Complete in ${duration}ms`);

  const response: SendMessageResponse = {
    success: true,
    messageId: storedMessageId,
    providerMessageId,
    conversationId,
    sentAt: new Date().toISOString(),
  };

  return apiSuccess<SendMessageResponse>(response, `Message sent in ${duration}ms`);

}, {
  operation: 'sendMessage',
  entityType: COLLECTIONS.MESSAGES,
  entityId: 'outbound'
});
