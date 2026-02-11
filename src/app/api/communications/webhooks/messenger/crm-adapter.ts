/**
 * =============================================================================
 * MESSENGER → CRM ADAPTER — NORMALIZE & STORE
 * =============================================================================
 *
 * Normalizes Messenger webhook messages into the canonical CRM model
 * and stores them using the shared omnichannel Firestore collections.
 *
 * Pattern mirrors whatsapp/crm-adapter.ts — same Firestore collections,
 * same ID generation, same conversation model.
 *
 * @module api/communications/webhooks/messenger/crm-adapter
 * @enterprise ADR-174 - Meta Omnichannel Integration (Phase 2)
 * @enterprise ADR-029 - Omnichannel Conversation Model
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  BOT_IDENTITY,
  SYSTEM_IDENTITY,
  PARTICIPANT_ROLES,
  SENDER_TYPES,
  PLATFORMS,
} from '@/config/domain-constants';
import { COMMUNICATION_CHANNELS } from '@/types/communications';
import {
  CONVERSATION_STATUS,
  DELIVERY_STATUS,
  IDENTITY_PROVIDER,
  MESSAGE_DIRECTION,
} from '@/types/conversations';
import {
  generateConversationId,
  generateMessageDocId,
  generateExternalIdentityId,
} from '@/server/lib/id-generation';
import type {
  ConversationDocument,
  MessageDocument,
  ExternalIdentityDocument,
} from '@/server/types/conversations.firestore';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { MessengerMessage } from './types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('MessengerCRMAdapter');

// ============================================================================
// TYPES
// ============================================================================

export interface MessengerStoreResult {
  messageDocId: string | null;
  conversationId: string | null;
  isNewConversation: boolean;
}

// ============================================================================
// MAIN STORE FUNCTION
// ============================================================================

/**
 * Store an inbound Messenger message in the CRM (conversations + messages + identities)
 */
export async function storeMessengerMessage(
  psid: string,
  message: MessengerMessage,
  senderName: string,
  direction: 'inbound' | 'outbound' = 'inbound'
): Promise<MessengerStoreResult> {
  try {
    const db = getAdminFirestore();
    const messageText = extractMessengerMessageText(message);

    // 1. Idempotency check
    const docId = generateMessageDocId(
      COMMUNICATION_CHANNELS.MESSENGER,
      psid,
      message.mid
    );

    const existingMsg = await db.collection(COLLECTIONS.MESSAGES).doc(docId).get();
    if (existingMsg.exists) {
      logger.info('Messenger message already processed (idempotent)', { docId });
      return {
        messageDocId: docId,
        conversationId: generateConversationId(COMMUNICATION_CHANNELS.MESSENGER, psid),
        isNewConversation: false,
      };
    }

    // 2. Upsert conversation
    const { conversationId, isNew } = await upsertConversation(
      db, psid, senderName, direction
    );

    // 3. Upsert external identity
    await upsertExternalIdentity(db, psid, senderName);

    // 4. Store message
    const now = Timestamp.now();
    const companyId = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID ?? 'pagonis-company';

    const messageDoc = {
      id: docId,
      companyId,
      conversationId,
      channel: COMMUNICATION_CHANNELS.MESSENGER,
      direction: direction === 'inbound' ? MESSAGE_DIRECTION.INBOUND : MESSAGE_DIRECTION.OUTBOUND,
      senderId: direction === 'inbound'
        ? generateExternalIdentityId(IDENTITY_PROVIDER.MESSENGER, psid)
        : BOT_IDENTITY.ID,
      senderName: direction === 'inbound' ? senderName : BOT_IDENTITY.DISPLAY_NAME,
      senderType: direction === 'inbound' ? SENDER_TYPES.CUSTOMER : SENDER_TYPES.BOT,
      content: {
        text: messageText,
        attachments: [],
      },
      providerMessageId: message.mid,
      deliveryStatus: direction === 'inbound' ? DELIVERY_STATUS.DELIVERED : DELIVERY_STATUS.SENT,
      providerMetadata: {
        platform: PLATFORMS.MESSENGER,
        chatId: psid,
      },
      createdAt: now,
      updatedAt: now,
    } satisfies MessageDocument;

    await db.collection(COLLECTIONS.MESSAGES).doc(docId).set(messageDoc);

    // 5. Update conversation lastMessage preview
    await db.collection(COLLECTIONS.CONVERSATIONS).doc(conversationId).update({
      'lastMessage.content': messageText.substring(0, 100),
      'lastMessage.direction': messageDoc.direction,
      'lastMessage.timestamp': now,
      'audit.updatedAt': now,
    });

    logger.info('Messenger message stored in CRM', { docId, conversationId, isNew });
    return { messageDocId: docId, conversationId, isNewConversation: isNew };
  } catch (error) {
    logger.error('Failed to store Messenger message', { error });
    return { messageDocId: null, conversationId: null, isNewConversation: false };
  }
}

// ============================================================================
// CONVERSATION UPSERT
// ============================================================================

async function upsertConversation(
  db: FirebaseFirestore.Firestore,
  psid: string,
  senderName: string,
  direction: 'inbound' | 'outbound'
): Promise<{ conversationId: string; isNew: boolean }> {
  const conversationId = generateConversationId(COMMUNICATION_CHANNELS.MESSENGER, psid);
  const convRef = db.collection(COLLECTIONS.CONVERSATIONS).doc(conversationId);
  const snapshot = await convRef.get();
  const now = Timestamp.now();

  if (snapshot.exists) {
    await convRef.update({
      'lastMessage.direction': direction,
      'lastMessage.timestamp': now,
      messageCount: FieldValue.increment(1),
      ...(direction === 'inbound' ? { unreadCount: FieldValue.increment(1) } : {}),
      'audit.updatedAt': now,
    });
    return { conversationId, isNew: false };
  }

  const companyId = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID ?? 'pagonis-company';

  const newConversation = {
    id: conversationId,
    companyId,
    channel: COMMUNICATION_CHANNELS.MESSENGER,
    participants: [
      {
        identityId: generateExternalIdentityId(IDENTITY_PROVIDER.MESSENGER, psid),
        isInternal: false,
        displayName: senderName,
        role: PARTICIPANT_ROLES.CUSTOMER,
        joinedAt: now,
      },
      {
        identityId: BOT_IDENTITY.ID,
        isInternal: true,
        displayName: BOT_IDENTITY.DISPLAY_NAME,
        role: PARTICIPANT_ROLES.BOT,
        joinedAt: now,
      },
    ],
    status: CONVERSATION_STATUS.ACTIVE,
    tags: [] as string[],
    messageCount: 1,
    unreadCount: direction === 'inbound' ? 1 : 0,
    lastMessage: {
      content: '',
      direction: direction === 'inbound' ? MESSAGE_DIRECTION.INBOUND : MESSAGE_DIRECTION.OUTBOUND,
      timestamp: now,
    },
    audit: {
      createdBy: SYSTEM_IDENTITY.ID,
      createdAt: now,
      updatedAt: now,
    },
  } satisfies ConversationDocument;

  await convRef.set(newConversation);
  return { conversationId, isNew: true };
}

// ============================================================================
// EXTERNAL IDENTITY UPSERT
// ============================================================================

async function upsertExternalIdentity(
  db: FirebaseFirestore.Firestore,
  psid: string,
  senderName: string
): Promise<void> {
  const identityId = generateExternalIdentityId(IDENTITY_PROVIDER.MESSENGER, psid);
  const identityRef = db.collection(COLLECTIONS.EXTERNAL_IDENTITIES).doc(identityId);
  const snapshot = await identityRef.get();
  const now = Timestamp.now();

  if (snapshot.exists) {
    await identityRef.update({
      displayName: senderName,
      updatedAt: now,
      lastSeenAt: now,
    });
    return;
  }

  const newIdentity = {
    id: identityId,
    provider: IDENTITY_PROVIDER.MESSENGER,
    externalUserId: psid,
    displayName: senderName,
    verified: false,
    consent: {
      marketing: false,
      transactional: true,
    },
    createdAt: now,
    updatedAt: now,
    lastSeenAt: now,
  } satisfies ExternalIdentityDocument;

  await identityRef.set(newIdentity);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract text content from a Messenger message
 */
export function extractMessengerMessageText(message: MessengerMessage): string {
  // Quick reply payload comes first (user tapped a suggestion/feedback button)
  if (message.quick_reply) {
    return message.text ?? message.quick_reply.payload;
  }

  if (message.text) {
    return message.text;
  }

  // Attachment placeholders
  if (message.attachments && message.attachments.length > 0) {
    const attachment = message.attachments[0];
    switch (attachment.type) {
      case 'image': return '[Image]';
      case 'audio': return '[Audio]';
      case 'video': return '[Video]';
      case 'file': return '[File]';
      case 'location': return attachment.payload.title
        ? `[Location: ${attachment.payload.title}]`
        : '[Location]';
      default: return `[${attachment.type}]`;
    }
  }

  return '';
}
