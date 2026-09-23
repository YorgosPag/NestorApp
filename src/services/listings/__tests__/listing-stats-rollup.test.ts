/**
 * ADR-777 §8.72 — η νυχτερινή σύνοψη: ιδεμποτική εκ κατασκευής, χωρίς χαμένες ή διπλές προβολές.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AdminFirestore } from '@/lib/api/guarded-route';
import { LISTING_STATS_RETENTION_DAYS, shiftMarketDay } from '@/lib/listings/listing-stats';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { nextListingStats, rollupListingStats } from '../listing-stats-rollup.service';
import type { StoredListingStats } from '../listing-stats-document';

const TODAY = '2026-10-10';
const A = 'ownp_a';
const B = 'ownp_b';

const fake = new FakeFirestore();
const db = fake as unknown as AdminFirestore;

function seedShard(propertyId: string, day: string, shard: number, views: number): void {
  fake.seed(
    COLLECTIONS.LISTING_VIEW_SHARDS,
    enterpriseIdService.generateDeterministicListingViewShardId(propertyId, day, shard),
    { propertyId, day, shard, views },
  );
}

function statsOf(propertyId: string): StoredListingStats | undefined {
  return fake.all<StoredListingStats>(COLLECTIONS.LISTING_STATS).find((s) => s.propertyId === propertyId);
}

beforeEach(() => fake.reset());

describe('Σ1 — κλειστές ημέρες ⇒ σύνοψη, shards σβήνονται', () => {
  it('αθροίζει τα shards ανά (ακίνητο, ημέρα) και τα σβήνει', async () => {
    seedShard(A, '2026-10-09', 0, 3);
    seedShard(A, '2026-10-09', 4, 2);
    seedShard(A, '2026-10-08', 1, 1);
    seedShard(B, '2026-10-09', 2, 7);

    const report = await rollupListingStats(db, TODAY);

    expect(report).toMatchObject({ properties: 2, failed: 0 });
    expect(statsOf(A)?.daily).toEqual({ '2026-10-08': 1, '2026-10-09': 5 });
    expect(statsOf(B)?.daily).toEqual({ '2026-10-09': 7 });
    expect(fake.all(COLLECTIONS.LISTING_VIEW_SHARDS)).toHaveLength(0);
  });

  it('η ΣΗΜΕΡΙΝΗ ημέρα δεν αγγίζεται — είναι ακόμη ανοιχτή', async () => {
    seedShard(A, TODAY, 0, 4);
    await rollupListingStats(db, TODAY);
    expect(statsOf(A)).toBeUndefined();
    expect(fake.all(COLLECTIONS.LISTING_VIEW_SHARDS)).toHaveLength(1);
  });
});

describe('Σ2 — ιδεμποτία: δεύτερη εκτέλεση = καμία αλλαγή', () => {
  it('τρέχει δύο φορές ⇒ ίδια σύνοψη (όχι διπλάσια)', async () => {
    seedShard(A, '2026-10-09', 0, 3);
    await rollupListingStats(db, TODAY);
    const first = statsOf(A);
    await rollupListingStats(db, TODAY);
    expect(statsOf(A)).toEqual(first);
  });

  it('αργοπορημένο shard ίδιας ημέρας σε επόμενη νύχτα ⇒ ΠΡΟΣΤΙΘΕΤΑΙ, δεν αντικαθιστά', async () => {
    seedShard(A, '2026-10-08', 0, 3);
    await rollupListingStats(db, '2026-10-09');
    seedShard(A, '2026-10-08', 1, 2);
    await rollupListingStats(db, TODAY);
    expect(statsOf(A)?.daily['2026-10-08']).toBe(5);
  });
});

describe('Σ3 — nextListingStats: το σύνολο δεν μειώνεται ποτέ', () => {
  it('ημέρες έξω από τη διατήρηση περνούν στο archivedViews', () => {
    const old = shiftMarketDay(TODAY, -(LISTING_STATS_RETENTION_DAYS + 5));
    const previous: StoredListingStats = { propertyId: A, daily: { [old]: 9, '2026-10-01': 1 }, archivedViews: 4, rolledThrough: '2026-10-01' };
    const next = nextListingStats(previous, A, { '2026-10-09': 2 }, TODAY);
    expect(next.daily).toEqual({ '2026-10-01': 1, '2026-10-09': 2 });
    expect(next.archivedViews).toBe(13);
    expect(next.rolledThrough).toBe('2026-10-09');
  });
});

describe('Σ4 — τα αλάτια των κλειστών ημερών σβήνονται (Plausible)', () => {
  it('χθεσινό αλάτι ⇒ διαγράφεται· σημερινό ⇒ μένει', async () => {
    const saltId = (day: string): string => enterpriseIdService.generateDeterministicListingViewSaltId(day);
    fake.seed(COLLECTIONS.LISTING_VIEW_SALTS, saltId('2026-10-09'), { day: '2026-10-09', salt: 'x' });
    fake.seed(COLLECTIONS.LISTING_VIEW_SALTS, saltId(TODAY), { day: TODAY, salt: 'y' });
    await rollupListingStats(db, TODAY);
    expect(fake.all<{ day: string }>(COLLECTIONS.LISTING_VIEW_SALTS).map((s) => s.day)).toEqual([TODAY]);
  });
});
