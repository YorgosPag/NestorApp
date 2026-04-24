/**
 * @module services/contacts.service
 * @enterprise ADR-214 — Contact CRUD Service (Write Operations)
 *
 * Google SRP: Write operations (create, update, delete, archive/restore).
 * Read operations extracted to contacts-query.service.ts.
 * ContactsService class delegates read methods for backward compatibility.
 */

import {
  doc, setDoc, updateDoc,
  serverTimestamp, deleteField, FieldValue,
} from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import {
  Contact, ContactStatus,
} from '@/types/contacts';
import { EnterpriseContactSaver } from '@/utils/contacts/EnterpriseContactSaver';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { DuplicatePreventionService } from './contacts/DuplicatePreventionService';
import { sanitizeContactData, sanitizeContactForUpdate, validateContactData, type ContactDataRecord } from '@/utils/contactForm/utils/data-cleaning';

import { getCol, asDate } from '@/lib/firestore/utils';
import { contactConverter } from '@/lib/firestore/converters/contact.converter';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { DocumentData } from 'firebase/firestore';
import { RealtimeService } from '@/services/realtime';
import { mapActivePersonas } from '@/utils/contactForm/mappers/individual';
import { generateContactId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { resolveCompanyDisplayName } from '@/services/company/company-name-resolver';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES, ENTITY_TYPES } from '@/config/domain-constants';
import { PhotoUploadService } from '@/services/photo-upload.service';
import { cleanupOrphanedPhotos } from '@/utils/contactForm/photo-cleanup';

// Re-export read operations for backward compatibility
export {
  getAllContacts,
  getAllContactIds,
  getOwnerContactIds,
  searchContacts,
  getContactStatistics,
  subscribeToContacts,
  exportContacts,
  importContacts,
  archiveMultipleContacts,
} from './contacts-query.service';

import * as queryService from './contacts-query.service';

const logger = createModuleLogger('ContactsService');

// ============================================================================
// Types
// ============================================================================

interface ContactArchiveFields {
  archivedAt?: FieldValue;
  archivedBy?: string;
  archivedReason?: string;
  restoredAt?: FieldValue;
  restoredBy?: string;
}

interface ContactSoftDeleteFields {
  deletedAt?: FieldValue | Date | { toDate: () => Date };
  deletedBy?: string;
  previousStatus?: string;
}

interface ContactPhotoFields {
  photoURL?: string;
  multiplePhotoURLs?: string[] | FieldValue;
}

/**
 * ADR-195 Phase 1 CDC stamps. Read by the Cloud Function audit trigger to
 * resolve a real `performedBy` on every contact write. Optional on every
 * write path — missing stamps fall back to `'cdc_unknown'` with a warning.
 */
interface ContactLastModifiedStamps {
  _lastModifiedBy?: string;
  _lastModifiedByName?: string | null;
  _lastModifiedAt?: FieldValue;
}

type ContactFirestoreData = Omit<Contact, 'createdAt' | 'updatedAt'> & {
  createdAt?: FieldValue;
  updatedAt?: FieldValue;
} & ContactArchiveFields & ContactSoftDeleteFields & ContactLastModifiedStamps;

type ContactUpdatePayload = Omit<Partial<Contact>, 'multiplePhotoURLs'>
  & ContactArchiveFields & ContactSoftDeleteFields & ContactPhotoFields
  & ContactLastModifiedStamps
  & { updatedAt?: FieldValue };

const CONTACTS_COLLECTION = COLLECTIONS.CONTACTS;

// ============================================================================
// Helpers
// ============================================================================

function toContact(raw: DocumentData): Contact {
  return { id: raw.id as string, ...raw, createdAt: asDate(raw.createdAt), updatedAt: asDate(raw.updatedAt) } as Contact;
}

/**
 * Deep-clean undefined values from a record before Firestore write.
 * Firestore accepts null but REJECTS undefined.
 */
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

/** UI-only fields that must NOT reach Firestore */
const UI_ONLY_FIELDS = [
  'logoFile', 'logoPreview', 'photoFile', 'photoPreview',
  'selectedProfilePhotoIndex', 'socialMediaArray',
  'multiplePhotos', '_isLogoUploading', '_isPhotoUploading',
  '_forceDeleteLogo', 'activePersonaTab', 'photoFileName',
] as const;

/** Legacy fields removed from payload (not from Firestore) */
const LEGACY_FIELDS = ['email', 'phone', 'street', 'streetNumber', 'city', 'postalCode', 'website'] as const;

/** System fields protected by Firestore rules */
const SYSTEM_FIELDS = ['id', 'createdAt', 'createdBy', 'ownerId'] as const;

// ============================================================================
// ContactsService — Write Operations
// ============================================================================

export class ContactsService {
  /** Build display name from contact data. Public for pre-flight name change checks. */
  static getDisplayName(contactData: Partial<Contact>): string {
    switch (contactData.type) {
      case 'individual': return `${contactData.firstName || ''} ${contactData.lastName || ''}`.trim();
      case 'company':
        return resolveCompanyDisplayName({
          id: (contactData as { id?: string }).id,
          companyName: contactData.companyName,
          tradeName: (contactData as { tradeName?: string }).tradeName,
          legalName: (contactData as { legalName?: string }).legalName,
        });
      case 'service': return contactData.serviceName || 'Unknown Service';
      default: return 'Unknown Contact';
    }
  }

  // ==== CREATE ====

  static async createContact(contactData: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    // Phase 1: Validate + Sanitize
    const contactRecord = contactData as unknown as ContactDataRecord;
    const validationResult = validateContactData(contactRecord);
    if (!validationResult.isValid) {
      throw new Error(`VALIDATION_ERROR: ${validationResult.errors.join(', ')}`);
    }
    const sanitizedData = sanitizeContactData(contactRecord) as unknown as Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>;

    // Phase 2: Duplicate Prevention
    const duplicateResult = await DuplicatePreventionService.detectDuplicates(sanitizedData, {
      strictMode: true,
      timeWindow: 5000,
    });
    if (duplicateResult.isDuplicate) {
      const rec = duplicateResult.recommendations[0];
      const match = duplicateResult.matchingContacts[0];
      throw new Error(
        `DUPLICATE_CONTACT_DETECTED: ${rec.reason} ` +
        `(Confidence: ${(duplicateResult.confidence * 100).toFixed(1)}%) ` +
        `[Contact ID: ${match?.id}]`
      );
    }

    // Phase 3: Auth + Create
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('AUTHENTICATION_ERROR: User must be logged in to create contacts');

    const tokenResult = await currentUser.getIdTokenResult();
    const userCompanyId = tokenResult.claims?.companyId as string | undefined;
    if (!userCompanyId) throw new Error('AUTHORIZATION_ERROR: User is not assigned to a company');

    const colRef = getCol<Contact>(CONTACTS_COLLECTION, contactConverter);
    const id = generateContactId();
    const createData: ContactFirestoreData = {
      ...sanitizedData, id,
      companyId: userCompanyId,
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      // ADR-195 Phase 1 (CDC PoC): stamp performer so `auditContactWrite`
      // trigger resolves a real `performedBy` instead of 'cdc_unknown'.
      // Mirrors the stamp applied in `updateContact` — on create the current
      // user IS the performer, so `createdBy === _lastModifiedBy`.
      _lastModifiedBy: currentUser.uid,
      _lastModifiedByName:
        currentUser.displayName?.trim() || currentUser.email || null,
      _lastModifiedAt: serverTimestamp(),
    };

    // ADR-268 Q88: Auto-sync personaTypes on create
    const createRecord = createData as unknown as Record<string, unknown>;
    if (Array.isArray(createRecord.personas)) {
      const personasArr = createRecord.personas as Array<{ personaType: string; status: string }>;
      createRecord.personaTypes = personasArr.filter(p => p.status === 'active').map(p => p.personaType);
    }

    const docRef = doc(colRef, id);
    await setDoc(docRef, createData as unknown as Contact);

    logger.info('CONTACT CREATED', { contactId: id, contactType: sanitizedData.type });

    // ADR-029 Phase D: search_documents written by Cloud Function onContactWrite.
    // Audit trail: covered by CDC Cloud Function (auditContactWrite) — ADR-195 Phase 2 cutover.

    RealtimeService.dispatch('CONTACT_CREATED', {
      contactId: id,
      contact: {
        type: sanitizedData.type,
        firstName: sanitizedData.type === 'individual' ? sanitizedData.firstName : undefined,
        lastName: sanitizedData.type === 'individual' ? sanitizedData.lastName : undefined,
        companyName: sanitizedData.type === 'company' ? sanitizedData.companyName : undefined,
        serviceName: sanitizedData.type === 'service' ? sanitizedData.serviceName : undefined,
      },
      timestamp: Date.now(),
    });

    return id;
  }

  // ==== READ (single) ====

  static async getContact(id: string): Promise<Contact | null> {
    const raw = await firestoreQueryService.getById<DocumentData>('CONTACTS', id);
    return raw ? toContact(raw) : null;
  }

  // ==== UPDATE FROM FORM ====

  static async updateExistingContactFromForm(
    existingContact: Contact,
    formData: Partial<ContactFormData>,
  ): Promise<void> {
    const contactId = existingContact.id;
    if (!contactId) {
      throw new Error('Contact not found');
    }

    const enterpriseData = EnterpriseContactSaver.updateExistingContact(existingContact, formData);
    const photoData: {
      photoURL?: string;
      logoURL?: string;
      multiplePhotoURLs?: string[];
    } = {
      photoURL: typeof enterpriseData.photoURL === 'string' ? enterpriseData.photoURL : undefined,
      logoURL: typeof enterpriseData.logoURL === 'string' ? enterpriseData.logoURL : undefined,
      multiplePhotoURLs: Array.isArray(enterpriseData.multiplePhotoURLs) ? enterpriseData.multiplePhotoURLs : undefined,
    };
    await cleanupOrphanedPhotos(existingContact, photoData);
    await this.updateContactFromForm(contactId, formData);
  }

  static async updateContactFromForm(id: string, formData: Partial<ContactFormData>): Promise<void> {
    const existingContact = await this.getContact(id);
    if (!existingContact) throw new Error('Contact not found');

    // ADR-323: `formData` is the DIRTY DIFF (only fields the user touched).
    // We build two views:
    //   - `enterpriseFull`  = merge (existing + diff) — used for validation,
    //     photo diff, and the post-save name cascade.
    //   - `enterpriseDiff`  = convert diff only — this is what we WRITE, so
    //     untouched fields are not overwritten with stale form defaults.
    const enterpriseFull = EnterpriseContactSaver.updateExistingContact(existingContact, formData);

    const validationResult = validateContactData(enterpriseFull as ContactDataRecord);
    if (!validationResult.isValid) {
      throw new Error(`VALIDATION_ERROR: ${validationResult.errors.join(', ')}`);
    }

    // Cleanup removed photos from Storage (fire-and-forget) — needs the full view
    // to know what the existing photos were vs. the desired post-save set.
    const oldURLs = (existingContact as unknown as Record<string, unknown>).multiplePhotoURLs;
    const newURLs = enterpriseFull.multiplePhotoURLs;
    if (Array.isArray(oldURLs) && oldURLs.length > 0) {
      const newURLSet = new Set(Array.isArray(newURLs) ? newURLs : []);
      const deletedURLs = oldURLs.filter((url): url is string => typeof url === 'string' && !newURLSet.has(url));
      if (deletedURLs.length > 0) {
        PhotoUploadService.cleanupMultiplePhotos(deletedURLs).catch(() => {});
      }
    }

    // Write only the diff. companyId is immutable per Firestore rules, so
    // skipping it in the diff is safe — existing doc keeps its value.
    const enterpriseDiff = EnterpriseContactSaver.convertToEnterpriseStructure(formData);
    await this.updateContact(id, enterpriseDiff);

    // ADR-249: Contact name cascade (fire-and-forget)
    const oldName = this.getDisplayName(existingContact);
    const newName = this.getDisplayName({ ...existingContact, ...enterpriseFull });
    if (oldName !== newName && newName.length > 0) {
      apiClient.post(`/api/contacts/${id}/name-cascade`, { newDisplayName: newName }).catch(() => {});
    }

    // Audit trail: covered by CDC Cloud Function (auditContactWrite) — ADR-195 Phase 2 cutover.
  }

  // ==== UPDATE (core) ====

  static async updateContact(id: string, updates: ContactUpdatePayload): Promise<void> {
    const docRef = doc(getCol<Contact>(CONTACTS_COLLECTION, contactConverter), id);

    // ADR-323: Sanitize the user payload BEFORE adding system fields / FieldValue
    // sentinels. Empty strings / arrays / objects in the payload represent an
    // explicit user "clear" and are converted to Firestore deleteField() so the
    // stale value is actually removed (instead of being overwritten with ""
    // which bloated the document). Fields not in the payload are left alone.
    const { cleanUpdates, fieldsToDelete } = sanitizeContactForUpdate(updates as ContactDataRecord);
    const updateData = { ...cleanUpdates, updatedAt: serverTimestamp() } as ContactUpdatePayload;
    for (const field of fieldsToDelete) {
      (updateData as Record<string, unknown>)[field] = deleteField();
    }

    // ADR-195 Phase 1 (CDC PoC): stamp the performer on the document itself
    // so the Cloud Function audit trigger has user context without needing
    // a separate channel. Read by `auditContactWrite` from after.data().
    const currentUser = auth.currentUser;
    if (currentUser) {
      updateData._lastModifiedBy = currentUser.uid;
      updateData._lastModifiedByName =
        currentUser.displayName?.trim() || currentUser.email || null;
      updateData._lastModifiedAt = serverTimestamp();
    }

    // Remove protected system fields
    for (const field of SYSTEM_FIELDS) { delete (updateData as Record<string, unknown>)[field]; }

    // Handle multiplePhotoURLs edge cases
    if ('multiplePhotoURLs' in updates) {
      if (Array.isArray(updates.multiplePhotoURLs) && updates.multiplePhotoURLs.length === 0) {
        updateData.multiplePhotoURLs = [];
      } else if (updates.multiplePhotoURLs === null || updates.multiplePhotoURLs === undefined) {
        updateData.multiplePhotoURLs = deleteField() as ContactPhotoFields['multiplePhotoURLs'];
      }
    }

    // Remove legacy fields from payload
    const udRecord = updateData as Record<string, unknown>;
    for (const field of LEGACY_FIELDS) { delete udRecord[field]; }

    // ADR-121: Convert form-level persona fields to Firestore structure
    if (udRecord.activePersonas && Array.isArray(udRecord.activePersonas)) {
      const mapped = (udRecord.activePersonas as string[]).length > 0
        ? mapActivePersonas(updateData as unknown as ContactFormData)
        : [];
      udRecord.personas = mapped;
    }
    delete udRecord.activePersonas;
    delete udRecord.personaData;

    // ADR-268 Q88: Auto-sync personaTypes from personas[]
    if (Array.isArray(udRecord.personas)) {
      const personasArr = udRecord.personas as Array<{ personaType: string; status: string }>;
      udRecord.personaTypes = personasArr.filter(p => p.status === 'active').map(p => p.personaType);
    }

    // Remove UI-only fields
    for (const field of UI_ONLY_FIELDS) { delete udRecord[field]; }

    // Deep clean undefined (Firestore rejects undefined)
    deepCleanUndefined(udRecord);

    await updateDoc(docRef, udRecord);

    // ADR-029 Phase D: search_documents written by Cloud Function onContactWrite.

    RealtimeService.dispatch('CONTACT_UPDATED', {
      contactId: id,
      updates: {
        firstName: updates.firstName, lastName: updates.lastName,
        companyName: updates.companyName, serviceName: updates.serviceName,
        status: updates.status, isFavorite: updates.isFavorite,
      },
      timestamp: Date.now(),
    });
  }

  // ==== TOGGLE / ARCHIVE / RESTORE / DELETE ====

  static async toggleFavorite(id: string, currentStatus: boolean): Promise<void> {
    await this.updateContact(id, { isFavorite: !currentStatus });
  }

  static async archiveContact(id: string, reason?: string): Promise<void> {
    const updateData: ContactUpdatePayload = {
      status: 'archived' as ContactStatus,
      archivedAt: serverTimestamp(),
      archivedBy: process.env.NEXT_PUBLIC_DEFAULT_USER_ID || 'current-user',
    };
    if (reason?.trim()) updateData.archivedReason = reason.trim();
    await this.updateContact(id, updateData);
  }

  static async restoreContact(id: string): Promise<void> {
    await this.updateContact(id, {
      status: 'active' as ContactStatus,
      restoredAt: serverTimestamp(),
      restoredBy: process.env.NEXT_PUBLIC_DEFAULT_USER_ID || 'current-user',
    });
  }

  // ==== SOFT DELETE (Trash) ====

  /** Soft-delete: moves contact to trash (status='deleted') with undo capability */
  static async deleteContact(id: string): Promise<void> {
    await apiClient.delete(API_ROUTES.CONTACTS.BY_ID(id));
    RealtimeService.dispatch('CONTACT_DELETED', { contactId: id, timestamp: Date.now() });
  }

  /** Soft-delete multiple contacts in parallel */
  static async deleteMultipleContacts(ids: string[]): Promise<void> {
    await Promise.all(ids.map(id => apiClient.delete(API_ROUTES.CONTACTS.BY_ID(id))));
  }

  /** Restore a soft-deleted contact from trash to its previous status */
  static async restoreDeletedContact(id: string): Promise<void> {
    await apiClient.post(API_ROUTES.CONTACTS.RESTORE(id));
    RealtimeService.dispatch('CONTACT_UPDATED', { contactId: id, updates: { status: 'active' }, timestamp: Date.now() });
  }

  /** Restore multiple soft-deleted contacts in parallel */
  static async restoreMultipleDeletedContacts(ids: string[]): Promise<void> {
    await Promise.all(ids.map(id => apiClient.post(API_ROUTES.CONTACTS.RESTORE(id))));
  }

  // ==== PERMANENT DELETE ====

  /** Permanently delete a contact (must be in trash first). Runs full dependency check. */
  static async permanentDeleteContact(id: string): Promise<void> {
    await apiClient.delete(API_ROUTES.CONTACTS.PERMANENT_DELETE(id));
    RealtimeService.dispatch('CONTACT_DELETED', { contactId: id, timestamp: Date.now() });
  }

  /** Permanently delete multiple trashed contacts */
  static async permanentDeleteMultipleContacts(ids: string[]): Promise<void> {
    await Promise.all(ids.map(id => apiClient.delete(API_ROUTES.CONTACTS.PERMANENT_DELETE(id))));
  }

  // ==== DELEGATED READ METHODS (backward compatibility) ====

  static getAllContacts = queryService.getAllContacts;
  static getAllContactIds = queryService.getAllContactIds;
  static getOwnerContactIds = queryService.getOwnerContactIds;
  static searchContacts = queryService.searchContacts;
  static getContactStatistics = queryService.getContactStatistics;
  static subscribeToContacts = queryService.subscribeToContacts;
  static exportContacts = queryService.exportContacts;
  static importContacts = queryService.importContacts;
  static archiveMultipleContacts = queryService.archiveMultipleContacts;
}
