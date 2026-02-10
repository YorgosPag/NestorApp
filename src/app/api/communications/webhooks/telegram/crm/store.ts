/**
 * =============================================================================
 * TELEGRAM CRM STORE - ENTERPRISE OMNICHANNEL
 * =============================================================================
 *
 * Stores Telegram messages using canonical conversation model.
 * Architecture: CONVERSATIONS (container) + MESSAGES (canonical) - Single source of truth.
 *
 * @module api/communications/webhooks/telegram/crm/store
 * @enterprise ADR-029 - Omnichannel Conversation Model
 * @updated 2026-01-16 - Removed legacy COMMUNICATIONS duplicate writes
 */

import { isFirebaseAvailable } from '../firebase/availability';
import { getFirestoreHelpers } from '../firebase/helpers-lazy';
import { safeDbOperation } from '../firebase/safe-op';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  BOT_IDENTITY,
  SYSTEM_IDENTITY,
  PARTICIPANT_ROLES,
  SENDER_TYPES,
  PLATFORMS,
  DEFAULTS,
} from '@/config/domain-constants';
import {
  COMMUNICATION_CHANNELS,
  type CommunicationChannel,
} from '@/types/communications';
import {
  CONVERSATION_STATUS,
  DELIVERY_STATUS,
  IDENTITY_PROVIDER,
  type MessageAttachment,
} from '@/types/conversations';
import {
  generateConversationId,
  generateMessageDocId,
  generateExternalIdentityId,
} from '@/server/lib/id-generation';
import type { DocumentReference } from 'firebase-admin/firestore';
import type {
  ConversationDocument,
  MessageDocument,
  ExternalIdentityDocument,
} from '@/server/types/conversations.firestore';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('TelegramCRMStore');

// ============================================================================
// TYPES
// ============================================================================

/** Message input for CRM storage (backward compatible) */
export interface CRMStoreMessage {
  from: { id: number | string; first_name?: string; username?: string };
  chat: { id: number | string };
  chat_id?: number | string;
  text?: string;
  message_id?: number | string;
  /** 🏢 ADR-055: Attachments from media messages */
  attachments?: MessageAttachment[];
  /** Caption for media messages */
  caption?: string;
  /** ADR-156: Flag when text comes from voice transcription (Whisper) */
  isVoiceTranscription?: boolean;
}

/** Direction type (backward compatible) */
type Direction = 'inbound' | 'outbound';

/** Store result with conversation linking */
export interface StoreResult {
  messageDocRef: DocumentReference | null;
  conversationId: string | null;
  isNewConversation: boolean;
}

// ============================================================================
// IDEMPOTENCY HELPERS
// ============================================================================

/**
 * Check if message already exists (idempotency)
 * @enterprise Prevents duplicate messages on webhook retries
 * @param chatId - Required for Telegram (message_id is only unique per chat)
 */
async function isMessageAlreadyProcessed(
  firestoreHelpers: Awaited<ReturnType<typeof getFirestoreHelpers>>,
  channel: CommunicationChannel,
  chatId: string,
  providerMessageId: string
): Promise<boolean> {
  if (!firestoreHelpers) return false;

  const { collection, doc, getDoc } = firestoreHelpers;
  // CRITICAL: Include chatId for proper idempotency (B1 fix)
  const docId = generateMessageDocId(channel, chatId, providerMessageId);

  try {
    // Check if document with deterministic ID exists
    const messagesRef = collection(COLLECTIONS.MESSAGES);
    const messageDoc = doc(messagesRef, docId);
    const snapshot = await getDoc(messageDoc);

    if (snapshot.exists) {
      logger.info('Message already processed', { docId });
      return true;
    }
    return false;
  } catch (error) {
    // If query fails, proceed with storage (fail-open for idempotency check only)
    logger.warn('Idempotency check failed, proceeding', { error });
    return false;
  }
}

// ============================================================================
// CONVERSATION UPSERT
// ============================================================================

/**
 * Get or create conversation for a Telegram chat
 * @enterprise Links all messages to a conversation thread
 */
async function upsertConversation(
  firestoreHelpers: Awaited<ReturnType<typeof getFirestoreHelpers>>,
  chatId: string,
  senderName: string,
  direction: Direction
): Promise<{ conversationId: string; isNew: boolean }> {
  if (!firestoreHelpers) {
    return { conversationId: '', isNew: false };
  }

  const { collection, doc, getDoc, setDoc, updateDoc, Timestamp } = firestoreHelpers;
  const conversationId = generateConversationId(COMMUNICATION_CHANNELS.TELEGRAM, chatId);

  try {
    const conversationsRef = collection(COLLECTIONS.CONVERSATIONS);
    const convRef = doc(conversationsRef, conversationId);
    const convSnapshot = await getDoc(convRef);

    if (convSnapshot.exists) {
      // Update existing conversation
      await updateDoc(convRef, {
        'lastMessage.direction': direction,
        'lastMessage.timestamp': Timestamp.now(),
        messageCount: (convSnapshot.data()?.messageCount || 0) + 1,
        unreadCount: direction === 'inbound'
          ? (convSnapshot.data()?.unreadCount || 0) + 1
          : convSnapshot.data()?.unreadCount || 0,
        'audit.updatedAt': Timestamp.now(),
      });

      logger.info('Updated conversation', { conversationId });
      return { conversationId, isNew: false };
    } else {
      // Create new conversation - using domain constants (B3 fix)
      // B4: Type-safe Firestore document with satisfies
      // 🏢 TENANT ISOLATION: Use environment variable for companyId (AUTHZ Phase 2)
      const companyId = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID || 'pagonis-company';

      const newConversation = {
        id: conversationId,
        companyId, // 🏢 CRITICAL: Tenant isolation field
        channel: COMMUNICATION_CHANNELS.TELEGRAM,
        participants: [
          {
            identityId: generateExternalIdentityId(IDENTITY_PROVIDER.TELEGRAM, chatId),
            isInternal: false,
            displayName: senderName,
            role: PARTICIPANT_ROLES.CUSTOMER,
            joinedAt: Timestamp.now(),
          },
          {
            identityId: BOT_IDENTITY.ID,
            isInternal: true,
            displayName: BOT_IDENTITY.DISPLAY_NAME,
            role: PARTICIPANT_ROLES.BOT,
            joinedAt: Timestamp.now(),
          },
        ],
        status: CONVERSATION_STATUS.ACTIVE,
        tags: [] as string[],
        messageCount: 1,
        unreadCount: direction === 'inbound' ? 1 : 0,
        lastMessage: {
          content: '',
          direction,
          timestamp: Timestamp.now(),
        },
        audit: {
          createdBy: SYSTEM_IDENTITY.ID,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
      } satisfies ConversationDocument;

      await setDoc(convRef, newConversation);
      logger.info('Created new conversation', { conversationId });
      return { conversationId, isNew: true };
    }
  } catch (error) {
    logger.error('Conversation upsert failed', { error });
    return { conversationId: '', isNew: false };
  }
}

// ============================================================================
// EXTERNAL IDENTITY UPSERT
// ============================================================================

/**
 * Get or create external identity for Telegram user
 */
async function upsertExternalIdentity(
  firestoreHelpers: Awaited<ReturnType<typeof getFirestoreHelpers>>,
  telegramUserId: string,
  displayName: string,
  username?: string
): Promise<string | null> {
  if (!firestoreHelpers) return null;

  const { collection, doc, getDoc, setDoc, updateDoc, Timestamp } = firestoreHelpers;
  const identityId = generateExternalIdentityId(IDENTITY_PROVIDER.TELEGRAM, telegramUserId);

  try {
    const identitiesRef = collection(COLLECTIONS.EXTERNAL_IDENTITIES);
    const identityRef = doc(identitiesRef, identityId);
    const identitySnapshot = await getDoc(identityRef);

    if (identitySnapshot.exists) {
      // Update last seen
      await updateDoc(identityRef, {
        displayName,
        username: username || identitySnapshot.data()?.username,
        lastSeenAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      return identityId;
    } else {
      // Create new identity - B4: Type-safe with satisfies
      const newIdentity = {
        id: identityId,
        provider: IDENTITY_PROVIDER.TELEGRAM,
        externalUserId: telegramUserId,
        displayName,
        username,
        verified: false,
        consent: {
          marketing: false,
          transactional: true,
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        lastSeenAt: Timestamp.now(),
      } satisfies ExternalIdentityDocument;

      await setDoc(identityRef, newIdentity);
      logger.info('Created external identity', { identityId });
      return identityId;
    }
  } catch (error) {
    logger.error('External identity upsert failed', { error });
    return null;
  }
}

// ============================================================================
// MAIN STORE FUNCTION (BACKWARD COMPATIBLE)
// ============================================================================

/**
 * Store message in CRM with conversation linking
 * @enterprise Maintains backward compatibility while adding conversation model
 */
export async function storeMessageInCRM(
  message: CRMStoreMessage,
  direction: Direction
): Promise<DocumentReference | null> {
  if (!isFirebaseAvailable()) {
    logger.warn('Firebase not available, skipping CRM storage');
    return null;
  }

  const firestoreHelpers = await getFirestoreHelpers();
  if (!firestoreHelpers) {
    logger.warn('Firestore helpers not available for CRM storage');
    return null;
  }

  return safeDbOperation(async (_db) => {
    // Note: _db is provided by safeDbOperation but helpers create their own connection
    const { collection, addDoc, doc, setDoc, Timestamp, updateDoc } = firestoreHelpers;

    // 🔍 DEBUG: Log incoming message data
    logger.info('storeMessageInCRM called', {
      hasText: !!message.text,
      hasCaption: !!message.caption,
      hasAttachments: !!(message.attachments && message.attachments.length > 0),
      attachmentsCount: message.attachments?.length || 0,
    });

    const chatId = String(message.chat?.id || message.chat_id);
    const userId = String(message.from.id);
    const messageId = String(message.message_id || Date.now());
    const senderName = message.from?.first_name || DEFAULTS.UNKNOWN_SENDER;

    // 1. Idempotency check - CRITICAL: Include chatId (B1 fix)
    const alreadyProcessed = await isMessageAlreadyProcessed(
      firestoreHelpers,
      COMMUNICATION_CHANNELS.TELEGRAM,
      chatId,
      messageId
    );

    if (alreadyProcessed) {
      logger.info('Skipping duplicate message', { messageId });
      return null;
    }

    // 2. Upsert external identity (for inbound only)
    if (direction === 'inbound') {
      await upsertExternalIdentity(
        firestoreHelpers,
        userId,
        senderName,
        message.from?.username
      );
    }

    // 3. Upsert conversation
    const { conversationId, isNew } = await upsertConversation(
      firestoreHelpers,
      chatId,
      senderName,
      direction
    );

    // 4. Store in canonical MESSAGES collection - B4: Type-safe with satisfies
    // 🏢 TENANT ISOLATION: Get companyId from environment (same as conversation)
    const companyId = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID || 'pagonis-company';

    const canonicalMessageDocId = generateMessageDocId(COMMUNICATION_CHANNELS.TELEGRAM, chatId, messageId);

    // 🏢 ADR-055: Build content with text and/or attachments
    const hasAttachments = message.attachments && message.attachments.length > 0;
    const messageText = message.text || message.caption || (hasAttachments ? '' : DEFAULTS.MEDIA_MESSAGE_PLACEHOLDER);

    // Build content object
    const content: { text?: string; attachments?: MessageAttachment[] } = {};
    if (messageText) {
      content.text = messageText;
    }
    if (hasAttachments) {
      content.attachments = message.attachments;
    }

    const canonicalMessage = {
      id: canonicalMessageDocId,
      companyId, // 🏢 CRITICAL: Tenant isolation field for Firestore security rules
      conversationId,
      direction,
      channel: COMMUNICATION_CHANNELS.TELEGRAM,
      senderId: direction === 'inbound' ? userId : BOT_IDENTITY.ID,
      senderName: direction === 'inbound' ? senderName : BOT_IDENTITY.DISPLAY_NAME,
      senderType: direction === 'inbound' ? SENDER_TYPES.CUSTOMER : SENDER_TYPES.BOT,
      content,
      providerMessageId: messageId,
      deliveryStatus: direction === 'inbound' ? DELIVERY_STATUS.DELIVERED : DELIVERY_STATUS.SENT,
      providerMetadata: {
        platform: PLATFORMS.TELEGRAM,
        chatId,
        userName: senderName,
        ...(message.isVoiceTranscription ? { isVoiceTranscription: true } : {}),
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    } satisfies MessageDocument;

    // 4. Store in canonical MESSAGES collection (SINGLE SOURCE OF TRUTH)
    logger.info('Attempting to store message', { docId: canonicalMessageDocId });
    logger.debug('Message content', { data: content });

    const messagesCollRef = collection(COLLECTIONS.MESSAGES);
    const messagesRef = doc(messagesCollRef, canonicalMessageDocId);

    try {
      await setDoc(messagesRef, canonicalMessage);
      logger.info('setDoc succeeded', { docId: canonicalMessageDocId });
    } catch (setDocError) {
      logger.error('setDoc FAILED', { error: setDocError });
      throw setDocError; // Re-throw to be caught by safeDbOperation
    }

    // 🏢 ADR-055: Update conversation lastMessage.content with preview
    const lastMessagePreview = messageText
      ? messageText.substring(0, 100)
      : hasAttachments
        ? `📎 ${message.attachments!.length} attachment${message.attachments!.length > 1 ? 's' : ''}`
        : '';

    if (conversationId && lastMessagePreview) {
      try {
        const conversationsCollRef = collection(COLLECTIONS.CONVERSATIONS);
        const convRef = doc(conversationsCollRef, conversationId);
        await updateDoc(convRef, {
          'lastMessage.content': lastMessagePreview,
        });
      } catch (err) {
        logger.warn('Failed to update lastMessage content', { error: err });
      }
    }

    logger.info('Message stored', { docId: canonicalMessageDocId, conversationId, isNew, attachments: message.attachments?.length || 0 });

    // 🏢 ENTERPRISE: No legacy COMMUNICATIONS write (removed 2026-01-16)
    // Architecture: CONVERSATIONS (container) + MESSAGES (canonical) ONLY
    // Previous: Duplicate writes to COMMUNICATIONS collection (legacy)
    // Current: Single write to MESSAGES - zero duplication
    return messagesRef as unknown as DocumentReference;
  }, null);
}

/**
 * Enhanced store function returning full result
 * @enterprise For components that need conversation info
 */
export async function storeMessageWithConversation(
  message: CRMStoreMessage,
  direction: Direction
): Promise<StoreResult> {
  const messageDocRef = await storeMessageInCRM(message, direction);

  const chatId = String(message.chat?.id || message.chat_id);
  const conversationId = generateConversationId(COMMUNICATION_CHANNELS.TELEGRAM, chatId);

  return {
    messageDocRef,
    conversationId: messageDocRef ? conversationId : null,
    isNewConversation: false, // Would need to track from upsert
  };
}
