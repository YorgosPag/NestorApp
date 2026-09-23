/**
 * @jest-environment node
 *
 * @fileoverview 🖼️ **ΑΓΚΥΡΑ — η μικρογραφία ταξιδεύει ΜΕ την έκβαση** (ADR-777 §8.70).
 * @related services/owner-property/owner-property-publication.service.ts · lib/owner-property/owner-listing-thumbnail
 *
 * Εκτελεί την **πραγματική** `republishOwnerProperty` πάνω σε ψεύτικη Firestore, μέσα από τον
 * **πραγματικό** γραφέα της προβολής. Μοκάρονται μόνο τα κεφάλια των ραφιών (GCS) και η απόδειξη
 * παρουσίας — ίδιο σχήμα με την `audience-narrowing.test.ts`.
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | το `stampPublication` ξεχνά τη μικρογραφία | `thumbnail` απόν ⇒ 🔴 |
 * | η μικρογραφία βγαίνει από τα **ανεβάσματα** αντί για το ράφι | άλλο url ⇒ 🔴 |
 * | η απόσυρση αφήνει την παλιά μικρογραφία | όχι `null` ⇒ 🔴 |
 * | το `stampPublication` ξεχνά το σημάδι χάρτη (§8.70 Φ2) | `mapMark` απόν ⇒ 🔴 |
 * | το σημάδι βγαίνει από το ιδιωτικό `place` αντί για τη δημοσιευμένη θέση | `label` / `accuracy` διαρρέουν ⇒ 🔴 |
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

type ShelfCall = [kind: unknown, subjectId: string, sources: readonly unknown[]];

const reconcilePublicShelf = jest.fn<Promise<unknown>, ShelfCall>();

const EMPTY_REPORT = { outcome: 'reconciled', published: [], removed: 0, rejected: 0 };
const ONE_PHOTO_REPORT = {
  outcome: 'reconciled',
  published: [
    {
      canonical: { key: 'k0-2560', url: 'https://shelf/0-2560.webp', width: 2560, height: 1700 },
      variants: [
        { key: 'k0-640', url: 'https://shelf/0-640.webp', width: 640, height: 425 },
        { key: 'k0-2560', url: 'https://shelf/0-2560.webp', width: 2560, height: 1700 },
      ],
      material: { kind: 'photo' },
    },
  ],
  removed: 0,
  rejected: 0,
};

jest.mock('@/services/listings/public-shelf.service', () => ({
  reconcilePublicShelf: (...args: ShelfCall) => reconcilePublicShelf(...args),
}));
jest.mock('@/services/listings/public-shelf-model.service', () => ({
  reconcilePublicModelShelf: async () => EMPTY_REPORT,
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
const { republishOwnerProperty } = require('../owner-property-publication.service') as
  typeof import('../owner-property-publication.service');
/* eslint-enable @typescript-eslint/no-require-imports */

async function storedPublication(db: InstanceType<typeof FakeFirestore>, id: string): Promise<unknown> {
  const snap = await db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(id).get();
  return snap.data()?.publication;
}

beforeEach(() => {
  jest.clearAllMocks();
  reconcilePublicShelf.mockResolvedValue(ONE_PHOTO_REPORT);
});

describe('🖼️ η μικρογραφία γράφεται στο ΙΔΙΟ αποτύπωμα με την έκβαση', () => {
  it('🔑 δημοσιεύτηκε ⇒ η 1η εικόνα ΤΟΥ ΡΑΦΙΟΥ, χωρίς altKey', async () => {
    const property = validOwnerProperty();
    const db = new FakeFirestore();
    db.seed(COLLECTIONS.OWNER_PROPERTIES, property.id, property);

    const { publish, property: stamped } = await republishOwnerProperty(db as unknown as AdminFirestore, property);

    const expected = {
      url: 'https://shelf/0-2560.webp',
      width: 2560,
      height: 1700,
      sources: [
        { url: 'https://shelf/0-640.webp', width: 640 },
        { url: 'https://shelf/0-2560.webp', width: 2560 },
      ],
    };
    expect(publish).toBe('published');
    expect(await storedPublication(db, property.id)).toMatchObject({ outcome: 'published', thumbnail: expected });
    expect(stamped.publication?.thumbnail).toEqual(expected);
  });

  it('δημοσιεύτηκε χωρίς φωτογραφία ⇒ `thumbnail: null`', async () => {
    reconcilePublicShelf.mockResolvedValue(EMPTY_REPORT);
    const property = validOwnerProperty();
    const db = new FakeFirestore();
    db.seed(COLLECTIONS.OWNER_PROPERTIES, property.id, property);

    await republishOwnerProperty(db as unknown as AdminFirestore, property);

    expect(await storedPublication(db, property.id)).toMatchObject({ outcome: 'published', thumbnail: null });
  });

  it('🔴 απόσυρση ⇒ `thumbnail: null` — η παλιά μικρογραφία ΔΕΝ επιβιώνει', async () => {
    const property = validOwnerProperty();
    const db = new FakeFirestore();
    db.seed(COLLECTIONS.OWNER_PROPERTIES, property.id, property);
    const typedDb = db as unknown as AdminFirestore;
    await republishOwnerProperty(typedDb, property);

    const withdrawn = { ...property, lifecycle: 'withdrawn' as const };
    db.seed(COLLECTIONS.OWNER_PROPERTIES, property.id, withdrawn);
    const { publish } = await republishOwnerProperty(typedDb, withdrawn);

    expect(publish).toBe('withdrawn');
    expect(await storedPublication(db, property.id)).toMatchObject({ outcome: 'withdrawn', thumbnail: null });
  });
});

describe('🗺️ το σημάδι χάρτη γράφεται στο ΙΔΙΟ αποτύπωμα (ADR-777 §8.70 Φάση 2)', () => {
  it('🔑 δημοσιεύτηκε ⇒ ΜΟΝΟ σχήμα + σημείο της δημόσιας αγγελίας — καμία διεύθυνση, καμία ακρίβεια', async () => {
    const property = validOwnerProperty();
    const db = new FakeFirestore();
    db.seed(COLLECTIONS.OWNER_PROPERTIES, property.id, property);

    const { property: stamped } = await republishOwnerProperty(db as unknown as AdminFirestore, property);

    const expected = { shape: 'pin', point: { lat: 40.63, lng: 22.95 } };
    expect((await storedPublication(db, property.id)) as { mapMark: unknown }).toMatchObject({ mapMark: expected });
    expect(stamped.publication?.mapMark).toStrictEqual(expected);
  });

  it('🔴 απόσυρση ⇒ `mapMark: null` — η θέση φεύγει μαζί με την αγγελία', async () => {
    const property = validOwnerProperty();
    const db = new FakeFirestore();
    db.seed(COLLECTIONS.OWNER_PROPERTIES, property.id, property);
    const typedDb = db as unknown as AdminFirestore;
    await republishOwnerProperty(typedDb, property);

    const withdrawn = { ...property, lifecycle: 'withdrawn' as const };
    db.seed(COLLECTIONS.OWNER_PROPERTIES, property.id, withdrawn);
    await republishOwnerProperty(typedDb, withdrawn);

    expect(await storedPublication(db, property.id)).toMatchObject({ outcome: 'withdrawn', mapMark: null });
  });
});
