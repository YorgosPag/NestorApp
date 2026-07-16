/**
 * =============================================================================
 * INSTAGRAM → CRM ADAPTER — NORMALIZE & STORE
 * =============================================================================
 *
 * Instagram-specific half of the CRM write path: extract display text from an
 * Instagram DM payload, then hand the normalized message to the shared store.
 *
 * All channel-agnostic work (ID generation, idempotency, conversation and
 * identity upsert, Firestore writes) lives in the SSoT:
 * `@/server/comms/crm/channel-crm-store`.
 *
 * @module api/communications/webhooks/instagram/crm-adapter
 * @enterprise ADR-174 - Meta Omnichannel Integration (Phase 3)
 */

import { COMMUNICATION_CHANNELS } from '@/types/communications';
import { MESSAGE_DIRECTION, type MessageDirection } from '@/types/conversations';
import {
  storeChannelMessage,
  type ChannelStoreResult,
} from '@/server/comms/crm/channel-crm-store';
import { resolveAttachmentLabel } from '@/server/comms/crm/attachment-labels';
import type { InstagramMessage } from './types';

// ============================================================================
// TYPES
// ============================================================================

export type InstagramStoreResult = ChannelStoreResult;

// ============================================================================
// MAIN STORE FUNCTION
// ============================================================================

/**
 * Store an inbound Instagram DM in the CRM (conversations + messages + identities)
 */
export async function storeInstagramMessage(
  igsid: string,
  message: InstagramMessage,
  senderName: string,
  direction: MessageDirection = MESSAGE_DIRECTION.INBOUND
): Promise<InstagramStoreResult> {
  return storeChannelMessage({
    channel: COMMUNICATION_CHANNELS.INSTAGRAM,
    externalUserId: igsid,
    providerMessageId: message.mid,
    senderName,
    text: extractInstagramMessageText(message),
    direction,
  });
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract text content from an Instagram message
 */
export function extractInstagramMessageText(message: InstagramMessage): string {
  if (message.text) {
    return message.text;
  }

  const attachment = message.attachments?.[0];
  if (!attachment) {
    return '';
  }

  // Instagram-only attachment kinds; the rest share the common media labels.
  switch (attachment.type) {
    case 'share': return '[Shared Post]';
    case 'story_mention': return '[Story Mention]';
    default: return resolveAttachmentLabel(attachment.type);
  }
}
