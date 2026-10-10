/**
 * ⚓ «Τι θα κάνει η επαναφορά» — το κείμενο της ταινίας δεμένο με τη συμπεριφορά (ADR-329 §3.9)
 *
 * Ο πίνακας `REINSTATE_PROMISES` είναι client-safe δήλωση· η συμπεριφορά ζει στον διακομιστή
 * (`propertyLifecycleEffects.reinstatePatch`). Η άγκυρα **εκτελεί** το πραγματικό `reinstatePatch`
 * για κάθε απόσυρση πάνω σε ακίνητο που ήταν στην αγορά, και κοκκινίζει αν ο πίνακας λέει κάτι άλλο.
 *
 * @module lib/firestore/__tests__/reinstate-promises
 */

jest.mock('@/services/listings/listing-media-refresh', () => ({
  republishListingOfChangedUnit: jest.fn(),
}));

import { propertyLifecycleEffects } from '@/services/property/property-lifecycle-effects';
import { ARCHIVE, RETIREMENTS, TRASH, type Retirement } from '../lifecycle-retirements';
import { REINSTATE_PROMISES, reinstatePromiseOf, type ReinstatePromise } from '../reinstate-promises';
import { retiredKindOf, type RetiredKind } from '../trashed-status';

const RETIREMENT_OF: Record<RetiredKind, Retirement> = { archived: ARCHIVE, trashed: TRASH };

const LISTED_STATUS = 'for-sale';

/** Ό,τι **πράγματι** κάνει ο διακομιστής σε ακίνητο που ήταν στην αγορά όταν αποσύρθηκε. */
function observedPromise(kind: RetiredKind): ReinstatePromise {
  const from = RETIREMENT_OF[kind];
  const data = { status: from.status, commercialStatus: LISTED_STATUS, previousStatus: LISTED_STATUS };
  const patch = propertyLifecycleEffects.reinstatePatch?.(from, data, LISTED_STATUS) ?? null;

  if (patch === null) return 'returns-as-it-was';
  if (patch.outcome === 'taken-off-market') return 'returns-off-market';
  throw new Error(`Η επαναφορά από ${from.place} κάνει κάτι που ο πίνακας δεν ονομάζει`);
}

describe('ο πίνακας καλύπτει κάθε απόσυρση της μηχανής', () => {
  it('κάθε `Retirement` αντιστοιχεί σε `RetiredKind` με υπόσχεση', () => {
    const kinds = RETIREMENTS.map((retirement) => retiredKindOf({ status: retirement.status }));

    expect(kinds.sort()).toEqual(Object.keys(REINSTATE_PROMISES.property).sort());
  });
});

describe('🔴 η υπόσχεση είναι η συμπεριφορά', () => {
  it.each<RetiredKind>(['archived', 'trashed'])('ακίνητο · %s', (kind) => {
    expect(reinstatePromiseOf('property', kind)).toBe(observedPromise(kind));
  });

  it('το αρχείο και ο κάδος ΔΕΝ υπόσχονται το ίδιο', () => {
    expect(observedPromise('archived')).not.toBe(observedPromise('trashed'));
  });
});
