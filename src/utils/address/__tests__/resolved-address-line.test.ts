/**
 * @fileoverview Άγκυρες της σύντομης μορφής της απάντησης του παρόχου (ADR-332 D28).
 * @related utils/address/address-line · hooks/geo/usePlaceResolver · components/geo/ResolvedPlaceConfirmation
 */

/* global describe, it, expect */

import { formatResolvedAddressLine } from '../address-line';

describe('formatResolvedAddressLine — «Οδός Αριθμός, Περιοχή, Τ.Κ.»', () => {
  it('🔑 το περιστατικό: δώδεκα κομμάτια ⇒ τρία (γειτονιά πριν από πόλη, Τ.Κ. στη γραφή ΕΛΤΑ)', () => {
    expect(
      formatResolvedAddressLine({
        street: 'Σαμοθράκης',
        neighborhood: 'Ελευθέριο-Κορδελιό',
        city: 'Δημοτική Ενότητα Ελευθερίου - Κορδελιού',
        postalCode: '56334',
        country: 'Ελλάδα',
      }),
    ).toBe('Σαμοθράκης, Ελευθέριο-Κορδελιό, 563 34');
  });

  it('🔴 η παύλα του επίσημου ονόματος ΜΕΝΕΙ — η οθόνη υπάρχει για επαλήθευση, όχι για σύγκριση', () => {
    expect(formatResolvedAddressLine({ street: 'Σαμοθράκης', neighborhood: 'Ελευθέριο-Κορδελιό' })).toContain('Ελευθέριο-Κορδελιό');
  });

  it('χωρίς γειτονιά ⇒ η πόλη, ΧΩΡΙΣ το πρόθεμα βαθμίδας του παρόχου', () => {
    expect(
      formatResolvedAddressLine({ street: 'Εγνατίας', number: '147', city: 'Δήμος Θεσσαλονίκης', postalCode: '54636' }),
    ).toBe('Εγνατίας 147, Θεσσαλονίκης, 546 36');
  });

  it('ξένος Τ.Κ. μένει αυτούσιος', () => {
    expect(
      formatResolvedAddressLine({ street: 'Baker Street', number: '221B', city: 'London', postalCode: 'NW1 6XE', country: 'United Kingdom' }),
    ).toBe('Baker Street 221B, London, NW1 6XE');
  });

  it('ούτε οδός ούτε περιοχή ⇒ κενό: ο καλών κρατά το πλήρες κείμενο', () => {
    expect(formatResolvedAddressLine({ postalCode: '56334' })).toBe('');
  });
});
