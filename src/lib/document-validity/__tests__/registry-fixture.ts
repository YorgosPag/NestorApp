/**
 * ADR-915 Φ4γ — συνθετικό μητρώο για τις άγκυρες της σελίδας. **Κανένα δεδομένο πελάτη.**
 *
 * 🔑 Οι γραμμές παράγονται από τον **αληθινό** πυρήνα (`documentRegistry`), όχι χειροποίητες: έτσι η σελίδα και οι
 *    προβολές ελέγχονται απέναντι στον ΙΔΙΟ ταξινομητή με την παραγωγή — ένα fixture με «σωστές» καταστάσεις γραμμένες
 *    με το χέρι θα έμενε πράσινο ακόμη κι αν ο πυρήνας άλλαζε κρίση.
 */

import { documentRegistry, type RegistryDocument } from '@/lib/document-validity/document-registry';
import type { DocumentRequirement } from '@/lib/document-validity/document-requirement';
import type { IssuanceRosterEntry } from '@/lib/document-validity/issuance-assignment';
import { issuanceOfRows } from '@/lib/document-validity/issuance-rows';
import type { ObligorLead } from '@/lib/document-validity/obligor-lead';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';

export const FIXTURE_AS_OF = '2026-10-15';
const READ = { kind: 'document-text', reader: 'pea-text' } as const;

function doc(id: string, propertyId: string | null, issuedOn: string | null, extra: Partial<RegistryDocument> = {}): RegistryDocument {
  return {
    id, kind: 'energy-certificate', propertyId, party: null, origin: { kind: 'file', fileId: id },
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
    documentKind: 'energy-certificate', subject: { propertyId: 'p2', party: null }, process: { kind: 'conveyance', caseId: 'case-1' },
    neededOn: { kind: 'on', day: '2027-03-01' }, policy: 'block', warnWindowDays: 15,
    basis: { kind: 'checklist-item', itemId: 'energy_certificate', verifiedAt: null }, presence: 'required', attestation: null,
  },
  // `block` που ΔΕΝ μπλοκάρει: υπογραφή πριν από τη λήξη (2034-03-01) ⇒ «Υποχρεωτικό», ποτέ «Μπλοκάρει τώρα».
  {
    documentKind: 'energy-certificate', subject: { propertyId: 'p4', party: null }, process: { kind: 'conveyance', caseId: 'case-2' },
    neededOn: { kind: 'on', day: '2033-01-01' }, policy: 'block', warnWindowDays: 15,
    basis: { kind: 'checklist-item', itemId: 'energy_certificate', verifiedAt: null }, presence: 'required', attestation: null,
  },
  {
    documentKind: 'energy-certificate', subject: { propertyId: 'p4', party: null }, process: { kind: 'listing-publication', listingId: 'p4' },
    neededOn: { kind: 'continuous' }, policy: 'warn', warnWindowDays: 60, basis: { kind: 'statute', statute: 'ν.4122/2013' },
    presence: 'required', attestation: null,
  },
  // Φ4δ — ΚΕΝΟ που μπλοκάρει: υπόθεση χωρίς κανένα ΠΕΑ.
  {
    documentKind: 'energy-certificate', subject: { propertyId: 'p6', party: null }, process: { kind: 'conveyance', caseId: 'case-3' },
    neededOn: { kind: 'unscheduled' }, policy: 'block', warnWindowDays: 15,
    basis: { kind: 'checklist-item', itemId: 'energy_certificate', verifiedAt: null }, presence: 'required', attestation: null,
  },
  // Φ4δ — ΚΕΝΟ σε αγγελία ιδιώτη υπό εντολή (Ε10): `warn` ⇒ ΔΕΝ μπλοκάρει (Α1).
  {
    documentKind: 'energy-certificate', subject: { propertyId: 'ownp_7', party: null }, process: { kind: 'listing-publication', listingId: 'ownp_7' },
    neededOn: { kind: 'continuous' }, policy: 'warn', warnWindowDays: 60, basis: { kind: 'statute', statute: 'ν.4122/2013' },
    presence: 'required', attestation: null,
  },
];

/** Συνθετικός δήμος (μορφή ADR-883) για το «Βρες επαγγελματία» της γραμμής p1. */
export const FIXTURE_AREA_ID = 'municipality:0501';

/** ADR-915 §26 — ένας ιδιοκτήτης ⇒ αυτός ο υπεύθυνος. */
export function sole(contactId: string): ObligorLead {
  return { kind: 'designated', contactId, basis: 'sole', sharePct: null, staleContactId: null };
}

const NO_LEAD = { obligorLead: null, ownerShares: {} } as const;

const NAMES: Pick<DocumentRegistryResponse, 'properties' | 'files' | 'people'> = {
  properties: {
    // ADR-915 §24 — μόνο το p1 έχει αποδεδειγμένο δήμο: το κενό p6 δείχνει τον κατάλογο ΧΩΡΙΣ περιοχή.
    p1: { name: 'Συνθετικό Α1', scope: 'property', areaId: FIXTURE_AREA_ID, ownerContactIds: ['cont_alpha'], obligorLead: sole('cont_alpha'), ownerShares: {} },
    // ADR-915 §25 — p2: ρωτήθηκε, κανείς · p3/p4/p5: δεν ρωτήθηκε (μόνο ο ρόλος).
    p2: { name: 'Συνθετικό Β2', scope: 'property', areaId: null, ownerContactIds: [], ...NO_LEAD },
    p3: { name: null, scope: 'property', areaId: null, ownerContactIds: null, ...NO_LEAD },
    p4: { name: 'Συνθετικό Δ4', scope: 'property', areaId: null, ownerContactIds: null, ...NO_LEAD },
    p5: { name: 'Συνθετικό Ε5', scope: 'property', areaId: null, ownerContactIds: null, ...NO_LEAD },
    // p6: πέντε ιδιοκτήτες — μη διαθέσιμη επαφή · χωρίς όνομα · με όνομα, και «+2 ακόμη».
    p6: {
      name: 'Συνθετικό Ζ6', scope: 'property', areaId: null,
      ownerContactIds: ['cont_gone', 'cont_unnamed', 'cont_alpha', 'cont_gamma', 'cont_delta'],
      // ADR-915 §26 — κανένα μερίδιο, κανένας κύριος πωλητής ⇒ κανείς υπεύθυνος (ποτέ «ο πρώτος της λίστας»).
      obligorLead: { kind: 'undesignated', reason: 'unknown-shares', staleContactId: null }, ownerShares: {},
    },
    ownp_7: { name: 'Συνθετική εντολή Η7', scope: 'owner-property', areaId: null, ownerContactIds: ['cont_client'], obligorLead: sole('cont_client'), ownerShares: {} },
  },
  files: {
    'f-expired': { name: 'synthetic-expired.pdf' }, 'f-expiring': { name: 'synthetic-expiring.pdf' }, 'f-soon': { name: 'synthetic-soon.pdf' },
    'f-unknown': { name: null }, 'f-valid': { name: 'synthetic-new.pdf' }, 'f-old': { name: 'synthetic-old.pdf' },
  },
  // ADR-915 §25 — το `cont_gone` λείπει επίτηδες: ξένη ή διαγραμμένη επαφή.
  people: {
    cont_alpha: { name: 'Συνθετικός Άλφα' }, cont_unnamed: { name: null }, cont_gamma: { name: 'Συνθετικός Γάμμα' },
    cont_delta: { name: 'Συνθετικός Δέλτα' }, cont_client: { name: 'Συνθετική Πελάτισσα' },
  },
};

/** Η απόκριση του `GET`, όπως θα την έστελνε ο διακομιστής. */
export function fixtureResponse(
  overrides: Partial<DocumentRegistryResponse> = {},
  documents: readonly RegistryDocument[] = FIXTURE_DOCUMENTS,
  requirements: readonly DocumentRequirement[] = FIXTURE_REQUIREMENTS,
  roster: readonly IssuanceRosterEntry[] = [],
): DocumentRegistryResponse {
  const core = documentRegistry({ documents, requirements, asOf: FIXTURE_AS_OF });
  return {
    ...core, asOf: FIXTURE_AS_OF, freshUntil: '2026-10-15T21:00:00.000Z',
    truncated: false, truncatedSources: [], unscopedListings: 0, ...NAMES,
    // §27 — οι αναθέσεις από τον ΑΛΗΘΙΝΟ συναρμολογητή (κενός κατάλογος ⇒ «καμία ανάθεση» σε κάθε γραμμή «Ανάθεσης»).
    issuance: issuanceOfRows(core.rows, roster).issuance, issuanceKnown: true,
    ...overrides,
  };
}
