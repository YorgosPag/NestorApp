/**
 * Tests για το SSoT Τ.Κ. (ADR-332 D16).
 *
 * Ο κρίσιμος άξονας δεν είναι «κόβει το κενό» — είναι **τι ΔΕΝ αγγίζει**. Ένα
 * τυφλό `replace` θα κατέστρεφε ξένους Τ.Κ., και αυτό δεν το πιάνει κανένα gate.
 */

import {
  formatGreekPostalCode,
  isValidGreekPostalCode,
  parseGreekPostalCodeInput,
  postalCodeAppearsIn,
  toCanonicalGreekPostalCode,
} from '../postal-code';

describe('toCanonicalGreekPostalCode', () => {
  it.each([
    ['546 24', '54624'],
    ['54624', '54624'],
    ['  546 24  ', '54624'],
    ['', ''],
  ])('κανονικοποιεί «%s» → «%s»', (input, expected) => {
    expect(toCanonicalGreekPostalCode(input)).toBe(expected);
  });

  it.each([undefined, null])('δέχεται %s χωρίς να σκάει', (input) => {
    expect(toCanonicalGreekPostalCode(input)).toBe('');
  });

  it('ΑΦΗΝΕΙ ΑΝΕΠΑΦΟΥΣ τους ξένους Τ.Κ.', () => {
    expect(toCanonicalGreekPostalCode('SW1A 1AA')).toBe('SW1A 1AA');
    expect(toCanonicalGreekPostalCode('1234 AB')).toBe('1234 AB');
    expect(toCanonicalGreekPostalCode('12345-6789')).toBe('12345-6789');
  });

  it('είναι ιδιότροπη — δεύτερη εφαρμογή δεν αλλάζει τίποτα', () => {
    const once = toCanonicalGreekPostalCode('546 24');
    expect(toCanonicalGreekPostalCode(once)).toBe(once);
  });
});

describe('formatGreekPostalCode', () => {
  it.each([
    ['54624', '546 24'],
    ['546 24', '546 24'],
    ['5462', '546 2'],
    ['546', '546'],
    ['54', '54'],
    ['', ''],
  ])('μορφοποιεί «%s» → «%s»', (input, expected) => {
    expect(formatGreekPostalCode(input)).toBe(expected);
  });

  it('ΑΦΗΝΕΙ ΑΝΕΠΑΦΟΥΣ τους ξένους Τ.Κ.', () => {
    expect(formatGreekPostalCode('SW1A 1AA')).toBe('SW1A 1AA');
    expect(formatGreekPostalCode('123456')).toBe('123456');
  });
});

describe('parseGreekPostalCodeInput', () => {
  it('κρατά μόνο ψηφία, το πολύ 5', () => {
    expect(parseGreekPostalCodeInput('546 24')).toBe('54624');
    expect(parseGreekPostalCodeInput('5462456')).toBe('54624');
    expect(parseGreekPostalCodeInput('αβγ')).toBe('');
  });

  it('το backspace πάνω στη μάσκα γυρίζει καθαρά', () => {
    // Οθόνη «546 24» → ο χρήστης σβήνει έναν χαρακτήρα → «546 2»
    expect(formatGreekPostalCode(parseGreekPostalCodeInput('546 2'))).toBe('546 2');
    // …ξανά → «546 » → μοντέλο «546» → οθόνη «546»
    expect(formatGreekPostalCode(parseGreekPostalCodeInput('546 '))).toBe('546');
  });
});

describe('isValidGreekPostalCode', () => {
  it('δέχεται ΚΑΙ ΤΙΣ ΔΥΟ μορφές — παλιά δεδομένα δεν είναι «άκυρα»', () => {
    expect(isValidGreekPostalCode('54624')).toBe(true);
    expect(isValidGreekPostalCode('546 24')).toBe(true);
  });

  it.each(['00000', '00100', '1234', '123456', 'ABCDE', ''])('απορρίπτει «%s»', (input) => {
    expect(isValidGreekPostalCode(input)).toBe(false);
  });
});

describe('postalCodeAppearsIn', () => {
  const displayName = 'Ονειροπόλων, Θεσσαλονίκη, 546 24, Ελλάδα';

  it('βρίσκει τον κανονικό Τ.Κ. μέσα σε κείμενο που τον γράφει με κενό', () => {
    // Χωρίς αυτό, η κανονικοποίηση του ερωτήματος θα έριχνε το confidence.
    expect(postalCodeAppearsIn(displayName, '54624')).toBe(true);
  });

  it('βρίσκει και την ίδια μορφή', () => {
    expect(postalCodeAppearsIn(displayName, '546 24')).toBe(true);
    expect(postalCodeAppearsIn('Egnatia 147, 54622', '54622')).toBe(true);
  });

  it('δεν βρίσκει ό,τι δεν υπάρχει', () => {
    expect(postalCodeAppearsIn(displayName, '11111')).toBe(false);
    expect(postalCodeAppearsIn(displayName, '')).toBe(false);
    expect(postalCodeAppearsIn(displayName, undefined)).toBe(false);
  });
});
