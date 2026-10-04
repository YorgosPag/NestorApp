/**
 * ΑΓΚΥΡΑ — **ΜΙΑ προθεσμία για όλη την επίλυση**, ο ένας βοηθός (ADR-332 D27 Ζ5 · D29).
 *
 * Τον καλούν επαφές, έργα και κτίρια. Ό,τι φυλάγεται εδώ φυλάγεται και για τους τρεις — γι' αυτό
 * είναι ένας βοηθός και όχι τρία αντίγραφα του ίδιου μπλοκ:
 * - ο πάροχος που αργεί **δεν** κρατά την αποθήκευση πέρα από την προθεσμία·
 * - ό,τι δεν πρόλαβε επιστρέφει **ονομαστικά**, με τη θέση που είχε·
 * - το χρονόμετρο **κλείνει** — αλλιώς κρατά ζωντανή τη διεργασία ως τη λήξη.
 */

/* global describe, it, expect, beforeEach, afterEach, jest */

import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { resolveAddressPositionsWithinDeadline } from '../address-place-writeback';
import { geocodeWithVerdict } from '@/app/api/geocoding/geocoding-engine';

jest.mock('../publish-public-listing', () => ({ republishListingsForProject: jest.fn() }));
jest.mock('@/app/api/geocoding/geocoding-engine', () => ({ geocodeWithVerdict: jest.fn() }));

const engine = geocodeWithVerdict as jest.MockedFunction<typeof geocodeWithVerdict>;
type Verdict = Awaited<ReturnType<typeof geocodeWithVerdict>>;

const HIT = {
  kind: 'hit',
  result: { lat: 40.6403, lng: 22.9444, accuracy: 'exact', confidence: 0.9, source: { variantUsed: 1 } },
} as unknown as Verdict;

const ADDRESS = { id: 'addr_1', street: 'Τσιμισκή', number: '43', city: 'Θεσσαλονίκη' };
const NONE = new Set<string>();
const { RESOLVER_TIMEOUT_MS } = GEOGRAPHIC_CONFIG.GEOCODING;

beforeEach(() => {
  jest.useFakeTimers();
  engine.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('επίλυση θέσεων μέσα σε προθεσμία', () => {
  it('Π1 — ο πάροχος απαντά εγκαίρως ⇒ θέση, καμία εκκρεμότητα', async () => {
    engine.mockResolvedValue(HIT);

    const { addresses, pendingIds } = await resolveAddressPositionsWithinDeadline([], [ADDRESS], NONE);

    expect(addresses[0]).toMatchObject({ coordinates: { lat: 40.6403, lng: 22.9444 }, source: 'geocoded' });
    expect(pendingIds).toEqual([]);
  });

  it('Π2 — ο πάροχος δεν απαντά ⇒ επιστρέφει ΣΤΗΝ προθεσμία, με τη διεύθυνση ονομαστικά εκκρεμή', async () => {
    engine.mockReturnValue(new Promise<Verdict>(() => undefined));

    const resolving = resolveAddressPositionsWithinDeadline([], [ADDRESS], NONE);
    await jest.advanceTimersByTimeAsync(RESOLVER_TIMEOUT_MS);
    const { addresses, pendingIds, tally } = await resolving;

    expect(pendingIds).toEqual(['addr_1']);
    expect(tally['budget-exhausted']).toBe(1);
    expect(addresses[0]).not.toHaveProperty('coordinates');
  });

  it('Π3 — η προθεσμία είναι ΜΙΑ για όλες: η δεύτερη διεύθυνση δεν παίρνει δικό της χρόνο', async () => {
    engine.mockReturnValue(new Promise<Verdict>(() => undefined));
    const second = { ...ADDRESS, id: 'addr_2', street: 'Εγνατία' };

    const resolving = resolveAddressPositionsWithinDeadline([], [ADDRESS, second], NONE);
    await jest.advanceTimersByTimeAsync(RESOLVER_TIMEOUT_MS);
    const { pendingIds } = await resolving;

    expect(pendingIds).toEqual(['addr_1', 'addr_2']);
    // Η δεύτερη βρήκε μηδέν υπόλοιπο: η μηχανή δεν ρωτήθηκε καν γι' αυτήν.
    expect(engine).toHaveBeenCalledTimes(1);
  });

  it('Π4 — το χρονόμετρο κλείνει μετά την επίλυση, ό,τι κι αν έγινε', async () => {
    engine.mockResolvedValue(HIT);

    await resolveAddressPositionsWithinDeadline([], [ADDRESS], NONE);

    expect(jest.getTimerCount()).toBe(0);
  });
});
