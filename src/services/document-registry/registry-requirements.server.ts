/**
 * @fileoverview Μητρώο λήξεων — οι ΑΠΑΙΤΗΣΕΙΣ: ποιες διαδικασίες ρωτούν τα έγγραφα (ADR-915 Φ4β).
 * @module services/document-registry/registry-requirements.server
 *
 * **Κανένας νέος κατάλογος**: οι απαιτήσεις βγαίνουν από τους υπάρχοντες παραγωγούς (Φ2).
 *  - **Υποθέσεις μεταβίβασης** — `companyId ==` + `storedState == 'open'` (δύο ισότητες, χωρίς σύνθετο δείκτη), και
 *    μετά το **ίδιο** κριτήριο με τη σάρωση λήξεων: `effectiveCaseState(…, legalPhase) === 'open'` (μετά την υπογραφή
 *    η ισχύς δεν κρίνει πια τίποτα). Γραμμές: `caseDocumentRequirements` — χωρίς τις «δεν εφαρμόζεται».
 *  - **Αγγελίες** — το `public_listings` δεν έχει πεδίο εταιρείας (`published-projection`)· έχει όμως `id === propertyId`
 *    και η απόσυρση **σβήνει** το έγγραφο. Άρα: `getAll` **μόνο** για ακίνητα της εταιρείας — «υπάρχει» = «δημοσιευμένη».
 *    Ανάγνωση μέσω του συνόρου `publicListingFromDocument` (CHECK 3.74).
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { chunkArray } from '@/lib/array-utils';
import { caseDocumentRequirements } from '@/lib/conveyance/case-document-requirements';
import { effectiveCaseState } from '@/lib/conveyance/case-state';
import { parseConveyanceCase } from '@/lib/conveyance/conveyance-case-schema';
import { deriveFacts, resolveFacts } from '@/lib/conveyance/derive-facts';
import type { DocumentRequirement } from '@/lib/document-validity/document-requirement';
import { publicationRequirements } from '@/lib/legality/publication-requirements';
import { publicListingFromDocument } from '@/lib/listings/public-listing-from-document';
import { subjectContextOf } from '@/services/conveyance/conveyance-subject.server';
import type { ConveyanceCase } from '@/types/conveyance-case';
import { REGISTRY_GET_ALL_CHUNK } from './document-registry.types';
import type { RegistryProperty } from './registry-properties.server';

const OPEN: ConveyanceCase['storedState'] = 'open';

interface OpenCases {
  readonly cases: readonly ConveyanceCase[];
  readonly truncated: boolean;
}

/** Οι υποθέσεις της εταιρείας με αποθηκευμένη κατάσταση `open` — αλλοιωμένες έξω (ο ανεκτικός αναγνώστης). */
export async function readOpenCases(db: AdminFirestore, companyId: string, cap: number): Promise<OpenCases> {
  const snapshot = await db
    .collection(COLLECTIONS.CONVEYANCE_CASES)
    .where(FIELDS.COMPANY_ID, '==', companyId)
    .where('storedState', '==', OPEN)
    .limit(cap + 1)
    .get();
  const cases = snapshot.docs
    .slice(0, cap)
    .map((doc) => parseConveyanceCase(doc.data()))
    .filter((record): record is ConveyanceCase => record !== null && record.companyId === companyId);
  return { cases, truncated: snapshot.size > cap };
}

/**
 * Μία υπόθεση → απαιτήσεις, ή τίποτα όταν το ακίνητο λείπει / δεν είναι της εταιρείας / υπογράφηκε. Τα γεγονότα
 * επιλύονται όπως στον κατάλογο· χωρίς το έργο (`landownerCount: null`) ⇒ ό,τι εξαρτάται από αυτό μένει **άγνωστο**,
 * άρα η απαίτηση **μένει** (συντηρητικό).
 */
function caseRequirementsOf(record: ConveyanceCase, properties: ReadonlyMap<string, RegistryProperty>): readonly DocumentRequirement[] {
  const property = properties.get(record.subject.propertyId);
  if (property === undefined) return [];
  const context = subjectContextOf(property.id, property.data, null);
  if (effectiveCaseState(record.storedState, context.legalPhase) !== 'open') return [];
  return caseDocumentRequirements(record, resolveFacts(deriveFacts(context.factSources), record.facts));
}

export function openCaseRequirements(
  cases: readonly ConveyanceCase[],
  properties: ReadonlyMap<string, RegistryProperty>,
): readonly DocumentRequirement[] {
  return cases.flatMap((record) => caseRequirementsOf(record, properties));
}

/** Οι απαιτήσεις των **δημοσιευμένων** αγγελιών για αυτά τα ακίνητα (της εταιρείας — ο καλών το εγγυάται). */
export async function listingRequirements(
  db: AdminFirestore,
  propertyIds: readonly string[],
): Promise<readonly DocumentRequirement[]> {
  const requirements: DocumentRequirement[] = [];
  for (const group of chunkArray([...new Set(propertyIds)], REGISTRY_GET_ALL_CHUNK)) {
    const snapshots = await db.getAll(...group.map((id) => db.collection(COLLECTIONS.PUBLIC_LISTINGS).doc(id)));
    for (const snapshot of snapshots) {
      const listing = snapshot.exists ? publicListingFromDocument(snapshot.data(), snapshot.id) : null;
      if (listing === null) continue;
      requirements.push(...publicationRequirements({ listingId: listing.id, propertyId: snapshot.id, offerKinds: listing.offerKinds }));
    }
  }
  return requirements;
}
