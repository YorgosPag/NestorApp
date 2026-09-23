/**
 * ADR-777 §8.72 — ο αναγνώστης του κατόχου: μόνο τα δικά του, άγνωστο ≠ μηδέν ανά πηγή.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AdminFirestore } from '@/lib/api/guarded-route';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import type { FirstContact } from '@/types/first-contact';
import type { SavedListing } from '@/types/saved-listing';

const mockCollectAddressedContacts = jest.fn<Promise<readonly FirstContact[] | null>, [unknown, unknown]>();
jest.mock('@/services/contact/first-contact-projection', () => ({
  collectAddressedContacts: (...args: [unknown, unknown]) => mockCollectAddressedContacts(...args),
}));

const mockReadSavesOfListings = jest.fn<Promise<readonly SavedListing[] | null>, [unknown, readonly string[]]>();
jest.mock('@/services/listings/saved-listing.service', () => ({
  readSavesOfListings: (...args: [unknown, readonly string[]]) => mockReadSavesOfListings(...args),
}));

// Ο αναγνώστης ζητά ΜΟΝΟ ταυτότητα, θεματοφυλακή και σφραγίδα — ο πλήρης αναγνώστης εγγράφου
// κατόχου κρίνεται στις δικές του άγκυρες.
jest.mock('@/lib/owner-property/owner-property-from-document', () => ({
  ownerPropertyFromDocument: (raw: Record<string, unknown>, id: string) => ({ ...raw, id }),
}));

import { contactCountsFor, readOwnerPortfolioStats, saveCountsFor } from '../listing-stats.service';

const NOW = Date.parse('2026-10-10T09:00:00Z');
const ME = { uid: 'uid-me', companyId: null } as const;
const MINE = 'ownp_mine';
const COMPANY_LISTING = 'ownp_company';

const fake = new FakeFirestore();
const db = fake as unknown as AdminFirestore;

function contact(listingId: string, createdAt: string): FirstContact {
  return { id: `fcon_${createdAt}`, target: { kind: 'listing', listingId }, createdAt } as unknown as FirstContact;
}

function saved(listingId: string, savedAt: string): SavedListing {
  return { id: `svls_${listingId}_${savedAt}`, saverUserId: 'uid-x', listingId, savedAt, priceAtSave: null };
}

beforeEach(() => {
  fake.reset();
  fake.seed(COLLECTIONS.OWNER_PROPERTIES, MINE, {
    authorUserId: ME.uid, authorCompanyId: null, listedAt: { kind: 'known', at: '2026-10-01T09:00:00Z' },
  });
  // Γραμμένο από εμένα, αλλά ΕΤΑΙΡΙΚΗΣ θεματοφυλακής — ο πολίτης χωρίς εταιρεία δεν το διαχειρίζεται.
  fake.seed(COLLECTIONS.OWNER_PROPERTIES, COMPANY_LISTING, { authorUserId: ME.uid, authorCompanyId: 'comp_x' });
  fake.seed(COLLECTIONS.LISTING_STATS, enterpriseIdService.generateDeterministicListingStatsId(MINE), {
    propertyId: MINE, daily: { '2026-10-02': 4, '2026-10-08': 3 }, archivedViews: 10, rolledThrough: '2026-10-08',
  });
  fake.seed(COLLECTIONS.LISTING_VIEW_SHARDS, enterpriseIdService.generateDeterministicListingViewShardId(MINE, '2026-10-10', 0), {
    propertyId: MINE, day: '2026-10-10', shard: 0, views: 2,
  });
  mockReadSavesOfListings.mockReset();
  mockReadSavesOfListings.mockResolvedValue([saved(MINE, '2026-10-09T21:30:00Z'), saved(MINE, '2026-09-01T10:00:00Z'), saved('ownp_other', '2026-10-09T10:00:00Z')]);
  mockCollectAddressedContacts.mockReset();
  mockCollectAddressedContacts.mockResolvedValue([contact(MINE, '2026-10-09T10:00:00Z'), contact('ownp_other', '2026-10-09T10:00:00Z')]);
});

describe('Α1 — μόνο ό,τι περνά το mayAdminister', () => {
  it('η εταιρική αγγελία που έγραψα ΔΕΝ εμφανίζεται στον πολίτη', async () => {
    const stats = await readOwnerPortfolioStats(db, ME, NOW);
    expect(Object.keys(stats?.byProperty ?? {})).toEqual([MINE]);
  });
});

describe('Α2 — σύνοψη + ζωντανά shards, σωστά παράθυρα', () => {
  it('7 ημέρες: 3 (08/10) + 2 (σήμερα)· προηγούμενες 7: 4 (02/10)· σύνολο με τα αρχειοθετημένα', async () => {
    const views = (await readOwnerPortfolioStats(db, ME, NOW))?.byProperty[MINE].views;
    expect(views).toMatchObject({ lastWindow: 5, previousWindow: 4, total: 19 });
    expect(views?.daily['2026-10-10']).toBe(2);
  });

  it('countingSince = η ημέρα που μπήκε στην αγορά', async () => {
    expect((await readOwnerPortfolioStats(db, ME, NOW))?.byProperty[MINE].countingSince).toBe('2026-10-01');
  });
});

describe('Α3 — άγνωστο ≠ μηδέν, ΑΝΑ ΠΗΓΗ', () => {
  it('βλάβη επαφών ⇒ contacts: null, οι προβολές φαίνονται', async () => {
    mockCollectAddressedContacts.mockResolvedValue(null);
    const summary = (await readOwnerPortfolioStats(db, ME, NOW))?.byProperty[MINE];
    expect(summary?.contacts).toBeNull();
    expect(summary?.views).not.toBeNull();
  });

  it('βλάβη βάσης ⇒ ολόκληρη η απάντηση null (δεν ξέρουμε ΠΟΙΑ είναι δικά σου)', async () => {
    fake.failReads = true;
    await expect(readOwnerPortfolioStats(db, ME, NOW)).resolves.toBeNull();
  });
});

describe('Α4 — επαφές: από το first_contacts, ποτέ δεύτερος μετρητής', () => {
  it('μετρά μόνο τις επαφές ΑΥΤΗΣ της αγγελίας, ανά ημέρα αγοράς', () => {
    const counts = contactCountsFor(
      [contact(MINE, '2026-10-09T22:30:00Z'), contact(MINE, '2026-09-01T10:00:00Z'), contact('ownp_other', '2026-10-09T10:00:00Z')],
      MINE,
      '2026-10-10',
    );
    // 22:30 UTC 09/10 = 01:30 Αθήνας 10/10 ⇒ μέσα στο παράθυρο, στη σωστή μέρα.
    expect(counts).toMatchObject({ total: 2, lastWindow: 1 });
    expect(counts.daily['2026-10-10']).toBe(1);
  });
});

describe('Α6 — οι αποθηκεύσεις: ίδια πηγή με την πράξη, ίδιος υπολογισμός με τις επαφές (§8.74)', () => {
  it('μετρά ΜΟΝΟ της αγγελίας · ημέρα ΑΘΗΝΑΣ (21:30 UTC 09/10 = 10/10) · παράθυρο 7 ημερών', () => {
    const counts = saveCountsFor([saved(MINE, '2026-10-09T21:30:00Z'), saved(MINE, '2026-09-01T10:00:00Z'), saved('ownp_other', '2026-10-09T10:00:00Z')], MINE, '2026-10-10');
    expect(counts).toMatchObject({ total: 2, lastWindow: 1 });
    expect(counts.daily['2026-10-10']).toBe(1);
  });

  it('ζητά τις αποθηκεύσεις ΜΟΝΟ για ό,τι πέρασε το mayAdminister', async () => {
    await readOwnerPortfolioStats(db, ME, NOW);
    expect(mockReadSavesOfListings).toHaveBeenCalledWith(expect.anything(), [MINE]);
  });

  it('🔴 βλάβη αποθηκεύσεων ⇒ saves: null, προβολές ΚΑΙ επαφές φαίνονται (ποτέ «0 αποθηκεύσεις»)', async () => {
    mockReadSavesOfListings.mockResolvedValue(null);
    const summary = (await readOwnerPortfolioStats(db, ME, NOW))?.byProperty[MINE];
    expect(summary?.saves).toBeNull();
    expect(summary?.views).not.toBeNull();
    expect(summary?.contacts).not.toBeNull();
  });
});
