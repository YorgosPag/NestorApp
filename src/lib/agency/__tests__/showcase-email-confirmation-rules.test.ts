/**
 * ADR-841 §7 Α21.18 — οι κανόνες της επιβεβαίωσης email: κάθε όριο εκτελείται χωρίς ρολόι και χωρίς Firestore.
 */

import {
  EMAIL_CONFIRMATION_LIFETIME_HOURS,
  carryConfirmations,
  confirmationFreshness,
  confirmationLinkExpiresAt,
  latestConfirmedAt,
  withConfirmation,
} from '../showcase-email-confirmation-rules';

const SEPT = '2026-09-10T08:00:00.000Z';
const OCT = '2026-10-01T08:00:00.000Z';

describe('carryConfirmations', () => {
  it('🔑 μία ανά διεύθυνση, η νεότερη, στη σειρά των email', () => {
    const previous = [
      { email: 'b@x.gr', confirmedAt: SEPT },
      { email: 'a@x.gr', confirmedAt: SEPT },
      { email: 'A@X.GR', confirmedAt: OCT },
    ];
    expect(carryConfirmations(previous, ['a@x.gr', 'b@x.gr'])).toEqual([
      { email: 'a@x.gr', confirmedAt: OCT },
      { email: 'b@x.gr', confirmedAt: SEPT },
    ]);
  });

  it('🔴 διεύθυνση που έφυγε από την κάρτα ΔΕΝ μεταφέρεται — ούτε με άκυρη ημερομηνία', () => {
    const previous = [
      { email: 'gone@x.gr', confirmedAt: SEPT },
      { email: 'a@x.gr', confirmedAt: 'χθες' },
    ];
    expect(carryConfirmations(previous, ['a@x.gr'])).toEqual([]);
  });
});

describe('latestConfirmedAt / withConfirmation', () => {
  it('κενό ⇒ null · αλλιώς η νεότερη αναγνώσιμη', () => {
    expect(latestConfirmedAt([])).toBeNull();
    expect(latestConfirmedAt([{ email: 'a', confirmedAt: SEPT }, { email: 'b', confirmedAt: OCT }, { email: 'c', confirmedAt: 'x' }])).toBe(OCT);
  });

  it('🔑 νέα επιβεβαίωση ΑΝΤΙΚΑΘΙΣΤΑ την παλιά της ίδιας διεύθυνσης — ποτέ δεύτερη γραμμή', () => {
    const next = withConfirmation([{ email: 'a@x.gr', confirmedAt: SEPT }, { email: 'b@x.gr', confirmedAt: SEPT }], 'A@x.gr', OCT);
    expect(next).toEqual([{ email: 'b@x.gr', confirmedAt: SEPT }, { email: 'A@x.gr', confirmedAt: OCT }]);
  });
});

describe('confirmationFreshness — ήπια φθορά 12 ημερολογιακών μηνών', () => {
  it('φρέσκια μέχρι ΑΚΡΙΒΩΣ πριν τους 12 μήνες, παλιά από εκεί', () => {
    expect(confirmationFreshness(SEPT, '2027-09-10T07:59:59.999Z')).toBe('fresh');
    expect(confirmationFreshness(SEPT, '2027-09-10T08:00:00.000Z')).toBe('aged');
  });

  it('🔴 29 Φεβρουαρίου + 12 μήνες = 28 Φεβρουαρίου — όχι 1 Μαρτίου (το SSoT `addMonthsUTC`)', () => {
    expect(confirmationFreshness('2028-02-29T10:00:00.000Z', '2029-02-28T09:59:59.000Z')).toBe('fresh');
    expect(confirmationFreshness('2028-02-29T10:00:00.000Z', '2029-02-28T10:00:00.000Z')).toBe('aged');
  });

  it('⚠️ μη αναγνώσιμη ημερομηνία ⇒ aged (ποτέ σήμα χωρίς στήριγμα)', () => {
    expect(confirmationFreshness('χθες', SEPT)).toBe('aged');
    expect(confirmationFreshness(SEPT, 'τώρα')).toBe('aged');
  });
});

describe('confirmationLinkExpiresAt', () => {
  it('72 ώρες μετά — ή null σε μη αναγνώσιμο «τώρα»', () => {
    expect(EMAIL_CONFIRMATION_LIFETIME_HOURS).toBe(72);
    expect(confirmationLinkExpiresAt('2026-09-11T17:30:00.000Z')).toBe('2026-09-14T17:30:00.000Z');
    expect(confirmationLinkExpiresAt('x')).toBeNull();
  });
});
