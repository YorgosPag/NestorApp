/**
 * @fileoverview Μητρώο λήξεων — τα ΕΓΓΡΑΦΑ της εταιρείας (ADR-915 Φ4β · §11.1 Ε1).
 * @module services/document-registry/registry-documents.server
 *
 * Δύο οικογένειες, **μία** γραμμή ανά έγγραφο:
 *  - (α) αρχεία `files` της εταιρείας με `documentFacts` — μέσω του ΕΝΟΣ ανεκτικού αναγνώστη (`readDocumentFacts`)·
 *    αλλοιωμένα γεγονότα ⇒ καμία γραμμή (ποτέ «ισχύει»). Κάδος / μη έτοιμο ⇒ έξω (`isLiveFileRecord`).
 *  - (β) ΠΕΑ δηλωμένο στο ακίνητο **χωρίς** ζωντανό αρχείο-πηγή (Α3 εφεδρεία) — και **χωρίς** ημερομηνία: γραμμή
 *    `expiry-unknown` (Δ1: ο άνθρωπος δηλώνει ότι υπάρχει ΠΕΑ· η απόκρυψη θα ήταν σιωπή).
 *
 * 🔑 **Καμία διπλή γραμμή**: η δήλωση γίνεται γραμμή **μόνο** όταν το αρχείο που ονομάζει (`sourceFileId`) δεν είναι
 *    ήδη γραμμή. Αρχείο στον κάδο ⇒ η δήλωση **δεν** εξαφανίζεται μαζί του (ίδια εφεδρεία με την αξίωση, §10.3).
 * ❌ Transmittals (ξένη θεματοφυλακή) · ❌ `files_personal` (προσωπικός χώρος) — εκτός Φ4 (Ε1).
 * 🔑 Αρχείο επιπέδου **έργου** (`entityType: project`) ⇒ `propertyId: null`· το «τι σταματά» του έρχεται **μόνο** από
 *    ρητή έγκριση σε υπόθεση (ADR-915 Φ4δ Ε9 — `requirementCoveredBy`), ποτέ από μαντεψιά «έργο ⇒ όλα τα ακίνητα».
 * 🔑 Φ4δ Ε10 — οι δηλώσεις (β) έρχονται **και** από ακίνητα ιδιωτών υπό θεματοφυλακή του γραφείου: ίδιος κανόνας.
 * 🔑 ADR-915 §33 — (γ) αρχεία **χωρίς στοιχεία**: θέση που **υπόσχεται** παρακολουθούμενο είδος (`namedDocumentKindOfFile`),
 *    κανένα γεγονός ⇒ γραμμή με `source: null` (`expiry-unknown`) και «Συμπλήρωση στοιχείων». Οι σκοποί του ερωτήματος
 *    **παράγονται** από τον κατάλογο (`namedDocumentFileKeys`). Αρχείο που ονομάζει δήλωση ΠΕΑ ακινήτου **υποχωρεί**:
 *    η δήλωση έχει ήδη την ημερομηνία (Δ5).
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { ENTITY_TYPES } from '@/config/domain-constants';
import { DOCUMENT_KINDS, type DocumentKind } from '@/config/document-validity/document-validity';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { namedDocumentFileKeys, namedDocumentKindOfFile } from '@/lib/conveyance/document-kind-of-file';
import { DOCUMENT_FACTS_FIELD, readDocumentFacts, type DocumentFacts } from '@/lib/document-validity/document-facts';
import type { RegistryDocument } from '@/lib/document-validity/document-registry';
import { isLiveFileRecord } from '@/lib/files/container-file-verdict';
import { trimmedStringOrNull } from '@/lib/type-guards';
import type { RegistryProperty } from './registry-properties.server';

/** Ένα αρχείο του μητρώου, όπως βγήκε από το ερώτημα — ακόμη χωρίς κρίση ακινήτου. */
export interface RegistryFile {
  readonly fileId: string;
  readonly kind: DocumentKind;
  /** `null` = αρχείο **χωρίς στοιχεία** (ADR-915 §33): η θέση υπόσχεται το είδος, κανείς δεν έγραψε ημερομηνίες. */
  readonly facts: DocumentFacts | null;
  /** `entityId` όταν το αρχείο ζει σε ακίνητο — αλλιώς `null`. */
  readonly propertyId: string | null;
  /**
   * ADR-915 §25 (5γ) — `entityId` όταν το αρχείο ζει στην κάρτα **επαφής**: εκεί ανεβαίνουν τα έγγραφα ανά πρόσωπο
   * (επίπεδο `seller_contact`, §22.4). Αλλιώς `null`.
   */
  readonly contactId: string | null;
  readonly name: string | null;
  /** Το αντικείμενο που είδε η οθόνη — CAS της δήλωσης (`expectedStoragePath` του γραφέα, ADR-915 §33). */
  readonly storagePath: string | null;
}

interface RegistryFiles {
  readonly files: readonly RegistryFile[];
  readonly truncated: boolean;
}

type FileData = Readonly<Record<string, unknown>>;

function registryFileFrom(fileId: string, data: FileData, kind: DocumentKind, facts: DocumentFacts | null): RegistryFile {
  const propertyId = data.entityType === ENTITY_TYPES.PROPERTY ? trimmedStringOrNull(data.entityId) : null;
  const contactId = data.entityType === ENTITY_TYPES.CONTACT ? trimmedStringOrNull(data.entityId) : null;
  const name = trimmedStringOrNull(data.displayName);
  return { fileId, kind, facts, propertyId, contactId, name, storagePath: trimmedStringOrNull(data.storagePath) };
}

function registryFileOf(fileId: string, data: FileData): RegistryFile | null {
  if (!isLiveFileRecord(data)) return null;
  const facts = readDocumentFacts(data[DOCUMENT_FACTS_FIELD]);
  return facts === null ? null : registryFileFrom(fileId, data, facts.kind, facts);
}

/** (γ) — ζωντανό, **χωρίς** έγκυρα γεγονότα, σε θέση που υπόσχεται **ένα** είδος. */
function undeclaredFileOf(fileId: string, data: FileData): RegistryFile | null {
  if (!isLiveFileRecord(data) || readDocumentFacts(data[DOCUMENT_FACTS_FIELD]) !== null) return null;
  const kind = namedDocumentKindOfFile(data);
  return kind === null ? null : registryFileFrom(fileId, data, kind, null);
}

/** Τα ζωντανά αρχεία της εταιρείας με γεγονότα εγγράφου. Ισότητα + `in`: χωρίς σύνθετο δείκτη (μετρημένο, §11.3). */
export async function readRegistryFiles(db: AdminFirestore, companyId: string, cap: number): Promise<RegistryFiles> {
  const snapshot = await db
    .collection(COLLECTIONS.FILES)
    .where(FIELDS.COMPANY_ID, '==', companyId)
    // Στατικό όνομα (όχι `${DOCUMENT_FACTS_FIELD}.kind`): αλλιώς η CHECK 3.91 το βλέπει «δυναμικό» και δεν το κρίνει.
    .where('documentFacts.kind', 'in', [...DOCUMENT_KINDS])
    .limit(cap + 1)
    .get();
  const files = snapshot.docs
    .slice(0, cap)
    .map((doc) => registryFileOf(doc.id, doc.data()))
    .filter((file): file is RegistryFile => file !== null);
  return { files, truncated: snapshot.size > cap };
}

/**
 * (γ) Τα ζωντανά αρχεία της εταιρείας **χωρίς στοιχεία** σε θέση που υπόσχεται είδος. Ισότητα + `in` (ίδιο σχήμα με το
 * παραπάνω, χωρίς σύνθετο δείκτη)· το είδος και το επίπεδο κρίνονται στη μνήμη (ίδιος σκοπός σε επαφή ≠ ακίνητο).
 * ⚠️ Το όριο μετρά **πριν** από το φίλτρο μνήμης — δεν είναι σιωπηλό, λέγεται στο `truncatedSources`.
 */
export async function readUndeclaredFiles(db: AdminFirestore, companyId: string, cap: number): Promise<RegistryFiles> {
  // Το `in` δέχεται ως 30 τιμές· οι ονομαστικές θέσεις είναι λίγες (άγκυρα `document-kind-of-file.test.ts`).
  const purposes = [...new Set(namedDocumentFileKeys().map((key) => key.purpose))];
  const snapshot = await db
    .collection(COLLECTIONS.FILES)
    .where(FIELDS.COMPANY_ID, '==', companyId)
    .where('purpose', 'in', purposes)
    .limit(cap + 1)
    .get();
  const files = snapshot.docs
    .slice(0, cap)
    .map((doc) => undeclaredFileOf(doc.id, doc.data()))
    .filter((file): file is RegistryFile => file !== null);
  return { files, truncated: snapshot.size > cap };
}

/** (α) — το ακίνητο μετρά **μόνο** αν ανήκει στην εταιρεία· `pinned` = το μπλοκ ΠΕΑ του ονομάζει αυτό το αρχείο. */
function fileDocumentOf(file: RegistryFile, properties: ReadonlyMap<string, RegistryProperty>): RegistryDocument {
  const property = file.propertyId === null ? undefined : properties.get(file.propertyId);
  const pinned = file.kind === 'energy-certificate' && property?.certificate.sourceFileId === file.fileId;
  return {
    id: `file:${file.fileId}`,
    kind: file.kind,
    propertyId: property?.id ?? null,
    // Το πρόσωπο ταυτίζεται με την επαφή του — ίδιο κλειδί με τον πωλητή της υπόθεσης (`sellerKeyOf`).
    party: file.contactId === null ? null : { key: file.contactId, contactId: file.contactId },
    origin: { kind: 'file', fileId: file.fileId },
    issuedOn: file.facts?.issuedOn ?? null,
    printedValidUntil: file.facts?.printedValidUntil ?? null,
    classification: file.facts?.classification ?? null,
    source: file.facts?.source ?? null,
    pinned,
  };
}

/** (β) — η δήλωση ως γραμμή· `null` όταν το αρχείο που ονομάζει είναι ήδη γραμμή. */
function declaredDocumentOf(property: RegistryProperty, fileIds: ReadonlySet<string>): RegistryDocument | null {
  const { certificate } = property;
  if (certificate.class === null) return null;
  if (certificate.sourceFileId !== null && fileIds.has(certificate.sourceFileId)) return null;
  return {
    id: `declared:${property.id}:energy-certificate`,
    kind: 'energy-certificate',
    propertyId: property.id,
    party: null,
    origin: { kind: 'declared' },
    issuedOn: certificate.issuedOn,
    printedValidUntil: null,
    classification: null,
    source: null,
    pinned: false,
  };
}

/** Τα αρχεία που ονομάζει ως πηγή μια δήλωση ΠΕΑ που **θα γίνει** γραμμή (κλάση δηλωμένη). */
function declarationSourceIds(declared: readonly RegistryProperty[]): ReadonlySet<string> {
  const ids = declared
    .filter((property) => property.certificate.class !== null)
    .map((property) => property.certificate.sourceFileId);
  return new Set(ids.filter((id): id is string => id !== null));
}

/**
 * Οι γραμμές-έγγραφα του μητρώου, από τα αρχεία (με ή χωρίς στοιχεία) και τις δηλώσεις. ADR-915 §33 Δ5: αρχείο χωρίς
 * στοιχεία που ονομάζει δήλωση ΠΕΑ **υποχωρεί** — η δήλωση κρατά ήδη την ημερομηνία που ξέρουμε.
 */
export function registryDocumentsOf(
  all: readonly RegistryFile[],
  declared: readonly RegistryProperty[],
  properties: ReadonlyMap<string, RegistryProperty>,
): readonly RegistryDocument[] {
  const sourceIds = declarationSourceIds(declared);
  const files = all.filter((file) => file.facts !== null || !sourceIds.has(file.fileId));
  const fileIds = new Set(files.filter((file) => file.facts !== null).map((file) => file.fileId));
  const fromFiles = files.map((file) => fileDocumentOf(file, properties));
  const fromDeclarations = declared
    .map((property) => declaredDocumentOf(property, fileIds))
    .filter((document): document is RegistryDocument => document !== null);
  return [...fromFiles, ...fromDeclarations];
}
