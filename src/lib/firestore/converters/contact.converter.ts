import type { FirestoreDataConverter, QueryDocumentSnapshot, SnapshotOptions } from 'firebase/firestore';
import type { Contact } from '@/types/contacts';
import { asDate } from '../utils';

export const contactConverter: FirestoreDataConverter<Contact> = {
  toFirestore(contact: Contact) {
    // Aφήνουμε τα timestamps να μπαίνουν από το service με serverTimestamp()
    const { id, ...rest } = contact as any;
    return rest;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): Contact {
    const data = snapshot.data(options) as any;
    return {
      id: snapshot.id,
      ...data,
      // προαιρετική κανονικοποίηση για καταναλωτές
      createdAt: asDate(data.createdAt),
      updatedAt: asDate(data.updatedAt),
    } as Contact;
  },
};
