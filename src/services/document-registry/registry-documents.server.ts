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
 * ⚠️ Αρχείο επιπέδου **έργου** (`entityType: project`) ⇒ `propertyId: null` ⇒ κενό «τι σταματά» — δηλωμένο όριο (Δ3).
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { ENTITY_TYPES } from '@/config/domain-constants';
import { DOCUMENT_KINDS } from '@/config/document-validity/document-validity';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { DOCUMENT_FACTS_FIELD, readDocumentFacts, type DocumentFacts } from '@/lib/document-validity/document-facts';
import type { RegistryDocument } from '@/lib/document-validity/document-registry';
import { isLiveFileRecord } from '@/lib/files/container-file-verdict';
import { trimmedStringOrNull } from '@/lib/type-guards';
import type { RegistryProperty } from './registry-properties.server';

/** Ένα αρχείο με γεγονότα, όπως βγήκε από το ερώτημα — ακόμη χωρίς κρίση ακινήτου. */
export interface RegistryFile {
  readonly fileId: string;
  readonly facts: DocumentFacts;
  /** `entityId` όταν το αρχείο ζει σε ακίνητο — αλλιώς `null`. */
  readonly propertyId: string | null;
  readonly name: string | null;
}

interface RegistryFiles {
  readonly files: readonly RegistryFile[];
  readonly truncated: boolean;
}

function registryFileOf(fileId: string, data: Readonly<Record<string, unknown>>): RegistryFile | null {
  if (!isLiveFileRecord(data)) return null;
  const facts = readDocumentFacts(data[DOCUMENT_FACTS_FIELD]);
  if (facts === null) return null;
  const propertyId = data.entityType === ENTITY_TYPES.PROPERTY ? trimmedStringOrNull(data.entityId) : null;
  return { fileId, facts, propertyId, name: trimmedStringOrNull(data.displayName) };
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

/** (α) — το ακίνητο μετρά **μόνο** αν ανήκει στην εταιρεία· `pinned` = το μπλοκ ΠΕΑ του ονομάζει αυτό το αρχείο. */
function fileDocumentOf(file: RegistryFile, properties: ReadonlyMap<string, RegistryProperty>): RegistryDocument {
  const property = file.propertyId === null ? undefined : properties.get(file.propertyId);
  const pinned = file.facts.kind === 'energy-certificate' && property?.certificate.sourceFileId === file.fileId;
  return {
    id: `file:${file.fileId}`,
    kind: file.facts.kind,
    propertyId: property?.id ?? null,
    origin: { kind: 'file', fileId: file.fileId },
    issuedOn: file.facts.issuedOn,
    printedValidUntil: file.facts.printedValidUntil,
    source: file.facts.source,
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
    origin: { kind: 'declared' },
    issuedOn: certificate.issuedOn,
    printedValidUntil: null,
    source: null,
    pinned: false,
  };
}

/** Οι γραμμές-έγγραφα του μητρώου, από τα αρχεία και τις δηλώσεις. */
export function registryDocumentsOf(
  files: readonly RegistryFile[],
  declared: readonly RegistryProperty[],
  properties: ReadonlyMap<string, RegistryProperty>,
): readonly RegistryDocument[] {
  const fileIds = new Set(files.map((file) => file.fileId));
  const fromFiles = files.map((file) => fileDocumentOf(file, properties));
  const fromDeclarations = declared
    .map((property) => declaredDocumentOf(property, fileIds))
    .filter((document): document is RegistryDocument => document !== null);
  return [...fromFiles, ...fromDeclarations];
}
