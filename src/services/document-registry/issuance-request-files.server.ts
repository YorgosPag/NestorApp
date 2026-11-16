import 'server-only';

/**
 * @fileoverview ADR-942 Φ1 (Ε2) — **πού ζουν τα έγγραφα** ενός ακινήτου ανάθεσης έκδοσης, και τι **έχει ήδη** ο φάκελος.
 * @related issuance-request-catalog.ts (τα είδη) · registry-owner-properties.server.ts (θεματοφυλακή) · upload-entry-points/queries.ts
 * @module services/document-registry/issuance-request-files.server
 *
 * 🔑 **«Τα έγγραφα του σπιτιού ζουν εκεί που ζει το σπίτι»**: η ανάθεση ανήκει στο γραφείο, και το ακίνητο είναι
 *    - ακίνητο εταιρείας (`property`) ⇒ αρχεία της οντότητας ακινήτου της εταιρείας·
 *    - ακίνητο ιδιώτη σε θεματοφυλακή του γραφείου (`owner-property`) ⇒ αρχεία εταιρείας της οντότητας `owner_property`
 *      (το ίδιο δοχείο με το `AttestationDocumentField`). Αν το ακίνητο πέρασε στον ιδιοκτήτη ⇒ `null`: το γραφείο
 *      δεν είναι πια ο κάτοχος, και κανένα αίτημα δεν πάει σε λάθος φάκελο.
 * 🔑 **«Το έχει ήδη» = ερώτημα, όχι μαντεψιά**: ο σκοπός (`purpose`) του κάθε είδους **παράγεται** από τον κατάλογο
 *    ανεβάσματος. Μόνο ισότητες + `in` ⇒ κανένας σύνθετος δείκτης (ίδιο σχήμα με το `readUndeclaredFiles`).
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import type { IssuanceRequestItem } from '@/config/document-requests/issuance-request-catalog';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { findCatalogEntryForFile } from '@/config/upload-entry-points/queries';
import { fieldToISO } from '@/lib/date-local';
import { isLiveFileRecord } from '@/lib/files/container-file-verdict';
import { createModuleLogger } from '@/lib/telemetry';
import type { IssuanceRequestEntityType } from '@/types/issuance-document-request';
import type { DocumentIssuanceAssignment } from './issuance-assignment-schema';
import { isOwnerPropertyInOfficeCustody } from './registry-owner-properties.server';

const logger = createModuleLogger('issuance-request-files');

/** Το δοχείο αρχείων του κατόχου — θεματοφυλακή εταιρείας, πάντα του γραφείου της ανάθεσης. */
export interface IssuanceRequestContainer {
  readonly companyId: string;
  readonly entityType: IssuanceRequestEntityType;
  readonly entityId: string;
}

/** Το δοχείο της ανάθεσης — ή `null` όταν το γραφείο δεν κατέχει πια το ακίνητο. */
export async function issuanceRequestContainerOf(
  db: AdminFirestore,
  assignment: Pick<DocumentIssuanceAssignment, 'companyId' | 'propertyId' | 'scope'>,
): Promise<IssuanceRequestContainer | null> {
  if (assignment.scope === 'property') {
    return { companyId: assignment.companyId, entityType: ENTITY_TYPES.PROPERTY, entityId: assignment.propertyId };
  }
  const held = await isOwnerPropertyInOfficeCustody(db, assignment.companyId, assignment.propertyId);
  return held ? { companyId: assignment.companyId, entityType: ENTITY_TYPES.OWNER_PROPERTY, entityId: assignment.propertyId } : null;
}

/** Ο σκοπός αρχείου ενός είδους — από τον κατάλογο ανεβάσματος (ακίνητο + μελέτες), ποτέ δεύτερη λίστα. */
export function issuanceRequestPurposeOf(itemId: string): string | null {
  return findCatalogEntryForFile(ENTITY_TYPES.PROPERTY, { entryPointId: itemId })?.purpose ?? null;
}

/** Ανά στοιχείο: το νεότερο ζωντανό αρχείο του είδους του στο δοχείο, ή `null`. */
function newestByPurpose(docs: readonly { readonly data: () => Record<string, unknown> }[]): Map<string, string> {
  const newest = new Map<string, string>();
  for (const doc of docs) {
    const data = doc.data();
    if (!isLiveFileRecord(data) || typeof data.purpose !== 'string') continue;
    const at = fieldToISO(data, 'createdAt');
    const known = newest.get(data.purpose);
    if (known === undefined || at > known) newest.set(data.purpose, at);
  }
  return newest;
}

/**
 * «Το έχει ήδη ο φάκελος;» για κάθε στοιχείο — `itemId → πότε` (ή `null`). Αποτυχία ανάγνωσης ⇒ `null` ολόκληρο
 * («δεν ξέρω» ≠ «λείπουν όλα»: ποτέ αίτημα για κάτι που ίσως υπάρχει).
 */
export async function readIssuanceProvided(
  db: AdminFirestore,
  container: IssuanceRequestContainer,
  items: readonly IssuanceRequestItem[],
): Promise<Readonly<Record<string, string | null>> | null> {
  const purposes = [...new Set(items.flatMap((item) => issuanceRequestPurposeOf(item.itemId) ?? []))];
  if (purposes.length === 0) return Object.fromEntries(items.map((item) => [item.itemId, null]));
  try {
    const snapshot = await db
      .collection(COLLECTIONS.FILES)
      .where(FIELDS.COMPANY_ID, '==', container.companyId)
      .where(FIELDS.ENTITY_TYPE, '==', container.entityType)
      .where(FIELDS.ENTITY_ID, '==', container.entityId)
      .where('purpose', 'in', purposes)
      .get();
    const newest = newestByPurpose(snapshot.docs);
    return Object.fromEntries(items.map((item) => {
      const purpose = issuanceRequestPurposeOf(item.itemId);
      return [item.itemId, purpose === null ? null : newest.get(purpose) ?? null];
    }));
  } catch (error) {
    logger.error('Τα αρχεία του φακέλου της ανάθεσης δεν διαβάστηκαν', { entityId: container.entityId, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}
