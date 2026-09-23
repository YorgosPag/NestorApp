/**
 * ADR-777 §8.72 — ο γραφέας προβολών: «ένας επισκέπτης, μία φορά την ημέρα, όχι ο κάτοχος».
 *
 * 🔑 Κάθε άγκυρα μετρά την **παρενέργεια** (τι έμεινε στα shards), όχι μόνο το αποτέλεσμα: ένας
 * γραφέας που επέστρεφε `duplicate` αλλά αύξανε τον μετρητή θα ήταν πράσινος σε άγκυρα αποτελέσματος.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AdminFirestore } from '@/lib/api/guarded-route';
import type { ListingResolution } from '@/services/listings/listing-resolver';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';

const mockResolveListing = jest.fn<Promise<ListingResolution>, [unknown, string, string]>();
jest.mock('@/services/listings/listing-resolver', () => ({
  resolveListing: (...args: [unknown, string, string]) => mockResolveListing(...args),
}));

import { recordListingView, visitorDayHash, type ListingViewInput } from '../listing-view-recorder';

const LISTING = 'ownp_listing_0001';
const OWNER_UID = 'uid-owner';
const NOW = Date.parse('2026-10-10T09:00:00Z');
const DAY_MS = 86_400_000;

const fake = new FakeFirestore();
const db = fake as unknown as AdminFirestore;

function input(overrides: Partial<ListingViewInput> = {}): ListingViewInput {
  return { listingId: LISTING, ip: '203.0.113.7', userAgent: 'Mozilla/5.0 Chrome/129', viewer: null, nowMs: NOW, ...overrides };
}

function totalViews(): number {
  return fake.all<{ views: number }>(COLLECTIONS.LISTING_VIEW_SHARDS).reduce((sum, shard) => sum + shard.views, 0);
}

beforeEach(() => {
  fake.reset();
  fake.seed(COLLECTIONS.PUBLIC_LISTINGS, LISTING, { id: LISTING });
  mockResolveListing.mockReset();
  mockResolveListing.mockResolvedValue({
    family: 'owner', custody: { kind: 'personal', userId: OWNER_UID }, facts: null,
  } as unknown as ListingResolution);
});

describe('Κ1 — ένας επισκέπτης μετρά ΜΙΑ φορά την ημέρα', () => {
  it('δεύτερη προβολή του ίδιου ανθρώπου την ίδια μέρα ⇒ duplicate, ο μετρητής μένει 1', async () => {
    expect(await recordListingView(db, input())).toBe('counted');
    expect(await recordListingView(db, input())).toBe('duplicate');
    expect(totalViews()).toBe(1);
  });

  it('δύο ΤΑΥΤΟΧΡΟΝΑ αιτήματα του ίδιου ανθρώπου ⇒ ακριβώς μία προβολή', async () => {
    const outcomes = await Promise.all([recordListingView(db, input()), recordListingView(db, input())]);
    expect([...outcomes].sort()).toEqual(['counted', 'duplicate']);
    expect(totalViews()).toBe(1);
  });

  it('άλλος άνθρωπος (άλλη IP) ⇒ δεύτερη προβολή', async () => {
    await recordListingView(db, input());
    expect(await recordListingView(db, input({ ip: '198.51.100.9' }))).toBe('counted');
    expect(totalViews()).toBe(2);
  });

  it('ο ίδιος άνθρωπος την ΕΠΟΜΕΝΗ μέρα ⇒ μετρά ξανά', async () => {
    await recordListingView(db, input());
    expect(await recordListingView(db, input({ nowMs: NOW + DAY_MS }))).toBe('counted');
    expect(totalViews()).toBe(2);
  });
});

describe('Κ2 — ο κάτοχος δεν μετρά (ο Zillow τον μετρά· εμείς όχι)', () => {
  it('ο θεματοφύλακας ⇒ own-listing, κανένα shard', async () => {
    expect(await recordListingView(db, input({ viewer: { uid: OWNER_UID, companyId: null } }))).toBe('own-listing');
    expect(totalViews()).toBe(0);
  });

  it('συνδεδεμένος ξένος ⇒ μετρά', async () => {
    expect(await recordListingView(db, input({ viewer: { uid: 'uid-stranger', companyId: null } }))).toBe('counted');
    expect(totalViews()).toBe(1);
  });

  it('βλάβη του κριτή ⇒ unavailable, ΚΑΜΙΑ προβολή (ποτέ «μέτρα για σιγουριά» τον πιθανό κάτοχο)', async () => {
    mockResolveListing.mockResolvedValue(null);
    expect(await recordListingView(db, input({ viewer: { uid: OWNER_UID, companyId: null } }))).toBe('unavailable');
    expect(totalViews()).toBe(0);
  });
});

describe('Κ3 — μόνο αγγελίες στην αγορά', () => {
  it('ανύπαρκτη/αποσυρμένη αγγελία ⇒ not-listed, κανένα έγγραφο γεννιέται', async () => {
    expect(await recordListingView(db, input({ listingId: 'ownp_ghost' }))).toBe('not-listed');
    expect(fake.all(COLLECTIONS.LISTING_VIEW_SHARDS)).toHaveLength(0);
    expect(fake.all(COLLECTIONS.LISTING_VIEW_MARKS)).toHaveLength(0);
  });

  it('βλάβη βάσης ⇒ unavailable, ΠΟΤΕ εξαίρεση προς τη σελίδα', async () => {
    fake.failReads = true;
    await expect(recordListingView(db, input())).resolves.toBe('unavailable');
  });
});

describe('Κ4 — καμία PII στη βάση', () => {
  it('το σημάδι ΔΕΝ περιέχει IP ή UA — μόνο ημέρα και λήξη', async () => {
    await recordListingView(db, input());
    const [mark] = fake.all<Record<string, unknown>>(COLLECTIONS.LISTING_VIEW_MARKS);
    expect(Object.keys(mark).sort()).toEqual(['day', 'expiresAt']);
    expect(JSON.stringify(fake.all(COLLECTIONS.LISTING_VIEW_SHARDS))).not.toContain('203.0.113.7');
  });

  it('το hash αλλάζει με το αλάτι — χωρίς το αλάτι δεν ξαναβρίσκεται η IP', () => {
    const a = visitorDayHash('salt-a', '2026-10-10', LISTING, '203.0.113.7', 'UA');
    const b = visitorDayHash('salt-b', '2026-10-10', LISTING, '203.0.113.7', 'UA');
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('το hash περιέχει το ακίνητο — τα σημάδια δεν συνδέονται μεταξύ αγγελιών', () => {
    expect(visitorDayHash('s', 'd', 'ownp_a', 'ip', 'ua')).not.toBe(visitorDayHash('s', 'd', 'ownp_b', 'ip', 'ua'));
  });
});
