/**
 * ADR-777 §8.65.13 — ΑΓΚΥΡΕΣ για την **ανάγνωση** της απάντησης ζήτησης.
 *
 * 🔴 **Γεννήθηκαν από πτώση στην παραγωγή** *(2026-09-11)*: το §8.65 έκανε το `near`
 * του `usePublicListings` υποχρεωτικό, και ο **μόνος** καταναλωτής που δεν ενημερώθηκε
 * ήταν αυτός — `usePublicListings()` ⇒ `undefined` ⇒ `listingAreaKey` ⇒
 * `'south' in undefined` ⇒ **κάθε** `/demands/[id]` έπεφτε. Κανένα test δεν εκτελούσε
 * αυτόν τον hook· το σφάλμα ήταν σφάλμα **τύπων**, και ο N.17 κρατά το `tsc` έξω από
 * τη ροή του πράκτορα ⇒ η μόνη άμυνα μέσα στη ροή είναι δοκιμή που **εκτελεί**.
 *
 *   Κ1  Η περιοχή δίνεται **ΡΗΤΑ**: ένα όρισμα, ποτέ σιωπηλό `undefined`
 *   Κ2  🔴 Η ανάγνωση είναι **ΟΛΗ η αγορά** — και για ζήτηση με ακτίνα
 *   Κ3  Ό,τι δίνεται, το δέχεται ο **πραγματικός** `listingAreaKey` — ο μηχανισμός της πτώσης
 */

import { renderHook } from '@testing-library/react';
import type { PropertyDemand } from '@/types/property-demand';
import { listingAreaKey } from '@/lib/listings/listing-geo-query';
import { usePublicListings } from '@/services/realtime/hooks/usePublicListings';
import { demand } from '@/lib/demand/__tests__/demand-fixtures';
import { useDemandAnswer } from '../useDemandAnswer';

jest.mock('@/services/realtime/hooks/usePublicListings', () => ({
  usePublicListings: jest.fn(),
}));

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { get: jest.fn() },
}));

const readListings = jest.mocked(usePublicListings);

/** Ζήτηση **με ακτίνα** — η περίπτωση που θα έμπαινε στον πειρασμό να στενέψει. */
const NEAR_DEMAND = demand({
  place: { kind: 'near', center: { lat: 40.64, lng: 22.94 }, radiusKm: 2 },
});

const CASES: ReadonlyArray<readonly [string, PropertyDemand | null]> = [
  ['η ζήτηση δεν έχει φορτωθεί ακόμη', null],
  ['ζήτηση «οπουδήποτε»', demand()],
  ['ζήτηση με ακτίνα 2 χλμ.', NEAR_DEMAND],
];

/** Τα ορίσματα κάθε κλήσης του αναγνώστη, για μία απόδοση του hook. */
function readArguments(
  subject: PropertyDemand | null,
): ReadonlyArray<Parameters<typeof usePublicListings>> {
  readListings.mockReset();
  // Σε `loading` η απάντηση δεν συναρμολογείται: η σουίτα ρωτά **τι ζητήθηκε**, όχι
  // τι απαντήθηκε — το δεύτερο το φυλάνε οι σουίτες του `lib/demand/`.
  readListings.mockReturnValue({
    listings: [],
    loading: true,
    error: null,
    coverage: { kind: 'complete' },
  });
  renderHook(() => useDemandAnswer(subject));
  return readListings.mock.calls;
}

describe('Κ1 — η περιοχή δίνεται ΡΗΤΑ', () => {
  it.each(CASES)('%s ⇒ ακριβώς ένα όρισμα σε κάθε κλήση', (_label, subject) => {
    const calls = readArguments(subject);
    expect(calls.length).toBeGreaterThan(0);
    for (const args of calls) {
      expect(args).toHaveLength(1);
      expect(args[0]).not.toBeUndefined();
    }
  });
});

describe('Κ2 🔴 — η ανάγνωση είναι ΟΛΗ η αγορά', () => {
  it.each(CASES)('%s ⇒ `null`', (_label, subject) => {
    // ⚠️ Όχι ο κύκλος της ζήτησης: το `outside-radius` είναι «παραλίγο» **χωρίς όριο
    //    απόστασης**, και η παραχώρηση `search-radius` μετρά όσα μένουν **έξω** από
    //    την ακτίνα. Στένωση εδώ = σιωπηλά λιγότερα «παραλίγο».
    for (const args of readArguments(subject)) {
      expect(args[0]).toBeNull();
    }
  });
});

describe('Κ3 — ό,τι δίνεται, το δέχεται ο πραγματικός `listingAreaKey`', () => {
  it.each(CASES)('%s ⇒ κανένα `TypeError`', (_label, subject) => {
    for (const args of readArguments(subject)) {
      // Η **ίδια** συνάρτηση που έσκασε στην παραγωγή, όχι αντίγραφο της συνθήκης της.
      expect(() => listingAreaKey(args[0])).not.toThrow();
    }
  });
});
