/**
 * Ισοπαλία συμβάσεων κατά την αποθήκευση — ο ΙΔΙΟΣ επιλογέας με την τιμολόγηση PO (ADR-923 §5.11 «3γ», Βήμα 2).
 * Κάθε σενάριο ρωτά: «θα έβγαζε ο `selectLineAgreement` `ambiguous` για κάποια γραμμή, κάποια στιγμή;»
 */

import { findAgreementTies } from '../framework-agreement-ambiguity';
import { makeAgreement } from '../../__fixtures__/framework-agreement-fixture';

function tiedWith(draft: ReturnType<typeof makeAgreement>, others: ReturnType<typeof makeAgreement>[]): string[] {
  return findAgreementTies(draft, others).map((tie) => tie.agreementId);
}

describe('findAgreementTies — εύρος γραμμής', () => {
  it('ίδιο υλικό ⇒ ισοπαλία, με το σημείο της', () => {
    const draft = makeAgreement('d', { applicableMaterialIds: ['m_1'] });
    const other = makeAgreement('o', { applicableMaterialIds: ['m_1', 'm_2'] });
    const ties = findAgreementTies(draft, [other]);
    expect(ties.map((t) => t.agreementId)).toEqual(['o']);
    expect(ties[0].points).toEqual([{ materialId: 'm_1', categoryCode: null, projectId: null, fromMs: Date.parse('2026-01-01T00:00:00.000Z') }]);
  });

  it('υλικό έναντι κατηγορίας ⇒ ο ειδικότερος νικά, καμία ισοπαλία', () => {
    const draft = makeAgreement('d', { applicableMaterialIds: ['m_1'] });
    const other = makeAgreement('o', { applicableAtoeCategoryCodes: ['OIK-9'] });
    expect(tiedWith(draft, [other])).toEqual([]);
  });

  it('κατηγορία έναντι (υλικά + ίδια κατηγορία) ⇒ ισοπαλία στις υπόλοιπες γραμμές της κατηγορίας', () => {
    const draft = makeAgreement('d', { applicableAtoeCategoryCodes: ['OIK-9'] });
    const other = makeAgreement('o', { applicableMaterialIds: ['m_1'], applicableAtoeCategoryCodes: ['OIK-9'] });
    const ties = findAgreementTies(draft, [other]);
    expect(ties[0].points.map((p) => [p.materialId, p.categoryCode])).toEqual([[null, 'OIK-9']]);
  });

  it('«όλα» έναντι «όλα» ⇒ ισοπαλία· «όλα» έναντι λίστας ⇒ όχι', () => {
    const draft = makeAgreement('d');
    expect(tiedWith(draft, [makeAgreement('o')])).toEqual(['o']);
    expect(tiedWith(draft, [makeAgreement('o', { applicableMaterialIds: ['m_1'] })])).toEqual([]);
  });
});

describe('findAgreementTies — εύρος έργων', () => {
  it('λίστα έργων έναντι «όλα τα έργα» ⇒ η λίστα νικά, καμία ισοπαλία', () => {
    const draft = makeAgreement('d', { applicableProjectIds: ['p_1'] });
    expect(tiedWith(draft, [makeAgreement('o')])).toEqual([]);
    expect(tiedWith(makeAgreement('d'), [makeAgreement('o', { applicableProjectIds: ['p_1'] })])).toEqual([]);
  });

  it('λίστα έναντι λίστας ⇒ ισοπαλία μόνο στην τομή', () => {
    const draft = makeAgreement('d', { applicableProjectIds: ['p_1', 'p_2'] });
    const other = makeAgreement('o', { applicableProjectIds: ['p_2', 'p_3'] });
    expect(findAgreementTies(draft, [other])[0].points.map((p) => p.projectId)).toEqual(['p_2']);
  });
});

describe('findAgreementTies — χρόνος', () => {
  it('ισχύ χωρίς επικάλυψη ⇒ καμία ισοπαλία', () => {
    const draft = makeAgreement('d', { validFrom: '2027-01-01T00:00:00.000Z', validUntil: '2027-12-31T00:00:00.000Z' });
    expect(tiedWith(draft, [makeAgreement('o')])).toEqual([]);
  });

  it('το «έως» της άλλης είναι συμπεριληπτικό ⇒ αρχή της νέας την ίδια στιγμή = ισοπαλία', () => {
    const draft = makeAgreement('d', { validFrom: '2026-12-31T00:00:00.000Z', validUntil: '2027-12-31T00:00:00.000Z' });
    expect(tiedWith(draft, [makeAgreement('o')])).toEqual(['o']);
  });

  it('η άλλη ξεκινά μέσα στην ισχύ ⇒ η ισοπαλία αναφέρεται από την ΑΡΧΗ της άλλης', () => {
    const other = makeAgreement('o', { validFrom: '2026-03-01T00:00:00.000Z' });
    const ties = findAgreementTies(makeAgreement('d'), [other]);
    expect(ties[0].points.map((p) => p.fromMs)).toEqual([Date.parse('2026-03-01T00:00:00.000Z')]);
  });

  it('η άλλη λήγει πριν αρχίσει η ελεγχόμενη ⇒ καμία ισοπαλία (και όχι από την αρχή της άλλης)', () => {
    const draft = makeAgreement('d', { validFrom: '2026-07-01T00:00:00.000Z' });
    const other = makeAgreement('o', { validUntil: '2026-06-30T00:00:00.000Z' });
    expect(tiedWith(draft, [other])).toEqual([]);
  });

  it('σημεία ελέγχου εκτός κάθε ξένης λίστας ⇒ καμία τρίτη σύμβαση δεν «κρύβει» ισοπαλία', () => {
    // Η `x` είναι ειδικότερη ΜΟΝΟ για το m_1· οι υπόλοιπες γραμμές της κατηγορίας μένουν σε ισοπαλία d ↔ o.
    const draft = makeAgreement('d', { applicableAtoeCategoryCodes: ['OIK-9'] });
    const other = makeAgreement('o', { applicableAtoeCategoryCodes: ['OIK-9'] });
    const narrower = makeAgreement('x', { applicableMaterialIds: ['m_1'] });
    expect(tiedWith(draft, [other, narrower])).toEqual(['o']);
  });

  it('τρεις εξίσου ειδικές ⇒ αναφέρονται και οι δύο άλλες', () => {
    expect(tiedWith(makeAgreement('d'), [makeAgreement('o'), makeAgreement('p')]).sort()).toEqual(['o', 'p']);
  });
});

describe('findAgreementTies — ποιος μετρά', () => {
  it.each([
    ['πρόχειρη', { status: 'draft' as const }],
    ['τερματισμένη', { status: 'terminated' as const }],
    ['διαγραμμένη', { isDeleted: true }],
    ['άλλου προμηθευτή', { vendorContactId: 'sup_2' }],
  ])('άλλη σύμβαση %s ⇒ αγνοείται', (_label, overrides) => {
    expect(tiedWith(makeAgreement('d'), [makeAgreement('o', overrides)])).toEqual([]);
  });

  it('ο εαυτός της εξαιρείται (επεξεργασία: η αποθηκευμένη εκδοχή είναι στη λίστα)', () => {
    const stored = makeAgreement('d');
    expect(tiedWith({ ...stored, title: 'edited' }, [stored])).toEqual([]);
  });

  it('η σύμβαση που ελέγχεται θεωρείται ενεργή ακόμη κι αν είναι πρόχειρη («αν ενεργοποιηθεί»)', () => {
    expect(tiedWith(makeAgreement('d', { status: 'draft' }), [makeAgreement('o')])).toEqual(['o']);
  });
});
