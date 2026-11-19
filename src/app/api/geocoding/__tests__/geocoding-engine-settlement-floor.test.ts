/**
 * @fileoverview Άγκυρες του **πάτου της σκάλας** — βαθμίδες 10/11 (οικισμός σε δημοτική) και 12 (μόνο Τ.Κ.).
 * @related app/api/geocoding/geocoding-ladder · utils/address/place-name · ADR-332 D31
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΦΥΛΑΝΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μετρημένο ζωντανά 2026-11-19: η έδρα «6,5 χλμ Θεσσαλονίκης - Ωραιοκάστρου · ΒΙ.ΠΕ. Ωραιοκάστρου ·
 * 570 13 · Ωραιόκαστρον» ⇒ `404`, και ο χάρτης έδειχνε την **Αθήνα**. Το OSM ξέρει «Ωραιόκαστρο»
 * (`«Ωραιόκαστρο, 570 13»` ⇒ `place/city`), όχι «Ωραιόκαστρον» (⇒ 0), και ο Τ.Κ. μόνος του λύνεται.
 *
 * 🔴 **Οι ΑΡΝΗΤΙΚΕΣ (Β2, Β3, Β5) είναι η ουσία**: ένας πάτος που δέχεται τυφλά είναι χειρότερος από
 * κανέναν — μετρημένο, το «ΒΙ.ΠΕ. Ωραιοκάστρου, 570 13» επιστρέφει γραφείο στην **Καλλιθέα** (574 00).
 */

/* global describe, it, expect, beforeEach, afterEach, jest */

import { geocode, geocodeWithVerdict } from '../geocoding-engine';
import { clearGeocodingCache } from '../geocoding-cache';

const ORIGINAL_FETCH = global.fetch;

const HQ = {
  street: '6,5 χλμ Θεσσαλονίκης - Ωραιοκάστρου',
  neighborhood: 'ΒΙ.ΠΕ. Ωραιοκάστρου',
  postalCode: '570 13',
  city: 'Ωραιόκαστρον',
  country: 'Ελλάδα',
};
const SETTLEMENT_Q = 'Ωραιόκαστρο, 570 13';
const POSTCODE_Q = '570 13';

interface Candidate {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  class: string;
  type: string;
  place_rank: number;
  address: { town?: string; postcode?: string; country_code?: string };
}

function town(name: string, postcode: string | undefined, lat = '40.7259058'): Candidate {
  return {
    lat,
    lon: '22.9189694',
    display_name: `${name}, Δήμος Ωραιοκάστρου, Ελλάς`,
    name,
    class: 'place',
    type: 'city',
    place_rank: 16,
    address: { town: name, country_code: 'gr', ...(postcode === undefined ? {} : { postcode }) },
  };
}

function postcodeArea(postcode: string): Candidate {
  return {
    lat: '40.7215095',
    lon: '22.9160208',
    display_name: `${postcode}, Δημοτική Ενότητα Ωραιοκάστρου, Ελλάς`,
    name: postcode,
    class: 'place',
    type: 'postcode',
    place_rank: 21,
    address: { postcode, country_code: 'gr' },
  };
}

/** Απαντά **μόνο** στα ερωτήματα του χάρτη· σε κάθε άλλο, άδειος πίνακας. */
function respond(byQuery: Record<string, Candidate[]>): jest.Mock {
  const mock = jest.fn(async (url: string) => {
    const q = new URL(url).searchParams.get('q') ?? '';
    return { ok: true, status: 200, json: async () => byQuery[q] ?? [] };
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

describe('Β — ο πάτος της σκάλας (ADR-332 D31)', () => {
  it('Β1 — το περιστατικό: ο οικισμός λύνεται στη ΔΗΜΟΤΙΚΗ μορφή, με δηλωμένη χαλάρωση', async () => {
    respond({ [SETTLEMENT_Q]: [town('Ωραιόκαστρο', '570 13')] });

    const result = await geocode(HQ);

    expect(result?.source.variantUsed).toBe(10);
    expect(result?.lat).toBeCloseTo(40.7259058);
    expect(result?.reasoning.relaxation).toEqual({ dropped: ['street', 'neighborhood'], anchor: 'locality' });
    expect(result?.reasoning.fieldMatches.city).toBe('match'); // «Ωραιόκαστρον» ⇄ «Ωραιόκαστρο»
  });

  it('Β2 — 🔴 ίδιο όνομα, ΑΛΛΟΣ Τ.Κ. (το Ωραιόκαστρο της Πρέβεζας) ⇒ απορρίπτεται, πέφτει στη 12', async () => {
    respond({ [SETTLEMENT_Q]: [town('Ωραιόκαστρο', '481 00')], [POSTCODE_Q]: [postcodeArea('570 13')] });

    const result = await geocode(HQ);

    expect(result?.source.variantUsed).toBe(12);
    expect(result?.reasoning.relaxation).toEqual({
      dropped: ['street', 'neighborhood', 'city'],
      anchor: 'postalCode',
    });
    expect(result?.reasoning.attemptsLog.find((a) => a.variant === 10)?.status).toBe('no-results');
  });

  it('Β3 — 🔴 σωστός Τ.Κ. αλλά ΑΛΛΟΣ τόπος στη 10 ⇒ απορρίπτεται (απόδειξη τόπου, όχι μόνο Τ.Κ.)', async () => {
    respond({ [SETTLEMENT_Q]: [town('Νεοχωρούδα', '570 13')] });

    await expect(geocodeWithVerdict(HQ)).resolves.toEqual({ kind: 'absent' });
  });

  it('Β4 — υποψήφιος οικισμού ΧΩΡΙΣ Τ.Κ. δεν διαψεύδει: γίνεται δεκτός με την απόδειξη τόπου', async () => {
    respond({ [SETTLEMENT_Q]: [town('Ωραιόκαστρο', undefined)] });

    const result = await geocode(HQ);

    expect(result?.source.variantUsed).toBe(10);
  });

  it('Β5 — 🔴 η 12 δέχεται ΜΟΝΟ τον ίδιο Τ.Κ.', async () => {
    respond({ [POSTCODE_Q]: [postcodeArea('574 00')] });

    await expect(geocodeWithVerdict(HQ)).resolves.toEqual({ kind: 'absent' });
  });

  it('Β6 — η 11 ρωτά τη ΔΕΥΤΕΡΗ δημοτική μορφή («-ιο») μόνο όταν υπάρχει', async () => {
    const mock = respond({ 'Προσήλιο': [{ ...town('Προσήλιο', undefined), address: { country_code: 'gr' } }] });

    const result = await geocode({ city: 'Προσήλιον' });

    expect(result?.source.variantUsed).toBe(11);
    expect(askedQueries(mock)).toContain('Προσήλι'); // πρώτα η μετρημένα πιθανότερη
    expect(result?.reasoning.relaxation).toBeUndefined(); // δεν αφαιρέθηκε τίποτα — μόνο εκσυγχρονίστηκε
  });

  it('Β7 — ΠΑΡΟΝΟΜΑΣΤΗΣ: ερώτημα ταυτόσημο με της 1 δεν ξαναστέλνεται (πολιτική OSMF)', async () => {
    const mock = respond({});

    await geocodeWithVerdict({ city: 'Ωραιόκαστρο', postalCode: '57013' });

    const asked = askedQueries(mock);
    expect(asked.filter((q) => q === 'Ωραιόκαστρο, 57013')).toHaveLength(1); // μόνο η 1, όχι και η 10
    expect(asked).toContain('57013'); // η 12 ρωτήθηκε
  });

  it('Β8 — σειρά: 9 → 10 → 11 → 12, ΠΡΙΝ από τη χαλάρωση χώρας (7/8)', async () => {
    respond({ 'Ωραιόκαστρον': [town('Ωραιόκαστρον', '570 13')] }); // επιτυχία στην 8, για να υπάρχει ημερολόγιο

    const result = await geocode(HQ);

    expect(result?.reasoning.attemptsLog.map((a) => a.variant)).toEqual([1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 7, 8]);
  });
});
