import { addBusinessDays, isBusinessDay, nonBusinessDayReason, shiftToBusinessDay } from '../business-days';

describe('addBusinessDays (ADR-915 §45 Φ2)', () => {
  it.each([
    ['2026-11-16', 5, '2026-11-23'],  // Δευτέρα + 5 ⇒ την επόμενη Δευτέρα (η ίδια ημέρα δεν μετρά)
    ['2026-11-20', 1, '2026-11-23'],  // Παρασκευή + 1 ⇒ Δευτέρα (σαββατοκύριακο)
    ['2026-12-24', 1, '2026-12-28'],  // Πέμπτη + 1 ⇒ Χριστούγεννα · Σύναξη (Σάβ.) · Κυριακή ⇒ Δευτέρα
    ['2027-04-29', 1, '2027-05-04'],  // Μ. Πέμπτη 2027 + 1 ⇒ Μ. Παρασκευή · Σάβ. · Πάσχα · Δευτέρα του Πάσχα ⇒ Τρίτη
    ['2026-11-21', 0, '2026-11-21'],  // 0 ⇒ η ίδια ημέρα, ακόμη κι αν δεν είναι εργάσιμη
  ] as const)('%s + %d εργάσιμες ⇒ %s', (day, n, expected) => {
    expect(addBusinessDays(day, n)).toBe(expected);
  });

  it.each([
    ['not-a-day', 1], ['2026-02-30', 1], ['2026-11-16', -1], ['2026-11-16', 1.5], ['2026-11-16', 367],
  ] as const)('άκυρο (%s, %d) ⇒ null', (day, n) => {
    expect(addBusinessDays(day, n)).toBeNull();
  });
});

describe('isBusinessDay', () => {
  it.each([
    ['2027-03-03', true],  // Τετάρτη
    ['2027-03-06', false], // Σάββατο
    ['2027-03-07', false], // Κυριακή
    ['2027-08-16', true],  // Δευτέρα μετά τον Δεκαπενταύγουστο
    ['2026-08-14', true],  // Παρασκευή
    ['2027-03-25', false], // 25η Μαρτίου (Πέμπτη)
    ['2027-04-30', false], // Μεγάλη Παρασκευή 2027 (Πάσχα 2 Μαΐου)
    ['2027-05-03', false], // Δευτέρα του Πάσχα 2027
    ['2027-06-21', false], // Αγίου Πνεύματος 2027
    ['2026-08-15', false], // Σάββατο και Κοίμηση
    ['not-a-day', false],
  ])('%s → %s', (day, expected) => {
    expect(isBusinessDay(day)).toBe(expected);
  });
});

describe('nonBusinessDayReason — ΓΙΑΤΙ δεν είναι εργάσιμη (ADR-916 Φ-Ε1 λήξη πρόσβασης)', () => {
  it.each([
    ['2027-02-16', null],                                        // Τρίτη — η λήξη του φακέλου δοκιμής
    ['2027-03-06', { kind: 'weekend', weekday: 6 }],             // Σάββατο
    ['2027-03-07', { kind: 'weekend', weekday: 7 }],             // Κυριακή
    ['2027-03-15', { kind: 'holiday', holiday: 'clean-monday' }], // Καθαρά Δευτέρα 2027
    ['2026-08-15', { kind: 'holiday', holiday: 'assumption' }],   // Σάββατο ΚΑΙ αργία ⇒ το όνομα της αργίας
    ['not-a-day', null],
  ])('%s → %j', (day, expected) => {
    expect(nonBusinessDayReason(day)).toEqual(expected);
  });
});

describe('shiftToBusinessDay', () => {
  it('εργάσιμη μένει ίδια', () => {
    expect(shiftToBusinessDay('2027-03-03', 'previous_business_day')).toBe('2027-03-03');
  });

  it('Κυριακή → προηγούμενη Παρασκευή / επόμενη Δευτέρα', () => {
    expect(shiftToBusinessDay('2027-03-07', 'previous_business_day')).toBe('2027-03-05');
    expect(shiftToBusinessDay('2027-03-07', 'next_business_day')).toBe('2027-03-08');
  });

  it('το Πάσχα 2027 πηδά τέσσερις μη εργάσιμες (Μ. Παρασκευή → Δευτέρα)', () => {
    expect(shiftToBusinessDay('2027-05-01', 'previous_business_day')).toBe('2027-04-29');
    expect(shiftToBusinessDay('2027-04-30', 'next_business_day')).toBe('2027-05-04');
  });

  it('none ⇒ ίδια ημέρα, και σε αργία', () => {
    expect(shiftToBusinessDay('2027-03-25', 'none')).toBe('2027-03-25');
  });

  it('άκυρο κλειδί ⇒ null', () => {
    expect(shiftToBusinessDay('2027-02-30', 'next_business_day')).toBeNull();
  });
});
