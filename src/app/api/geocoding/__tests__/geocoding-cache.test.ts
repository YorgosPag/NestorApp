/**
 * Ε — **Η μηχανή δεν ξαναρωτιέται για ό,τι ήδη ξέρει** (ADR-332 D27 Ζ5 · ADR-167).
 *
 * 🔴 **Η πολιτική του Nominatim το ΑΠΑΙΤΕΙ, δεν το προτείνει**: *«Results **must** be cached on your side.
 * Clients sending repeatedly the same query may be classified as faulty and **blocked**»*. Μέχρι σήμερα η
 * διαδρομή του διακομιστή (`geocoding-engine` ← `address-place-writeback`) δεν είχε **καμία** μνήμη: κάθε
 * αποθήκευση επαφής ξαναρωτούσε από την αρχή, **έως 8 παραλλαγές** με `sleep(1100ms)` ανάμεσά τους —
 * μετρημένο ζωντανά: **61,4 δευτερόλεπτα**.
 *
 * ⚠️ **Η μνήμη υπήρχε ήδη, στη ΛΑΘΟΣ πλευρά του συνόρου**: το `lib/geocoding/geocoding-service.ts` έχει cache
 * + in-flight dedup, αλλά είναι περιτύλιγμα **πελάτη** γύρω από το `/api/geocoding`. Η αποθήκευση καλεί τη
 * μηχανή **μέσα στη διεργασία** και δεν το βλέπει ποτέ. Επειδή πληκτρολόγηση **και** αποθήκευση καταλήγουν
 * στο ίδιο `geocodeWithVerdict`, μία μνήμη **εκεί** εξυπηρετεί και τις δύο.
 *
 * ── ΠΟΛΙΤΙΚΗ ΑΝΑ ΕΤΥΜΗΓΟΡΙΑ (το κρίσιμο σημείο) ──
 * - `hit` → μεγάλη διάρκεια: η θέση μιας διεύθυνσης είναι πρακτικά στατική.
 * - `absent` → **σύντομη** διάρκεια (αρνητική μνήμη, πρότυπο DNS negative TTL). Χωρίς αυτήν, μια διεύθυνση
 *   που **δεν** λύνεται πληρώνει **και τις 8 παραλλαγές σε ΚΑΘΕ αποθήκευση** — δηλαδή ακριβώς η χειρότερη
 *   περίπτωση των 61″ θα έμενε άθικτη. Σύντομη, ώστε μια διεύθυνση που μπαίνει στο OSM να βρεθεί σύντομα.
 * - `unavailable` → **ΠΟΤΕ**. «Δεν μπόρεσα να ρωτήσω» δεν είναι γνώση· ένα παροδικό 429 δεν επιτρέπεται να
 *   γίνει μόνιμη αλήθεια (ίδιος κανόνας με το `geocoding-service.ts`, όπου μόνο τα `found` μπαίνουν).
 */

/* global describe, it, expect, jest */

import { cachedGeocode, geocodingCacheKey } from '../geocoding-cache';
import { geocodeWithVerdict, sanitizeQuery, type GeocodeVerdict } from '../geocoding-engine';
import type { GeocodingApiResponse, GeocodingRequestBody } from '@/lib/geocoding/geocoding-types';

const RESULT = { latitude: 40.64, longitude: 22.94 } as unknown as GeocodingApiResponse;
const HIT: GeocodeVerdict = { kind: 'hit', result: RESULT };
const ABSENT: GeocodeVerdict = { kind: 'absent' };
const UNAVAILABLE: GeocodeVerdict = { kind: 'unavailable' };

/** Κάθε έλεγχος χρησιμοποιεί **δική του** διεύθυνση: η μνήμη είναι singleton της διεργασίας. */
let counter = 0;
function uniqueQuery(overrides: Partial<GeocodingRequestBody> = {}): GeocodingRequestBody {
  counter += 1;
  return { street: `Οδός ${counter}`, number: '1', city: 'Θεσσαλονίκη', country: 'Greece', ...overrides };
}

describe('Ε — μνήμη γεωκωδικοποίησης στη μηχανή', () => {
  it('Ε1 — δεύτερο ίδιο ερώτημα ⇒ η μηχανή ΔΕΝ ξαναρωτιέται', async () => {
    const query = uniqueQuery();
    const fetcher = jest.fn<Promise<GeocodeVerdict>, []>().mockResolvedValue(HIT);

    const first = await cachedGeocode(query, fetcher);
    const second = await cachedGeocode(query, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(first).toEqual(HIT);
    expect(second).toEqual(HIT);
  });

  it('Ε2 — το «δεν μπόρεσα να ρωτήσω» ΔΕΝ αποθηκεύεται ποτέ', async () => {
    // Ένα παροδικό 429 / πεσμένο δίκτυο δεν επιτρέπεται να παγώσει ως απάντηση: η επόμενη
    // αποθήκευση πρέπει να ξαναρωτήσει, αλλιώς η άγνοια γίνεται μόνιμη «γνώση».
    const query = uniqueQuery();
    const fetcher = jest.fn<Promise<GeocodeVerdict>, []>().mockResolvedValue(UNAVAILABLE);

    await cachedGeocode(query, fetcher);
    await cachedGeocode(query, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('Ε2β — το «ρωτήθηκε καθαρά και δεν υπάρχει» αποθηκεύεται (αρνητική μνήμη)', async () => {
    // Χωρίς αυτό, η ΧΕΙΡΟΤΕΡΗ περίπτωση (διεύθυνση που δεν λύνεται) πληρώνει και τις 8 παραλλαγές
    // σε κάθε αποθήκευση — το ακριβές σχήμα των 61,4″.
    const query = uniqueQuery();
    const fetcher = jest.fn<Promise<GeocodeVerdict>, []>().mockResolvedValue(ABSENT);

    await cachedGeocode(query, fetcher);
    const second = await cachedGeocode(query, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(second).toEqual(ABSENT);
  });

  it('Ε3 — δύο ΤΑΥΤΟΧΡΟΝΑ ίδια ερωτήματα ⇒ ΕΝΑ αίτημα (in-flight dedup)', async () => {
    // Δύο διευθύνσεις της ίδιας επαφής με ίδιο κείμενο λύνονται μέσα στην ίδια αποθήκευση.
    // Χωρίς dedup θα έφευγαν δύο ταυτόσημα αιτήματα — ακριβώς αυτό που η πολιτική λέει «faulty».
    const query = uniqueQuery();
    let release: (v: GeocodeVerdict) => void = () => undefined;
    const pending = new Promise<GeocodeVerdict>((resolve) => {
      release = resolve;
    });
    const fetcher = jest.fn<Promise<GeocodeVerdict>, []>().mockReturnValue(pending);

    const both = Promise.all([cachedGeocode(query, fetcher), cachedGeocode(query, fetcher)]);
    release(HIT);
    const [a, b] = await both;

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(a).toEqual(HIT);
    expect(b).toEqual(HIT);
  });

  it('Ε3β — μετά την ολοκλήρωση, η κράτηση in-flight ελευθερώνεται (καμία διαρροή)', async () => {
    const query = uniqueQuery();
    const failing = jest.fn<Promise<GeocodeVerdict>, []>().mockRejectedValueOnce(new Error('δίκτυο'));
    await expect(cachedGeocode(query, failing)).rejects.toThrow('δίκτυο');

    // Η αποτυχία δεν αφήνει κολλημένη υπόσχεση: το επόμενο ερώτημα ρωτά κανονικά.
    const recovering = jest.fn<Promise<GeocodeVerdict>, []>().mockResolvedValue(HIT);
    await expect(cachedGeocode(query, recovering)).resolves.toEqual(HIT);
    expect(recovering).toHaveBeenCalledTimes(1);
  });

  it('Ε4 — το κλειδί κανονικοποιεί κεφαλαία και κενά', () => {
    const query = uniqueQuery({ street: 'Τσιμισκή', city: 'Θεσσαλονίκη' });
    const noisy: GeocodingRequestBody = { ...query, street: '  ΤΣΙΜΙΣΚΉ  ', city: 'Θεσσαλονίκη ' };

    // Ίδια διεύθυνση γραμμένη αλλιώς = ίδιο ερώτημα προς το Nominatim ⇒ οφείλει να είναι ίδιο κλειδί.
    expect(geocodingCacheKey(noisy)).toBe(geocodingCacheKey(query));
  });

  it('Ε4δ — ΤΟΝΟΙ: διαφορετικός τονισμός ⇒ ΔΙΑΦΟΡΕΤΙΚΟ κλειδί', () => {
    // 🔴 Η μηχανή έχει **δική της** παραλλαγή «χωρίς τόνους» (attempt 4) ακριβώς επειδή το Nominatim
    // απαντά αλλιώς. Ένα κλειδί που ισοπεδώνει τους τόνους θα επέστρεφε την απάντηση **άλλου**
    // ερωτήματος — σιωπηλά λάθος θέση. Η κανονικοποίηση σταματά στα κεφαλαία και τα κενά.
    const accented = uniqueQuery({ city: 'Θεσσαλονίκη' });
    const bare = { ...accented, city: 'Θεσσαλονικη' };
    expect(geocodingCacheKey(bare)).not.toBe(geocodingCacheKey(accented));
  });

  it('Ε4β — διαφορετική χώρα ⇒ ΔΙΑΦΟΡΕΤΙΚΟ κλειδί', () => {
    const gr = uniqueQuery({ country: 'Greece' });
    const cy = { ...gr, country: 'Cyprus' };
    expect(geocodingCacheKey(cy)).not.toBe(geocodingCacheKey(gr));
  });

  it('Ε4γ — το κλειδί χτίζεται ΜΟΝΟ από τη διεύθυνση: καμία ταυτότητα μισθωτή/χρήστη', () => {
    // Η γεωκωδικοποίηση δημόσιας διεύθυνσης ΔΕΝ είναι δεδομένο πελάτη — η μνήμη είναι κοινή για όλους.
    // Αν ποτέ κάποιο πεδίο ταυτότητας τρυπώσει στο σώμα, ΔΕΝ επιτρέπεται να αλλάξει το κλειδί
    // (αλλιώς η μνήμη κατακερματίζεται ανά χρήστη και η πολιτική ξαναπαραβιάζεται).
    const query = uniqueQuery();
    const contaminated = {
      ...query,
      companyId: 'comp_secret',
      userId: 'user_secret',
    } as unknown as GeocodingRequestBody;

    const key = geocodingCacheKey(contaminated);
    expect(key).toBe(geocodingCacheKey(query));
    expect(key).not.toContain('comp_secret');
    expect(key).not.toContain('user_secret');
  });

  it('Ε6 — Η ΚΑΛΩΔΙΩΣΗ: δεύτερη ίδια κλήση της ΜΗΧΑΝΗΣ ⇒ κανένα νέο αίτημα δικτύου', async () => {
    // Χωρίς αυτό, το module θα μπορούσε να είναι τέλειο και **ασύνδετο** — πράσινο σε νεκρό δίδυμο.
    // Εδώ εκτελείται η πραγματική `geocodeWithVerdict` και μετριέται το `fetch`.
    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ lat: '40.6401', lon: '22.9444', display_name: 'Τσιμισκή, Θεσσαλονίκη' }]),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    try {
      const query = uniqueQuery();
      const first = await geocodeWithVerdict(query);
      const callsAfterFirst = fetchMock.mock.calls.length;
      const second = await geocodeWithVerdict(query);

      expect(first.kind).toBe('hit');
      expect(second.kind).toBe('hit');
      expect(callsAfterFirst).toBeGreaterThan(0);
      expect(fetchMock.mock.calls.length).toBe(callsAfterFirst); // καμία νέα κλήση
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('Ε5 — το κλειδί διαβάζει ΚΑΘΕ πεδίο που στέλνει η μηχανή στο Nominatim', () => {
    // 🔑 Ο φρουρός που κρατά τα δύο συγχρονισμένα. Αν αύριο προστεθεί πεδίο στο `sanitizeQuery`
    // (δηλαδή φύγει προς το Nominatim) και **δεν** μπει στο κλειδί, τότε δύο διαφορετικές
    // διευθύνσεις που διαφέρουν **μόνο** σε αυτό θα μοιράζονταν εγγραφή μνήμης — σιωπηλά λάθος θέση.
    const base = sanitizeQuery({});
    const fields = Object.keys(base) as (keyof typeof base)[];
    expect(fields.length).toBeGreaterThan(0);

    const query = uniqueQuery();
    for (const field of fields) {
      const changed = { ...query, [field]: `ΔΙΑΦΟΡΕΤΙΚΟ-${field}` };
      expect(geocodingCacheKey(changed)).not.toBe(geocodingCacheKey(query));
    }
  });
});
