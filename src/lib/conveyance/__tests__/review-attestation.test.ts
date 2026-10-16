/**
 * ⚓ ADR-915 Φ3β βήμα 11 — πότε η έγκριση γίνεται δήλωση γεγονότων στο αρχείο: μόνο αποδοχή, μόνο γραμμή με είδος
 * εγγράφου, μόνο με ημερομηνία, μόνο σε αρχείο του μισθωτή (ποτέ σε ξένη θεματοφυλακή).
 */

import type { EvidenceFile } from '@/types/conveyance-case';
import type { ConveyanceCommand } from '../conveyance-commands';
import { attestationOfReview, reviewIssuedOnOf } from '../review-attestation';

const PEA: EvidenceFile = {
  source: { kind: 'owned' }, fileId: 'file_pea', displayName: 'pea.pdf', entityType: 'property', entityId: 'prop_1',
  purpose: 'certificate', level: 'property', fingerprint: 'file_pea:0:x', createdAt: 't', documentFacts: null,
};

const accept = (overrides: Partial<Extract<ConveyanceCommand, { type: 'review' }>> = {}): ConveyanceCommand => ({
  type: 'review', itemId: 'energy_certificate', verdict: 'accepted', fileId: 'file_pea', issuedOn: '2025-01-01', reason: null, ...overrides,
});

describe('attestationOfReview', () => {
  it('αποδοχή ΠΕΑ με ημερομηνία ⇒ `attested` μέσω `conveyance-review`, χωρίς τυπωμένη λήξη', () => {
    expect(attestationOfReview(accept(), [PEA], 'u1')).toEqual({
      fileId: 'file_pea',
      claim: { kind: 'energy-certificate', issuedOn: '2025-01-01', printedValidUntil: null, source: { kind: 'attested', via: 'conveyance-review' }, recordedBy: 'u1' },
    });
  });

  it('ADR-915 §14 — η τυπωμένη λήξη ταξιδεύει στο αρχείο· και μόνη της (χωρίς έκδοση) είναι δήλωση', () => {
    const TAX: EvidenceFile = { ...PEA, fileId: 'file_tax', entityType: 'contact', entityId: 'cont_s', level: 'seller_contact', purpose: 'tax-clearance' };
    const command = accept({ itemId: 'seller_tax_clearance', fileId: 'file_tax', issuedOn: null, validUntil: '2026-11-20' });
    expect(attestationOfReview(command, [TAX], 'u1')?.claim).toMatchObject({ kind: 'tax-clearance', issuedOn: null, printedValidUntil: '2026-11-20' });
  });

  it.each([
    ['επιστροφή', accept({ verdict: 'rejected', reason: 'x' })],
    ['χωρίς ημερομηνία', accept({ issuedOn: null })],
    ['χωρίς αρχείο', accept({ fileId: null })],
    ['γραμμή χωρίς είδος εγγράφου', accept({ itemId: 'building_permit' })],
    ['άλλη εντολή', { type: 'set_target_signing_date', date: '2026-12-01' } as const],
  ])('⛔ %s ⇒ τίποτα', (_label, command) => {
    expect(attestationOfReview(command, [PEA], 'u1')).toBeNull();
  });

  it('🔒 transmittal (προσωπικό αρχείο επαγγελματία) ⇒ τίποτα — καμία εγγραφή σε ξένη θεματοφυλακή', () => {
    const sent: EvidenceFile = { ...PEA, source: { kind: 'transmittal', contributionId: 'c1', authorRole: 'seller_lawyer', onBehalf: false, own: false } };
    expect(attestationOfReview(accept(), [sent], 'u1')).toBeNull();
  });
});

describe('reviewIssuedOnOf — η προσυμπλήρωση του διαλόγου ελέγχου', () => {
  const ENERGY = { documentKind: 'energy-certificate' } as const;
  const withFacts = (documentFacts: EvidenceFile['documentFacts']): EvidenceFile => ({ ...PEA, documentFacts });
  const READ = { kind: 'energy-certificate', issuedOn: '2025-01-01', printedValidUntil: null, source: { kind: 'document-text', reader: 'pea-text' } } as const;

  it('ανάγνωση του εγγράφου ⇒ κλειδωμένη τιμή (`document-text`)', () => {
    expect(reviewIssuedOnOf(ENERGY, withFacts(READ))).toEqual({ issuedOn: '2025-01-01', printedValidUntil: null, origin: 'document-text', discrepancy: null });
  });

  it('δήλωση προηγούμενου ελέγχου ⇒ `attested` (επεξεργάσιμη)', () => {
    expect(reviewIssuedOnOf(ENERGY, withFacts({ ...READ, source: { kind: 'attested', via: 'conveyance-review' } })).origin).toBe('attested');
  });

  it('Α4 — τυπωμένη λήξη ≠ κανόνας ⇒ η ασυμφωνία φτάνει στον ελεγκτή', () => {
    expect(reviewIssuedOnOf(ENERGY, withFacts({ ...READ, printedValidUntil: '2030-01-01' })).discrepancy).toEqual({ rule: '2035-01-01', printed: '2030-01-01' });
  });

  it.each([
    ['χωρίς αρχείο', undefined],
    ['αρχείο χωρίς γεγονότα', withFacts(null)],
    ['γεγονότα άλλου είδους', withFacts({ ...READ, kind: 'building-identity' })],
  ])('%s ⇒ τίποτα γνωστό (κενό πεδίο, όπως πριν)', (_label, file) => {
    expect(reviewIssuedOnOf(ENERGY, file)).toEqual({ issuedOn: null, printedValidUntil: null, origin: null, discrepancy: null });
  });
});
