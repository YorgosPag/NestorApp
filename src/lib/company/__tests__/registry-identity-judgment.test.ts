/**
 * @fileoverview Άγκυρες της **κρίσης «επαληθευμένη;»** — ADR-841 §7 Α23 (Φ2).
 *
 * 🔴 Η άγκυρα που μετρά περισσότερο είναι η **Ο1**: αλλαγή αριθμού στο προφίλ **μετά** την
 * επαλήθευση ρίχνει το σήμα στην επόμενη ανάγνωση — χωρίς κανέναν γραφέα να το σβήσει.
 */

import { registryCheck } from '@/lib/company/__fixtures__/registry-record-fixture';
import { judgeRegistryIdentity } from '@/lib/company/registry-identity-judgment';
import type { RegistryCheck, RegistryCheckRead, RegistryCompanyRecord } from '@/types/company-registry';

// 🔑 Η κρίση ρωτά μόνο αριθμό · κατάσταση · επωνυμία — αυτά γράφονται ΡΗΤΑ· τα υπόλοιπα από το fixture.
const CHECK: RegistryCheck = registryCheck({
  registrationNumber: '123401000',
  legalName: 'ΠΑΓΩΝΗΣ ΕΝΕΡΓΕΙΑΚΗ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ',
});
const PRESENT: RegistryCheckRead = { kind: 'present', check: CHECK };

const DECLARED = { registrationNumber: '000123401000', legalName: 'ΠΑΓΩΝΗΣ Ενεργειακή Κατασκευαστική Α.Ε.' };

function withRecord(patch: Partial<RegistryCompanyRecord>): RegistryCheckRead {
  return { kind: 'present', check: { ...CHECK, record: { ...CHECK.record, ...patch } } };
}

describe('Ε — επαληθευμένη μόνο όταν ΟΛΑ συμφωνούν', () => {
  it('Ε1 — ίδιος αριθμός (με μηδενικά), ενεργή, ίδια επωνυμία ⇒ verified, με την απόδειξη', () => {
    expect(judgeRegistryIdentity(DECLARED, PRESENT)).toEqual({ state: 'verified', issuer: 'gemi', check: CHECK });
  });
});

describe('Κ — κάθε κενό έχει όνομα', () => {
  it.each([
    ['Κ1 χωρίς αριθμό (ελεύθερος επαγγελματίας)', { ...DECLARED, registrationNumber: null }, PRESENT, 'no-registration-number'],
    ['Κ2 αριθμός που δεν είναι ΓΕΜΗ', { ...DECLARED, registrationNumber: 'ΑΒΓ' }, PRESENT, 'invalid-registration-number'],
    ['Κ3 δεν ρωτήθηκε ποτέ', DECLARED, { kind: 'absent' } as const, 'not-checked'],
    ['Κ4 🔑 η απάντηση δεν διαβάζεται ⇒ ΟΧΙ «δεν ρωτήθηκε»', DECLARED, { kind: 'unavailable' } as const, 'check-unreadable'],
    ['Κ5 διαγραμμένη', DECLARED, withRecord({ status: { code: null, activity: 'inactive' } }), 'inactive'],
    ['Κ6 κατάσταση άγνωστη', DECLARED, withRecord({ status: { code: null, activity: 'unknown' } }), 'status-unknown'],
    ['Κ7 άλλη επωνυμία', { ...DECLARED, legalName: 'ΑΛΦΑ ΑΕ' }, PRESENT, 'name-mismatch'],
    ['Κ8 χωρίς επωνυμία', { ...DECLARED, legalName: null }, PRESENT, 'name-mismatch'],
  ])('%s', (_label, identity, stored, gap) => {
    const judgment = judgeRegistryIdentity(identity, stored);
    expect(judgment.state).toBe('declared');
    expect(judgment.state === 'declared' && judgment.gap).toBe(gap);
  });
});

describe('Ο — drift χωρίς γραφέα', () => {
  it('Ο1 — 🔴 ο αριθμός άλλαξε στο προφίλ μετά την επαλήθευση ⇒ number-mismatch, και η παλιά απάντηση μένει ορατή', () => {
    const judgment = judgeRegistryIdentity({ ...DECLARED, registrationNumber: '999999999000' }, PRESENT);
    expect(judgment).toEqual({ state: 'declared', gap: 'number-mismatch', check: CHECK });
  });
});
