/**
 * @jest-environment node
 *
 * @fileoverview 🏆 **ΑΓΚΥΡΑ Α2 του ADR-864** — στένεμα `public → custodians` σβήνει την προβολή ΣΤΟ ΙΔΙΟ ΠΕΡΑΣΜΑ.
 * @related ADR-864 §5.2 · §7 Α2 · services/owner-property/owner-property-write.service.ts
 *
 * Εκτελεί την **πραγματική** πράξη (`setOwnerPropertyAudience`) πάνω σε ψεύτικη Firestore,
 * μέσα από τον **πραγματικό** γραφέα της προβολής. Μοκάρονται **μόνο** τα δύο κεφάλια των
 * ραφιών (αλλιώς χτυπά GCS) και η απόδειξη παρουσίας γραφείου.
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | η πράξη γράφει το πεδίο **χωρίς** επαναπροβολή (`ref.set` αντί `persist`) | το `public_listings/{id}` **μένει** ⇒ 🔴 |
 * | η απόσυρση ξεχνά τα ράφια | κανένα `reconcile(..., [])` ⇒ 🔴 |
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

type ShelfCall = [kind: unknown, subjectId: string, sources: readonly unknown[]];

const reconcilePublicShelf = jest.fn<Promise<unknown>, ShelfCall>();
const reconcilePublicModelShelf = jest.fn<Promise<unknown>, ShelfCall>();

const EMPTY_REPORT = { outcome: 'reconciled', published: [], removed: 0, rejected: 0 };

jest.mock('@/services/listings/public-shelf.service', () => ({
  reconcilePublicShelf: (...args: ShelfCall) => reconcilePublicShelf(...args),
}));
jest.mock('@/services/listings/public-shelf-model.service', () => ({
  reconcilePublicModelShelf: (...args: ShelfCall) => reconcilePublicModelShelf(...args),
}));
jest.mock('@/services/mandate/showcase-presence.service', () => ({
  refreshShowcasePresence: async () => undefined,
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { COLLECTIONS } = require('@/config/firestore-collections') as
  typeof import('@/config/firestore-collections');
const { FakeFirestore } = require('@/services/places/__tests__/fake-firestore') as
  typeof import('@/services/places/__tests__/fake-firestore');
const { validOwnerProperty } = require('@/lib/owner-property/__tests__/owner-property-fixtures') as
  typeof import('@/lib/owner-property/__tests__/owner-property-fixtures');
const { setOwnerPropertyAudience } = require('../owner-property-write.service') as
  typeof import('../owner-property-write.service');
/* eslint-enable @typescript-eslint/no-require-imports */

const OWNER = { uid: 'user-1', companyId: null };

async function publicListingExists(db: InstanceType<typeof FakeFirestore>, id: string): Promise<boolean> {
  const snap = await db.collection(COLLECTIONS.PUBLIC_LISTINGS).doc(id).get();
  return snap.exists;
}

beforeEach(() => {
  jest.clearAllMocks();
  reconcilePublicShelf.mockResolvedValue(EMPTY_REPORT);
  reconcilePublicModelShelf.mockResolvedValue(EMPTY_REPORT);
});

describe('🏆 Α2 — το στένεμα ΑΠΟΣΥΡΕΙ από τον κόσμο στο ίδιο πέρασμα', () => {
  it('🔑 παρονομαστής: διεύρυνση σε `public` ΓΡΑΦΕΙ δημόσια προβολή', async () => {
    const property = validOwnerProperty({ marketingAudience: 'custodians' });
    const db = new FakeFirestore();
    db.seed(COLLECTIONS.OWNER_PROPERTIES, property.id, property);

    const result = await setOwnerPropertyAudience(db as unknown as AdminFirestore, property.id, 'public', OWNER);

    expect(result.kind).toBe('saved');
    expect(await publicListingExists(db, property.id)).toBe(true);
  });

  it('🔴 `public → custodians` ⇒ `public_listings/{id}` ΣΒΗΝΕΤΑΙ και τα ράφια αδειάζουν', async () => {
    const property = validOwnerProperty();
    const db = new FakeFirestore();
    db.seed(COLLECTIONS.OWNER_PROPERTIES, property.id, property);
    const typedDb = db as unknown as AdminFirestore;

    await setOwnerPropertyAudience(typedDb, property.id, 'public', OWNER);
    expect(await publicListingExists(db, property.id)).toBe(true);
    jest.clearAllMocks();

    const result = await setOwnerPropertyAudience(typedDb, property.id, 'custodians', OWNER);

    expect(result.kind).toBe('saved');
    expect(await publicListingExists(db, property.id)).toBe(false);
    expect(reconcilePublicShelf).toHaveBeenCalledWith(expect.anything(), property.id, []);
    expect(reconcilePublicModelShelf).toHaveBeenCalledWith(expect.anything(), property.id, []);

    const stored = await db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(property.id).get();
    expect(stored.data()?.marketingAudience).toBe('custodians');
  });

  it('🔴 ΞΕΝΟΣ δεν αλλάζει κοινό — ίδια κρίση κατοχής με την απόσυρση', async () => {
    const property = validOwnerProperty();
    const db = new FakeFirestore();
    db.seed(COLLECTIONS.OWNER_PROPERTIES, property.id, property);

    const result = await setOwnerPropertyAudience(
      db as unknown as AdminFirestore,
      property.id,
      'custodians',
      { uid: 'intruder', companyId: null },
    );

    expect(result.kind).toBe('absent');
  });
});
