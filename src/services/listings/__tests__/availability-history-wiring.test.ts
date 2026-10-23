/**
 * @fileoverview **Η ΚΛΗΣΗ ΠΟΥ ΔΕΝ ΠΡΕΠΕΙ ΝΑ ΛΕΙΨΕΙ**: ρωτά ο γραφέας τη σφραγίδα διαθεσιμότητας; (ADR-919 §10)
 * @related services/listings/publish-public-listing.ts · availability-history-stamp.ts · public-listing-projection.ts
 *
 * Οι άλλες άγκυρες δοκιμάζουν τη **μεταφορά** (σφραγίδα μόνη της, κρίση μόνη της). Αυτή ρωτά το μόνο που ενώνει τα
 * κομμάτια: μια **πραγματική** μετάθεση της υπόσχεσης του κτιρίου, μέσα από τον **πραγματικό** γραφέα, φτάνει ως
 * `availabilityTrack` στη δημόσια αγγελία **και** ως `availabilityHistory` στη μονάδα; (Ίδια κλάση με το ADR-841 Α1:
 * η μηχανή υπήρχε, έλειπε η κλήση.)
 *
 * Firestore: η κοινή `FakeFirestore` (πραγματικές συναλλαγές). Τα ράφια μοκάρονται, αλλιώς χτυπούν πραγματικό GCS.
 */

jest.mock('../public-shelf.service', () => ({
  reconcilePublicShelf: async () => ({ outcome: 'reconciled', published: [], removed: 0, rejected: 0 }),
}));
jest.mock('../public-shelf-model.service', () => ({
  reconcilePublicModelShelf: async () => ({ outcome: 'reconciled', published: [], removed: 0, rejected: 0 }),
}));
jest.mock('../public-shelf-video.service', () => ({
  reconcilePublicVideoShelf: async () => ({ outcome: 'reconciled', published: [], removed: 0, rejected: 0 }),
}));
jest.mock('../public-shelf-terrain.service', () => ({
  reconcilePublicTerrainShelf: async () => ({ outcome: 'reconciled', published: [], removed: 0, rejected: 0 }),
}));
jest.mock('@/services/mandate/showcase-presence.service', () => ({
  refreshShowcasePresence: async () => undefined,
}));

// eslint-disable-next-line import/first -- τα mocks πρέπει να δηλωθούν πριν τα imports
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { PublicListing } from '@/types/public-listing';

import { republishListing, type ListingSourceProperty } from '../publish-public-listing';

const PROPERTY_ID = 'prop_a0000003-7777-4aaa-8aaa-000000000003';
const DECLARED_AT = '2026-10-01T10:00:00.000Z';

const PROPERTY: ListingSourceProperty = {
  id: PROPERTY_ID,
  name: 'Διαμέρισμα Β1',
  type: 'apartment',
  commercialStatus: 'for-sale',
  commercial: { askingPrice: 180_000 },
  areas: { gross: 78 },
  buildingId: 'bldg_1',
  projectId: 'proj_1',
};

const promise = (anchor: string) => ({ provenance: 'declared', value: { precision: 'quarter', anchor }, at: DECLARED_AT });
const Q2_2027 = { kind: 'scheduled', precision: 'quarter', window: { start: '2027-04-01', end: '2027-06-30' } };
const Q4_2027 = { kind: 'scheduled', precision: 'quarter', window: { start: '2027-10-01', end: '2027-12-31' } };

const resolveAgency = async () => null;
const resolveMedia = async () => [];

function world(): FakeFirestore {
  const fake = new FakeFirestore();
  fake.seed(COLLECTIONS.PROJECTS, 'proj_1', { addresses: [] });
  fake.seed(COLLECTIONS.BUILDINGS, 'bldg_1', { projectId: 'proj_1', status: 'construction', completionDeclaration: promise('2027-05-15') });
  fake.seed(COLLECTIONS.PROPERTIES, PROPERTY_ID, { ...PROPERTY });
  return fake;
}

/** Ένα πέρασμα του γραφέα με το έγγραφο της μονάδας **όπως είναι τώρα στη βάση**. */
async function publish(fake: FakeFirestore): Promise<PublicListing> {
  const stored = fake.getData(COLLECTIONS.PROPERTIES, PROPERTY_ID) as ListingSourceProperty;
  await republishListing(fake as unknown as AdminFirestore, PROPERTY_ID, stored, resolveAgency, resolveMedia);
  return fake.getData(COLLECTIONS.PUBLIC_LISTINGS, PROPERTY_ID) as unknown as PublicListing;
}

describe('Σ — η σφραγίδα διαθεσιμότητας στον γραφέα', () => {
  it('🔴 Σ1 — πρώτη δημοσίευση με υπόσχεση ⇒ μία παρατήρηση στη ΜΟΝΑΔΑ, ιστορία χωρίς μετάθεση στην αγγελία', async () => {
    const fake = world();

    const listing = await publish(fake);

    expect(listing.availability).toEqual(Q2_2027);
    expect(listing.availabilityTrack).toEqual({ originally: Q2_2027, slips: 0, lastChange: null });
    const history = fake.getData(COLLECTIONS.PROPERTIES, PROPERTY_ID)?.availabilityHistory as unknown[];
    expect(history).toHaveLength(1);
  });

  it('🔴 Σ2 — το κτίριο μεταθέτει την παράδοση ⇒ «αρχικά Β΄ τρ. · μετατέθηκε 1 φορά», με την αλλαγή για τον ειδοποιητή', async () => {
    const fake = world();
    await publish(fake);
    fake.seed(COLLECTIONS.BUILDINGS, 'bldg_1', { projectId: 'proj_1', status: 'construction', completionDeclaration: promise('2027-11-15') });

    const listing = await publish(fake);

    expect(listing.availability).toEqual(Q4_2027);
    expect(listing.availabilityTrack?.originally).toEqual(Q2_2027);
    expect(listing.availabilityTrack?.slips).toBe(1);
    expect(listing.availabilityTrack?.lastChange).toMatchObject({ kind: 'slipped', from: Q2_2027 });
  });

  it('Σ3 — επαναδημοσίευση χωρίς αλλαγή ⇒ καμία νέα παρατήρηση (idempotent)', async () => {
    const fake = world();
    await publish(fake);

    await publish(fake);

    expect(fake.getData(COLLECTIONS.PROPERTIES, PROPERTY_ID)?.availabilityHistory as unknown[]).toHaveLength(1);
  });

  it('⛔ Σ4 — μη δημόσια μονάδα ⇒ τίποτα στο ιστορικό (μόνο ό,τι είδε το κοινό)', async () => {
    const fake = world();
    fake.seed(COLLECTIONS.PROPERTIES, PROPERTY_ID, { ...PROPERTY, commercialStatus: 'unavailable' });

    await publish(fake);

    expect(fake.getData(COLLECTIONS.PROPERTIES, PROPERTY_ID)?.availabilityHistory).toBeUndefined();
  });
});
