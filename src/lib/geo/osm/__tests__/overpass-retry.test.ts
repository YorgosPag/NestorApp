/**
 * @fileoverview **ΑΓΚΥΡΑ — «ΑΛΛΟΤΕ ΤΟ ΕΝΤΟΠΙΖΕΙ ΚΑΙ ΑΛΛΟΤΕ ΟΧΙ».**
 * @related lib/geo/osm/overpass-client.ts · ADR-777 §13.4 (ODbL) · §13.6
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΑΝΑΦΟΡΑ ΠΟΥ ΤΟ ΓΕΝΝΗΣΕ (Giorgio, 2026-09-02)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * *«Όταν πατάω “Διάλεξε κτίριο από τον χάρτη” και κάνω κλικ στο ίδιο σημείο, άλλοτε το
 * εντοπίζει και άλλοτε όχι.»*
 *
 * Το ερώτημα είναι **μικρό και σταθερό**. Ό,τι άλλαζε ήταν ο **κοινός** διακομιστής:
 * `429` όταν γεμίσουν τα slots της IP, `504` υπό φόρτο, ή απάντηση πιο αργή από το δικό
 * μας χρονόμετρο. Και οι τρεις σήμαιναν «ξαναρώτα» — αλλά **το ξαναρώτημα το πλήρωνε ο
 * άνθρωπος**.
 *
 * ⚠️ **Η ΜΗ ΕΠΑΝΑΛΗΨΗ ΕΙΝΑΙ ΕΞΙΣΟΥ ΑΓΚΥΡΩΜΕΝΗ ΜΕ ΤΗΝ ΕΠΑΝΑΛΗΨΗ.** Το §13.4 (ODbL)
 * στηρίζεται στο ότι κάθε κλήση αντιστοιχεί σε **μία ανθρώπινη χειρονομία**· μια
 * υλοποίηση που ξαναρωτά σε **κάθε** αποτυχία — ή χωρίς όριο — θα διέβρωνε ακριβώς
 * αυτή την άμυνα. Γι' αυτό ο **παρονομαστής** (Κ2) δεν είναι προαιρετικός.
 */

/* global describe, it, expect, beforeEach, afterEach, jest */

import { runOverpassQueryStrict } from '../overpass-client';

const ORIGINAL_FETCH = global.fetch;

/** Καθαρή επιτυχία — ένα στοιχείο, για να ξεχωρίζει από το «κενό». */
const okBody = { elements: [{ type: 'way', id: 1 }] };

function respondWith(...responses: readonly { status: number; headers?: Record<string, string> }[]) {
  const calls = responses.map((spec) => ({
    ok: spec.status >= 200 && spec.status < 300,
    status: spec.status,
    headers: new Headers(spec.headers ?? {}),
    json: async () => okBody,
  }));
  const fetchMock = jest.fn(async () => calls.shift() ?? calls[calls.length - 1]);
  global.fetch = fetchMock as unknown as typeof global.fetch;
  return fetchMock;
}

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['performance'] });
});

afterEach(() => {
  jest.useRealTimers();
  global.fetch = ORIGINAL_FETCH;
});

/** Τρέχει το ερώτημα **και** ξετυλίγει τους χρονιστές της αναμονής. */
async function runWithTimers(): Promise<Awaited<ReturnType<typeof runOverpassQueryStrict>>> {
  const promise = runOverpassQueryStrict('[out:json];out;');
  await jest.runAllTimersAsync();
  return promise;
}

// =============================================================================
// Κ1 — ΤΟ ΠΕΡΑΣΤΙΚΟ ΕΜΠΟΔΙΟ ΔΕΝ ΦΤΑΝΕΙ ΣΤΟΝ ΑΝΘΡΩΠΟ
// =============================================================================

describe('Κ1 — ό,τι σημαίνει «ξαναρώτα», ξαναρωτιέται', () => {
  /** ⛔ ΜΕΤΑΛΛΑΞΗ: βγάλε τον βρόχο επανάληψης ⇒ **κόκκινο**. */
  it('🔴 ένα 429 δεν γίνεται «δεν υπάρχει κτίριο» — η δεύτερη προσπάθεια πετυχαίνει', async () => {
    const fetchMock = respondWith({ status: 429 }, { status: 200 });

    const outcome = await runWithTimers();

    expect(outcome.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('🔴 και το 504 (φόρτος) το ίδιο', async () => {
    const fetchMock = respondWith({ status: 504 }, { status: 200 });

    expect((await runWithTimers()).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  /**
   * 🔑 **Η ΣΥΧΝΟΤΕΡΗ ΠΕΡΙΠΤΩΣΗ ΤΗΣ ΑΝΑΦΟΡΑΣ**: ο διακομιστής δεν απαντά καθόλου μέσα
   * στο χρονόμετρό μας. Ένα `AbortError` δεν έχει κωδικό κατάστασης — και μια
   * υλοποίηση που κρίνει την επαναληψιμότητα **μόνο** από status θα το έχανε.
   */
  it('🔴 λήξη χρόνου / σφάλμα δικτύου είναι ΕΠΑΝΑΛΗΨΙΜΑ', async () => {
    let call = 0;
    global.fetch = jest.fn(async () => {
      call += 1;
      if (call === 1) throw new Error('The operation was aborted due to timeout');
      return { ok: true, status: 200, headers: new Headers(), json: async () => okBody };
    }) as unknown as typeof global.fetch;

    expect((await runWithTimers()).ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

// =============================================================================
// Κ2 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ΤΟ ΟΡΙΟ ΤΟΥ §13.4 ΕΙΝΑΙ ΑΓΚΥΡΩΜΕΝΟ
// =============================================================================

describe('Κ2 — η επανάληψη έχει ΟΡΙΟ, και δεν είναι καθολική', () => {
  /**
   * 🔴 **Η ΑΜΥΝΑ ΤΟΥ ODbL ΕΙΝΑΙ ΑΡΙΘΜΟΣ.** Χωρίς αυτή την άγκυρα, ένας μελλοντικός
   * «θα ξαναρωτάμε μέχρι να τα καταφέρει» θα περνούσε την Κ1 θριαμβευτικά και θα
   * μετέτρεπε μία ανθρώπινη χειρονομία σε απεριόριστες κλήσεις.
   */
  it('🔴 σταματά στις 3 προσπάθειες — ποτέ ατέρμονα', async () => {
    const fetchMock = respondWith({ status: 429 }, { status: 429 }, { status: 429 });

    const outcome = await runWithTimers();

    expect(outcome.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  /**
   * 🔑 **Ένα 400 δεν γίνεται καλό επειδή περιμέναμε.** Η επανάληψή του είναι σπατάλη
   * πόρων του κοινού διακομιστή για βεβαιότητα που ήδη έχουμε — και ακριβώς το είδος
   * κίνησης που το §13.4 μας ζητά να μην παράγουμε.
   */
  it('🔴 μη επαναλήψιμο σφάλμα σταματά ΑΜΕΣΩΣ, με μία μόνο κλήση', async () => {
    const fetchMock = respondWith({ status: 400 }, { status: 200 });

    const outcome = await runWithTimers();

    expect(outcome.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('🔑 και η επιτυχία δεν ξαναρωτά ΠΟΤΕ — μία χειρονομία, μία κλήση', async () => {
    const fetchMock = respondWith({ status: 200 });

    expect((await runWithTimers()).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// Κ3 — Ο ΔΙΑΚΟΜΙΣΤΗΣ ΞΕΡΕΙ ΚΑΛΥΤΕΡΑ, ΑΛΛΑ ΟΧΙ ΑΠΕΡΙΟΡΙΣΤΑ
// =============================================================================

describe('Κ3 — το `Retry-After` τιμάται, με ταβάνι', () => {
  /**
   * 🔑 Ο διακομιστής ξέρει πότε θα έχει θέση καλύτερα από κάθε εκθετική φόρμουλα. Αλλά
   * ένα «σε 60 δευτερόλεπτα» δεν το περιμένει **κανείς άνθρωπος** με έναν δείκτη
   * φόρτωσης μπροστά του: πάνω από το ταβάνι, η ειλικρινής απάντηση είναι «δεν
   * απάντησε» — που η οθόνη ήδη ξέρει να πει.
   */
  it('🔴 δεν κρατά τον άνθρωπο σε αναμονή όσο ζητήσει ο διακομιστής', async () => {
    respondWith({ status: 429, headers: { 'retry-after': '60' } }, { status: 200 });

    const promise = runOverpassQueryStrict('[out:json];out;');
    // Το ταβάνι είναι 3 s· αν το «60» τιμούνταν αυτούσιο, τίποτα δεν θα είχε συμβεί.
    await jest.advanceTimersByTimeAsync(3_100);

    expect((await promise).ok).toBe(true);
  });
});
