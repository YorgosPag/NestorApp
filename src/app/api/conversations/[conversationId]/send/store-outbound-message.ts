/**
 * Αποθήκευση **εξερχόμενου** μηνύματος + ενημέρωση της συνομιλίας
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ (N.7.1 · ADR-742 §7decies)
 * ─────────────────────────────────────────────────────────────────────────────
 * Η διαδρομή `send` είναι **εκτελεστής HTTP**: επικυρώνει, κρίνει ιδιοκτησία,
 * στέλνει στον πάροχο και απαντά. Η **εμμονή** (ποιο σχήμα εγγράφου γράφεται,
 * ποια πεδία της συνομιλίας ανανεώνονται) είναι άλλη ευθύνη — και ήταν το
 * μεγαλύτερο μη-δρομολογικό κομμάτι του αρχείου.
 *
 * @module app/api/conversations/[conversationId]/send/store-outbound-message
 * @enterprise ADR-055 — Enterprise Attachment System
 */

import 'server-only';

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
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
import { generateMessageDocId } from '@/server/lib/id-generation';
import type { MessageDocument } from '@/server/types/conversations.firestore';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('ConversationSendStore');

export interface StoreOutboundMessageSpec {
  readonly conversationId: string;
  readonly chatId: string;
  readonly text: string;
  readonly providerMessageId: number;
  /** 🏢 TENANT ISOLATION: απαιτείται από τους κανόνες Firestore. */
  readonly companyId: string;
  /** 🏢 ADR-055 */
  readonly attachments?: MessageAttachment[];
}

/** Το κείμενο προεπισκόπησης της συνομιλίας — κείμενο ή πλήθος συνημμένων. */
function previewOf(text: string, attachments?: MessageAttachment[]): string {
  if (text) return text.substring(0, CONVERSATION_PREVIEW_LENGTH);
  if (attachments && attachments.length > 0) {
    return `📎 ${attachments.length} attachment${attachments.length > 1 ? 's' : ''}`;
  }
  return '';
}

/**
 * Γράφει το μήνυμα και ανανεώνει το `lastMessage` της συνομιλίας.
 *
 * ⚠️ Επιστρέφει `null` αντί να ρίξει: το μήνυμα **έχει ήδη σταλεί** στον πάροχο
 * όταν φτάνει εδώ, οπότε αποτυχία εγγραφής δεν επιτρέπεται να εμφανιστεί στον
 * χρήστη ως «δεν στάλθηκε». Συμπεριφορά διατηρημένη ως είχε.
 */
export async function storeOutboundMessage(
  spec: StoreOutboundMessageSpec,
): Promise<string | null> {
  const { conversationId, chatId, text, providerMessageId, companyId, attachments } = spec;

  try {
    const messageDocId = generateMessageDocId(
      COMMUNICATION_CHANNELS.TELEGRAM,
      chatId,
      String(providerMessageId),
    );

    const now = Timestamp.now();

    const content: { text?: string; attachments?: MessageAttachment[] } = {};
    if (text) content.text = text;
    if (attachments && attachments.length > 0) content.attachments = attachments;

    const messageData: MessageDocument = {
      id: messageDocId,
      companyId,
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

    const db = getAdminFirestore();
    await db.collection(COLLECTIONS.MESSAGES).doc(messageDocId).set(messageData);

    await db.collection(COLLECTIONS.CONVERSATIONS).doc(conversationId).update({
      'lastMessage.content': previewOf(text, attachments),
      'lastMessage.direction': MESSAGE_DIRECTION.OUTBOUND,
      'lastMessage.timestamp': FieldValue.serverTimestamp(),
      messageCount: FieldValue.increment(1),
      'audit.updatedAt': FieldValue.serverTimestamp(),
    });

    logger.info('Outbound message stored', {
      messageDocId,
      attachmentCount: attachments?.length ?? 0,
    });
    return messageDocId;
  } catch (error) {
    logger.error('Failed to store outbound message', { error: getErrorMessage(error) });
    return null;
  }
}
