/**
 * ΑΓΚΥΡΑ — **η μηχανή υποχωρεί στους ανθρώπους, οι άνθρωποι δεν περιμένουν ποτέ** (ADR-332 §D33).
 *
 * Η πολιτική χρήσης του Nominatim: το πολύ 1 αίτημα/δευτ. Η σάρωση το τηρεί μόνη της· οι κλήσεις των
 * ανθρώπων δεν καθυστερούν (η αποθήκευση έχει προθεσμία 9″), αλλά μετρούν — ώστε η μηχανή να μη
 * ρωτήσει πάνω σε ριπή ανθρώπου.
 */

import { NOMINATIM_BACKGROUND_INTERVAL_MS, inBackgroundGeocodingLane, paceNominatimRequest } from '../nominatim-pacer';

jest.mock('server-only', () => ({}));

let clock = 1_000_000;
const now = () => clock;

beforeEach(() => {
  jest.useFakeTimers();
  clock += 60_000; // κάθε test ξεκινά μακριά από την τελευταία κλήση του προηγούμενου
});

afterEach(() => {
  jest.useRealTimers();
});

/** Προωθεί ΚΑΙ το ρολόι του ρυθμιστή ΚΑΙ τους χρονοδιακόπτες. */
async function advance(ms: number): Promise<void> {
  clock += ms;
  await jest.advanceTimersByTimeAsync(ms);
}

describe('Ρ — δύο λωρίδες, μία μνήμη', () => {
  it('Ρ1 — ανθρώπινη λωρίδα: δύο κλήσεις στη σειρά, ΚΑΜΙΑ αναμονή', async () => {
    await paceNominatimRequest(now);
    let second = false;
    void paceNominatimRequest(now).then(() => { second = true; });
    await jest.advanceTimersByTimeAsync(0);
    expect(second).toBe(true);
  });

  it('Ρ2 — παρασκήνιο αμέσως μετά από άνθρωπο ⇒ περιμένει ΟΛΟ το διάστημα', async () => {
    await paceNominatimRequest(now);
    let done = false;
    void inBackgroundGeocodingLane(() => paceNominatimRequest(now)).then(() => { done = true; });

    await advance(NOMINATIM_BACKGROUND_INTERVAL_MS - 1);
    expect(done).toBe(false);
    await advance(1);
    expect(done).toBe(true);
  });

  it('Ρ3 — δύο κλήσεις παρασκηνίου ⇒ η δεύτερη ΜΕΤΑ το διάστημα (≤1 αίτημα/δευτ.)', async () => {
    await inBackgroundGeocodingLane(() => paceNominatimRequest(now));
    let done = false;
    void inBackgroundGeocodingLane(() => paceNominatimRequest(now)).then(() => { done = true; });

    await advance(NOMINATIM_BACKGROUND_INTERVAL_MS - 1);
    expect(done).toBe(false);
    await advance(1);
    expect(done).toBe(true);
  });

  it('Ρ4 — η λωρίδα ΔΕΝ διαρρέει: κλήση έξω από το `inBackgroundGeocodingLane` μένει ανθρώπινη', async () => {
    await inBackgroundGeocodingLane(() => paceNominatimRequest(now));
    let human = false;
    void paceNominatimRequest(now).then(() => { human = true; });
    await jest.advanceTimersByTimeAsync(0);
    expect(human).toBe(true);
  });
});
