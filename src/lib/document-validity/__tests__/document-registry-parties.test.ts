/**
 * ADR-915 §25 (5γ) — **μία γραμμή ανά πρόσωπο** για τα έγγραφα που εκδίδονται ανά πρόσωπο. Συνθετικά δεδομένα μόνο.
 *
 * Πριν: η ομάδα ήταν (ακίνητο, είδος) ⇒ δύο συμπωλητές = **ένα** κενό φορολογικής με δύο εξαρτώμενους, και δύο εγκρίσεις
 * της ίδιας μέρας = **μία** γραμμή με ταυτότητα `attested:<υπόθεση>:<είδος>` που συγκρούεται.
 */

import {
  documentRegistry,
  registryRowIdOf,
  registryRowPartyOf,
  type RegistryDocument,
  type RegistryRow,
} from '../document-registry';
import { requirementCoveredBy, type DocumentRequirement, type RequirementParty } from '../document-requirement';

const ASOF = '2026-10-15';
const A: RequirementParty = { key: 'cont_a', contactId: 'cont_a' };
const B: RequirementParty = { key: 'cont_b', contactId: 'cont_b' };

function tax(party: RequirementParty | null, attestation: DocumentRequirement['attestation'] = null): DocumentRequirement {
  return {
    documentKind: 'tax-clearance', subject: { propertyId: 'p1', party }, process: { kind: 'conveyance', caseId: 'c1' },
    neededOn: { kind: 'unscheduled' }, policy: 'block', warnWindowDays: 15,
    basis: { kind: 'checklist-item', itemId: party === null ? 'seller_tax_clearance' : `seller_tax_clearance@${party.key}`, verifiedAt: null },
    presence: 'required', attestation,
  };
}

function propertyFile(id: string): RegistryDocument {
  return {
    id, kind: 'tax-clearance', propertyId: 'p1', party: null, origin: { kind: 'file', fileId: id },
    issuedOn: '2026-10-01', printedValidUntil: '2026-11-30', source: null, pinned: false,
  };
}

const accepted = (fileId: string | null) => ({ fileId, issuedOn: '2026-10-01', printedValidUntil: '2026-11-30' });
const rowsOf = (documents: RegistryDocument[], requirements: DocumentRequirement[]) =>
  documentRegistry({ documents, requirements, asOf: ASOF }).rows;
const byId = (rows: readonly RegistryRow[], id: string) => rows.find((row) => registryRowIdOf(row) === id);
const heldBy = (row: RegistryRow | undefined) => row?.dependents.map((d) => d.requirement.subject.party?.key ?? null);

describe('κενά — ένα ανά πρόσωπο, με το πρόσωπό του', () => {
  it('δύο συμπωλητές χωρίς φορολογική ⇒ ΔΥΟ κενά, το καθένα με έναν εξαρτώμενο', () => {
    const rows = rowsOf([], [tax(A), tax(B)]);
    expect(rows.map(registryRowIdOf).sort()).toEqual(['missing:p1:tax-clearance@cont_a', 'missing:p1:tax-clearance@cont_b']);
    expect(rows.map(registryRowPartyOf).map((party) => party?.key).sort()).toEqual(['cont_a', 'cont_b']);
    expect(rows.every((row) => row.dependents.length === 1)).toBe(true);
  });

  it('έγγραφο ακινήτου (χωρίς πρόσωπο) ⇒ η ταυτότητα του κενού ΔΕΝ αλλάζει (ημερολόγιο ειδοποιήσεων)', () => {
    const [row] = rowsOf([], [tax(null)]);
    expect(registryRowIdOf(row)).toBe('missing:p1:tax-clearance');
    expect(registryRowPartyOf(row)).toBeNull();
  });
});

describe('εγκρίσεις — δύο πρόσωπα, ίδια μέρα έκδοσης', () => {
  it('ΔΥΟ γραμμές με ΔΙΑΦΟΡΕΤΙΚΗ ταυτότητα, η καθεμία κρατά ΜΟΝΟ τη δική της απαίτηση', () => {
    const rows = rowsOf([], [tax(A, accepted(null)), tax(B, accepted(null))]);
    const a = byId(rows, 'attested:c1:tax-clearance@cont_a');
    const b = byId(rows, 'attested:c1:tax-clearance@cont_b');
    expect(heldBy(a)).toEqual(['cont_a']);
    expect(heldBy(b)).toEqual(['cont_b']);
    expect(rows.some((row) => row.kind === 'gap')).toBe(false);
  });

  it('ο ένας εγκρίθηκε, ο άλλος όχι ⇒ γραμμή για τον πρώτο ΚΑΙ κενό για τον δεύτερο (ποτέ «καλύφθηκαν»)', () => {
    const rows = rowsOf([], [tax(A, accepted(null)), tax(B)]);
    expect(heldBy(byId(rows, 'attested:c1:tax-clearance@cont_a'))).toEqual(['cont_a']);
    expect(byId(rows, 'missing:p1:tax-clearance@cont_b')).toBeDefined();
  });
});

describe('αρχείο ΧΩΡΙΣ πρόσωπο — ποτέ μαντεψιά ανάμεσα σε συμπωλητές', () => {
  it('ένας πωλητής ⇒ το αρχείο του ακινήτου τον κρατά (όπως πριν)', () => {
    const rows = rowsOf([propertyFile('f1')], [tax(A)]);
    expect(heldBy(byId(rows, 'f1'))).toEqual(['cont_a']);
    expect(rows.some((row) => row.kind === 'gap')).toBe(false);
  });

  it('δύο πωλητές ⇒ ΚΑΝΕΝΑΝ: το αρχείο μένει χωρίς εξαρτώμενους και λείπει και στους δύο', () => {
    const rows = rowsOf([propertyFile('f1')], [tax(A), tax(B)]);
    expect(heldBy(byId(rows, 'f1'))).toEqual([]);
    expect(rows.filter((row) => row.kind === 'gap')).toHaveLength(2);
  });

  it('ρητή έγκριση ΑΥΤΟΥ του αρχείου για τον Α ⇒ κρατά τον Α (ο ρητός δεσμός νικά την αμφισημία)', () => {
    const rows = rowsOf([propertyFile('f1')], [tax(A, accepted('f1')), tax(B)]);
    expect(heldBy(byId(rows, 'f1'))).toEqual(['cont_a']);
    expect(byId(rows, 'missing:p1:tax-clearance@cont_b')).toBeDefined();
  });
});

describe('requirementCoveredBy — το πρόσωπο', () => {
  const tracked = (party: RequirementParty | null) => ({ kind: 'tax-clearance' as const, subject: { propertyId: 'p1', party }, fileId: null, expiresOn: null });

  it('έγγραφο του Α ΔΕΝ καλύπτει απαίτηση του Β, ούτε απαίτηση του ακινήτου', () => {
    expect(requirementCoveredBy(tracked(A), tax(A))).toBe(true);
    expect(requirementCoveredBy(tracked(A), tax(B))).toBe(false);
    expect(requirementCoveredBy(tracked(A), tax(null))).toBe(false);
  });

  it('έγγραφο χωρίς πρόσωπο καλύπτει (η αμφισημία κρίνεται στον κάτοχο)', () => {
    expect(requirementCoveredBy(tracked(null), tax(B))).toBe(true);
  });
});
