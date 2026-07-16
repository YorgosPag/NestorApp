/**
 * =============================================================================
 * WHATSAPP → CRM ADAPTER — NORMALIZE & STORE
 * =============================================================================
 *
 * WhatsApp-specific half of the CRM write path: extract display text from a
 * WhatsApp payload, then hand the normalized message to the shared store.
 * Delivery-status callbacks are WhatsApp-only and stay here.
 *
 * All channel-agnostic work (ID generation, idempotency, conversation and
 * identity upsert, Firestore writes) lives in the SSoT:
 * `@/server/comms/crm/channel-crm-store`.
 *
 * @module api/communications/webhooks/whatsapp/crm-adapter
 * @enterprise ADR-174 - Meta Omnichannel Integration
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { COMMUNICATION_CHANNELS } from '@/types/communications';
import {
  DELIVERY_STATUS,
  MESSAGE_DIRECTION,
  type DeliveryStatus,
  type MessageDirection,
} from '@/types/conversations';
import {
  storeChannelMessage,
  type ChannelStoreResult,
} from '@/server/comms/crm/channel-crm-store';
import { Timestamp } from 'firebase-admin/firestore';
import type { WhatsAppMessage, WhatsAppContact } from './types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('WhatsAppCRMAdapter');

// ============================================================================
// TYPES
// ============================================================================

export type WhatsAppStoreResult = ChannelStoreResult;

/** Delivery states WhatsApp reports back on outbound messages. */
type WhatsAppDeliveryStatus = 'sent' | 'delivered' | 'read' | 'failed';

// ============================================================================
// MAIN STORE FUNCTION
// ============================================================================

/**
 * Store an inbound WhatsApp message in the CRM (conversations + messages + identities)
 */
export async function storeWhatsAppMessage(
  message: WhatsAppMessage,
  contact: WhatsAppContact | undefined,
  direction: MessageDirection = MESSAGE_DIRECTION.INBOUND
): Promise<WhatsAppStoreResult> {
  const senderPhone = message.from;

  return storeChannelMessage({
    channel: COMMUNICATION_CHANNELS.WHATSAPP,
    externalUserId: senderPhone,
    providerMessageId: message.id,
    senderName: contact?.profile?.name ?? senderPhone,
    text: extractMessageText(message),
    direction,
  });
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
  status: WhatsAppDeliveryStatus
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

function mapWhatsAppStatus(status: WhatsAppDeliveryStatus): DeliveryStatus {
  switch (status) {
    case 'sent': return DELIVERY_STATUS.SENT;
    case 'delivered': return DELIVERY_STATUS.DELIVERED;
    case 'read': return DELIVERY_STATUS.READ;
    case 'failed': return DELIVERY_STATUS.FAILED;
    default: return DELIVERY_STATUS.PENDING;
  }
}
