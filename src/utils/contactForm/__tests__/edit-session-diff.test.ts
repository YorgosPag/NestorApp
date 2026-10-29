/**
 * Άγκυρα: η συνεδρία επεξεργασίας επαφής κρατά **μόνο ό,τι διαφέρει από τη βάση** (ADR-323 · ADR-327 §8.5.4).
 *
 * Περιστατικό 2026-10-29 (μετρημένο στο `/test-harness/contact-mutation?scenario=server-company`):
 * αλλαγή του τύπου ενός τηλεφώνου έστελνε ~120 κλειδιά στον γραφέα, επειδή οι ενότητες γράφουν
 * `setFormData({ ...formData, phones })` πάνω στη συγχωνευμένη προβολή. Το Ιστορικό της MACON ATEE
 * χρέωσε στον άνθρωπο `activityType` / διευθύνσεις / οικισμό που δεν άγγιξε.
 */

import {
  diffAgainstBaseline,
  isSameFormValue,
  nextEditSessionDiff,
} from '@/utils/contactForm/edit-session-diff';
import {
  isClearedFormValue,
  sanitizeContactForUpdate,
  type ContactDataRecord,
} from '@/utils/contactForm/utils/data-cleaning';

interface FormShape {
  companyName: string;
  vatNumber: string;
  activityType: string;
  settlement: string;
  taxOffice?: string;
  phones: Array<{ number: string; type: string }>;
  companyAddresses: Array<{ id: string; street: string }>;
}

const baseline: FormShape = {
  companyName: 'MACON ATEE',
  vatNumber: '',
  activityType: 'main',
  settlement: 'Θεσσαλονίκη',
  phones: [{ number: '2310428900', type: 'mobile' }],
  companyAddresses: [{ id: 'addr_1', street: 'Απόλλωνος' }],
};

describe('nextEditSessionDiff — η ενότητα που απλώνει ΟΛΗ τη φόρμα', () => {
  it('Δ1: `{ ...formData, phones }` κρατά ΜΟΝΟ τα phones (το μετρημένο περιστατικό)', () => {
    const merged = { ...baseline };
    const phones = [{ number: '2310428900', type: 'main' }];
    const diff = nextEditSessionDiff(baseline, {}, { ...merged, phones });
    expect(Object.keys(diff)).toEqual(['phones']);
    expect(diff.phones).toEqual(phones);
  });

  it('Δ2: δεύτερη αλλαγή κρατά και την πρώτη — ο updater βλέπει τη ΣΥΓΧΩΝΕΥΜΕΝΗ προβολή', () => {
    const first = nextEditSessionDiff(baseline, {}, (merged) => ({ ...merged, vatNumber: '094201577' }));
    const second = nextEditSessionDiff(baseline, first, (merged) => {
      expect(merged.vatNumber).toBe('094201577');
      expect(merged.companyName).toBe('MACON ATEE');
      return { ...merged, phones: [{ number: '2310428900', type: 'main' }] };
    });
    expect(Object.keys(second).sort()).toEqual(['phones', 'vatNumber']);
  });

  it('Δ3: επαναφορά στην αρχική τιμή ⇒ το πεδίο ΠΑΥΕΙ να είναι αλλαγή', () => {
    const edited = nextEditSessionDiff(baseline, {}, (m) => ({ ...m, activityType: 'secondary' }));
    expect(Object.keys(edited)).toEqual(['activityType']);
    const reverted = nextEditSessionDiff(baseline, edited, (m) => ({ ...m, activityType: 'main' }));
    expect(reverted).toEqual({});
  });

  it('Δ4: `setEditedData({})` = άδεια συνεδρία', () => {
    const edited = nextEditSessionDiff(baseline, {}, (m) => ({ ...m, vatNumber: '094201577' }));
    expect(nextEditSessionDiff(baseline, edited, {})).toEqual({});
  });

  it('Δ5: ίδιος πίνακας με ΝΕΑ αναφορά δεν είναι αλλαγή (βαθιά σύγκριση)', () => {
    const copy = baseline.companyAddresses.map((a) => ({ ...a }));
    expect(diffAgainstBaseline(baseline, { companyAddresses: copy })).toEqual({});
  });
});

describe('isSameFormValue — «απόν» ≡ «αδειασμένο», αλλά τιμή → κενό ΕΙΝΑΙ αλλαγή', () => {
  it.each([
    ['undefined/κενό κείμενο', undefined, ''],
    ['undefined/κενός πίνακας', undefined, []],
    ['null/κενά', null, '   '],
  ])('Κ1 %s ⇒ ίσα', (_label, a, b) => {
    expect(isSameFormValue(a, b)).toBe(true);
  });

  it('Κ2: ρητό σβήσιμο υπάρχουσας τιμής μένει στη διαφορά (⇒ `deleteField()`)', () => {
    expect(diffAgainstBaseline(baseline, { settlement: '' })).toEqual({ settlement: '' });
  });

  it('Κ3: κενό πεδίο που η βάση δεν έχει καν ΔΕΝ είναι αλλαγή', () => {
    expect(diffAgainstBaseline(baseline, { taxOffice: '' })).toEqual({});
  });
});

describe('Ένας ορισμός «αδειάσματος» — η διαφορά και ο καθαριστής ΣΥΜΦΩΝΟΥΝ', () => {
  it.each([null, '', '  ', [], 'x', ['a'], 0, false])('Σ1 %p', (value) => {
    const { fieldsToDelete } = sanitizeContactForUpdate({ f: value } as ContactDataRecord);
    expect(fieldsToDelete.includes('f')).toBe(isClearedFormValue(value));
  });
});
