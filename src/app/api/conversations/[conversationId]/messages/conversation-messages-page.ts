/**
 * Η **σελίδα μηνυμάτων** μιας συνομιλίας: ερώτημα Firestore + χαρτογράφηση
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ (N.7.1 · ADR-742 §7decies)
 * ─────────────────────────────────────────────────────────────────────────────
 * Η διαδρομή είναι **εκτελεστής HTTP**: παράμετροι, φύλακας ιδιοκτησίας, μνήμη,
 * απάντηση. Το «ποιο ερώτημα τρέχει και πώς γίνεται DTO ένα έγγραφο μηνύματος»
 * είναι άλλη ευθύνη — αδελφή εξαγωγή με το `send/store-outbound-message.ts`.
 *
 * ⚠️ **Δεν κρίνει ιδιοκτησία.** Ο καλών έχει ήδη περάσει από το
 * `loadOwnedConversation`· τα μηνύματα κρέμονται από τη συνομιλία, οπότε ο
 * tenant κόβεται **εκεί** — ίδιο σχήμα με το `executeSubcollectionQuery` του
 * `contact-impact-engine` (ADR-742 §7novies).
 *
 * @module app/api/conversations/[conversationId]/messages/conversation-messages-page
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { fieldToISO } from '@/lib/date-local';
import { getString, getObject } from '@/lib/firestore/field-extractors';
import { type MessageDirection, type DeliveryStatus } from '@/types/conversations';
import { type CommunicationChannel } from '@/types/communications';
import { type SenderType } from '@/config/domain-constants';

export interface MessageListItem {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  channel: CommunicationChannel;
  senderId: string;
  senderName: string;
  senderType: SenderType;
  content: {
    text: string;
    attachments?: Array<{
      type: string;
      url?: string;
      filename?: string;
    }>;
  };
  providerMessageId: string;
  deliveryStatus: DeliveryStatus;
  providerMetadata: {
    platform?: string;
    chatId?: string;
    userName?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface MessagesPageSpec {
  readonly conversationId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly order: 'asc' | 'desc';
}

export interface MessagesPage {
  readonly messages: MessageListItem[];
  readonly totalCount: number;
  readonly offset: number;
}

function toListItem(
  doc: FirebaseFirestore.QueryDocumentSnapshot,
  conversationId: string,
): MessageListItem {
  const data = doc.data() as Record<string, unknown>;

  const content = getObject<Record<string, unknown>>(data, 'content', {});
  const providerMetadata = getObject<Record<string, unknown>>(data, 'providerMetadata', {});

  return {
    id: doc.id,
    conversationId: getString(data, 'conversationId') ?? conversationId,
    direction: getString(data, 'direction', 'inbound') as MessageDirection,
    channel: getString(data, 'channel', 'telegram') as CommunicationChannel,
    senderId: getString(data, 'senderId') ?? '',
    senderName: getString(data, 'senderName') ?? '',
    senderType: getString(data, 'senderType', 'customer') as SenderType,
    content: {
      text: getString(content, 'text') ?? '',
      attachments: content.attachments as MessageListItem['content']['attachments'],
    },
    providerMessageId: getString(data, 'providerMessageId') ?? '',
    deliveryStatus: getString(data, 'deliveryStatus', 'sent') as DeliveryStatus,
    providerMetadata: {
      platform: getString(providerMetadata, 'platform'),
      chatId: getString(providerMetadata, 'chatId'),
      userName: getString(providerMetadata, 'userName'),
    },
    createdAt: fieldToISO(data, 'createdAt'),
    updatedAt: fieldToISO(data, 'updatedAt'),
  };
}

/** Διαβάζει μία σελίδα μηνυμάτων μαζί με το συνολικό πλήθος. */
export async function readMessagesPage(spec: MessagesPageSpec): Promise<MessagesPage> {
  const { conversationId, page, pageSize, order } = spec;

  const query = getAdminFirestore()
    .collection(COLLECTIONS.MESSAGES)
    .where('conversationId', '==', conversationId)
    .orderBy(FIELDS.CREATED_AT, order);

  const countSnapshot = await query.count().get();
  const totalCount = countSnapshot.data().count;

  const offset = (page - 1) * pageSize;
  const snapshot = await query.offset(offset).limit(pageSize).get();

  return {
    messages: snapshot.docs.map((doc) => toListItem(doc, conversationId)),
    totalCount,
    offset,
  };
}
