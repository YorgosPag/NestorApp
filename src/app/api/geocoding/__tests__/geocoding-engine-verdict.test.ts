/**
 * Άγκυρες της **ΕΤΥΜΗΓΟΡΙΑΣ** της μηχανής γεωκωδικοποίησης.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΦΥΛΑΝΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο `fetchNominatim` **καταπίνει** κάθε σφάλμα δικτύου και επιστρέφει `results: []`.
 * Άρα το ιστορικό `geocode()` απαντά **`null`** και για το «δεν υπάρχει» και για το
 * «δεν μπόρεσα να ρωτήσω». Ο γραφέας θέσης (`lib/geocoding/address-position.ts`)
 * **σβήνει** τη θέση στο πρώτο και **την κρατά** στο δεύτερο — οπότε αν η διάκριση
 * χαθεί, μια διακοπή του Nominatim **σβήνει σωστές θέσεις** σε κάθε αποθήκευση.
 *
 * ⚠️ Ο **ΠΑΡΟΝΟΜΑΣΤΗΣ** είναι η άγκυρα `Ε0`: αποδεικνύει ότι το ιστορικό `geocode()`
 * **όντως** ισοπεδώνει τις δύο περιπτώσεις. Χωρίς αυτήν, το «η ετυμηγορία τις
 * ξεχωρίζει» θα μπορούσε να είναι πράσινο επειδή **δεν υπήρξε ποτέ ισοπέδωση**.
 */

/* global describe, it, expect, beforeEach, afterEach, jest */

import { geocode, geocodeWithVerdict } from '../geocoding-engine';

const ORIGINAL_FETCH = global.fetch;

/** Καθαρή απάντηση «δεν βρέθηκε τίποτα» — HTTP 200, άδειος πίνακας. */
function respondEmpty(): void {
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => [],
  })) as unknown as typeof fetch;
}

/** Ο πάροχος **δεν απάντησε** — κάθε αίτημα πέφτει σε σφάλμα δικτύου. */
function respondNetworkError(): void {
  global.fetch = jest.fn(async () => {
    throw new Error('ECONNRESET');
  }) as unknown as typeof fetch;
}

/** Ο πάροχος **μας έκοψε** — HTTP 429. */
function respondRateLimited(): void {
  global.fetch = jest.fn(async () => ({
    ok: false,
    status: 429,
    json: async () => ({}),
  })) as unknown as typeof fetch;
}

const QUERY = { street: 'Εγνατίας', number: '147', city: 'Θεσσαλονίκη', country: 'Greece' };

describe('Ε — η ετυμηγορία της μηχανής', () => {
  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    jest.restoreAllMocks();
  });

  it('Ε0 — ΠΑΡΟΝΟΜΑΣΤΗΣ: το ιστορικό `geocode()` ισοπεδώνει ΚΑΙ ΤΙΣ ΔΥΟ σε `null`', async () => {
    respondEmpty();
    const absent = await geocode(QUERY);
    global.fetch = ORIGINAL_FETCH;

    respondNetworkError();
    const unavailable = await geocode(QUERY);

    // 🔴 Δύο ριζικά διαφορετικά γεγονότα, **μία** απάντηση. Αυτό είναι το ελάττωμα.
    expect(absent).toBeNull();
    expect(unavailable).toBeNull();
  }, 30_000);

  it('Ε1 — καθαρό «δεν βρέθηκε» ⇒ `absent`', async () => {
    respondEmpty();
    await expect(geocodeWithVerdict(QUERY)).resolves.toEqual({ kind: 'absent' });
  }, 30_000);

  it('Ε2 — σφάλμα δικτύου σε ΚΑΘΕ προσπάθεια ⇒ `unavailable`', async () => {
    respondNetworkError();
    await expect(geocodeWithVerdict(QUERY)).resolves.toEqual({ kind: 'unavailable' });
  }, 30_000);

  it('Ε3 — ρυθμιστής (429) σε ΚΑΘΕ προσπάθεια ⇒ `unavailable`, ΠΟΤΕ `absent`', async () => {
    respondRateLimited();
    await expect(geocodeWithVerdict(QUERY)).resolves.toEqual({ kind: 'unavailable' });
  }, 30_000);

  it('Ε4 — ΜΙΚΤΟ: έστω μία καθαρή «δεν βρέθηκε» ⇒ `absent` (κάτι μάθαμε)', async () => {
    let call = 0;
    global.fetch = jest.fn(async () => {
      call += 1;
      // Η πρώτη προσπάθεια απαντά καθαρά «τίποτα»· οι υπόλοιπες πέφτουν.
      if (call === 1) return { ok: true, status: 200, json: async () => [] } as unknown as Response;
      throw new Error('ECONNRESET');
    }) as unknown as typeof fetch;

    await expect(geocodeWithVerdict(QUERY)).resolves.toEqual({ kind: 'absent' });
  }, 30_000);

  it('Ε5 — επιτυχία ⇒ `hit`, και το ιστορικό `geocode()` δίνει ΤΟ ΙΔΙΟ αποτέλεσμα', async () => {
    const hitPayload = [
      {
        lat: '40.6401',
        lon: '22.9444',
        display_name: 'Εγνατίας 147, Θεσσαλονίκη',
        type: 'house',
        class: 'place',
        importance: 0.7,
        osm_id: 1,
        address: { road: 'Εγνατίας', house_number: '147', city: 'Θεσσαλονίκη' },
      },
    ];
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => hitPayload,
    })) as unknown as typeof fetch;

    const verdict = await geocodeWithVerdict(QUERY);
    expect(verdict.kind).toBe('hit');

    const legacy = await geocode(QUERY);
    // Ο προσαρμογέας δεν αλλάζει τίποτα για τους τρεις υπάρχοντες καλούντες.
    expect(legacy).not.toBeNull();
    expect(legacy?.lat).toBe(verdict.kind === 'hit' ? verdict.result.lat : NaN);
  }, 30_000);
});
