import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where,
  orderBy, limit, startAfter, DocumentSnapshot, QueryConstraint, Timestamp,
  writeBatch, serverTimestamp, onSnapshot, Unsubscribe, deleteField, FieldValue,
  QuerySnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Contact, ContactType, ContactStatus, isIndividualContact, isCompanyContact, isServiceContact,
  AddressInfo, PhoneInfo, EmailInfo,
} from '@/types/contacts';
import { EnterpriseContactSaver } from '@/utils/contacts/EnterpriseContactSaver';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { DuplicatePreventionService } from './contacts/DuplicatePreventionService';
import { sanitizeContactData, validateContactData } from '@/utils/contactForm/utils/data-cleaning';

import { getCol, mapDocs, chunk, asDate, startAfterDocId } from '@/lib/firestore/utils';
import { contactConverter } from '@/lib/firestore/converters/contact.converter';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { Unit } from '@/types/unit';

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions for Firestore Operations
// ============================================================================

/**
 * Extended Contact fields for archive operations
 * These fields are added when archiving/restoring contacts
 */
interface ContactArchiveFields {
  archivedAt?: FieldValue;
  archivedBy?: string;
  archivedReason?: string;
  restoredAt?: FieldValue;
  restoredBy?: string;
}

/**
 * Photo fields that exist on IndividualContact
 * Used for updates that include photo changes
 */
interface ContactPhotoFields {
  photoURL?: string;
  multiplePhotoURLs?: string[] | FieldValue;
}

/**
 * Contact data for Firestore operations (create/update)
 * Includes timestamp fields that use FieldValue
 */
type ContactFirestoreData = Omit<Contact, 'createdAt' | 'updatedAt'> & {
  createdAt?: FieldValue;
  updatedAt?: FieldValue;
} & ContactArchiveFields;

/**
 * Update data structure for contact modifications
 * Allows partial Contact with archive fields, photo fields, and timestamps
 * Uses Record<string, unknown> for Firestore compatibility
 */
type ContactUpdatePayload = Partial<Contact> & ContactArchiveFields & ContactPhotoFields & {
  updatedAt?: FieldValue;
};

// 🏢 ENTERPRISE: Centralized Firestore collection configuration
const CONTACTS_COLLECTION = COLLECTIONS.CONTACTS;
const UNITS_COLLECTION = COLLECTIONS.UNITS;
const BATCH_SIZE = parseInt(process.env.NEXT_PUBLIC_CONTACTS_BATCH_SIZE || '100'); // Increased to show more contacts in dropdowns
const MAX_BATCH = parseInt(process.env.NEXT_PUBLIC_CONTACTS_MAX_BATCH || '500');

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
  /**
   * 📝 Helper function για display name generation
   */
  private static getContactDisplayName(contactData: Partial<Contact>): string {
    switch (contactData.type) {
      case 'individual':
        return `${contactData.firstName || ''} ${contactData.lastName || ''}`.trim();
      case 'company':
        return contactData.companyName || 'Unknown Company';
      case 'service':
        return contactData.serviceName || 'Unknown Service';
      default:
        return 'Unknown Contact';
    }
  }
  // Create
  /**
   * 🏢 ENTERPRISE CONTACT CREATION με DUPLICATE PREVENTION
   *
   * Enterprise-grade contact creation με intelligent duplicate detection
   * και professional error handling για data integrity
   */
  static async createContact(contactData: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // 🧹 PHASE 1: ENTERPRISE DATA SANITIZATION & VALIDATION
      console.log('🧹 ENTERPRISE SANITIZER: Starting pre-processing...');

      // Validate input data first
      const validationResult = validateContactData(contactData);
      if (!validationResult.isValid) {
        console.error('❌ VALIDATION FAILED:', validationResult.errors);
        throw new Error(`VALIDATION_ERROR: ${validationResult.errors.join(', ')}`);
      }

      // Log warnings για potential issues
      if (validationResult.warnings.length > 0) {
        console.warn('⚠️ VALIDATION WARNINGS:', validationResult.warnings);
      }

      // Sanitize data πριν την αποθήκευση
      const sanitizedData = sanitizeContactData(contactData);

      console.log('✅ SANITIZATION COMPLETED:', {
        originalFields: Object.keys(contactData).length,
        sanitizedFields: Object.keys(sanitizedData).length,
        validationErrors: validationResult.errors.length,
        validationWarnings: validationResult.warnings.length
      });

      // 🛡️ PHASE 2: ENTERPRISE DUPLICATE PREVENTION
      console.log('🔍 ENTERPRISE DUPLICATE CHECK: Starting intelligent duplicate detection...');

      const duplicateResult = await DuplicatePreventionService.detectDuplicates(sanitizedData, {
        strictMode: true,
        timeWindow: 5000, // 5 second protection against rapid duplicate clicks
      });

      console.log('🔍 DUPLICATE DETECTION RESULT:', {
        isDuplicate: duplicateResult.isDuplicate,
        confidence: duplicateResult.confidence,
        matchingContactsCount: duplicateResult.matchingContacts.length,
        recommendations: duplicateResult.recommendations.map(r => r.action)
      });

      // 🚨 DUPLICATE FOUND - ENTERPRISE PREVENTION
      if (duplicateResult.isDuplicate) {
        const topRecommendation = duplicateResult.recommendations[0];
        const matchingContact = duplicateResult.matchingContacts[0];

        console.error('🚨 DUPLICATE CONTACT PREVENTION:', {
          action: topRecommendation.action,
          reason: topRecommendation.reason,
          confidence: duplicateResult.confidence,
          matchingContactId: matchingContact?.id,
          matchedDetails: duplicateResult.matchDetails[0]
        });

        // Enterprise-grade error με detailed information
        throw new Error(
          `DUPLICATE_CONTACT_DETECTED: ${topRecommendation.reason} ` +
          `(Confidence: ${(duplicateResult.confidence * 100).toFixed(1)}%) ` +
          `[Contact ID: ${matchingContact?.id}]`
        );
      }

      // 🎯 PHASE 3: SAFE CONTACT CREATION με SANITIZED DATA
      console.log('✅ DUPLICATE CHECK PASSED: Proceeding με safe contact creation...');

      const colRef = getCol<Contact>(CONTACTS_COLLECTION, contactConverter);
      const createData: ContactFirestoreData = {
        ...sanitizedData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      // Type assertion needed for addDoc compatibility with FieldValue timestamps
      const docRef = await addDoc(colRef, createData as unknown as Contact);

      console.log('✅ CONTACT CREATED SUCCESSFULLY:', {
        contactId: docRef.id,
        contactType: sanitizedData.type,
        contactName: this.getContactDisplayName(sanitizedData),
        sanitizationApplied: true
      });

      return docRef.id;

    } catch (error) {
      // 🏢 ENTERPRISE ERROR HANDLING με comprehensive error types
      if (error instanceof Error) {
        // Validation errors
        if (error.message.startsWith('VALIDATION_ERROR')) {
          console.error('🚨 ENTERPRISE VALIDATION ERROR:', error.message);
          throw error; // Re-throw για UI handling
        }

        // Duplicate contact errors
        if (error.message.startsWith('DUPLICATE_CONTACT_DETECTED')) {
          console.error('🚨 ENTERPRISE DUPLICATE PREVENTION:', error.message);
          throw error; // Re-throw με original message για proper UI handling
        }
      }

      console.error('🚨 CONTACT CREATION ERROR:', error);
      throw new Error('Failed to create contact - enterprise processing failed');
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
        const unit = d.data() as Partial<Unit>;
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
      console.log('📥 CONTACTSSERVICE: getAllContacts called with options:', options);
      const q = await buildContactsQuery(options);
      const qs = await getDocs(q);
      // Type assertion: converter ensures data is Contact type
      const contacts = mapDocs<Contact>(qs as unknown as QuerySnapshot<Contact>);

      console.log('📊 RAW FIRESTORE RESULTS:', contacts.length, 'contacts');
      console.log('📊 RAW CONTACTS FROM FIRESTORE:', contacts.map(c => ({
        id: c.id,
        firstName: isIndividualContact(c) ? c.firstName : undefined,
        lastName: isIndividualContact(c) ? c.lastName : undefined,
        companyName: isCompanyContact(c) ? c.companyName : undefined,
        serviceName: isServiceContact(c) ? c.serviceName : undefined,
        type: c.type,
        status: c.status || 'no-status'
      })));

      // Client-side filtering (status & search)
      let filtered = contacts;

      // Filter by archived status (client-side για να αποφύγουμε Firestore index)
      if (options?.includeArchived === true) {
        // Δείχνει ΜΟΝΟ archived επαφές
        console.log('🔍 FILTERING FOR ARCHIVED CONTACTS ONLY');
        filtered = filtered.filter((contact) =>
          contact.status === 'archived'
        );
      } else {
        // Exclude archived contacts (default behavior)
        console.log('🔍 FILTERING OUT ARCHIVED CONTACTS (default)');
        console.log('🔍 BEFORE ARCHIVED FILTER:', filtered.length, 'contacts');

        const beforeFilter = filtered.length;
        filtered = filtered.filter((contact) => {
          const isArchived = contact.status === 'archived';
          const hasNoStatus = !contact.status;
          const shouldInclude = hasNoStatus || contact.status !== 'archived';

          if (isArchived) {
            // Get display name based on contact type
            const displayName = isIndividualContact(contact)
              ? contact.firstName
              : isCompanyContact(contact)
                ? contact.companyName
                : contact.serviceName;
            console.log('❌ FILTERING OUT ARCHIVED CONTACT:', contact.id,
              displayName, 'status:', contact.status);
          }

          return shouldInclude;
        });

        console.log('🔍 AFTER ARCHIVED FILTER:', filtered.length, 'contacts');
        console.log('🔍 FILTERED OUT:', beforeFilter - filtered.length, 'archived contacts');
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

  // 🏢 ENTERPRISE Update: For form data with automatic conversion to arrays
  static async updateContactFromForm(id: string, formData: ContactFormData): Promise<void> {
    // 🔍 DEBUG: Ποιος καλεί αυτή τη function;
    console.log('🚨 UPDATECONTACTFROMFORM CALLED! ID:', id);
    console.log('🚨 CALL LOCATION:', new Error('DEBUG').stack?.split('\n')?.[2] || 'UNKNOWN');

    try {
      // Get existing contact for merge
      const existingContact = await this.getContact(id);
      if (!existingContact) {
        throw new Error('Contact not found');
      }

      // Convert form data to enterprise structure
      const enterpriseData = EnterpriseContactSaver.updateExistingContact(existingContact, formData);

      console.log('🏢 ENTERPRISE UPDATE: Converted data:', {
        hasAddresses: !!enterpriseData.addresses?.length,
        hasWebsites: !!enterpriseData.websites?.length,
        addressExample: enterpriseData.addresses?.[0],
        websiteExample: enterpriseData.websites?.[0]
      });

      // Save using standard method
      await this.updateContact(id, enterpriseData);
      console.log('✅ ENTERPRISE UPDATE: Successfully saved contact with arrays structure');

    } catch (error) {
      console.error('❌ ENTERPRISE UPDATE: Failed to update contact:', error);
      throw new Error('Failed to update contact');
    }
  }

  // Update
  static async updateContact(id: string, updates: ContactUpdatePayload): Promise<void> {
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
      // Spread into new object and add timestamp - Firestore accepts FieldValue for updatedAt
      const updateData = { ...updates, updatedAt: serverTimestamp() } as ContactUpdatePayload;

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

      // Type assertion needed for Firestore updateDoc compatibility
      await updateDoc(docRef, updateData as Record<string, unknown>);

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
      await this.updateContact(id, { isFavorite: !currentStatus });
    } catch (error) {
      // Error logging removed //('Error toggling favorite:', error);
      throw new Error('Failed to toggle favorite');
    }
  }

  // Archive functionality
  static async archiveContact(id: string, reason?: string): Promise<void> {
    try {
      const updateData: ContactUpdatePayload = {
        status: 'archived' as ContactStatus,
        archivedAt: serverTimestamp(),
        archivedBy: process.env.NEXT_PUBLIC_DEFAULT_USER_ID || 'current-user' // TODO: Get actual user ID
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
      const updateData: ContactUpdatePayload = {
        status: 'active' as ContactStatus,
        restoredAt: serverTimestamp(),
        restoredBy: process.env.NEXT_PUBLIC_DEFAULT_USER_ID || 'current-user' // TODO: Get actual user ID
      };
      await this.updateContact(id, updateData);
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

          // Object literal with serverTimestamp() - type assertion needed for FieldValue compatibility
          const updateData = {
            status: 'archived' as ContactStatus,
            archivedAt: serverTimestamp(),
            archivedBy: process.env.NEXT_PUBLIC_DEFAULT_USER_ID || 'current-user', // TODO: Get actual user ID
            updatedAt: serverTimestamp()
          } as ContactUpdatePayload;

          // Only add archivedReason if it's provided
          if (reason && reason.trim()) {
            updateData.archivedReason = reason.trim();
          }

          // Type assertion needed for Firestore batch.update compatibility
          batch.update(docRef, updateData as Record<string, unknown>);
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
      // Type assertion: converter ensures data is Contact type
      callback(mapDocs<Contact>(snapshot as unknown as QuerySnapshot<Contact>));
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
        const data = d.data() as Contact;
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
        const createData: ContactFirestoreData = {
          ...contact,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        batch.set(ref, createData);
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
      // Type assertion: converter ensures data is Contact type
      return mapDocs<Contact>(snapshot as unknown as QuerySnapshot<Contact>);
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
      // Type assertion: converter ensures data is Contact type
      let contacts = mapDocs<Contact>(snapshot as unknown as QuerySnapshot<Contact>);

      const term = (searchOptions.searchTerm || '').toLowerCase();

      if (term) {
        contacts = contacts.filter((c) => JSON.stringify(c).toLowerCase().includes(term));
      }

      if (searchOptions.tags?.length) {
        contacts = contacts.filter((c) => (c.tags ?? []).some((t: string) => searchOptions.tags!.includes(t)));
      }

      if (searchOptions.city) {
        const cityTerm = searchOptions.city.toLowerCase();
        contacts = contacts.filter((c) => {
          // All contact types have addresses property
          const addresses = c.addresses ?? [];
          return addresses.some((a: AddressInfo) => (a.city || '').toLowerCase().includes(cityTerm));
        });
      }

      if (searchOptions.hasPhone !== undefined) {
        contacts = contacts.filter((c) => {
          const phonesLength = c.phones?.length ?? 0;
          return searchOptions.hasPhone ? phonesLength > 0 : phonesLength === 0;
        });
      }

      if (searchOptions.hasEmail !== undefined) {
        contacts = contacts.filter((c) => {
          const emailsLength = c.emails?.length ?? 0;
          return searchOptions.hasEmail ? emailsLength > 0 : emailsLength === 0;
        });
      }

      if (searchOptions.createdAfter) {
        contacts = contacts.filter((c) => asDate(c.createdAt) >= searchOptions.createdAfter!);
      }
      if (searchOptions.createdBefore) {
        contacts = contacts.filter((c) => asDate(c.createdAt) <= searchOptions.createdBefore!);
      }

      return contacts;
    } catch (error) {
      // Error logging removed //('Error searching contacts:', error);
      throw new Error('Failed to search contacts');
    }
  }
}
