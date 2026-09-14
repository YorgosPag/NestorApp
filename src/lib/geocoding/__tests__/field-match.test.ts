/**
 * @fileoverview Άγκυρες της **μίας** σύγκρισης πεδίου διεύθυνσης (ADR-332 D28).
 * @related lib/geocoding/field-match · geocoding-engine-helpers.buildFieldMatches · editor/hooks/useAddressFieldStatus
 *
 * Φυλάνε δύο πράγματα:
 * - **`broader`**: η «Θεσσαλονίκη» για διεύθυνση στο Κορδελιό είναι ευρύτερη περιοχή, όχι λάθος·
 * - **ΠΑΡΟΝΟΜΑΣΤΗΣ**: η «Καλαμαριά» μέσα στη Θεσσαλονίκη **μένει** `mismatch` — το νέο κριτήριο δεν
 *   επιτρέπεται να «συγχωρεί» πραγματική αντίφαση.
 */

/* global describe, it, expect */

import { compareAddressField, compareAddressFields } from '../field-match';
import type { ResolvedAddressFields } from '../geocoding-types';

/** Η πραγματική απάντηση του Nominatim για το περιστατικό (μετρημένο 2026-09-14). */
const KORDELIO: ResolvedAddressFields = {
  street: 'Σαμοθράκης',
  postalCode: '56334',
  neighborhood: 'Ελευθέριο-Κορδελιό',
  city: 'Δημοτική Ενότητα Ελευθερίου - Κορδελιού',
  county: 'Μητροπολιτική Ενότητα Θεσσαλονίκης',
  region: 'Περιφέρεια Κεντρικής Μακεδονίας',
  country: 'Ελλάδα',
};

describe('compareAddressField — broader', () => {
  it('🔑 «Θεσσαλονίκη» για διεύθυνση στο Κορδελιό ⇒ broader', () => {
    expect(compareAddressField('city', 'Θεσσαλονίκη', KORDELIO)).toBe('broader');
  });

  it('η γειτονιά ως ευρύτερη: «Κορδελιό» για γειτονιά ⇒ broader όταν ο δήμος το ονομάζει', () => {
    const resolved: ResolvedAddressFields = { neighborhood: 'Ελευθέριο', city: 'Κορδελιό' };
    expect(compareAddressField('neighborhood', 'Κορδελιό', resolved)).toBe('broader');
  });

  it('χωρίς πόλη στην απάντηση, αλλά νομός με το ίδιο όνομα ⇒ broader, όχι unknown', () => {
    expect(compareAddressField('city', 'Θεσσαλονίκη', { county: 'Μητροπολιτική Ενότητα Θεσσαλονίκης' })).toBe('broader');
  });

  it('🔴 ΠΑΡΟΝΟΜΑΣΤΗΣ: «Καλαμαριά» μέσα στη Θεσσαλονίκη ⇒ ΜΕΝΕΙ mismatch', () => {
    const resolved: ResolvedAddressFields = { city: 'Θεσσαλονίκη', county: 'Μητροπολιτική Ενότητα Θεσσαλονίκης' };
    expect(compareAddressField('city', 'Καλαμαριά', resolved)).toBe('mismatch');
  });

  it('η οδός δεν «περιέχεται» σε τίποτα', () => {
    expect(compareAddressField('street', 'Θεσσαλονίκης', KORDELIO)).toBe('mismatch');
  });
});

describe('compareAddressField — τα τέσσερα ιστορικά', () => {
  it('match (τόνοι/πεζά αδιάφορα)', () => {
    expect(compareAddressField('street', 'ΣΑΜΟΘΡΑΚΗΣ', KORDELIO)).toBe('match');
  });

  it('🔴 Τ.Κ. σε κανονική μορφή και από τις δύο πλευρές — ο πελάτης το έχανε (D16)', () => {
    expect(compareAddressField('postalCode', '563 34', KORDELIO)).toBe('match');
  });

  it('not-provided / unknown', () => {
    expect(compareAddressField('number', '', KORDELIO)).toBe('not-provided');
    expect(compareAddressField('number', '16', KORDELIO)).toBe('unknown');
  });
});

describe('compareAddressFields — ο πίνακας του περιστατικού', () => {
  it('καμία αντίφαση: η διεύθυνση είναι συνεπής', () => {
    const matches = compareAddressFields(
      { street: 'Σαμοθράκης', number: '16', postalCode: '56334', city: 'Θεσσαλονίκη' },
      KORDELIO,
    );
    expect(matches).toEqual({
      street: 'match',
      number: 'unknown',
      postalCode: 'match',
      neighborhood: 'not-provided',
      city: 'broader',
      county: 'not-provided',
      region: 'not-provided',
      country: 'not-provided',
    });
  });
});
