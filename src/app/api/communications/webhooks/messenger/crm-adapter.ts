/**
 * =============================================================================
 * MESSENGER → CRM ADAPTER — NORMALIZE & STORE
 * =============================================================================
 *
 * Messenger-specific half of the CRM write path: extract display text from a
 * Messenger payload, then hand the normalized message to the shared store.
 *
 * All channel-agnostic work (ID generation, idempotency, conversation and
 * identity upsert, Firestore writes) lives in the SSoT:
 * `@/server/comms/crm/channel-crm-store`.
 *
 * @module api/communications/webhooks/messenger/crm-adapter
 * @enterprise ADR-174 - Meta Omnichannel Integration (Phase 2)
 */

import { COMMUNICATION_CHANNELS } from '@/types/communications';
import { MESSAGE_DIRECTION, type MessageDirection } from '@/types/conversations';
import {
  storeChannelMessage,
  type ChannelStoreResult,
} from '@/server/comms/crm/channel-crm-store';
import { resolveAttachmentLabel } from '@/server/comms/crm/attachment-labels';
import type { MessengerMessage } from './types';

// ============================================================================
// TYPES
// ============================================================================

export type MessengerStoreResult = ChannelStoreResult;

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
  direction: MessageDirection = MESSAGE_DIRECTION.INBOUND
): Promise<MessengerStoreResult> {
  return storeChannelMessage({
    channel: COMMUNICATION_CHANNELS.MESSENGER,
    externalUserId: psid,
    providerMessageId: message.mid,
    senderName,
    text: extractMessengerMessageText(message),
    direction,
  });
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

  const attachment = message.attachments?.[0];
  if (!attachment) {
    return '';
  }

  // Messenger-only attachment kinds; the rest share the common media labels.
  if (attachment.type === 'location') {
    return attachment.payload.title
      ? `[Location: ${attachment.payload.title}]`
      : '[Location]';
  }

  return resolveAttachmentLabel(attachment.type);
}
