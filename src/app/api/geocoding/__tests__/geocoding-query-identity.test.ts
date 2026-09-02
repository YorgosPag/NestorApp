/**
 * @fileoverview ΑΓΚΥΡΑ ΜΗ-ΠΑΛΙΝΔΡΟΜΗΣΗΣ — **η παραλλαγή που απαντά ρωτά ΤΟ ΙΔΙΟ πράγμα**.
 * @related lib/geocoding/address-line-query · utils/address/address-parse · ADR-777 §7 (Α14)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ, ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΑΡΚΟΥΣΕ ΝΑ ΤΟ ΓΡΑΨΟΥΜΕ ΣΕ ΣΧΟΛΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο εντοπισμός τόπου άλλαξε από *«όλο το κείμενο στο πεδίο `city`»* σε **δομημένα
 * πεδία**. Η αλλαγή αγγίζει **κάθε** αναζήτηση διεύθυνσης της εφαρμογής (προσφορά Α14,
 * ζήτηση Α9, επαλήθευση πηγής) — δηλαδή αν χαλάσει, χαλάει σιωπηλά και παντού.
 *
 * 🔑 **Ο ισχυρισμός ασφαλείας είναι συγκεκριμένος και ελέγξιμος**: η **παραλλαγή 1**
 * (`toOsmStyleQuery`, free-form) είναι αυτή που πετυχαίνει σχεδόν πάντα, και τα νέα
 * πεδία ανασυνθέτουν **την ίδια ακριβώς συμβολοσειρά ερωτήματος**. Άρα το αποτέλεσμα
 * που βλέπει ο άνθρωπος **δεν μπορεί** να αλλάξει· αλλάζουν μόνο οι παραλλαγές 2–5,
 * που σήμερα δέχονταν παράλογη είσοδο.
 *
 * ⚠️ **Η άγκυρα ΕΚΤΕΛΕΙ την πραγματική μηχανή** (`geocode`), δεν ξαναγράφει τη σύνθεση
 * του ερωτήματος. Μια δοκιμή που έφτιαχνε μόνη της την αναμενόμενη συμβολοσειρά θα
 * ήταν **δεύτερη υλοποίηση** του `toOsmStyleQuery` — και θα έμενε πράσινη ακριβώς
 * όταν οι δύο απέκλιναν.
 */

/* global describe, it, expect, beforeEach, afterEach, jest */

import { geocode } from '../geocoding-engine';
import { addressLineToQuery } from '@/lib/geocoding/address-line-query';

// =============================================================================
// ΑΡΜΑ ΔΟΚΙΜΗΣ
// =============================================================================

const ORIGINAL_FETCH = global.fetch;

/** Ένα αποτέλεσμα αρκεί: η παραλλαγή 1 πετυχαίνει και η μηχανή σταματά εκεί. */
function mockFetchHit(): jest.Mock {
  return jest.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve([
          { lat: '40.6403', lon: '22.9444', display_name: 'x', class: 'highway', type: 'residential' },
        ]),
    } as Response),
  );
}

/** Η παράμετρος `q` της πρώτης κλήσης — δηλαδή **τι ρωτήθηκε πραγματικά**. */
function firstFreeformQuery(fetchMock: jest.Mock): string | null {
  const url = new URL(String(fetchMock.mock.calls[0][0]));
  return url.searchParams.get('q');
}

async function queryFor(body: Parameters<typeof geocode>[0]): Promise<string | null> {
  const fetchMock = mockFetchHit();
  global.fetch = fetchMock as unknown as typeof fetch;
  await geocode(body);
  return firstFreeformQuery(fetchMock);
}

beforeEach(() => {
  jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
    fn();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout);
});

afterEach(() => {
  jest.restoreAllMocks();
  global.fetch = ORIGINAL_FETCH;
});

// =============================================================================
// Κ1 — ΤΑΥΤΟΤΗΤΑ: παλιό σχήμα ⇄ νέο σχήμα, ΙΔΙΟ ερώτημα
// =============================================================================

describe('Κ1 — η παραλλαγή 1 ρωτά ταυτόσημα πριν και μετά τη δόμηση', () => {
  it.each([
    ['Σαμοθράκης 16, 56334'],
    ['Εγνατίας 147, Θεσσαλονίκη'],
    ['Τσιμισκή 43, Θεσσαλονίκη, 54623'],
    ['25ης Μαρτίου 12, Εύοσμος'],
    ['Θεσσαλονίκη'],
    ['Ερμού, Αθήνα'],
  ])('«%s»', async (raw) => {
    const before = await queryFor({ city: raw });
    const after = await queryFor(addressLineToQuery(raw));

    expect(after).toBe(before);
  });
});

// =============================================================================
// Κ2 — ΤΟ ΚΕΡΔΟΣ: ο αριθμός φτάνει ΔΟΜΗΜΕΝΟΣ στο δομημένο variant
// =============================================================================

describe('Κ2 — ο αριθμός φτάνει πλέον στο πεδίο του', () => {
  /**
   * ⛔ ΜΕΤΑΛΛΑΞΗ: γύρνα το `addressLineToQuery` σε `{ city: raw }` ⇒ **κόκκινο**.
   *
   * 🔑 Το `street` του Nominatim θέλει «<αριθμός> <όνομα>» — αυτό το κάνει ο
   * `composeStreet` της μηχανής. Εδώ ελέγχεται ότι **έχει τι να συνθέσει**.
   */
  it('το δομημένο variant παίρνει street=«16 Σαμοθράκης», όχι ολόκληρο το κείμενο', async () => {
    const fetchMock = jest.fn().mockImplementation(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) } as Response),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await geocode(addressLineToQuery('Σαμοθράκης 16, 56334'));

    const structured = fetchMock.mock.calls
      .map((call) => new URL(String(call[0])))
      .find((url) => url.searchParams.has('street'));

    expect(structured?.searchParams.get('street')).toBe('16 Σαμοθράκης');
  });

  it('🔴 ο Τ.Κ. ΔΕΝ γίνεται δομημένο φίλτρο — ADR-332 D13, αφαιρεί μόνο', async () => {
    const fetchMock = jest.fn().mockImplementation(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) } as Response),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await geocode(addressLineToQuery('Σαμοθράκης 16, 56334'));

    const urls = fetchMock.mock.calls.map((call) => new URL(String(call[0])));
    expect(urls.some((url) => url.searchParams.has('postalcode'))).toBe(false);
  });
});

// =============================================================================
// Κ3 — Η ΣΤΑΣΗ ΤΟΥ ΑΡΙΘΜΟΥ: το συμβόλαιο πάνω στο οποίο στέκεται η πρόταση της οθόνης
// =============================================================================

/**
 * 🔴 **ΓΙΑΤΙ ΖΕΙ ΕΔΩ**: αυτό το κριτήριο φυλαγόταν από το
 * `geocoding-number-escalation.test.ts`, που **διαγράφηκε** μαζί με την κλιμάκωση όταν
 * η μέτρηση την απέρριψε (ADR-777 §8.47). Η κλιμάκωση έφυγε· **το συμβόλαιο έμεινε** —
 * και χωρίς άγκυρα θα ήταν αφύλαχτο ακριβώς όσο ήταν πριν από αυτή τη δουλειά.
 *
 * 🔑 Η πρόταση *«Ο αριθμός «16» καταχωρήθηκε, αλλά δεν τον επιβεβαιώνουν τα δεδομένα
 * του χάρτη»* παράγεται **αποκλειστικά** από το `fieldMatches.number`. Αν αυτό γυρίσει
 * ξανά σε `'not-provided'` — που ήταν η **μόνιμη** τιμή του πριν από το
 * {@link addressLineToQuery} — η οθόνη **σιωπά**, ακριβώς όπως σιωπούσε.
 */
describe('Κ3 — ο δηλωμένος αριθμός είναι διακριτός από τον ανύπαρκτο', () => {
  const withFetch = (results: unknown[]): void => {
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(results) } as Response),
    ) as unknown as typeof fetch;
  };

  /** Ο δρόμος: ο πάροχος απαντά **χωρίς** `addr:housenumber`. */
  const STREET_ONLY = {
    lat: '40.6700', lon: '22.9100', display_name: 'Σαμοθράκης, Εύοσμος',
    class: 'highway', type: 'residential', place_rank: 26,
    address: { road: 'Σαμοθράκης', city: 'Θεσσαλονίκη' },
  };

  it('🔴 δηλωμένος + ανεπιβεβαίωτος ⇒ «unknown» (και ΟΧΙ «not-provided»)', async () => {
    withFetch([STREET_ONLY]);

    const result = await geocode(addressLineToQuery('Σαμοθράκης 16, 56334'));

    expect(result?.reasoning.fieldMatches.number).toBe('unknown');
    expect(result?.accuracy).toBe('interpolated');
  });

  it('χωρίς δηλωμένο αριθμό ⇒ «not-provided» — δεν λείπει τίποτα, δεν ζητήθηκε', async () => {
    withFetch([STREET_ONLY]);

    const result = await geocode(addressLineToQuery('Σαμοθράκης, Εύοσμος'));

    expect(result?.reasoning.fieldMatches.number).toBe('not-provided');
  });

  it('δηλωμένος και επιβεβαιωμένος ⇒ «match» + «exact»', async () => {
    withFetch([{
      ...STREET_ONLY, place_rank: 30, class: 'place', type: 'house',
      address: { road: 'Σαμοθράκης', house_number: '16', city: 'Θεσσαλονίκη' },
    }]);

    const result = await geocode(addressLineToQuery('Σαμοθράκης 16, 56334'));

    expect(result?.reasoning.fieldMatches.number).toBe('match');
    expect(result?.accuracy).toBe('exact');
  });
});
