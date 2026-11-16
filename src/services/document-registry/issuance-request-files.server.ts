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

import { issuanceRequestItemsOf, type IssuanceRequestItem, type IssuanceRequestItemId } from '@/config/document-requests/issuance-request-catalog';
import type { DocumentKind } from '@/config/document-validity/document-validity';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { findCatalogEntryForFile } from '@/config/upload-entry-points/queries';
import { fieldToISO } from '@/lib/date-local';
import { fileDownloadName, type FileNameFields } from '@/lib/files/file-download-name';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { isLiveFileRecord } from '@/lib/files/container-file-verdict';
import { createModuleLogger } from '@/lib/telemetry';
import type { IssuanceFolderFile, IssuanceRequestEntityType } from '@/types/issuance-document-request';
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

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** Τα πεδία ονόματος του εγγράφου, στενεμένα (το έγγραφο είναι `unknown` ανά πεδίο). */
function nameFieldsOf(data: Record<string, unknown>): FileNameFields {
  return { displayName: optionalString(data.displayName), originalFilename: optionalString(data.originalFilename), ext: optionalString(data.ext) };
}

/** Ανά σκοπό: τα ζωντανά αρχεία, νεότερο πρώτο. */
function liveByPurpose(docs: readonly { readonly id: string; readonly data: () => Record<string, unknown> }[]): Map<string, IssuanceFolderFile[]> {
  const byPurpose = new Map<string, IssuanceFolderFile[]>();
  for (const doc of docs) {
    const data = doc.data();
    if (!isLiveFileRecord(data) || typeof data.purpose !== 'string') continue;
    const file: IssuanceFolderFile = { fileId: doc.id, fileName: fileDownloadName(nameFieldsOf(data), doc.id), createdAt: fieldToISO(data, 'createdAt') };
    byPurpose.set(data.purpose, [...(byPurpose.get(data.purpose) ?? []), file]);
  }
  for (const files of byPurpose.values()) files.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return byPurpose;
}

/**
 * «Τι έχει ο φάκελος;» για κάθε στοιχείο — `itemId → ζωντανά αρχεία, νεότερο πρώτο` (κενό ⇒ λείπει). Αποτυχία ανάγνωσης
 * ⇒ `null` ολόκληρο («δεν ξέρω» ≠ «λείπουν όλα»: ποτέ αίτημα για κάτι που ίσως υπάρχει).
 */
export async function readIssuanceFolder(
  db: AdminFirestore,
  container: IssuanceRequestContainer,
  items: readonly IssuanceRequestItem[],
): Promise<Readonly<Record<string, readonly IssuanceFolderFile[]>> | null> {
  const purposes = [...new Set(items.flatMap((item) => issuanceRequestPurposeOf(item.itemId) ?? []))];
  if (purposes.length === 0) return Object.fromEntries(items.map((item) => [item.itemId, []]));
  try {
    const snapshot = await db
      .collection(COLLECTIONS.FILES)
      .where(FIELDS.COMPANY_ID, '==', container.companyId)
      .where(FIELDS.ENTITY_TYPE, '==', container.entityType)
      .where(FIELDS.ENTITY_ID, '==', container.entityId)
      .where('purpose', 'in', purposes)
      .get();
    const byPurpose = liveByPurpose(snapshot.docs);
    return Object.fromEntries(items.map((item) => {
      const purpose = issuanceRequestPurposeOf(item.itemId);
      return [item.itemId, purpose === null ? [] : byPurpose.get(purpose) ?? []];
    }));
  } catch (error) {
    logger.error('Τα αρχεία του φακέλου της ανάθεσης δεν διαβάστηκαν', { entityId: container.entityId, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * ADR-942 Φ2 — ένα αρχείο **του δοχείου του κατόχου**: ζωντανό, του μισθωτή, της οντότητας του ακινήτου — αλλιώς `null`.
 * Ο ΕΝΑΣ έλεγχος για «δώσε» (γραφείο) **και** «άνοιξε» (μηχανικός): η διαδρομή έρχεται από το έγγραφο, ποτέ από το σύρμα.
 */
export async function readContainerFileRecord(
  db: AdminFirestore,
  container: IssuanceRequestContainer,
  fileId: string,
): Promise<Record<string, unknown> | null> {
  const data = (await db.collection(COLLECTIONS.FILES).doc(fileId).get()).data();
  if (data === undefined || !isLiveFileRecord(data) || !isPayloadOwnedByCompany(data, container.companyId)) return null;
  return data.entityType === container.entityType && data.entityId === container.entityId ? data : null;
}

/** Ένα αρχείο του δοχείου που **είναι** στοιχείο του καταλόγου ενός είδους — με το όνομα που βλέπει ο άνθρωπος. */
export interface IssuanceCatalogFile {
  readonly itemId: IssuanceRequestItemId;
  readonly fileName: string;
}

/** Το στοιχείο του καταλόγου που **είναι** αυτό το αρχείο — μόνο αν ζει στο δοχείο του κατόχου· αλλιώς `null`. */
export async function issuanceCatalogFileOf(
  db: AdminFirestore,
  container: IssuanceRequestContainer,
  kind: DocumentKind,
  fileId: string,
): Promise<IssuanceCatalogFile | null> {
  const data = await readContainerFileRecord(db, container, fileId);
  if (data === null) return null;
  const item = issuanceRequestItemsOf(kind).find((candidate) => issuanceRequestPurposeOf(candidate.itemId) === data.purpose);
  return item ? { itemId: item.itemId, fileName: fileDownloadName(nameFieldsOf(data), fileId) } : null;
}
