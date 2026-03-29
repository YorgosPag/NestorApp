/**
 * @module services/contacts-query.service
 * @enterprise ADR-214 — Contact Read/Query/Search Operations
 *
 * Extracted from contacts.service.ts (Google SRP split).
 * Contains all read-only operations: list, search, stats, subscribe, export, import.
 * Write operations remain in contacts.service.ts.
 */

import {
  doc, getDocs, query, where, collection,
  orderBy, limit, startAfter, DocumentSnapshot, QueryConstraint,
  writeBatch, serverTimestamp, QuerySnapshot,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import {
  Contact, ContactType, isIndividualContact, isCompanyContact,
  AddressInfo, ContactStatus,
} from '@/types/contacts';

import { getCol, mapDocs, chunk, asDate, startAfterDocId } from '@/lib/firestore/utils';
import { contactConverter } from '@/lib/firestore/converters/contact.converter';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { DocumentData } from 'firebase/firestore';
import { generateContactId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';

const logger = createModuleLogger('ContactsQueryService');

// ============================================================================
// Constants
// ============================================================================

const CONTACTS_COLLECTION = COLLECTIONS.CONTACTS;
const BATCH_SIZE = parseInt(process.env.NEXT_PUBLIC_CONTACTS_BATCH_SIZE || '100');
const MAX_BATCH = parseInt(process.env.NEXT_PUBLIC_CONTACTS_MAX_BATCH || '500');

// ============================================================================
// Types (shared with contacts.service.ts)
// ============================================================================

type ContactFirestoreData = Omit<Contact, 'createdAt' | 'updatedAt'> & {
  createdAt?: import('firebase/firestore').FieldValue;
  updatedAt?: import('firebase/firestore').FieldValue;
};

// ============================================================================
// Helpers
// ============================================================================

function toContact(raw: DocumentData): Contact {
  return {
    id: raw.id as string,
    ...raw,
    createdAt: asDate(raw.createdAt),
    updatedAt: asDate(raw.updatedAt),
  } as Contact;
}

async function buildContactsQuery(options?: {
  type?: ContactType;
  onlyFavorites?: boolean;
  includeArchived?: boolean;
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
  lastDoc?: DocumentSnapshot;
  limitCount?: number;
  cursorId?: string | null;
}) {
  const constraints: QueryConstraint[] = [];

  if (options?.type) constraints.push(where('type', '==', options.type));
  if (options?.onlyFavorites) constraints.push(where('isFavorite', '==', true));

  const orderField = options?.orderByField || 'updatedAt';
  const orderDir = options?.orderDirection || 'desc';
  constraints.push(orderBy(orderField, orderDir));

  if (options?.cursorId) {
    const snapRef = await startAfterDocId(CONTACTS_COLLECTION, options.cursorId);
    if (snapRef) constraints.push(startAfter(snapRef));
  } else if (options?.lastDoc) {
    constraints.push(startAfter(options.lastDoc));
  }

  constraints.push(limit(options?.limitCount || BATCH_SIZE));

  return query(getCol<Contact>(CONTACTS_COLLECTION, contactConverter), ...constraints);
}

// ============================================================================
// Read / List Operations
// ============================================================================

export async function getAllContacts(options?: {
  type?: ContactType;
  onlyFavorites?: boolean;
  includeArchived?: boolean;
  searchTerm?: string;
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
  limitCount?: number;
  lastDoc?: DocumentSnapshot;
  cursorId?: string | null;
}): Promise<{ contacts: Contact[]; lastDoc: DocumentSnapshot | null; nextCursor: string | null }> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    logger.warn('getAllContacts called without authentication — returning empty');
    return { contacts: [], lastDoc: null, nextCursor: null };
  }

  const q = await buildContactsQuery(options);
  const qs = await getDocs(q);
  const contacts = mapDocs<Contact>(qs as unknown as QuerySnapshot<Contact>);

  let filtered = contacts;

  // Filter by archived status (client-side to avoid composite Firestore index)
  if (options?.includeArchived === true) {
    filtered = filtered.filter((c) => c.status === 'archived');
  } else {
    filtered = filtered.filter((c) => !c.status || c.status !== 'archived');
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
      const emails = (contact.emails ?? []).map((e) => e.email || '');
      return (
        (contact.serviceName || '').toLowerCase().includes(term) ||
        emails.some((e) => e.toLowerCase().includes(term))
      );
    });
  }

  const lastDoc = qs.docs[qs.docs.length - 1] || null;
  return { contacts: filtered, lastDoc, nextCursor: lastDoc?.id ?? null };
}

export async function getAllContactIds(): Promise<string[]> {
  const result = await firestoreQueryService.getAll<DocumentData>('CONTACTS', {});
  return result.documents.map(d => d.id as string);
}

export async function getOwnerContactIds(): Promise<string[]> {
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
}

// ============================================================================
// Search
// ============================================================================

export async function searchContacts(searchOptions: {
  searchTerm?: string; type?: ContactType; tags?: string[]; city?: string;
  hasPhone?: boolean; hasEmail?: boolean; createdAfter?: Date; createdBefore?: Date;
}): Promise<Contact[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    logger.warn('searchContacts called without authentication — returning empty');
    return [];
  }

  const constraints: QueryConstraint[] = [];
  if (searchOptions.type) constraints.push(where('type', '==', searchOptions.type));

  const result = await firestoreQueryService.getAll<DocumentData>('CONTACTS', { constraints });
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
      const addresses = c.addresses ?? [];
      return addresses.some((a: AddressInfo) => (a.city || '').toLowerCase().includes(cityTerm));
    });
  }
  if (searchOptions.hasPhone !== undefined) {
    contacts = contacts.filter((c) => {
      const len = c.phones?.length ?? 0;
      return searchOptions.hasPhone ? len > 0 : len === 0;
    });
  }
  if (searchOptions.hasEmail !== undefined) {
    contacts = contacts.filter((c) => {
      const len = c.emails?.length ?? 0;
      return searchOptions.hasEmail ? len > 0 : len === 0;
    });
  }
  if (searchOptions.createdAfter) {
    contacts = contacts.filter((c) => asDate(c.createdAt) >= searchOptions.createdAfter!);
  }
  if (searchOptions.createdBefore) {
    contacts = contacts.filter((c) => asDate(c.createdAt) <= searchOptions.createdBefore!);
  }

  return contacts;
}

// ============================================================================
// Stats / Subscribe / Export
// ============================================================================

export async function getContactStatistics(): Promise<{
  total: number; individuals: number; companies: number; services: number; favorites: number;
}> {
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
}

export function subscribeToContacts(
  callback: (contacts: Contact[]) => void,
  options?: {
    type?: ContactType;
    onlyFavorites?: boolean;
    limitCount?: number;
    onError?: (error: Error) => void;
  }
): () => void {
  const constraints: QueryConstraint[] = [];
  if (options?.type) constraints.push(where('type', '==', options.type));
  if (options?.onlyFavorites) constraints.push(where('isFavorite', '==', true));
  constraints.push(orderBy('updatedAt', 'desc'));

  return firestoreQueryService.subscribe<DocumentData>(
    'CONTACTS',
    (result) => {
      const contacts = result.documents.map(doc => ({ ...doc } as unknown as Contact));
      callback(contacts);
    },
    (err) => {
      logger.error('Contact subscription error', { error: err.message });
      options?.onError?.(err);
    },
    {
      constraints,
      maxResults: options?.limitCount ?? BATCH_SIZE,
    }
  );
}

export async function exportContacts(type?: ContactType): Promise<Contact[]> {
  const constraints: QueryConstraint[] = [];
  if (type) constraints.push(where('type', '==', type));

  const result = await firestoreQueryService.getAll<DocumentData>('CONTACTS', { constraints });
  return result.documents.map(toContact);
}

// ============================================================================
// Import / Archive Batch
// ============================================================================

export async function importContacts(
  contacts: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>[],
): Promise<number> {
  let countInBatch = 0;
  let batch = writeBatch(db);

  for (const contact of contacts) {
    const ref = doc(collection(db, CONTACTS_COLLECTION), generateContactId());
    const createData: ContactFirestoreData = {
      ...contact,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    batch.set(ref, createData);
    countInBatch++;

    if (countInBatch >= MAX_BATCH) {
      await batch.commit();
      batch = writeBatch(db);
      countInBatch = 0;
    }
  }

  if (countInBatch > 0) await batch.commit();
  return contacts.length;
}

export async function archiveMultipleContacts(ids: string[], reason?: string): Promise<void> {
  for (const group of chunk(ids, MAX_BATCH)) {
    const batch = writeBatch(db);
    group.forEach((id) => {
      const docRef = doc(db, CONTACTS_COLLECTION, id);
      const updateData: Record<string, unknown> = {
        status: 'archived' as ContactStatus,
        archivedAt: serverTimestamp(),
        archivedBy: process.env.NEXT_PUBLIC_DEFAULT_USER_ID || 'current-user',
        updatedAt: serverTimestamp(),
      };
      if (reason && reason.trim()) {
        updateData.archivedReason = reason.trim();
      }
      batch.update(docRef, updateData);
    });
    await batch.commit();
  }
}
