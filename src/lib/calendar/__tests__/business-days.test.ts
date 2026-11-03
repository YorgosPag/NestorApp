import { isBusinessDay, shiftToBusinessDay } from '../business-days';

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
