/**
 * ADR-841 §7 Α21.21 — ειδικές ώρες: ο ΕΝΑΣ κριτής, η κανονικοποίηση (κλάδεμα περασμένων) και ο αναγνώστης «όλα ή τίποτα».
 */

import {
  MAX_SPECIAL_DAYS_PER_LOCATION,
  normalizeSpecialDays,
  proposeSpecialDay,
  readSpecialDays,
  specialDaysDefect,
  specialDaysDefects,
  type SpecialDay,
} from '../special-hours';

const TODAY = '2026-09-15';

const VALID: readonly SpecialDay[] = [
  { date: '2026-12-25', kind: 'closed' },
  { date: '2026-10-28', kind: 'regular' },
  { date: '2026-12-24', kind: 'custom', intervals: [{ opens: '17:30', closes: '21:00' }, { opens: '09:00', closes: '14:00' }] },
];

describe('specialDaysDefects — ο ΕΝΑΣ κριτής', () => {
  it('έγκυρες ⇒ κανένα ελάττωμα', () => {
    expect(specialDaysDefects(VALID, TODAY)).toEqual([]);
    expect(specialDaysDefect(VALID, TODAY)).toBeNull();
  });

  it.each([
    ['date-invalid', { date: '2026-02-30', kind: 'closed' }],
    ['date-invalid', { date: '25/12/2026', kind: 'closed' }],
    ['date-beyond-horizon', { date: '2027-09-17', kind: 'closed' }],
    ['hours-missing', { date: '2026-12-24', kind: 'custom', intervals: [] }],
    ['intervals-overlap', { date: '2026-12-24', kind: 'custom', intervals: [{ opens: '09:00', closes: '14:00' }, { opens: '13:00', closes: '15:00' }] }],
  ] as const)('%s', (defect, day) => {
    expect(specialDaysDefects([day], TODAY)).toEqual([{ index: 0, defect }]);
  });

  it('ορίζοντας: 366 ημέρες μπροστά γίνεται δεκτό· μετά τα μεσάνυχτα έγκυρο', () => {
    expect(specialDaysDefect([{ date: '2027-09-16', kind: 'custom', intervals: [{ opens: '22:00', closes: '02:00' }] }], TODAY)).toBeNull();
  });

  it('🔑 ίδια ημερομηνία δύο φορές ⇒ ελάττωμα ΣΤΗ δεύτερη γραμμή', () => {
    expect(specialDaysDefects([{ date: '2026-12-25', kind: 'closed' }, { date: '2026-12-25', kind: 'regular' }], TODAY)).toEqual([
      { index: 1, defect: 'date-duplicate' },
    ]);
  });

  it('🔴 περασμένη μέρα ΔΕΝ είναι λάθος του ανθρώπου — και δεν μετρά στο ταβάνι', () => {
    const upcoming = Array.from({ length: MAX_SPECIAL_DAYS_PER_LOCATION }, (_, index): SpecialDay => ({
      date: `2026-11-${String(index + 1).padStart(2, '0')}`,
      kind: 'closed',
    }));
    expect(specialDaysDefects([{ date: '2026-09-14', kind: 'closed' }, ...upcoming], TODAY)).toEqual([]);
    expect(specialDaysDefects([...upcoming, { date: '2026-12-01', kind: 'closed' }], TODAY)).toEqual([
      { index: MAX_SPECIAL_DAYS_PER_LOCATION, defect: 'too-many-days' },
    ]);
  });
});

describe('proposeSpecialDay — πάντα έγκυρη πρόταση', () => {
  it('η πρώτη ΕΛΕΥΘΕΡΗ μέρα από αύριο, και η πρότασή της περνά τον κριτή', () => {
    const taken: readonly SpecialDay[] = [{ date: '2026-09-16', kind: 'closed' }];
    const proposal = proposeSpecialDay(taken, TODAY);
    expect(proposal).toEqual({ date: '2026-09-17', kind: 'closed' });
    expect(specialDaysDefect([...taken, proposal as SpecialDay], TODAY)).toBeNull();
  });

  it('γεμάτο ταβάνι ⇒ null (το κουμπί δεν προσφέρεται)', () => {
    const full = Array.from({ length: MAX_SPECIAL_DAYS_PER_LOCATION }, (_, index): SpecialDay => ({
      date: `2026-11-${String(index + 1).padStart(2, '0')}`,
      kind: 'closed',
    }));
    expect(proposeSpecialDay(full, TODAY)).toBeNull();
  });
});

describe('normalizeSpecialDays', () => {
  it('κλαδεύει τις περασμένες, ταξινομεί ημερομηνίες και διαστήματα — η σημερινή ΜΕΝΕΙ', () => {
    const normalized = normalizeSpecialDays([...VALID, { date: '2026-09-14', kind: 'closed' }, { date: TODAY, kind: 'closed' }], TODAY);
    expect(normalized).toEqual([
      { date: TODAY, kind: 'closed' },
      { date: '2026-10-28', kind: 'regular' },
      { date: '2026-12-24', kind: 'custom', intervals: [{ opens: '09:00', closes: '14:00' }, { opens: '17:30', closes: '21:00' }] },
      { date: '2026-12-25', kind: 'closed' },
    ]);
  });
});

describe('readSpecialDays — ή όλες ή καμία', () => {
  it('round-trip μέσω του δίσκου', () => {
    expect(readSpecialDays(JSON.parse(JSON.stringify(VALID)) as unknown)).toEqual(VALID);
  });

  it('🔴 παλιό έγγραφο χωρίς πεδίο / σκουπίδι ⇒ [] — ποτέ σφάλμα', () => {
    expect(readSpecialDays(undefined)).toEqual([]);
    expect(readSpecialDays('25/12')).toEqual([]);
  });

  it('🔴 ΜΙΑ χαλασμένη γραμμή ⇒ [] (μισή λίστα θα έδειχνε ωράριο τη μέρα που δηλώθηκε «κλειστά»)', () => {
    expect(readSpecialDays([...VALID, { date: '2026-12-31', kind: 'maybe' }])).toEqual([]);
    expect(readSpecialDays([...VALID, { date: '2026-12-31', kind: 'custom', intervals: [{ opens: '10:00', closes: '10:00' }] }])).toEqual([]);
    expect(readSpecialDays([...VALID, { date: '2026-12-25', kind: 'regular' }])).toEqual([]);
  });
});
