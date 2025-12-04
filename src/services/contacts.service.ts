import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where,
  orderBy, limit, startAfter, DocumentSnapshot, QueryConstraint, Timestamp,
  writeBatch, serverTimestamp, onSnapshot, Unsubscribe, deleteField,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Contact, ContactType, isIndividualContact, isCompanyContact, isServiceContact,
} from '@/types/contacts';

import { getCol, mapDocs, chunk, asDate, startAfterDocId } from '@/lib/firestore/utils';
import { contactConverter } from '@/lib/firestore/converters/contact.converter';

const CONTACTS_COLLECTION = 'contacts';
const UNITS_COLLECTION = 'units';
const BATCH_SIZE = 20;
const MAX_BATCH = 500;

// ---------- Query builder ----------
async function buildContactsQuery(options?: {
  type?: ContactType;
  onlyFavorites?: boolean;
  includeArchived?: boolean;           // ΝΕΟ: για προβολή archived
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
  lastDoc?: DocumentSnapshot;          // διατηρείται για συμβατότητα
  limitCount?: number;
  cursorId?: string | null;            // ΝΕΟ: προαιρετικό
}) {
  const constraints: QueryConstraint[] = [];

  if (options?.type) constraints.push(where('type', '==', options.type));
  if (options?.onlyFavorites) constraints.push(where('isFavorite', '==', true));

  // ΣΗΜΕΙΩΣΗ: Δεν φιλτράρουμε archived στο query level γιατί απαιτεί σύνθετο Firestore index
  // Θα κάνουμε client-side filtering για status στη συνέχεια

  const orderField = options?.orderByField || 'updatedAt';
  const orderDir = options?.orderDirection || 'desc';
  constraints.push(orderBy(orderField, orderDir));

  // Pagination: προτεραιότητα σε cursorId, μετά lastDoc (για backward compatibility)
  if (options?.cursorId) {
    const snapRef = await startAfterDocId(CONTACTS_COLLECTION, options.cursorId);
    if (snapRef) constraints.push(startAfter(snapRef));
  } else if (options?.lastDoc) {
    constraints.push(startAfter(options.lastDoc));
  }

  constraints.push(limit(options?.limitCount || BATCH_SIZE));

  return query(getCol<Contact>(CONTACTS_COLLECTION, contactConverter), ...constraints);
}

export class ContactsService {
  // Create
  static async createContact(contactData: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const colRef = getCol<Contact>(CONTACTS_COLLECTION, contactConverter);
      const docRef = await addDoc(colRef, {
        ...contactData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      } as any);
      return docRef.id;
    } catch (error) {
      // Error logging removed //('Error creating contact:', error);
      throw new Error('Failed to create contact');
    }
  }

  // Read single
  static async getContact(id: string): Promise<Contact | null> {
    try {
      const docRef = doc(getCol<Contact>(CONTACTS_COLLECTION, contactConverter), id);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? (docSnap.data() as Contact) : null;
    } catch (error) {
      // Error logging removed //('Error getting contact:', error);
      throw new Error('Failed to get contact');
    }
  }

  // Owner Contact IDs (FIX: no '!= null' queries)
  static async getOwnerContactIds(): Promise<string[]> {
    try {
      // Χρησιμοποιούμε where('soldTo','>=','') και φιλτράρουμε client-side
      const q = query(collection(db, UNITS_COLLECTION), where('soldTo', '>=', ''));
      const snap = await getDocs(q);
      const ownerIds = new Set<string>();
      snap.forEach((d) => {
        const unit = d.data() as any;
        if (unit?.soldTo && typeof unit.soldTo === 'string') ownerIds.add(unit.soldTo);
      });
      return Array.from(ownerIds);
    } catch (error) {
      // Error logging removed //('Error getting owner contact IDs:', error);
      throw new Error('Failed to get owner contact IDs');
    }
  }

  static async getAllContactIds(): Promise<string[]> {
    try {
      // Firestore δεν έχει projection select στο web sdk — διαβάζουμε ids από docs
      const qs = await getDocs(getCol<Contact>(CONTACTS_COLLECTION, contactConverter));
      return qs.docs.map((d) => d.id);
    } catch (error) {
      // Error logging removed //('Error getting all contact IDs:', error);
      throw new Error('Failed to get all contact IDs');
    }
  }

  // List (με optional cursorId χωρίς breaking change)
  static async getAllContacts(options?: {
    type?: ContactType;
    onlyFavorites?: boolean;
    includeArchived?: boolean; // ΝΕΟ: για προβολή archived
    searchTerm?: string;
    orderByField?: string;
    orderDirection?: 'asc' | 'desc';
    limitCount?: number;
    lastDoc?: DocumentSnapshot;
    cursorId?: string | null; // ΝΕΟ, optional
  }): Promise<{ contacts: Contact[]; lastDoc: DocumentSnapshot | null; nextCursor: string | null }> {
    try {
      const q = await buildContactsQuery(options);
      const qs = await getDocs(q);
      const contacts = mapDocs<Contact>(qs); // thanks to converter, dates normalized

      // Client-side filtering (status & search)
      let filtered = contacts;

      // Filter by archived status (client-side για να αποφύγουμε Firestore index)
      if (options?.includeArchived === true) {
        // Δείχνει ΜΟΝΟ archived επαφές
        filtered = filtered.filter((contact: any) =>
          contact.status === 'archived'
        );
      } else {
        // Exclude archived contacts (default behavior)
        filtered = filtered.filter((contact: any) =>
          !contact.status || contact.status !== 'archived'
        );
      }

      // Search filter
      if (options?.searchTerm) {
        const term = options.searchTerm.toLowerCase();
        filtered = filtered.filter((contact) => {
          if (isIndividualContact(contact)) {
            const emails = (contact.emails ?? []).map((e) => e.email || '');
            const phones = (contact.phones ?? []).map((p) => p.number || '');
            return (
              (contact.firstName || '').toLowerCase().includes(term) ||
              (contact.lastName || '').toLowerCase().includes(term) ||
              emails.some((e) => e.toLowerCase().includes(term)) ||
              phones.some((n) => n.includes(term))
            );
          }
          if (isCompanyContact(contact)) {
            const emails = (contact.emails ?? []).map((e) => e.email || '');
            return (
              (contact.companyName || '').toLowerCase().includes(term) ||
              (contact.vatNumber || '').includes(term) ||
              emails.some((e) => e.toLowerCase().includes(term))
            );
          }
          // service
          const emails = (contact.emails ?? []).map((e) => e.email || '');
          return (
            (contact.serviceName || '').toLowerCase().includes(term) ||
            emails.some((e) => e.toLowerCase().includes(term))
          );
        });
      }

      const lastDoc = qs.docs[qs.docs.length - 1] || null;
      return { contacts: filtered, lastDoc, nextCursor: lastDoc?.id ?? null };
    } catch (error) {
      // Error logging removed //('Error getting contacts:', error);
      throw new Error('Failed to get contacts');
    }
  }

  // Update
  static async updateContact(id: string, updates: Partial<Contact>): Promise<void> {
    console.log('🚨 CONTACTS SERVICE: updateContact called for ID:', id);
    console.log('🚨 CONTACTS SERVICE: Received updates:', {
      hasMultiplePhotoURLs: 'multiplePhotoURLs' in updates,
      multiplePhotoURLsValue: updates.multiplePhotoURLs,
      multiplePhotoURLsLength: Array.isArray(updates.multiplePhotoURLs) ? updates.multiplePhotoURLs.length : 'not array',
      hasPhotoURL: 'photoURL' in updates,
      photoURLValue: updates.photoURL
    });

    try {
      const docRef = doc(getCol<Contact>(CONTACTS_COLLECTION, contactConverter), id);

      // 🔥 ΚΡΙΣΙΜΗ ΔΙΟΡΘΩΣΗ: Εξασφαλίζουμε ότι κενό array στέλνεται ως κενό array
      const updateData: any = { ...updates, updatedAt: serverTimestamp() };

      // Εάν υπάρχει το multiplePhotoURLs και είναι κενό array, το στέλνουμε ρητά
      if ('multiplePhotoURLs' in updates) {
        if (Array.isArray(updates.multiplePhotoURLs) && updates.multiplePhotoURLs.length === 0) {
          console.log('🛠️ CONTACTS SERVICE: 🔥 CONFIRMED: Sending EMPTY array for multiplePhotoURLs to Firebase! 🔥');
          updateData.multiplePhotoURLs = [];
        } else if (updates.multiplePhotoURLs === null || updates.multiplePhotoURLs === undefined) {
          // Αν θέλουμε να διαγράψουμε το field τελείως από τη βάση
          updateData.multiplePhotoURLs = deleteField();
        }
      }

      console.log('🚨 CONTACTS SERVICE: About to send updateData to Firebase:', {
        id,
        updateDataMultiplePhotoURLs: updateData.multiplePhotoURLs,
        updateDataPhotoURL: updateData.photoURL,
        fullUpdateDataKeys: Object.keys(updateData)
      });

      await updateDoc(docRef, updateData);

      console.log('✅ CONTACTS SERVICE: 🔥 Firebase UPDATE COMPLETED! 🔥 Check the database now!', {
        id,
        sentEmptyMultiplePhotos: Array.isArray(updateData.multiplePhotoURLs) && updateData.multiplePhotoURLs.length === 0,
        sentEmptyPhotoURL: updateData.photoURL === ''
      });

    } catch (error) {
      console.error('❌ CONTACTS SERVICE: Update failed', error);
      throw new Error('Failed to update contact');
    }
  }

  static async toggleFavorite(id: string, currentStatus: boolean): Promise<void> {
    try {
      await this.updateContact(id, { isFavorite: !currentStatus } as any);
    } catch (error) {
      // Error logging removed //('Error toggling favorite:', error);
      throw new Error('Failed to toggle favorite');
    }
  }

  // Archive functionality
  static async archiveContact(id: string, reason?: string): Promise<void> {
    try {
      const updateData: any = {
        status: 'archived',
        archivedAt: serverTimestamp(),
        archivedBy: 'current-user' // TODO: Get actual user ID
      };

      // Only add archivedReason if it's provided
      if (reason && reason.trim()) {
        updateData.archivedReason = reason.trim();
      }

      await this.updateContact(id, updateData);
    } catch (error) {
      // Error logging removed //('Error archiving contact:', error);
      throw new Error('Failed to archive contact');
    }
  }

  static async restoreContact(id: string): Promise<void> {
    try {
      await this.updateContact(id, {
        status: 'active',
        restoredAt: serverTimestamp(),
        restoredBy: 'current-user' // TODO: Get actual user ID
      } as any);
    } catch (error) {
      // Error logging removed //('Error restoring contact:', error);
      throw new Error('Failed to restore contact');
    }
  }

  static async archiveMultipleContacts(ids: string[], reason?: string): Promise<void> {
    try {
      for (const group of chunk(ids, MAX_BATCH)) {
        const batch = writeBatch(db);
        group.forEach((id) => {
          const docRef = doc(db, CONTACTS_COLLECTION, id);

          const updateData: any = {
            status: 'archived',
            archivedAt: serverTimestamp(),
            archivedBy: 'current-user', // TODO: Get actual user ID
            updatedAt: serverTimestamp()
          };

          // Only add archivedReason if it's provided
          if (reason && reason.trim()) {
            updateData.archivedReason = reason.trim();
          }

          batch.update(docRef, updateData);
        });
        await batch.commit();
      }
    } catch (error) {
      // Error logging removed //('Error archiving multiple contacts:', error);
      throw new Error('Failed to archive contacts');
    }
  }

  // Delete
  static async deleteContact(id: string): Promise<void> {
    try {
      await deleteDoc(doc(getCol<Contact>(CONTACTS_COLLECTION, contactConverter), id));
    } catch (error) {
      // Error logging removed //('Error deleting contact:', error);
      throw new Error('Failed to delete contact');
    }
  }

  static async deleteMultipleContacts(ids: string[]): Promise<void> {
    try {
      for (const group of chunk(ids, MAX_BATCH)) {
        const batch = writeBatch(db);
        group.forEach((id) => batch.delete(doc(db, CONTACTS_COLLECTION, id)));
        await batch.commit();
      }
    } catch (error) {
      // Error logging removed //('Error deleting multiple contacts:', error);
      throw new Error('Failed to delete contacts');
    }
  }

  // Realtime
  static async subscribeToContacts(
    callback: (contacts: Contact[]) => void,
    options?: { type?: ContactType; onlyFavorites?: boolean }
  ): Promise<Unsubscribe> {
    const q = await buildContactsQuery({
      type: options?.type,
      onlyFavorites: options?.onlyFavorites,
      orderByField: 'updatedAt',
      orderDirection: 'desc',
      limitCount: BATCH_SIZE,
    });
    return onSnapshot(q, (snapshot) => {
      callback(mapDocs<Contact>(snapshot));
    });
  }

  // Stats
  static async getContactStatistics(): Promise<{
    total: number; individuals: number; companies: number; services: number; favorites: number;
  }> {
    try {
      const qs = await getDocs(getCol<Contact>(CONTACTS_COLLECTION, contactConverter));
      let individuals = 0, companies = 0, services = 0, favorites = 0;

      qs.forEach((d) => {
        const data = d.data() as any;
        switch (data.type) {
          case 'individual': individuals++; break;
          case 'company': companies++; break;
          case 'service': services++; break;
        }
        if (data.isFavorite) favorites++;
      });

      return { total: qs.size, individuals, companies, services, favorites };
    } catch (error) {
      // Error logging removed //('Error getting statistics:', error);
      throw new Error('Failed to get statistics');
    }
  }

  // Import
  static async importContacts(contacts: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<number> {
    try {
      let countInBatch = 0;
      let batch = writeBatch(db);

      for (const contact of contacts) {
        const ref = doc(collection(db, CONTACTS_COLLECTION));
        batch.set(ref, {
          ...contact,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        } as any);
        countInBatch++;

        if (countInBatch >= MAX_BATCH) {
          await batch.commit();
          // ΝΕΟ: rollover batch
          batch = writeBatch(db);
          countInBatch = 0;
        }
      }

      if (countInBatch > 0) await batch.commit();
      return contacts.length;
    } catch (error) {
      // Error logging removed //('Error importing contacts:', error);
      throw new Error('Failed to import contacts');
    }
  }

  // Export
  static async exportContacts(type?: ContactType): Promise<Contact[]> {
    try {
      const constraints: QueryConstraint[] = [];
      if (type) constraints.push(where('type', '==', type));
      const q = query(getCol<Contact>(CONTACTS_COLLECTION, contactConverter), ...constraints);
      const snapshot = await getDocs(q);
      return mapDocs<Contact>(snapshot);
    } catch (error) {
      // Error logging removed //('Error exporting contacts:', error);
      throw new Error('Failed to export contacts');
    }
  }

  // Search (advanced)
  static async searchContacts(searchOptions: {
    searchTerm?: string; type?: ContactType; tags?: string[]; city?: string;
    hasPhone?: boolean; hasEmail?: boolean; createdAfter?: Date; createdBefore?: Date;
  }): Promise<Contact[]> {
    try {
      const constraints: QueryConstraint[] = [];
      if (searchOptions.type) constraints.push(where('type', '==', searchOptions.type));

      const q = query(getCol<Contact>(CONTACTS_COLLECTION, contactConverter), ...constraints);
      const snapshot = await getDocs(q);
      let contacts = mapDocs<Contact>(snapshot);

      const term = (searchOptions.searchTerm || '').toLowerCase();

      if (term) {
        contacts = contacts.filter((c) => JSON.stringify(c).toLowerCase().includes(term));
      }

      if (searchOptions.tags?.length) {
        contacts = contacts.filter((c: any) => (c.tags ?? []).some((t: string) => searchOptions.tags!.includes(t)));
      }

      if (searchOptions.city) {
        const cityTerm = searchOptions.city.toLowerCase();
        contacts = contacts.filter((c: any) =>
          (c.addresses ?? []).some((a: any) => (a.city || '').toLowerCase().includes(cityTerm))
        );
      }

      if (searchOptions.hasPhone !== undefined) {
        contacts = contacts.filter((c: any) =>
          searchOptions.hasPhone ? (c.phones?.length ?? 0) > 0 : (c.phones?.length ?? 0) === 0
        );
      }

      if (searchOptions.hasEmail !== undefined) {
        contacts = contacts.filter((c: any) =>
          searchOptions.hasEmail ? (c.emails?.length ?? 0) > 0 : (c.emails?.length ?? 0) === 0
        );
      }

      if (searchOptions.createdAfter) {
        contacts = contacts.filter((c: any) => asDate(c.createdAt) >= searchOptions.createdAfter!);
      }
      if (searchOptions.createdBefore) {
        contacts = contacts.filter((c: any) => asDate(c.createdAt) <= searchOptions.createdBefore!);
      }

      return contacts;
    } catch (error) {
      // Error logging removed //('Error searching contacts:', error);
      throw new Error('Failed to search contacts');
    }
  }
}
