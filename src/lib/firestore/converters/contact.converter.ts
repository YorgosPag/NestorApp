import type { FirestoreDataConverter, QueryDocumentSnapshot, SnapshotOptions, DocumentData } from 'firebase/firestore';
import type { Contact } from '@/types/contacts';
import { asDate } from '../utils';

// 🏢 ENTERPRISE: Type for Contact document data without ID
type ContactDocumentData = Omit<Contact, 'id'>;

// 🏢 ENTERPRISE: Type for raw Firestore data with timestamps
interface RawContactData extends DocumentData {
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const contactConverter: FirestoreDataConverter<Contact> = {
  toFirestore(contact: Contact): ContactDocumentData {
    // Aφήνουμε τα timestamps να μπαίνουν από το service με serverTimestamp()
    // 🏢 ENTERPRISE: Type-safe destructuring with proper types
    const { id: _id, ...rest } = contact;
    return rest;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): Contact {
    // 🏢 ENTERPRISE: Type-safe data extraction
    const data = snapshot.data(options) as RawContactData;
    return {
      id: snapshot.id,
      ...data,
      // προαιρετική κανονικοποίηση για καταναλωτές
      createdAt: asDate(data.createdAt),
      updatedAt: asDate(data.updatedAt),
    } as Contact;
  },
};
