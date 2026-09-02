/**
 * Unit tests for `geocoding-engine.ts` — ADR-332 Phase 0 multi-result behavior.
 *
 * Verifies:
 *   - Top result includes alternatives (up to 4) from the winning variant
 *   - resolvedFields populated from Nominatim address object
 *   - reasoning.attemptsLog tracks variants attempted (success/no-results/skipped)
 *   - reasoning.fieldMatches matrix correctly classifies match/mismatch/unknown/not-provided
 *   - partialMatch flag set when any user-provided field disagrees with Nominatim
 *   - source.variantUsed identifies which strategy produced the hit
 *
 * @see docs/centralized-systems/reference/adrs/ADR-332-enterprise-address-editor-system.md
 */

/* global describe, it, expect, beforeEach, afterEach, jest */

import { geocode } from '../geocoding-engine';

// =============================================================================
// FETCH MOCK HELPERS
// =============================================================================

interface NominatimMockResult {
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  class?: string;
  importance?: number;
  osm_id?: number;
  osm_type?: string;
  address?: {
    road?: string;
    house_number?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
}

const ORIGINAL_FETCH = global.fetch;

function mockFetchOnce(results: NominatimMockResult[], status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(results),
  } as Response);
}

function mockFetchSequence(...batches: NominatimMockResult[][]) {
  let i = 0;
  return jest.fn().mockImplementation(() => {
    const batch = batches[i] ?? [];
    i++;
    return mockFetchOnce(batch);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  // Speed-up: collapse the 1.2s NOMINATIM_DELAY_MS between variants
  jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
    fn();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  global.fetch = ORIGINAL_FETCH;
});

// =============================================================================
// FIXTURES
// =============================================================================

function fixtureSamothraki16Top(): NominatimMockResult {
  return {
    lat: '40.6234',
    lon: '22.9456',
    display_name: 'Σαμοθράκης 16, Θεσσαλονίκη 54635, Ελλάδα',
    type: 'building',
    class: 'building',
    importance: 0.42,
    osm_id: 12345678,
    osm_type: 'way',
    address: {
      road: 'Σαμοθράκης',
      house_number: '16',
      city: 'Θεσσαλονίκη',
      postcode: '54635',
      country: 'Ελλάδα',
      state: 'Κεντρική Μακεδονία',
    },
  };
}

/**
 * Μια εναλλακτική που είναι **όντως άλλη διεύθυνση** — ίδιο όνομα οδού, **άλλος δήμος**.
 *
 * 🔴 **ΤΟ ΠΑΛΙΟ FIXTURE ΗΤΑΝ ΤΡΟΦΗ ΠΟΥ Η ΠΑΡΑΓΩΓΗ ΔΕΝ ΠΑΡΑΓΕΙ**: γεννούσε τέσσερις
 * «εναλλακτικές» με **ίδια οδό, ίδιο αριθμό και ΤΑΥΤΟΣΗΜΕΣ συντεταγμένες**
 * (`40.6300/22.9500`), που διέφεραν **μόνο** στον ταχυδρομικό κώδικα. Αυτό δεν είναι
 * τέσσερις επιλογές — είναι η **ίδια πόρτα** γραμμένη τέσσερις φορές, και ένας κατάλογος
 * που τη ρωτούσε θα ζητούσε από τον άνθρωπο να ρίξει κορώνα-γράμματα.
 *
 * Η νέα μορφή είναι αντιγραφή **μετρημένης** απάντησης του Nominatim (02/09, «Αθηνάς 5»
 * χωρίς τοπωνύμιο): ίδιο οδώνυμο σε **πέντε δήμους**, 212-349 km μεταξύ τους.
 */
function fixtureSamothrakiElsewhere(
  city: string,
  postalCode: string,
  lat: string,
  lon: string,
  importance: number,
): NominatimMockResult {
  return {
    lat,
    lon,
    display_name: `Σαμοθράκης 16, ${city} ${postalCode}, Ελλάδα`,
    type: 'house',
    class: 'place',
    importance,
    osm_id: 99999000 + Number(postalCode),
    osm_type: 'way',
    address: {
      road: 'Σαμοθράκης',
      house_number: '16',
      city,
      postcode: postalCode,
      country: 'Ελλάδα',
      country_code: 'gr',
    },
  };
}

/** Οι τέσσερις μετρημένα-διακριτοί δήμοι, στη σειρά που τους δίνει ο πάροχος. */
const SAMOTHRAKI_ELSEWHERE: ReadonlyArray<readonly [string, string, string, string, number]> = [
  ['Λάρισα', '41222', '39.6390', '22.4191', 0.35],
  ['Καβάλα', '65403', '40.9396', '24.4069', 0.30],
  ['Καστοριά', '52100', '40.5167', '21.2667', 0.28],
  ['Ηγουμενίτσα', '46100', '39.5036', '20.2653', 0.25],
];

// =============================================================================
// TESTS
// =============================================================================

describe('geocode() — ADR-332 Phase 0 multi-result behavior', () => {
  it('returns top result + up to 4 alternatives from the winning variant', async () => {
    global.fetch = mockFetchSequence([
      fixtureSamothraki16Top(),
      ...SAMOTHRAKI_ELSEWHERE.map((args) => fixtureSamothrakiElsewhere(...args)),
    ]) as typeof fetch;

    const result = await geocode({
      street: 'Σαμοθράκης 16',
      city: 'Θεσσαλονίκη',
      postalCode: '54635',
      country: 'Ελλάδα',
    });

    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(40.6234);
    expect(result!.lng).toBeCloseTo(22.9456);
    expect(result!.alternatives).toHaveLength(4);
    expect(result!.alternatives[0].displayName).toContain('Λάρισα');
    expect(result!.alternatives[3].displayName).toContain('Ηγουμενίτσα');
  });

  it('populates resolvedFields from Nominatim address block', async () => {
    global.fetch = mockFetchSequence([fixtureSamothraki16Top()]) as typeof fetch;

    const result = await geocode({
      street: 'Σαμοθράκης 16',
      city: 'Θεσσαλονίκη',
      postalCode: '54635',
    });

    expect(result!.resolvedFields).toEqual({
      street: 'Σαμοθράκης',
      number: '16',
      postalCode: '54635',
      neighborhood: undefined,
      city: 'Θεσσαλονίκη',
      county: undefined,
      region: 'Κεντρική Μακεδονία',
      country: 'Ελλάδα',
    });
  });

  it('builds fieldMatches matrix correctly (match / mismatch / unknown / not-provided)', async () => {
    global.fetch = mockFetchSequence([fixtureSamothraki16Top()]) as typeof fetch;

    const result = await geocode({
      street: 'Σαμοθράκης',         // matches resolved 'Σαμοθράκης'
      city: 'Καλαμαριά',             // mismatch — resolved is 'Θεσσαλονίκη'
      postalCode: '54635',           // matches
      neighborhood: 'Ξηροκρήνη',     // unknown — Nominatim returned no neighborhood
      // county not provided
    });

    const matches = result!.reasoning.fieldMatches;
    expect(matches.street).toBe('match');
    expect(matches.city).toBe('mismatch');
    expect(matches.postalCode).toBe('match');
    expect(matches.neighborhood).toBe('unknown');
    expect(matches.county).toBe('not-provided');
  });

  it('flags partialMatch=true when any user field disagrees with resolved', async () => {
    global.fetch = mockFetchSequence([fixtureSamothraki16Top()]) as typeof fetch;

    const result = await geocode({
      street: 'Σαμοθράκης',
      city: 'Καλαμαριά',         // mismatch
      postalCode: '54635',
    });

    expect(result!.partialMatch).toBe(true);
  });

  it('flags partialMatch=false when all user fields match resolved', async () => {
    global.fetch = mockFetchSequence([fixtureSamothraki16Top()]) as typeof fetch;

    const result = await geocode({
      street: 'Σαμοθράκης',
      city: 'Θεσσαλονίκη',
      postalCode: '54635',
    });

    expect(result!.partialMatch).toBe(false);
  });

  it('records attemptsLog with success on the winning variant (variant 1 OSM-style)', async () => {
    global.fetch = mockFetchSequence([fixtureSamothraki16Top()]) as typeof fetch;

    const result = await geocode({
      street: 'Σαμοθράκης 16',
      city: 'Θεσσαλονίκη',
      postalCode: '54635',
    });

    const log = result!.reasoning.attemptsLog;
    expect(log).toHaveLength(1);
    expect(log[0].variant).toBe(1);
    expect(log[0].status).toBe('success');
    expect(log[0].i18nKey).toBe('addresses.geocoding.attempts.osmStyle');
  });

  it('records attemptsLog with no-results then success when variant 1 fails and variant 2 hits', async () => {
    global.fetch = mockFetchSequence(
      [],                            // variant 1 — no results
      [fixtureSamothraki16Top()],    // variant 2 — structured success
    ) as typeof fetch;

    const result = await geocode({
      street: 'Σαμοθράκης 16',
      city: 'Θεσσαλονίκη',
      postalCode: '54635',
    });

    const log = result!.reasoning.attemptsLog;
    expect(log.length).toBeGreaterThanOrEqual(2);
    expect(log[0].variant).toBe(1);
    expect(log[0].status).toBe('no-results');
    expect(log[1].variant).toBe(2);
    expect(log[1].status).toBe('success');
  });

  it('source.variantUsed reports which variant produced the top result', async () => {
    global.fetch = mockFetchSequence(
      [],                            // 1 fail
      [fixtureSamothraki16Top()],    // 2 success
    ) as typeof fetch;

    const result = await geocode({ street: 'Σαμοθράκης', city: 'Θεσσαλονίκη' });
    expect(result!.source.variantUsed).toBe(2);
    expect(result!.source.provider).toBe('nominatim');
  });

  it('returns null when ALL variants exhausted with no results', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    } as Response) as typeof fetch;

    const result = await geocode({
      street: 'Δεν Υπάρχει 999',
      city: 'Πουθενά',
      postalCode: '99999',
      country: 'Ελλάδα',
    });

    expect(result).toBeNull();
  });

  it('confidence breakdown reflects per-field contribution', async () => {
    global.fetch = mockFetchSequence([fixtureSamothraki16Top()]) as typeof fetch;

    const result = await geocode({
      street: 'Σαμοθράκης',
      city: 'Θεσσαλονίκη',
      postalCode: '54635',
    });

    const breakdown = result!.reasoning.confidenceBreakdown;
    expect(breakdown.base).toBeGreaterThan(0);
    expect(breakdown.streetMatch).toBeGreaterThan(0);
    expect(breakdown.cityMatch).toBeGreaterThan(0);
    expect(breakdown.postalMatch).toBeGreaterThan(0);
    expect(result!.confidence).toBeGreaterThan(0);
    expect(result!.confidence).toBeLessThanOrEqual(1);
  });

  it('alternatives carry their own resolvedFields and reasoning (with empty attemptsLog)', async () => {
    global.fetch = mockFetchSequence([
      fixtureSamothraki16Top(),
      fixtureSamothrakiElsewhere('Λάρισα', '41222', '39.6390', '22.4191', 0.35),
    ]) as typeof fetch;

    const result = await geocode({
      street: 'Σαμοθράκης',
      city: 'Θεσσαλονίκη',
      postalCode: '54635',
    });

    expect(result!.alternatives).toHaveLength(1);
    const alt = result!.alternatives[0];
    expect(alt.resolvedFields.postalCode).toBe('41222');
    expect(alt.reasoning.attemptsLog).toEqual([]);
    expect(alt.partialMatch).toBe(true); // user postal 54635 ≠ alt 41222
  });
});

// =============================================================================
// ΤΙ ΕΙΝΑΙ «ΕΝΑΛΛΑΚΤΙΚΗ» — ADR-332 §3.4 (2026-09-02)
// =============================================================================

/**
 * Οι τέσσερις σειρές που επέστρεψε **πραγματικά** ο Nominatim για
 * `q="Τσιμισκή 43, Θεσσαλονίκη, 54623"` με `limit=5` (ζωντανή μέτρηση 02/09).
 *
 * Δεν είναι τέσσερις διευθύνσεις — είναι **μία πόρτα και τα μαγαζιά της**, μέσα σε 57 m.
 * Οι συντεταγμένες και τα ονόματα είναι αντιγραμμένα από την απάντηση, όχι επινοημένα.
 */
const TSIMISKI_43_SAME_DOOR: ReadonlyArray<readonly [string, string, string]> = [
  ['Γενικό Προξενείο των ΗΠΑ, 43, Ιωάννη Τσιμισκή, Λαδάδικα, Θεσσαλονίκη, 546 23, Ελλάδα', '40.6331916', '22.9427856'],
  ['Μασούτης, 43, Ιωάννη Τσιμισκή, Λαδάδικα, 1η Κοινότητα Θεσσαλονίκης, 546 23, Ελλάδα', '40.6334732', '22.9433534'],
  ['ODEON Πλατεία, 43, Ιωάννη Τσιμισκή, Λαδάδικα, 1η Κοινότητα Θεσσαλονίκης, 546 23, Ελλάδα', '40.6335573', '22.9430297'],
  ['43, Ιωάννη Τσιμισκή, Λαδάδικα, 1η Κοινότητα Θεσσαλονίκης, 546 23, Ελλάδα', '40.6330851', '22.9426912'],
];

function tsimiskiRow(displayName: string, lat: string, lon: string): NominatimMockResult {
  return {
    lat,
    lon,
    display_name: displayName,
    type: 'house',
    class: 'place',
    importance: 0.4,
    osm_id: displayName.length,
    osm_type: 'node',
    address: {
      road: 'Ιωάννη Τσιμισκή',
      house_number: '43',
      city: 'Θεσσαλονίκη',
      postcode: '546 23',
      country: 'Ελλάδα',
      country_code: 'gr',
    },
  };
}

describe('geocode() — «εναλλακτική» σημαίνει άλλη ΔΙΕΥΘΥΝΣΗ, όχι άλλη σειρά', () => {
  it('συμπτύσσει τα POI της ίδιας πόρτας σε καμία εναλλακτική (μετρημένο: Τσιμισκή 43)', async () => {
    global.fetch = mockFetchSequence(
      TSIMISKI_43_SAME_DOOR.map(([name, lat, lon]) => tsimiskiRow(name, lat, lon)),
    ) as typeof fetch;

    const result = await geocode({
      street: 'Τσιμισκή',
      number: '43',
      city: 'Θεσσαλονίκη',
      postalCode: '54623',
      country: 'Ελλάδα',
    });

    // Ο κορυφαίος επιβιώνει — είναι η απάντηση. Οι άλλες τρεις σειρές ΕΙΝΑΙ ο κορυφαίος.
    expect(result!.displayName).toContain('Γενικό Προξενείο');
    expect(result!.alternatives).toHaveLength(0);
  });

  it('κρατά τις γνήσια διαφορετικές διευθύνσεις (μετρημένο: ίδιο οδώνυμο, άλλος δήμος)', async () => {
    global.fetch = mockFetchSequence([
      fixtureSamothraki16Top(),
      ...SAMOTHRAKI_ELSEWHERE.map((args) => fixtureSamothrakiElsewhere(...args)),
    ]) as typeof fetch;

    const result = await geocode({ street: 'Σαμοθράκης', number: '16', country: 'Ελλάδα' });

    expect(result!.alternatives.map((a) => a.resolvedFields.city)).toEqual([
      'Λάρισα', 'Καβάλα', 'Καστοριά', 'Ηγουμενίτσα',
    ]);
  });

  it('κόβει στις 4 ΜΕΤΑ τη σύμπτυξη — τα δίδυμα δεν τρώνε τη θέση των γνήσιων', async () => {
    global.fetch = mockFetchSequence([
      fixtureSamothraki16Top(),
      // δύο δίδυμα του κορυφαίου (ίδια πόρτα) πριν από τις γνήσιες
      { ...fixtureSamothraki16Top(), display_name: 'Καφενείο, Σαμοθράκης 16, Θεσσαλονίκη', lat: '40.62345' },
      { ...fixtureSamothraki16Top(), display_name: 'Φαρμακείο, Σαμοθράκης 16, Θεσσαλονίκη', lat: '40.62350' },
      ...SAMOTHRAKI_ELSEWHERE.map((args) => fixtureSamothrakiElsewhere(...args)),
    ]) as typeof fetch;

    const result = await geocode({ street: 'Σαμοθράκης', number: '16', country: 'Ελλάδα' });

    // Αν η κοπή γινόταν ΠΡΙΝ τη σύμπτυξη, οι δύο πρώτες θέσεις θα χάνονταν σε δίδυμα.
    expect(result!.alternatives).toHaveLength(4);
    expect(result!.alternatives[0].resolvedFields.city).toBe('Λάρισα');
    expect(result!.alternatives[3].resolvedFields.city).toBe('Ηγουμενίτσα');
  });

  it('πετά τις εναλλακτικές εκτός δηλωμένης χώρας, αλλά κρατά σημαιοδοτημένο τον κορυφαίο', async () => {
    const wheatland: NominatimMockResult = {
      lat: '42.6500', lon: '-88.4500',
      display_name: 'Town of Wheatland, Wisconsin, United States',
      type: 'administrative', class: 'boundary', importance: 0.55,
      osm_id: 77, osm_type: 'relation',
      address: { road: 'Ονειροπόλων', city: 'Wheatland', country: 'United States', country_code: 'us' },
    };
    global.fetch = mockFetchSequence([
      { ...wheatland, display_name: 'Wheatland A, Wisconsin' },
      { ...wheatland, display_name: 'Wheatland B, Wisconsin', lat: '43.1000' },
      { ...wheatland, display_name: 'Wheatland C, Wisconsin', lat: '43.5000' },
    ]) as typeof fetch;

    const result = await geocode({ street: 'Ονειροπόλων', postalCode: '54624', country: 'Ελλάδα' });

    // Ο κορυφαίος μένει ως ΕΞΗΓΗΣΗ (ADR-332 D12) — μηδενισμένος και σημαιοδοτημένος.
    expect(result!.outOfDeclaredCountry).toBe(true);
    expect(result!.confidence).toBe(0);
    // Οι υπόλοιπες θα ήταν «μήπως εννοούσες Ουισκόνσιν;» — δεν είναι επιλογές.
    expect(result!.alternatives).toHaveLength(0);
  });
});
