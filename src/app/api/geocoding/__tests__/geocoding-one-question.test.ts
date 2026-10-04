/**
 * ΑΓΚΥΡΑ — **η αποθήκευση δεν ξαναρωτά ό,τι ρώτησε ο συντάκτης** (ADR-332 D29).
 *
 * 🔴 Μετρημένο ζωντανά 2026-10-04: `POST /api/projects/list` = **8,4″**. Ο συντάκτης είχε ήδη
 * τρέξει όλη τη σκάλα για την ίδια διεύθυνση· η αποθήκευση την ξανάτρεξε, βαθμίδα προς βαθμίδα,
 * με 1,1″ αναμονή ανάμεσα.
 *
 * Δύο ανεξάρτητες αιτίες, και η άγκυρα κρατά **και τις δύο**:
 * 1. **Τρεις κατασκευαστές ερωτήματος** (συντάκτης · χάρτης · αποθήκευση) έδιναν τρία ερωτήματα
 *    ⇒ τρία κλειδιά μνήμης. Τώρα ένας: `toGeocodingRequest`.
 * 2. **Το κλειδί της μνήμης ήταν ολόκληρη η διεύθυνση.** Ο συντάκτης δεν γνωρίζει δήμο· η
 *    αποθήκευση τον στέλνει ⇒ άλλο κλειδί, ενώ το αίτημα προς τον πάροχο είναι **κατά γράμμα το
 *    ίδιο URL**. Τώρα υπάρχει και μνήμη **βαθμίδας**, κλειδωμένη στο URL.
 *
 * ⚠️ **Εκτελεί την πραγματική μηχανή** και μετρά **αιτήματα προς τον πάροχο** — όχι κλειδιά. Ένας
 * έλεγχος ισότητας κλειδιών θα περνούσε και στη μέρα που η δεύτερη αιτία ξαναεμφανιζόταν.
 */

/* global describe, it, expect, beforeEach, afterEach, jest */

import { geocodeWithVerdict } from '../geocoding-engine';
import { clearGeocodingCache, geocodingCacheKey } from '../geocoding-cache';
import { sleep } from '@/lib/async-utils';
import { toGeocodingRequest } from '@/lib/geocoding/address-geocoding-query';

jest.mock('@/lib/async-utils', () => ({
  ...jest.requireActual('@/lib/async-utils'),
  sleep: jest.fn(() => Promise.resolve()),
}));

const sleepMock = sleep as jest.MockedFunction<typeof sleep>;
const ORIGINAL_FETCH = global.fetch;

/** Ο πάροχος απαντά σε **κάθε** αίτημα με το ίδιο σώμα. */
function mockProvider(body: unknown, ok = true): jest.Mock {
  const fetchMock = jest.fn().mockImplementation(() =>
    Promise.resolve({ ok, status: ok ? 200 : 429, json: () => Promise.resolve(body) } as Response),
  );
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const ONE_HIT = [
  {
    lat: '40.6403',
    lon: '22.9444',
    display_name: 'Τσιμισκή 43, Θεσσαλονίκη',
    class: 'building',
    type: 'yes',
    address: { road: 'Τσιμισκή', house_number: '43', postcode: '546 23', country_code: 'gr' },
  },
];

/** Ό,τι ξέρει ο **συντάκτης**: λεξιλόγιο `county`, κανένας δήμος, κενή χώρα, Τ.Κ. όπως γράφτηκε. */
const EDITOR_INPUT = {
  street: 'Τσιμισκή',
  number: '43',
  city: 'Θεσσαλονίκη',
  postalCode: '546 23',
  county: 'Περιφερειακή Ενότητα Θεσσαλονίκης',
  region: '',
  country: '',
};

/** Ό,τι στέλνει η **αποθήκευση**: λεξιλόγιο `regionalUnit`, **και δήμος**, χώρα ως κωδικός. */
const SAVED_ADDRESS = {
  street: 'Τσιμισκή',
  number: '43',
  city: 'Θεσσαλονίκη',
  postalCode: '54623',
  regionalUnit: 'Περιφερειακή Ενότητα Θεσσαλονίκης',
  municipality: 'Δήμος Θεσσαλονίκης',
  country: 'GR',
};

beforeEach(() => {
  clearGeocodingCache();
  sleepMock.mockClear();
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
});

describe('ΕΝΑ ερώτημα — ο κατασκευαστής', () => {
  it('Κ1 — η ίδια διεύθυνση δίνει το ΙΔΙΟ ερώτημα από τα δύο λεξιλόγια (county ⇄ regionalUnit)', () => {
    const editor = toGeocodingRequest(EDITOR_INPUT);
    const saved = toGeocodingRequest({ ...SAVED_ADDRESS, municipality: undefined });

    expect(editor).toEqual(saved);
    expect(geocodingCacheKey(editor)).toBe(geocodingCacheKey(saved));
  });

  it('Κ2 — «Greece», «Ελλάδα», «GR» και το κενό είναι η ΙΔΙΑ χώρα', () => {
    const keys = ['Greece', 'Ελλάδα', 'GR', '', undefined].map((country) =>
      geocodingCacheKey(toGeocodingRequest({ ...EDITOR_INPUT, country })),
    );
    expect(new Set(keys).size).toBe(1);
  });

  it('Κ3 — ο αριθμός μένει ΧΩΡΙΣΤΑ από την οδό, και τα προθέματα βαθμίδας φεύγουν', () => {
    const request = toGeocodingRequest(SAVED_ADDRESS);
    expect(request.street).toBe('Τσιμισκή');
    expect(request.number).toBe('43');
    expect(request.county).toBe('Θεσσαλονίκης');
    expect(request.municipality).toBe('Θεσσαλονίκης');
    expect(request.postalCode).toBe('54623');
    expect(request.country).toBe('GR');
  });

  it('Κ4 — άγνωστη χώρα μένει όπως γράφτηκε: δεν επινοείται κωδικός', () => {
    expect(toGeocodingRequest({ city: 'Κάπου', country: 'Ατλαντίδα' }).country).toBe('Ατλαντίδα');
  });
});

describe('ΕΝΑ ερώτημα — η μηχανή', () => {
  it('Μ1 — διεύθυνση που έλυσε ο συντάκτης: η αποθήκευση ΔΕΝ στέλνει κανένα αίτημα', async () => {
    const provider = mockProvider(ONE_HIT);

    const typed = await geocodeWithVerdict(toGeocodingRequest(EDITOR_INPUT));
    expect(typed.kind).toBe('hit');
    const afterTyping = provider.mock.calls.length;
    expect(afterTyping).toBe(1);

    // Άλλο κλειδί ετυμηγορίας (η αποθήκευση ξέρει δήμο) — το ΑΙΤΗΜΑ όμως είναι το ίδιο URL.
    const savedRequest = toGeocodingRequest(SAVED_ADDRESS);
    expect(geocodingCacheKey(savedRequest)).not.toBe(geocodingCacheKey(toGeocodingRequest(EDITOR_INPUT)));

    const saved = await geocodeWithVerdict(savedRequest);
    expect(saved.kind).toBe('hit');
    expect(provider.mock.calls.length).toBe(afterTyping);
  });

  it('Μ2 — διεύθυνση που ΔΕΝ λύνεται: η αποθήκευση δεν ξαναπληρώνει τις βαθμίδες που ρωτήθηκαν', async () => {
    const provider = mockProvider([]);

    const typed = await geocodeWithVerdict(toGeocodingRequest(EDITOR_INPUT));
    expect(typed.kind).toBe('absent');
    const typedUrls = new Set(provider.mock.calls.map((call) => String(call[0])));
    expect(typedUrls.size).toBeGreaterThan(1);

    provider.mockClear();
    sleepMock.mockClear();
    const saved = await geocodeWithVerdict(toGeocodingRequest(SAVED_ADDRESS));
    expect(saved.kind).toBe('absent');

    // Ό,τι ρωτήθηκε ήδη δεν ξαναρωτιέται· φεύγουν ΜΟΝΟ οι βαθμίδες που ο δήμος κάνει διαφορετικές.
    const savedUrls = provider.mock.calls.map((call) => String(call[0]));
    expect(savedUrls.filter((url) => typedUrls.has(url))).toEqual([]);
    expect(savedUrls.length).toBeLessThan(typedUrls.size);
    // Η αναμονή ευγένειας αφορά αιτήματα: το πολύ μία ανά αίτημα που πράγματι έφυγε.
    expect(sleepMock.mock.calls.length).toBeLessThanOrEqual(savedUrls.length);
  });

  it('Μ3 — η ίδια ακριβώς διεύθυνση δεύτερη φορά: μηδέν αιτήματα, μηδέν αναμονή', async () => {
    const provider = mockProvider([]);
    await geocodeWithVerdict(toGeocodingRequest(SAVED_ADDRESS));

    provider.mockClear();
    sleepMock.mockClear();
    await geocodeWithVerdict(toGeocodingRequest({ ...SAVED_ADDRESS, country: 'Ελλάδα', postalCode: '546 23' }));

    expect(provider).not.toHaveBeenCalled();
    expect(sleepMock).not.toHaveBeenCalled();
  });

  it('Μ4 — «ο πάροχος δεν απάντησε» ΔΕΝ μπαίνει στη μνήμη βαθμίδας: ξαναρωτιέται', async () => {
    const failing = mockProvider([], false);
    const first = await geocodeWithVerdict(toGeocodingRequest(EDITOR_INPUT));
    expect(first.kind).toBe('unavailable');
    const failedCalls = failing.mock.calls.length;
    expect(failedCalls).toBeGreaterThan(0);

    const recovered = mockProvider(ONE_HIT);
    const second = await geocodeWithVerdict(toGeocodingRequest(EDITOR_INPUT));
    expect(second.kind).toBe('hit');
    expect(recovered).toHaveBeenCalledTimes(1);
  });
});
