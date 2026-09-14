/**
 * @fileoverview Άγκυρες της **βαθμίδας 9** — «ο Τ.Κ. αποδεικνύει ό,τι αφαιρέσαμε» (ADR-332 D28).
 * @related app/api/geocoding/geocoding-ladder · geocoding-engine · geocoding-query-variants
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΦΥΛΑΝΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μετρημένο ζωντανά 2026-09-14: «Σαμοθράκης 16, 56334, Θεσσαλονίκη» ⇒ **όλες** οι παραλλαγές κενές,
 * γιατί ο Τ.Κ. ανήκει στον Δήμο Κορδελιού-Ευόσμου και η «Θεσσαλονίκη» διαβάζεται ως δήμος. Χωρίς την
 * πόλη, η ίδια διεύθυνση λύνεται σωστά. Στη Θεσσαλονίκη υπάρχουν **τέσσερις** οδοί «Σαμοθράκης» —
 * άρα η χαλάρωση είναι ασφαλής **μόνο** αν ο Τ.Κ. αποδεικνύεται (Α2, Α3, Α7 είναι η ουσία).
 *
 * ⚠️ **ΠΑΡΟΝΟΜΑΣΤΗΣ** (Α5): διεύθυνση που λύνεται σήμερα στην 1 κοστίζει **ακριβώς ένα** αίτημα.
 */

/* global describe, it, expect, beforeEach, afterEach, jest */

import { geocode, geocodeWithVerdict } from '../geocoding-engine';
import { clearGeocodingCache } from '../geocoding-cache';

const ORIGINAL_FETCH = global.fetch;

const QUERY = { street: 'Σαμοθράκης', number: '16', postalCode: '56334', city: 'Θεσσαλονίκη' };
const ANCHORED_Q = 'Σαμοθράκης 16, 56334';

interface Candidate {
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
  place_rank: number;
  address: { road: string; postcode?: string; suburb?: string; county?: string; country_code?: string };
}

function kordelio(postcode: string | undefined, lat = '40.6643092'): Candidate {
  return {
    lat,
    lon: '22.8976016',
    display_name: 'Σαμοθράκης, Ελευθέριο-Κορδελιό, Μητροπολιτική Ενότητα Θεσσαλονίκης',
    class: 'highway',
    type: 'residential',
    place_rank: 26,
    address: {
      road: 'Σαμοθράκης',
      suburb: 'Ελευθέριο-Κορδελιό',
      county: 'Μητροπολιτική Ενότητα Θεσσαλονίκης',
      country_code: 'gr',
      ...(postcode === undefined ? {} : { postcode }),
    },
  };
}

/** Απαντά **μόνο** στο ερώτημα της βαθμίδας 9· σε κάθε άλλη παραλλαγή, άδειος πίνακας. */
function respondToAnchoredOnly(candidates: Candidate[]): jest.Mock {
  const mock = jest.fn(async (url: string) => {
    const q = new URL(url).searchParams.get('q');
    return { ok: true, status: 200, json: async () => (q === ANCHORED_Q ? candidates : []) };
  });
  global.fetch = mock as unknown as typeof fetch;
  return mock;
}

function askedQueries(mock: jest.Mock): (string | null)[] {
  return mock.mock.calls.map((call) => new URL(String(call[0])).searchParams.get('q'));
}

beforeEach(() => {
  clearGeocodingCache();
  jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
    fn();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout);
});

afterEach(() => {
  jest.restoreAllMocks();
  global.fetch = ORIGINAL_FETCH;
});

describe('Α — βαθμίδα 9: χαλάρωση τοπωνυμίου με άγκυρα τον Τ.Κ.', () => {
  it('Α1 — η διεύθυνση του περιστατικού λύνεται, με ΔΗΛΩΜΕΝΗ χαλάρωση', async () => {
    // Το OSM Ελλάδας γράφει τον Τ.Κ. με κενό — η απόδειξη συγκρίνει κανονική μορφή (D16).
    respondToAnchoredOnly([kordelio('563 34')]);

    const result = await geocode(QUERY);

    expect(result?.source.variantUsed).toBe(9);
    expect(result?.lat).toBeCloseTo(40.6643092);
    expect(result?.reasoning.relaxation).toEqual({ dropped: ['city'], anchor: 'postalCode' });
    expect(result?.reasoning.fieldMatches.postalCode).toBe('match');
  });

  it('Α2 — 🔴 υποψήφιος με ΑΛΛΟ Τ.Κ. απορρίπτεται: σωστός δρόμος, λάθος γειτονιά', async () => {
    respondToAnchoredOnly([kordelio('54635')]);

    const verdict = await geocodeWithVerdict(QUERY);

    expect(verdict).toEqual({ kind: 'absent' });
  });

  it('Α2β — η απόρριψη καταγράφεται «no-results», ΟΧΙ «success»', async () => {
    // Επιτυχία σε μεταγενέστερη βαθμίδα ώστε να υπάρχει ημερολόγιο να διαβαστεί.
    global.fetch = jest.fn(async (url: string) => {
      const q = new URL(url).searchParams.get('q');
      const body = q === ANCHORED_Q ? [kordelio('54635')] : q === 'Θεσσαλονίκη' ? [kordelio('563 34')] : [];
      return { ok: true, status: 200, json: async () => body };
    }) as unknown as typeof fetch;

    const result = await geocode({ ...QUERY, country: 'Ελλάδα' });
    const nine = result?.reasoning.attemptsLog.find((a) => a.variant === 9);

    expect(nine?.status).toBe('no-results');
    expect(result?.source.variantUsed).toBe(8);
    expect(result?.reasoning.relaxation).toBeUndefined();
  });

  it('Α3 — υποψήφιος ΧΩΡΙΣ Τ.Κ. = καμία απόδειξη ⇒ απόρριψη', async () => {
    respondToAnchoredOnly([kordelio(undefined)]);

    await expect(geocodeWithVerdict(QUERY)).resolves.toEqual({ kind: 'absent' });
  });

  it('Α4 — χωρίς δηλωμένη πόλη η 9 παραλείπεται: θα ξαναρωτούσε ό,τι μόλις απέτυχε', async () => {
    const mock = respondToAnchoredOnly([]);

    await geocodeWithVerdict({ street: 'Σαμοθράκης', number: '16', postalCode: '56334' });

    // Ακριβώς ΜΙΑ φορά το ερώτημα «οδός + Τ.Κ.» — από την παραλλαγή 1, όχι δεύτερη από την 9.
    expect(askedQueries(mock).filter((q) => q === ANCHORED_Q)).toHaveLength(1);
  });

  it('Α5 — ΠΑΡΟΝΟΜΑΣΤΗΣ: επιτυχία στην 1 ⇒ ακριβώς ΕΝΑ αίτημα, καμία χαλάρωση', async () => {
    const mock = jest.fn(async () => ({ ok: true, status: 200, json: async () => [kordelio('563 34')] }));
    global.fetch = mock as unknown as typeof fetch;

    const result = await geocode(QUERY);

    expect(mock).toHaveBeenCalledTimes(1);
    expect(result?.source.variantUsed).toBe(1);
    expect(result?.reasoning.relaxation).toBeUndefined();
  });

  it('Α6 — σειρά: η 9 εκτελείται ΜΕΤΑ την πλήρη διεύθυνση και ΠΡΙΝ τη χαλάρωση χώρας', async () => {
    respondToAnchoredOnly([]);

    const result = await geocodeWithVerdict({ ...QUERY, country: 'Ελλάδα' });
    expect(result.kind).toBe('absent');

    // Το ημερολόγιο δεν ταξιδεύει στο `absent` — διαβάζουμε τη σειρά από μια επιτυχία στην 8.
    clearGeocodingCache();
    global.fetch = jest.fn(async (url: string) => {
      const q = new URL(url).searchParams.get('q');
      return { ok: true, status: 200, json: async () => (q === 'Θεσσαλονίκη' ? [kordelio('563 34')] : []) };
    }) as unknown as typeof fetch;
    const hitAt8 = await geocode({ ...QUERY, country: 'Ελλάδα' });

    expect(hitAt8?.reasoning.attemptsLog.map((a) => a.variant)).toEqual([1, 2, 3, 4, 5, 6, 9, 7, 8]);
  });

  it('Α7 — φιλτράρονται ΟΛΟΙ οι υποψήφιοι, όχι μόνο ο πρώτος', async () => {
    respondToAnchoredOnly([kordelio('54635', '40.6100'), kordelio('563 34', '40.6643092')]);

    const result = await geocode(QUERY);

    expect(result?.lat).toBeCloseTo(40.6643092);
    expect(result?.alternatives).toHaveLength(0);
  });
});
