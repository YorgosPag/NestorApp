/**
 * =============================================================================
 * CHANNEL → CRM STORE — SSoT FOR OMNICHANNEL MESSAGE PERSISTENCE
 * =============================================================================
 *
 * Single source of truth for normalizing an inbound/outbound channel message
 * into the canonical CRM model (conversations + messages + external identities).
 *
 * Per-channel adapters own ONLY their provider-specific concerns: parsing the
 * raw webhook payload and extracting display text. Everything downstream of
 * that — ID generation, idempotency, conversation upsert, identity upsert and
 * the Firestore writes — lives here and is identical for every channel.
 *
 * @module server/comms/crm/channel-crm-store
 * @enterprise ADR-174 - Meta Omnichannel Integration (conversation model SSoT)
 * @enterprise ADR-584 - jscpd clone ratchet (de-duplication of crm-adapters)
 * @enterprise ADR-210 - Centralized companyId (tenant isolation)
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  BOT_IDENTITY,
  SYSTEM_IDENTITY,
  PARTICIPANT_ROLES,
  SENDER_TYPES,
} from '@/config/domain-constants';
import type { CommunicationChannel } from '@/types/communications';
import {
  CONVERSATION_STATUS,
  DELIVERY_STATUS,
  MESSAGE_DIRECTION,
} from '@/types/conversations';
import type { MessageDirection } from '@/types/conversations';
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
import { getCompanyId } from '@/config/tenant';
import { createModuleLogger } from '@/lib/telemetry';
import { resolveChannelBinding, type CrmChannel } from './channel-bindings';

const logger = createModuleLogger('ChannelCrmStore');

/** Max characters of message text kept as the conversation preview. */
const LAST_MESSAGE_PREVIEW_LENGTH = 100;

// ============================================================================
// TYPES
// ============================================================================

/**
 * A channel message already normalized by its per-channel adapter.
 *
 * `provider` and `platform` are intentionally absent — they are derived from
 * `channel` via the binding registry, so a caller cannot desynchronize them.
 */
export interface ChannelMessageInput {
  /** Which channel this message arrived on. Drives provider + platform. */
  channel: CrmChannel;
  /** Provider-side user id: phone (WhatsApp), PSID (Messenger), IGSID (Instagram). */
  externalUserId: string;
  /** Provider-side message id — used for idempotency. */
  providerMessageId: string;
  /** Display name of the human participant. */
  senderName: string;
  /** Already-extracted display text (per-channel adapters own the extraction). */
  text: string;
  direction: MessageDirection;
}

export interface ChannelStoreResult {
  messageDocId: string | null;
  conversationId: string | null;
  isNewConversation: boolean;
}

// ============================================================================
// MAIN STORE FUNCTION
// ============================================================================

/**
 * Store a channel message in the CRM (conversations + messages + identities).
 *
 * Idempotent: a repeated webhook delivery for the same provider message id
 * resolves to the same deterministic document id and is a no-op write.
 */
export async function storeChannelMessage(
  input: ChannelMessageInput
): Promise<ChannelStoreResult> {
  const { channel, externalUserId, providerMessageId } = input;

  try {
    const db = getAdminFirestore();
    const docId = generateMessageDocId(channel, externalUserId, providerMessageId);

    const existing = await db.collection(COLLECTIONS.MESSAGES).doc(docId).get();
    if (existing.exists) {
      logger.info('Message already processed (idempotent)', { docId, channel });
      return {
        messageDocId: docId,
        conversationId: generateConversationId(channel, externalUserId),
        isNewConversation: false,
      };
    }

    const { conversationId, isNew } = await upsertConversation(db, input);
    await upsertExternalIdentity(db, input);
    await writeMessage(db, input, docId, conversationId);

    logger.info('Message stored in CRM', { docId, conversationId, isNew, channel });
    return { messageDocId: docId, conversationId, isNewConversation: isNew };
  } catch (error) {
    logger.error('Failed to store channel message', { error, channel });
    return { messageDocId: null, conversationId: null, isNewConversation: false };
  }
}

// ============================================================================
// MESSAGE WRITE
// ============================================================================

/** Write the canonical message doc, then refresh the conversation preview. */
async function writeMessage(
  db: FirebaseFirestore.Firestore,
  input: ChannelMessageInput,
  docId: string,
  conversationId: string
): Promise<void> {
  const { channel, externalUserId, providerMessageId, senderName, text, direction } = input;
  const { provider, platform } = resolveChannelBinding(channel);
  const now = Timestamp.now();
  const isInbound = direction === MESSAGE_DIRECTION.INBOUND;

  const messageDoc = {
    id: docId,
    companyId: getCompanyId(),
    conversationId,
    channel,
    direction,
    senderId: isInbound
      ? generateExternalIdentityId(provider, externalUserId)
      : BOT_IDENTITY.ID,
    senderName: isInbound ? senderName : BOT_IDENTITY.DISPLAY_NAME,
    senderType: isInbound ? SENDER_TYPES.CUSTOMER : SENDER_TYPES.BOT,
    content: {
      text,
      attachments: [],
    },
    providerMessageId,
    deliveryStatus: isInbound ? DELIVERY_STATUS.DELIVERED : DELIVERY_STATUS.SENT,
    providerMetadata: {
      platform,
      chatId: externalUserId,
    },
    createdAt: now,
    updatedAt: now,
  } satisfies MessageDocument;

  await db.collection(COLLECTIONS.MESSAGES).doc(docId).set(messageDoc);

  await db.collection(COLLECTIONS.CONVERSATIONS).doc(conversationId).update({
    'lastMessage.content': text.substring(0, LAST_MESSAGE_PREVIEW_LENGTH),
    'lastMessage.direction': direction,
    'lastMessage.timestamp': now,
    'audit.updatedAt': now,
  });
}

// ============================================================================
// CONVERSATION UPSERT
// ============================================================================

async function upsertConversation(
  db: FirebaseFirestore.Firestore,
  input: ChannelMessageInput
): Promise<{ conversationId: string; isNew: boolean }> {
  const { channel, externalUserId, direction } = input;
  const conversationId = generateConversationId(channel, externalUserId);
  const convRef = db.collection(COLLECTIONS.CONVERSATIONS).doc(conversationId);
  const snapshot = await convRef.get();
  const now = Timestamp.now();

  if (snapshot.exists) {
    await convRef.update({
      'lastMessage.direction': direction,
      'lastMessage.timestamp': now,
      messageCount: FieldValue.increment(1),
      ...(direction === MESSAGE_DIRECTION.INBOUND
        ? { unreadCount: FieldValue.increment(1) }
        : {}),
      'audit.updatedAt': now,
    });
    return { conversationId, isNew: false };
  }

  await convRef.set(buildNewConversation(input, conversationId, now));
  return { conversationId, isNew: true };
}

function buildNewConversation(
  input: ChannelMessageInput,
  conversationId: string,
  now: Timestamp
): ConversationDocument {
  const { channel, externalUserId, senderName, direction } = input;
  const { provider } = resolveChannelBinding(channel);
  const isInbound = direction === MESSAGE_DIRECTION.INBOUND;

  return {
    id: conversationId,
    companyId: getCompanyId(), // 🏢 TENANT ISOLATION
    channel,
    participants: [
      {
        identityId: generateExternalIdentityId(provider, externalUserId),
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
    unreadCount: isInbound ? 1 : 0,
    lastMessage: {
      content: '',
      direction,
      timestamp: now,
    },
    audit: {
      createdBy: SYSTEM_IDENTITY.ID,
      createdAt: now,
      updatedAt: now,
    },
  } satisfies ConversationDocument;
}

// ============================================================================
// EXTERNAL IDENTITY UPSERT
// ============================================================================

async function upsertExternalIdentity(
  db: FirebaseFirestore.Firestore,
  input: ChannelMessageInput
): Promise<void> {
  const { channel, externalUserId, senderName } = input;
  const { provider } = resolveChannelBinding(channel);
  const identityId = generateExternalIdentityId(provider, externalUserId);
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
    companyId: getCompanyId(), // 🏢 TENANT ISOLATION
    provider,
    externalUserId,
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

export type { CrmChannel };
