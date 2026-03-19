import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, where,
  orderBy, limit, startAfter, DocumentSnapshot, QueryConstraint,
  writeBatch, serverTimestamp, deleteField, FieldValue,
  QuerySnapshot,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import {
  Contact, ContactType, ContactStatus, isIndividualContact, isCompanyContact, isServiceContact,
  AddressInfo,
} from '@/types/contacts';
import { EnterpriseContactSaver } from '@/utils/contacts/EnterpriseContactSaver';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { DuplicatePreventionService } from './contacts/DuplicatePreventionService';
import { sanitizeContactData, validateContactData, type ContactDataRecord } from '@/utils/contactForm/utils/data-cleaning';

import { getCol, mapDocs, chunk, asDate, startAfterDocId } from '@/lib/firestore/utils';
import { contactConverter } from '@/lib/firestore/converters/contact.converter';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { Unit } from '@/types/unit';
import type { DocumentData } from 'firebase/firestore';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';
// 🎭 ENTERPRISE: Contact Persona System (ADR-121) — persona form→Firestore mapping
import { mapActivePersonas } from '@/utils/contactForm/mappers/individual';
import { generateContactId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { PhotoUploadService } from '@/services/photo-upload.service';
import { computeEntityDiff, CONTACT_TRACKED_FIELDS } from '@/config/audit-tracked-fields';

const logger = createModuleLogger('ContactsService');

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
type ContactUpdatePayload = Omit<Partial<Contact>, 'multiplePhotoURLs'> & ContactArchiveFields & ContactPhotoFields & {
  updatedAt?: FieldValue;
};

// 🏢 ENTERPRISE: Centralized Firestore collection configuration
const CONTACTS_COLLECTION = COLLECTIONS.CONTACTS;
const UNITS_COLLECTION = COLLECTIONS.UNITS;
const BATCH_SIZE = parseInt(process.env.NEXT_PUBLIC_CONTACTS_BATCH_SIZE || '100'); // Increased to show more contacts in dropdowns
const MAX_BATCH = parseInt(process.env.NEXT_PUBLIC_CONTACTS_MAX_BATCH || '500');

// ============================================================================
// POST-QUERY NORMALIZATION (replaces contactConverter.fromFirestore for migrated methods)
// ============================================================================

/**
 * Convert raw Firestore document data to typed Contact.
 * Handles Timestamp → Date conversion for date fields.
 */
function toContact(raw: DocumentData): Contact {
  return {
    id: raw.id as string,
    ...raw,
    createdAt: asDate(raw.createdAt),
    updatedAt: asDate(raw.updatedAt),
  } as Contact;
}

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
      logger.info('ENTERPRISE SANITIZER: Starting pre-processing...');

      // Validate input data first
      const contactRecord = contactData as unknown as ContactDataRecord;
      const validationResult = validateContactData(contactRecord);
      if (!validationResult.isValid) {
        logger.error('VALIDATION FAILED', { errors: validationResult.errors });
        throw new Error(`VALIDATION_ERROR: ${validationResult.errors.join(', ')}`);
      }

      // Log warnings για potential issues
      if (validationResult.warnings.length > 0) {
        logger.warn('VALIDATION WARNINGS', { warnings: validationResult.warnings });
      }

      // Sanitize data πριν την αποθήκευση
      const sanitizedData = sanitizeContactData(contactRecord) as unknown as Omit<
        Contact,
        'id' | 'createdAt' | 'updatedAt'
      >;

      logger.info('SANITIZATION COMPLETED', {
        originalFields: Object.keys(contactData).length,
        sanitizedFields: Object.keys(sanitizedData).length,
        validationErrors: validationResult.errors.length,
        validationWarnings: validationResult.warnings.length
      });

      // 🛡️ PHASE 2: ENTERPRISE DUPLICATE PREVENTION
      logger.info('ENTERPRISE DUPLICATE CHECK: Starting intelligent duplicate detection...');

      const duplicateResult = await DuplicatePreventionService.detectDuplicates(sanitizedData, {
        strictMode: true,
        timeWindow: 5000, // 5 second protection against rapid duplicate clicks
      });

      logger.info('DUPLICATE DETECTION RESULT', {
        isDuplicate: duplicateResult.isDuplicate,
        confidence: duplicateResult.confidence,
        matchingContactsCount: duplicateResult.matchingContacts.length,
        recommendations: duplicateResult.recommendations.map(r => r.action)
      });

      // 🚨 DUPLICATE FOUND - ENTERPRISE PREVENTION
      if (duplicateResult.isDuplicate) {
        const topRecommendation = duplicateResult.recommendations[0];
        const matchingContact = duplicateResult.matchingContacts[0];

        logger.error('DUPLICATE CONTACT PREVENTION', {
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
      logger.info('DUPLICATE CHECK PASSED: Proceeding with safe contact creation...');

      // 🏢 ENTERPRISE: Get user's companyId from auth claims for tenant isolation
      const currentUser = auth.currentUser;
      if (!currentUser) {
        logger.error('CREATE CONTACT ERROR: No authenticated user');
        throw new Error('AUTHENTICATION_ERROR: User must be logged in to create contacts');
      }

      const tokenResult = await currentUser.getIdTokenResult();
      const userCompanyId = tokenResult.claims?.companyId as string | undefined;

      logger.info('CREATE CONTACT AUTH', {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        companyId: userCompanyId,
        globalRole: tokenResult.claims?.globalRole
      });

      if (!userCompanyId) {
        logger.error('CREATE CONTACT ERROR: User has no companyId claim');
        throw new Error('AUTHORIZATION_ERROR: User is not assigned to a company');
      }

      const colRef = getCol<Contact>(CONTACTS_COLLECTION, contactConverter);
      const id = generateContactId();
      const createData: ContactFirestoreData = {
        ...sanitizedData,
        id,
        companyId: userCompanyId, // 🏢 ENTERPRISE: Tenant isolation - CRITICAL for Firestore rules
        createdBy: currentUser.uid, // 🏢 ENTERPRISE: Track creator for authorization
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      // 🏢 ADR-210: Enterprise ID generation — setDoc with pre-generated ID
      const docRef = doc(colRef, id);
      await setDoc(docRef, createData as unknown as Contact);

      logger.info('CONTACT CREATED SUCCESSFULLY', {
        contactId: id,
        contactType: sanitizedData.type,
        contactName: this.getContactDisplayName(sanitizedData),
        sanitizationApplied: true
      });

      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      // Dispatch event for all components to update their local state
      RealtimeService.dispatch('CONTACT_CREATED',{
        contactId: id,
        contact: {
          type: sanitizedData.type,
          firstName: sanitizedData.type === 'individual' ? sanitizedData.firstName : undefined,
          lastName: sanitizedData.type === 'individual' ? sanitizedData.lastName : undefined,
          companyName: sanitizedData.type === 'company' ? sanitizedData.companyName : undefined,
          serviceName: sanitizedData.type === 'service' ? sanitizedData.serviceName : undefined,
        },
        timestamp: Date.now()
      });

      return id;

    } catch (error) {
      // 🏢 ENTERPRISE ERROR HANDLING με comprehensive error types
      if (error instanceof Error) {
        // Validation errors
        if (error.message.startsWith('VALIDATION_ERROR')) {
          logger.error('ENTERPRISE VALIDATION ERROR', { error: error.message });
          throw error; // Re-throw για UI handling
        }

        // Duplicate contact errors
        if (error.message.startsWith('DUPLICATE_CONTACT_DETECTED')) {
          logger.error('ENTERPRISE DUPLICATE PREVENTION', { error: error.message });
          throw error; // Re-throw με original message για proper UI handling
        }
      }

      logger.error('CONTACT CREATION ERROR', { error });
      throw new Error('Failed to create contact - enterprise processing failed');
    }
  }

  // Read single — ADR-214 Phase 2: via FirestoreQueryService
  static async getContact(id: string): Promise<Contact | null> {
    try {
      const raw = await firestoreQueryService.getById<DocumentData>('CONTACTS', id);
      return raw ? toContact(raw) : null;
    } catch (error) {
      throw new Error('Failed to get contact');
    }
  }

  // Owner Contact IDs (FIX: no '!= null' queries) — ADR-214: query UNITS via centralized service
  static async getOwnerContactIds(): Promise<string[]> {
    try {
      const result = await firestoreQueryService.getAll<DocumentData>('UNITS', {
        constraints: [where('soldTo', '>=', '')],
        tenantOverride: 'skip',
      });
      const ownerIds = new Set<string>();
      for (const d of result.documents) {
        const soldTo = d.soldTo;
        if (soldTo && typeof soldTo === 'string') ownerIds.add(soldTo);
      }
      return Array.from(ownerIds);
    } catch (error) {
      throw new Error('Failed to get owner contact IDs');
    }
  }

  // ADR-214 Phase 2: via FirestoreQueryService
  static async getAllContactIds(): Promise<string[]> {
    try {
      const result = await firestoreQueryService.getAll<DocumentData>('CONTACTS', {});
      return result.documents.map(d => d.id as string);
    } catch (error) {
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
      // 🔐 ENTERPRISE: Defense-in-depth — auth guard on read operations
      const currentUser = auth.currentUser;
      if (!currentUser) {
        logger.warn('[ContactsService] getAllContacts called without authentication — returning empty');
        return { contacts: [], lastDoc: null, nextCursor: null };
      }

      const q = await buildContactsQuery(options);
      const qs = await getDocs(q);
      // Type assertion: converter ensures data is Contact type
      const contacts = mapDocs<Contact>(qs as unknown as QuerySnapshot<Contact>);

      // Client-side filtering (status & search)
      let filtered = contacts;

      // Filter by archived status (client-side για να αποφύγουμε Firestore index)
      if (options?.includeArchived === true) {
        // Δείχνει ΜΟΝΟ archived επαφές
        filtered = filtered.filter((contact) =>
          contact.status === 'archived'
        );
      } else {
        // Exclude archived contacts (default behavior)
        filtered = filtered.filter((contact) => {
          const hasNoStatus = !contact.status;
          const shouldInclude = hasNoStatus || contact.status !== 'archived';
          return shouldInclude;
        });
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
      throw new Error('Failed to get contacts');
    }
  }

  // 🏢 ENTERPRISE Update: For form data with automatic conversion to arrays
  static async updateContactFromForm(id: string, formData: Partial<ContactFormData>): Promise<void> {
    try {
      // Get existing contact for merge
      const existingContact = await this.getContact(id);
      if (!existingContact) {
        throw new Error('Contact not found');
      }

      // Convert form data to enterprise structure
      const enterpriseData = EnterpriseContactSaver.updateExistingContact(existingContact, formData);

      // 🏢 ENTERPRISE: Ensure companyId is preserved for Firestore rules
      // The rule requires: request.resource.data.companyId == resource.data.companyId
      if (existingContact.companyId && !enterpriseData.companyId) {
        enterpriseData.companyId = existingContact.companyId;
      }

      // 🗑️ ENTERPRISE: Cleanup removed photos from Firebase Storage
      // Compare old vs new multiplePhotoURLs to find deleted URLs
      const oldURLs = (existingContact as Record<string, unknown>).multiplePhotoURLs;
      const newURLs = enterpriseData.multiplePhotoURLs;
      if (Array.isArray(oldURLs) && oldURLs.length > 0) {
        const newURLSet = new Set(Array.isArray(newURLs) ? newURLs : []);
        const deletedURLs = oldURLs.filter(
          (url): url is string => typeof url === 'string' && !newURLSet.has(url)
        );
        if (deletedURLs.length > 0) {
          logger.info('Cleaning up removed photos from Storage', { count: deletedURLs.length });
          // Fire-and-forget — don't block the save on Storage cleanup
          PhotoUploadService.cleanupMultiplePhotos(deletedURLs).catch((err) => {
            logger.warn('Storage cleanup failed (non-blocking)', { error: err });
          });
        }
      }

      // Save using standard method
      await this.updateContact(id, enterpriseData);

      // 📜 AUDIT TRAIL: Compute diff and send to centralized endpoint (fire-and-forget)
      const changes = computeEntityDiff(
        existingContact as unknown as Record<string, unknown>,
        enterpriseData as unknown as Record<string, unknown>,
        CONTACT_TRACKED_FIELDS,
      );
      if (changes.length > 0) {
        const isStatusChange = changes.some((c) => c.field === 'status');
        apiClient.post(API_ROUTES.AUDIT_TRAIL.RECORD, {
          entityType: 'contact',
          entityId: id,
          entityName: this.getContactDisplayName(existingContact),
          action: isStatusChange ? 'status_changed' : 'updated',
          changes,
        }).catch(() => { /* fire-and-forget — audit failure never breaks save */ });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('ENTERPRISE UPDATE: Failed to update contact', {
        errorMessage,
        contactId: id,
      });
      throw new Error(`Failed to update contact: ${errorMessage}`);
    }
  }

  // Update
  static async updateContact(id: string, updates: ContactUpdatePayload): Promise<void> {
    try {
      const docRef = doc(getCol<Contact>(CONTACTS_COLLECTION, contactConverter), id);

      // 🔥 ΚΡΙΣΙΜΗ ΔΙΟΡΘΩΣΗ: Εξασφαλίζουμε ότι κενό array στέλνεται ως κενό array
      // Spread into new object and add timestamp - Firestore accepts FieldValue for updatedAt
      const updateData = { ...updates, updatedAt: serverTimestamp() } as ContactUpdatePayload;

      // 🛡️ ENTERPRISE: Remove system fields that Firestore rules protect
      // These fields cannot be modified according to isAttemptingToModifySystemFields rule
      const systemFields = ['id', 'createdAt', 'createdBy', 'ownerId'] as const;
      for (const field of systemFields) {
        if (field in updateData) {
          delete (updateData as Record<string, unknown>)[field];
        }
      }

      // Εάν υπάρχει το multiplePhotoURLs και είναι κενό array, το στέλνουμε ρητά
      if ('multiplePhotoURLs' in updates) {
        if (Array.isArray(updates.multiplePhotoURLs) && updates.multiplePhotoURLs.length === 0) {
          updateData.multiplePhotoURLs = [];
        } else if (updates.multiplePhotoURLs === null || updates.multiplePhotoURLs === undefined) {
          // Αν θέλουμε να διαγράψουμε το field τελείως από τη βάση
          updateData.multiplePhotoURLs = deleteField() as ContactPhotoFields['multiplePhotoURLs'];
        }
      }

      // 🏢 ENTERPRISE FIX: Remove legacy fields from payload ONLY (don't use deleteField)
      // The Firestore rules validate the MERGED document, and deleteField() is seen as an object!
      // If the field doesn't exist in the document, we don't need to delete it.
      // Just remove from payload to avoid sending invalid data.
      delete (updateData as Record<string, unknown>).email;
      delete (updateData as Record<string, unknown>).phone;
      delete (updateData as Record<string, unknown>).street;
      delete (updateData as Record<string, unknown>).streetNumber;
      delete (updateData as Record<string, unknown>).city;
      delete (updateData as Record<string, unknown>).postalCode;
      delete (updateData as Record<string, unknown>).website;
      // Administrative Hierarchy flat fields — persisted for address display + geocoding
      // These are set by AddressWithHierarchy and need to survive save/reload

      // 🎭 ENTERPRISE: Convert form-level persona fields to Firestore structure (ADR-121)
      // activePersonas + personaData are form-only → mapped to personas[] for Firestore
      const udRecord = updateData as Record<string, unknown>;
      // 🔍 DIAGNOSTIC: Log persona conversion
      console.log('🎭 FIRESTORE PERSONA DEBUG', {
        hasActivePersonas: !!udRecord.activePersonas,
        isArray: Array.isArray(udRecord.activePersonas),
        activePersonas: udRecord.activePersonas,
        personaDataKeys: udRecord.personaData ? Object.keys(udRecord.personaData as Record<string, unknown>) : [],
        existingPersonas: udRecord.personas,
      });

      if (udRecord.activePersonas && Array.isArray(udRecord.activePersonas)) {
        // Map active personas to Firestore structure (or empty array for full deactivation)
        const mapped = (udRecord.activePersonas as string[]).length > 0
          ? mapActivePersonas(updateData as unknown as ContactFormData)
          : [];
        udRecord.personas = mapped;
        console.log('🎭 FIRESTORE MAPPED PERSONAS', {
          count: mapped.length,
          types: mapped.map(p => p.personaType),
          statuses: mapped.map(p => p.status),
        });
      }
      delete udRecord.activePersonas;
      delete udRecord.personaData;

      // 🛡️ ENTERPRISE: Remove UI-only fields that must NOT reach Firestore
      // File objects, preview blobs, and form-only UI state
      // ΚΡΙΣΙΜΟ: multiplePhotos περιέχει File/Blob objects → Firestore τα ΑΠΟΡΡΙΠΤΕΙ
      const uiOnlyFields = [
        'logoFile', 'logoPreview', 'photoFile', 'photoPreview',
        'selectedProfilePhotoIndex', 'socialMediaArray',
        'multiplePhotos',           // PhotoSlot[] με File objects — ΟΧΙ serializable
        '_isLogoUploading',         // UI state tracking
        '_isPhotoUploading',        // UI state tracking
        '_forceDeleteLogo',         // UI state tracking
        'activePersonaTab',         // UI tab state
        'photoFileName',            // UI display name, δεν αποθηκεύεται
      ] as const;
      for (const field of uiOnlyFields) {
        delete udRecord[field];
      }

      // 🔥 ΚΡΙΣΙΜΟ: Firestore ΑΠΟΡΡΙΠΤΕΙ undefined — αφαίρεση ΟΛΩΝ των undefined τιμών
      // (Firestore δέχεται null αλλά ΟΧΙ undefined)
      // Deep clean: αφαιρεί undefined σε nested objects και arrays
      function deepCleanUndefined(obj: Record<string, unknown>): void {
        for (const key of Object.keys(obj)) {
          if (obj[key] === undefined) {
            delete obj[key];
          } else if (Array.isArray(obj[key])) {
            for (const item of obj[key] as unknown[]) {
              if (item && typeof item === 'object' && !Array.isArray(item)) {
                deepCleanUndefined(item as Record<string, unknown>);
              }
            }
          } else if (obj[key] && typeof obj[key] === 'object' && !(obj[key] instanceof Date)) {
            deepCleanUndefined(obj[key] as Record<string, unknown>);
          }
        }
      }
      deepCleanUndefined(udRecord);

      // Type assertion needed for Firestore updateDoc compatibility
      await updateDoc(docRef, udRecord);

      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      // Dispatch event for all components to update their local state
      RealtimeService.dispatch('CONTACT_UPDATED',{
        contactId: id,
        updates: {
          firstName: updates.firstName,
          lastName: updates.lastName,
          companyName: updates.companyName,
          serviceName: updates.serviceName,
          status: updates.status,
          isFavorite: updates.isFavorite,
        },
        timestamp: Date.now()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = (error as { code?: string })?.code ?? 'unknown';
      logger.error('CONTACTS SERVICE: Update failed', {
        errorMessage,
        errorCode,
        contactId: id,
        fieldCount: Object.keys(updates).length,
      });
      throw new Error(`Failed to update contact: ${errorMessage}`);
    }
  }

  static async toggleFavorite(id: string, currentStatus: boolean): Promise<void> {
    try {
      await this.updateContact(id, { isFavorite: !currentStatus });
    } catch (error) {
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
      throw new Error('Failed to archive contacts');
    }
  }

  // Delete — via server API for audit trail + tenant isolation
  static async deleteContact(id: string): Promise<void> {
    try {
      await apiClient.delete(API_ROUTES.CONTACTS.BY_ID(id));

      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      RealtimeService.dispatch('CONTACT_DELETED', {
        contactId: id,
        timestamp: Date.now(),
      });
    } catch (error) {
      throw new Error('Failed to delete contact');
    }
  }

  static async deleteMultipleContacts(ids: string[]): Promise<void> {
    try {
      await Promise.all(ids.map(id => apiClient.delete(API_ROUTES.CONTACTS.BY_ID(id))));
    } catch (error) {
      throw new Error('Failed to delete contacts');
    }
  }

  // Realtime — ADR-227 Phase 2: Canonical pattern via firestoreQueryService.subscribe
  static subscribeToContacts(
    callback: (contacts: Contact[]) => void,
    options?: { type?: ContactType; onlyFavorites?: boolean; limitCount?: number }
  ): () => void {
    const constraints: QueryConstraint[] = [];
    if (options?.type) constraints.push(where('type', '==', options.type));
    if (options?.onlyFavorites) constraints.push(where('isFavorite', '==', true));
    constraints.push(orderBy('updatedAt', 'desc'));

    return firestoreQueryService.subscribe<DocumentData>(
      'CONTACTS',
      (result) => {
        // Map flat DocumentData to Contact (same fields, auto-spread by subscribe)
        const contacts = result.documents.map(doc => ({ ...doc } as unknown as Contact));
        callback(contacts);
      },
      (err) => {
        logger.error('Contact subscription error', { error: err.message });
      },
      {
        constraints,
        maxResults: options?.limitCount ?? BATCH_SIZE,
      }
    );
  }

  // Stats — ADR-214 Phase 2: via FirestoreQueryService
  static async getContactStatistics(): Promise<{
    total: number; individuals: number; companies: number; services: number; favorites: number;
  }> {
    try {
      const result = await firestoreQueryService.getAll<DocumentData>('CONTACTS', {});
      let individuals = 0, companies = 0, services = 0, favorites = 0;

      for (const raw of result.documents) {
        switch (raw.type) {
          case 'individual': individuals++; break;
          case 'company': companies++; break;
          case 'service': services++; break;
        }
        if (raw.isFavorite) favorites++;
      }

      return { total: result.size, individuals, companies, services, favorites };
    } catch (error) {
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
      throw new Error('Failed to import contacts');
    }
  }

  // Export — ADR-214 Phase 2: via FirestoreQueryService
  static async exportContacts(type?: ContactType): Promise<Contact[]> {
    try {
      const constraints: QueryConstraint[] = [];
      if (type) constraints.push(where('type', '==', type));

      const result = await firestoreQueryService.getAll<DocumentData>('CONTACTS', {
        constraints,
      });
      return result.documents.map(toContact);
    } catch (error) {
      throw new Error('Failed to export contacts');
    }
  }

  // Search (advanced) — ADR-214 Phase 2: via FirestoreQueryService
  static async searchContacts(searchOptions: {
    searchTerm?: string; type?: ContactType; tags?: string[]; city?: string;
    hasPhone?: boolean; hasEmail?: boolean; createdAfter?: Date; createdBefore?: Date;
  }): Promise<Contact[]> {
    try {
      // 🔐 ENTERPRISE: Defense-in-depth — auth guard on read operations
      const currentUser = auth.currentUser;
      if (!currentUser) {
        logger.warn('[ContactsService] searchContacts called without authentication — returning empty');
        return [];
      }

      const constraints: QueryConstraint[] = [];
      if (searchOptions.type) constraints.push(where('type', '==', searchOptions.type));

      const result = await firestoreQueryService.getAll<DocumentData>('CONTACTS', {
        constraints,
      });
      let contacts = result.documents.map(toContact);

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
      throw new Error('Failed to search contacts');
    }
  }
}
