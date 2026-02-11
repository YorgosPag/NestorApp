/**
 * =============================================================================
 * WHATSAPP → CRM ADAPTER — NORMALIZE & STORE
 * =============================================================================
 *
 * Normalizes WhatsApp webhook messages into the canonical CRM model
 * and stores them using the shared omnichannel Firestore collections.
 *
 * Pattern mirrors telegram/crm/store.ts — same Firestore collections,
 * same ID generation, same conversation model.
 *
 * @module api/communications/webhooks/whatsapp/crm-adapter
 * @enterprise ADR-174 - Meta Omnichannel Integration
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
import type { WhatsAppMessage, WhatsAppContact } from './types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('WhatsAppCRMAdapter');

// ============================================================================
// TYPES
// ============================================================================

export interface WhatsAppStoreResult {
  messageDocId: string | null;
  conversationId: string | null;
  isNewConversation: boolean;
}

// ============================================================================
// MAIN STORE FUNCTION
// ============================================================================

/**
 * Store an inbound WhatsApp message in the CRM (conversations + messages + identities)
 */
export async function storeWhatsAppMessage(
  message: WhatsAppMessage,
  contact: WhatsAppContact | undefined,
  direction: 'inbound' | 'outbound' = 'inbound'
): Promise<WhatsAppStoreResult> {
  try {
    const db = getAdminFirestore();
    const senderPhone = message.from;
    const senderName = contact?.profile?.name ?? senderPhone;
    const messageText = extractMessageText(message);

    // 1. Idempotency check
    const docId = generateMessageDocId(
      COMMUNICATION_CHANNELS.WHATSAPP,
      senderPhone,
      message.id
    );

    const existingMsg = await db.collection(COLLECTIONS.MESSAGES).doc(docId).get();
    if (existingMsg.exists) {
      logger.info('WhatsApp message already processed (idempotent)', { docId });
      return {
        messageDocId: docId,
        conversationId: generateConversationId(COMMUNICATION_CHANNELS.WHATSAPP, senderPhone),
        isNewConversation: false,
      };
    }

    // 2. Upsert conversation
    const { conversationId, isNew } = await upsertConversation(
      db, senderPhone, senderName, direction
    );

    // 3. Upsert external identity
    await upsertExternalIdentity(db, senderPhone, senderName);

    // 4. Store message — matching MessageDocument schema exactly
    const now = Timestamp.now();
    const companyId = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID ?? 'pagonis-company';

    const messageDoc = {
      id: docId,
      companyId,
      conversationId,
      channel: COMMUNICATION_CHANNELS.WHATSAPP,
      direction: direction === 'inbound' ? MESSAGE_DIRECTION.INBOUND : MESSAGE_DIRECTION.OUTBOUND,
      senderId: direction === 'inbound'
        ? generateExternalIdentityId(IDENTITY_PROVIDER.WHATSAPP, senderPhone)
        : BOT_IDENTITY.ID,
      senderName: direction === 'inbound' ? senderName : BOT_IDENTITY.DISPLAY_NAME,
      senderType: direction === 'inbound' ? SENDER_TYPES.CUSTOMER : SENDER_TYPES.BOT,
      content: {
        text: messageText,
        attachments: [],
      },
      providerMessageId: message.id,
      deliveryStatus: direction === 'inbound' ? DELIVERY_STATUS.DELIVERED : DELIVERY_STATUS.SENT,
      providerMetadata: {
        platform: PLATFORMS.WHATSAPP,
        chatId: senderPhone,
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

    logger.info('WhatsApp message stored in CRM', { docId, conversationId, isNew });
    return { messageDocId: docId, conversationId, isNewConversation: isNew };
  } catch (error) {
    logger.error('Failed to store WhatsApp message', { error });
    return { messageDocId: null, conversationId: null, isNewConversation: false };
  }
}

// ============================================================================
// CONVERSATION UPSERT
// ============================================================================

async function upsertConversation(
  db: FirebaseFirestore.Firestore,
  senderPhone: string,
  senderName: string,
  direction: 'inbound' | 'outbound'
): Promise<{ conversationId: string; isNew: boolean }> {
  const conversationId = generateConversationId(COMMUNICATION_CHANNELS.WHATSAPP, senderPhone);
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
    channel: COMMUNICATION_CHANNELS.WHATSAPP,
    participants: [
      {
        identityId: generateExternalIdentityId(IDENTITY_PROVIDER.WHATSAPP, senderPhone),
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
  senderPhone: string,
  senderName: string
): Promise<void> {
  const identityId = generateExternalIdentityId(IDENTITY_PROVIDER.WHATSAPP, senderPhone);
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
    provider: IDENTITY_PROVIDER.WHATSAPP,
    externalUserId: senderPhone,
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
 * Extract text content from any WhatsApp message type
 */
export function extractMessageText(message: WhatsAppMessage): string {
  switch (message.type) {
    case 'text':
      return message.text?.body ?? '';
    case 'image':
      return message.image?.caption ?? '[Image]';
    case 'document':
      return message.document?.caption ?? `[Document: ${message.document?.filename ?? 'file'}]`;
    case 'audio':
      return '[Audio message]';
    case 'video':
      return message.video?.caption ?? '[Video]';
    case 'location':
      return message.location?.name
        ? `[Location: ${message.location.name}]`
        : '[Location]';
    case 'sticker':
      return '[Sticker]';
    case 'reaction':
      return message.reaction?.emoji ?? '';
    case 'interactive':
      return message.interactive?.button_reply?.title
        ?? message.interactive?.list_reply?.title
        ?? '';
    default:
      return `[${message.type}]`;
  }
}

// ============================================================================
// STATUS UPDATE HANDLER
// ============================================================================

/**
 * Update delivery status of an outbound message
 */
export async function updateMessageDeliveryStatus(
  whatsappMessageId: string,
  status: 'sent' | 'delivered' | 'read' | 'failed'
): Promise<void> {
  try {
    const db = getAdminFirestore();

    // Find message by providerMessageId
    const query = await db
      .collection(COLLECTIONS.MESSAGES)
      .where('providerMessageId', '==', whatsappMessageId)
      .where('channel', '==', COMMUNICATION_CHANNELS.WHATSAPP)
      .limit(1)
      .get();

    if (query.empty) {
      logger.warn('Status update for unknown message', { whatsappMessageId, status });
      return;
    }

    const docRef = query.docs[0].ref;
    const deliveryStatus = mapWhatsAppStatus(status);

    await docRef.update({
      deliveryStatus,
      updatedAt: Timestamp.now(),
    });

    logger.info('Updated delivery status', { whatsappMessageId, status: deliveryStatus });
  } catch (error) {
    logger.warn('Failed to update delivery status', { whatsappMessageId, error });
  }
}

function mapWhatsAppStatus(status: 'sent' | 'delivered' | 'read' | 'failed'): string {
  switch (status) {
    case 'sent': return DELIVERY_STATUS.SENT;
    case 'delivered': return DELIVERY_STATUS.DELIVERED;
    case 'read': return DELIVERY_STATUS.READ;
    case 'failed': return DELIVERY_STATUS.FAILED;
    default: return DELIVERY_STATUS.PENDING;
  }
}
