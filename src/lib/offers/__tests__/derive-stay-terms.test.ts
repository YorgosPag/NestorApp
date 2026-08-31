/**
 * @fileoverview Άγκυρες **όρων διαμονής** (ADR-835 §4.5, Φ3).
 *
 * 🔑 Κάθε σκέλος έχει **παρονομαστή**: χωρίς αυτόν, ένα `return null` ή ένα
 * `return { minNights: null, maxGuests: null }` θα περνούσε τα μισά.
 */

import { deriveStayTerms } from '@/lib/offers/derive-stay-terms';
import type { PropertyOffer } from '@/types/property-offers';

const AT = '2026-08-01T00:00:00.000Z';

function shortLease(over: Partial<PropertyOffer> = {}): PropertyOffer {
  return {
    kind: 'leaseShort',
    lifecycle: 'active',
    nightlyRate: 80,
    minNights: 3,
    maxGuests: 4,
    createdAt: AT,
    updatedAt: AT,
    ...over,
  } as PropertyOffer;
}

const SALE: PropertyOffer = {
  kind: 'sell',
  lifecycle: 'active',
  askingPrice: 200000,
  finalPrice: null,
  createdAt: AT,
  updatedAt: AT,
} as PropertyOffer;

describe('Α — `null` σημαίνει «δεν είναι κατάλυμα», ποτέ «κατάλυμα χωρίς όρους»', () => {
  it('καμία διάθεση ⇒ `null`', () => {
    expect(deriveStayTerms([])).toBeNull();
    expect(deriveStayTerms(null)).toBeNull();
    expect(deriveStayTerms(undefined)).toBeNull();
  });

  it('🔴 ΜΟΝΟ πώληση ⇒ `null` — ολόκληρος ο κάδος `not-a-stay` κρέμεται από εδώ', () => {
    expect(deriveStayTerms([SALE])).toBeNull();
  });

  it('🔴 …ενώ ζωντανή βραχυχρόνια δίνει ΑΝΤΙΚΕΙΜΕΝΟ — ο παρονομαστής', () => {
    expect(deriveStayTerms([shortLease()])).toEqual({ minNights: 3, maxGuests: 4 });
  });

  it('🔴 κατάλυμα ΧΩΡΙΣ δηλωμένους όρους δίνει αντικείμενο με `null`, ΟΧΙ `null`', () => {
    // Η διάκριση που παράγει `terms-unknown` αντί για `not-a-stay`: το πρώτο
    // ζητά ένα πεδίο από τον κάτοχο, το δεύτερο δεν είναι καν ερώτηση γι' αυτόν.
    const mute = deriveStayTerms([shortLease({ minNights: null, maxGuests: null } as Partial<PropertyOffer>)]);
    expect(mute).toEqual({ minNights: null, maxGuests: null });
    expect(mute).not.toBeNull();
  });
});

describe('Β — ΜΟΝΟ ζωντανές διαθέσεις, ίδιος φρουρός με τα ποσά', () => {
  it('🔴 ΑΠΟΣΥΡΜΕΝΗ βραχυχρόνια ΔΕΝ δίνει όρους — «το ιστορικό δεν βάφει την οθόνη»', () => {
    // Αλλιώς η κάρτα θα έλεγε «ελάχιστο 3 νύχτες» για κατάλυμα που δεν νοικιάζεται.
    expect(deriveStayTerms([shortLease({ lifecycle: 'withdrawn' } as Partial<PropertyOffer>)])).toBeNull();
  });

  it('🔴 …ενώ η ΙΔΙΑ διάθεση ζωντανή δίνει — ο παρονομαστής του κύκλου ζωής', () => {
    expect(deriveStayTerms([shortLease({ lifecycle: 'active' } as Partial<PropertyOffer>)])).not.toBeNull();
  });

  it('η βραχυχρόνια βρίσκεται ανάμεσα σε άλλες διαθέσεις (συνύπαρξη §4.7)', () => {
    expect(deriveStayTerms([SALE, shortLease()])).toEqual({ minNights: 3, maxGuests: 4 });
  });
});
