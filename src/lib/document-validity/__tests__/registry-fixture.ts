/**
 * ADR-915 Φ4γ — συνθετικό μητρώο για τις άγκυρες της σελίδας. **Κανένα δεδομένο πελάτη.**
 *
 * 🔑 Οι γραμμές παράγονται από τον **αληθινό** πυρήνα (`documentRegistry`), όχι χειροποίητες: έτσι η σελίδα και οι
 *    προβολές ελέγχονται απέναντι στον ΙΔΙΟ ταξινομητή με την παραγωγή — ένα fixture με «σωστές» καταστάσεις γραμμένες
 *    με το χέρι θα έμενε πράσινο ακόμη κι αν ο πυρήνας άλλαζε κρίση.
 */

import { documentRegistry, type RegistryDocument } from '@/lib/document-validity/document-registry';
import type { DocumentRequirement } from '@/lib/document-validity/document-requirement';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';

export const FIXTURE_AS_OF = '2026-10-15';
const READ = { kind: 'document-text', reader: 'pea-text' } as const;

function doc(id: string, propertyId: string | null, issuedOn: string | null, extra: Partial<RegistryDocument> = {}): RegistryDocument {
  return {
    id, kind: 'energy-certificate', propertyId, origin: { kind: 'file', fileId: id },
    issuedOn, printedValidUntil: null, source: READ, pinned: false, ...extra,
  };
}

/**
 * Μία γραμμή ανά κατάσταση:
 *  - `f-expired` (p1) έληξε · `f-expiring` (p2) μέσα στις 60 ημέρες + υπογραφή μετά τη λήξη ⇒ **μπλοκάρει**
 *  - `f-soon` (p5) λήγει σε 17 ημέρες — η μόνη μέσα στο κυλιόμενο παράθυρο των 30
 *  - `f-unknown` (p3) χωρίς έκδοση · `f-valid` (p4) με ασυμφωνία Α4 + αγγελία `warn` + μεταβίβαση `block` που ΔΕΝ μπλοκάρει
 *  - `f-old` (p4) **αντικατεστημένο** από το `f-valid` — θα ταίριαζε μόνο του σε τρία φίλτρα (έληξε)
 *  - Φ4δ: δύο **κενά** από τις απαιτήσεις — `p6` (μεταβίβαση `block` ⇒ μπλοκάρει) · `ownp_7` (αγγελία εντολής, `warn`)
 */
export const FIXTURE_DOCUMENTS: readonly RegistryDocument[] = [
  doc('f-expired', 'p1', '2016-01-10'),
  doc('f-expiring', 'p2', '2016-12-01'),
  doc('f-soon', 'p5', '2016-11-01'),
  doc('f-unknown', 'p3', null),
  doc('f-valid', 'p4', '2025-03-01', { printedValidUntil: '2034-03-01' }),
  doc('f-old', 'p4', '2012-01-01'),
];

export const FIXTURE_REQUIREMENTS: readonly DocumentRequirement[] = [
  {
    documentKind: 'energy-certificate', subject: { propertyId: 'p2' }, process: { kind: 'conveyance', caseId: 'case-1' },
    neededOn: { kind: 'on', day: '2027-03-01' }, policy: 'block', warnWindowDays: 15,
    basis: { kind: 'checklist-item', itemId: 'energy_certificate', verifiedAt: null }, presence: 'required', attestation: null,
  },
  // `block` που ΔΕΝ μπλοκάρει: υπογραφή πριν από τη λήξη (2034-03-01) ⇒ «Υποχρεωτικό», ποτέ «Μπλοκάρει τώρα».
  {
    documentKind: 'energy-certificate', subject: { propertyId: 'p4' }, process: { kind: 'conveyance', caseId: 'case-2' },
    neededOn: { kind: 'on', day: '2033-01-01' }, policy: 'block', warnWindowDays: 15,
    basis: { kind: 'checklist-item', itemId: 'energy_certificate', verifiedAt: null }, presence: 'required', attestation: null,
  },
  {
    documentKind: 'energy-certificate', subject: { propertyId: 'p4' }, process: { kind: 'listing-publication', listingId: 'p4' },
    neededOn: { kind: 'continuous' }, policy: 'warn', warnWindowDays: 60, basis: { kind: 'statute', statute: 'ν.4122/2013' },
    presence: 'required', attestation: null,
  },
  // Φ4δ — ΚΕΝΟ που μπλοκάρει: υπόθεση χωρίς κανένα ΠΕΑ.
  {
    documentKind: 'energy-certificate', subject: { propertyId: 'p6' }, process: { kind: 'conveyance', caseId: 'case-3' },
    neededOn: { kind: 'unscheduled' }, policy: 'block', warnWindowDays: 15,
    basis: { kind: 'checklist-item', itemId: 'energy_certificate', verifiedAt: null }, presence: 'required', attestation: null,
  },
  // Φ4δ — ΚΕΝΟ σε αγγελία ιδιώτη υπό εντολή (Ε10): `warn` ⇒ ΔΕΝ μπλοκάρει (Α1).
  {
    documentKind: 'energy-certificate', subject: { propertyId: 'ownp_7' }, process: { kind: 'listing-publication', listingId: 'ownp_7' },
    neededOn: { kind: 'continuous' }, policy: 'warn', warnWindowDays: 60, basis: { kind: 'statute', statute: 'ν.4122/2013' },
    presence: 'required', attestation: null,
  },
];

const NAMES: Pick<DocumentRegistryResponse, 'properties' | 'files'> = {
  properties: {
    p1: { name: 'Συνθετικό Α1', scope: 'property' }, p2: { name: 'Συνθετικό Β2', scope: 'property' }, p3: { name: null, scope: 'property' },
    p4: { name: 'Συνθετικό Δ4', scope: 'property' }, p5: { name: 'Συνθετικό Ε5', scope: 'property' }, p6: { name: 'Συνθετικό Ζ6', scope: 'property' },
    ownp_7: { name: 'Συνθετική εντολή Η7', scope: 'owner-property' },
  },
  files: {
    'f-expired': { name: 'synthetic-expired.pdf' }, 'f-expiring': { name: 'synthetic-expiring.pdf' }, 'f-soon': { name: 'synthetic-soon.pdf' },
    'f-unknown': { name: null }, 'f-valid': { name: 'synthetic-new.pdf' }, 'f-old': { name: 'synthetic-old.pdf' },
  },
};

/** Η απόκριση του `GET`, όπως θα την έστελνε ο διακομιστής. */
export function fixtureResponse(
  overrides: Partial<DocumentRegistryResponse> = {},
  documents: readonly RegistryDocument[] = FIXTURE_DOCUMENTS,
  requirements: readonly DocumentRequirement[] = FIXTURE_REQUIREMENTS,
): DocumentRegistryResponse {
  const core = documentRegistry({ documents, requirements, asOf: FIXTURE_AS_OF });
  return {
    ...core, asOf: FIXTURE_AS_OF, freshUntil: '2026-10-15T21:00:00.000Z',
    truncated: false, truncatedSources: [], unscopedListings: 0, ...NAMES, ...overrides,
  };
}
