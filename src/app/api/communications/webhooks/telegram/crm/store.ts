// /home/user/studio/src/app/api/communications/webhooks/telegram/crm/store.ts

import { isFirebaseAvailable } from '../firebase/availability';
import { getFirestoreHelpers } from '../firebase/helpers-lazy';
import { safeDbOperation } from '../firebase/safe-op';
import type { Direction } from '../shared/types';

export async function storeMessageInCRM(message: any, direction: Direction): Promise<any> {
  if (!isFirebaseAvailable()) {
    console.warn('⚠️ Firebase not available, skipping CRM storage');
    return null;
  }

  const firestoreHelpers = await getFirestoreHelpers();
  if (!firestoreHelpers) {
    console.warn('⚠️ Firestore helpers not available for CRM storage');
    return null;
  }

  return safeDbOperation(async (database) => {
    const { collection, addDoc, Timestamp } = firestoreHelpers;

    const messageRecord = {
      type: 'telegram',
      direction,
      channel: 'telegram',
      from: direction === 'inbound' ? message.from.id.toString() : 'bot',
      to: direction === 'inbound' ? 'bot' : message.chat.id.toString(),
      content: message.text || '[Media Message]',
      status: direction === 'inbound' ? 'received' : 'sent',
      entityType: 'lead',
      entityId: null,
      externalId: message.message_id?.toString() || null,
      metadata: {
        userName: message.from?.first_name || 'Unknown',
        platform: 'telegram',
        chatId: message.chat?.id || message.chat_id
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const docRef = await addDoc(collection(database, COLLECTIONS.COMMUNICATIONS), messageRecord);
    console.log(`✅ Message stored in CRM with ID: ${docRef.id}`);
    return docRef;
  }, null);
}
