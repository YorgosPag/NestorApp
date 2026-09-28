/**
 * @jest-environment node
 *
 * ADR-890 Φ1 — ο γραφέας της νυχτερινής σύνοψης και ο αναγνώστης της σελίδας περιοχής, πάνω στο ίδιο
 * πλαστό Firestore: ό,τι γράφει ο ένας, το βρίσκει ο άλλος με `doc(id)`, χωρίς ερώτημα.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AdminFirestore } from '@/lib/api/guarded-route';
import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import type { AdminArea } from '@/lib/geo/admin-area-index-file';
import type { AdminAreaAssignment } from '@/lib/geo/admin-area-of-point';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import type { PublicListing } from '@/types/public-listing';

const mockReadLive = jest.fn();
jest.mock('@/services/listings/live-public-listings.reader', () => ({
  readLivePublicListings: (...args: unknown[]) => mockReadLive(...args),
}));

const AREAS: readonly AdminArea[] = [
  { id: 'regional_unit:07', name: 'ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ', level: 4, parentId: null },
  { id: 'municipality:0701', name: 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ', level: 5, parentId: 'regional_unit:07' },
  { id: 'municipal_unit:070101', name: 'ΔΗΜΟΤΙΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ', level: 6, parentId: 'municipality:0701' },
];
const mockDirectory = jest.fn();
jest.mock('@/services/places/admin-boundaries.reader', () => ({
  readAdminAreaDirectory: () => mockDirectory(),
}));

const mockSummary = jest.fn();
jest.mock('@/services/market/market-transactions.reader', () => ({
  readAreaSummary: (areaId: string) => mockSummary(areaId),
}));

const mockValueZoneFiles = jest.fn();
jest.mock('@/services/market/value-zones.reader', () => ({
  readValueZoneFileIds: (ids: readonly string[]) => mockValueZoneFiles(ids),
}));

import { loadAreaMarketPage } from '../area-market-page.service';
import { rollupAreaMarket } from '../area-market-rollup.service';

const THESSALONIKI: AdminAreaAssignment = {
  regionId: 'region:112',
  regionalUnitId: 'regional_unit:07',
  municipalityId: 'municipality:0701',
  municipalUnitId: 'municipal_unit:070101',
  communityId: null,
  nearBoundary: false,
};

const fake = new FakeFirestore();
const db = fake as unknown as AdminFirestore;
const DAY = '2026-09-26';

function located(count: number): PublicListing[] {
  return Array.from({ length: count }, (_, index) => listing({ id: `prop_${index}`, adminArea: THESSALONIKI, areaSqm: 60 + index * 10 }));
}

function seedListings(listings: readonly PublicListing[]): void {
  for (const item of listings) fake.seed(COLLECTIONS.PUBLIC_LISTINGS, item.id, { ...item, schemaVersion: 14 });
}

const INDEX = { asOf: '2026-09-01', window: { from: 2022, to: 2026 }, areas: new Set<string>(), categorySegments: [] };

function summaryOf(id: string) {
  return { v: 2, id, asOf: '2026-09-01', segments: {} };
}

beforeEach(() => {
  fake.reset();
  mockSummary.mockImplementation(async (id: string) => ({ kind: 'ready', file: summaryOf(id), index: INDEX }));
  mockValueZoneFiles.mockResolvedValue([]);
  mockDirectory.mockResolvedValue({
    areas: new Map(AREAS.map((area) => [area.id, area])),
    childrenOf: (parentId: string) => AREAS.filter((area) => area.parentId === parentId),
  });
});

describe('rollupAreaMarket', () => {
  it('γράφει ένα έγγραφο ανά περιοχή (δήμος + Δ.Ε.) και το σημάδι', async () => {
    mockReadLive.mockResolvedValue({ listings: [...located(5), listing({ id: 'prop_x' })], truncated: false });
    const run = await rollupAreaMarket(db, DAY, new Date('2026-09-26T00:25:00Z'));
    expect(run).toEqual(expect.objectContaining({ day: DAY, areas: 2, listings: 6, unassigned: 1, truncated: false }));
    expect(fake.all(COLLECTIONS.AREA_MARKET_SNAPSHOTS)).toHaveLength(2);
    expect(fake.all(COLLECTIONS.AREA_MARKET_RUNS)).toHaveLength(1);
  });

  it('ιδεμποτικό: η επανεκτέλεση της ίδιας ημέρας ΔΕΝ γεννά δεύτερα έγγραφα', async () => {
    mockReadLive.mockResolvedValue({ listings: located(3), truncated: false });
    await rollupAreaMarket(db, DAY, new Date());
    await rollupAreaMarket(db, DAY, new Date());
    expect(fake.all(COLLECTIONS.AREA_MARKET_SNAPSHOTS)).toHaveLength(2);
    expect(fake.all(COLLECTIONS.AREA_MARKET_RUNS)).toHaveLength(1);
    expect(fake.all(COLLECTIONS.AREA_MARKET_SERIES)).toHaveLength(2);
  });

  it('ADR-890 §13: η μηνιαία σειρά είναι ΕΝΩΣΗ των νυχτών του μήνα — αγγελία που έφυγε μετρά ακόμη', async () => {
    mockReadLive.mockResolvedValue({ listings: located(5), truncated: false });
    await rollupAreaMarket(db, '2026-09-26', new Date());
    mockReadLive.mockResolvedValue({ listings: located(5).slice(0, 2), truncated: false });
    await rollupAreaMarket(db, '2026-09-27', new Date());
    const page = await loadAreaMarketPage(db, 'municipality:0701', '2026-09-27');
    if (page.kind !== 'found' || page.market.kind !== 'ready') throw new Error('no market');
    const point = page.market.series?.['2026-09'];
    expect(point?.asOf).toBe('2026-09-27');
    expect(point?.offers.sale.apartment?.n).toBe(5);
  });
});

describe('loadAreaMarketPage', () => {
  it('άγνωστη μορφή ταυτότητας ⇒ not-found, χωρίς καμία ανάγνωση', async () => {
    expect(await loadAreaMarketPage(db, '../etc/passwd', DAY)).toEqual({ kind: 'not-found' });
  });

  it('βαθμίδα χωρίς σελίδα (Π.Ε.) ⇒ not-found', async () => {
    expect(await loadAreaMarketPage(db, 'regional_unit:07', DAY)).toEqual({ kind: 'not-found' });
  });

  it('ευρετήριο που δεν διαβάστηκε ⇒ unavailable (5xx), ποτέ not-found', async () => {
    mockDirectory.mockResolvedValue(null);
    expect(await loadAreaMarketPage(db, 'municipality:0701', DAY)).toEqual({ kind: 'unavailable' });
  });

  it('χωρίς νυχτερινή εκτέλεση ⇒ no-run, οι αγγελίες όμως φαίνονται ζωντανά', async () => {
    seedListings(located(2));
    const page = await loadAreaMarketPage(db, 'municipality:0701', DAY);
    if (page.kind !== 'found') throw new Error(page.kind);
    expect(page.market).toEqual({ kind: 'no-run' });
    expect(page.listings.total).toBe(2);
    expect(page.children.map((child) => child.id)).toEqual(['municipal_unit:070101']);
  });

  it('διαβάζει τη σύνοψη της ΧΘΕΣΙΝΗΣ ολοκληρωμένης νύχτας, με τον Δήμο ως γονέα για τη Δ.Ε.', async () => {
    mockReadLive.mockResolvedValue({ listings: located(6), truncated: false });
    await rollupAreaMarket(db, '2026-09-25', new Date());
    const page = await loadAreaMarketPage(db, 'municipal_unit:070101', DAY);
    if (page.kind !== 'found' || page.market.kind !== 'ready') throw new Error('no market');
    expect(page.market.run.day).toBe('2026-09-25');
    expect(page.market.snapshot?.areaId).toBe('municipal_unit:070101');
    expect(page.market.parent?.areaId).toBe('municipality:0701');
    expect(page.ancestors.map((area) => area.id)).toEqual(['municipality:0701', 'regional_unit:07']);
  });

  it('ADR-890 §13: η σελίδα διαβάζει τα σημεία της σειράς, ΠΟΤΕ το βιβλίο του μήνα (fieldMask)', async () => {
    mockReadLive.mockResolvedValue({ listings: located(6), truncated: false });
    await rollupAreaMarket(db, '2026-09-25', new Date());
    const page = await loadAreaMarketPage(db, 'municipal_unit:070101', DAY);
    if (page.kind !== 'found' || page.market.kind !== 'ready') throw new Error('no market');
    expect(Object.keys(page.market.series ?? {})).toEqual(['2026-09']);
    expect(JSON.stringify(page.market.series)).not.toContain('prop_');
  });

  it('τιμές συμβολαίων (ADR-890 Φ2): η Δ.Ε. ΚΑΙ ο Δήμος της, για την αναγωγή', async () => {
    const page = await loadAreaMarketPage(db, 'municipal_unit:070101', DAY);
    if (page.kind !== 'found' || page.contracts.kind !== 'ready') throw new Error('no contracts');
    expect(page.contracts.summary.id).toBe('municipal_unit:070101');
    expect(page.contracts.parent?.id).toBe('municipality:0701');
    expect(page.contracts.window).toEqual({ from: 2022, to: 2026 });
  });

  it('ζώνες αντικειμενικών αξιών (ADR-889 Φ5): ρωτά ο Δήμος ΚΑΙ οι Δ.Ε. του· αποτυχία ⇒ null, η σελίδα ΔΕΝ πέφτει', async () => {
    mockValueZoneFiles.mockImplementation(async (ids: readonly string[]) => ids.filter((id) => id.startsWith('municipal_unit')));
    const page = await loadAreaMarketPage(db, 'municipality:0701', DAY);
    expect(mockValueZoneFiles).toHaveBeenCalledWith(['municipality:0701', 'municipal_unit:070101']);
    expect(page.kind === 'found' && page.valueZoneFiles).toEqual(['municipal_unit:070101']);

    mockValueZoneFiles.mockResolvedValue(null);
    const failed = await loadAreaMarketPage(db, 'municipality:0701', DAY);
    expect(failed.kind === 'found' && failed.valueZoneFiles).toBeNull();
  });

  it('καμία εγγραφή ⇒ none (γεγονός)· αποτυχία ανάγνωσης ⇒ unavailable, και η σελίδα ΔΕΝ πέφτει', async () => {
    mockSummary.mockResolvedValue({ kind: 'none', index: INDEX });
    const empty = await loadAreaMarketPage(db, 'municipality:0701', DAY);
    expect(empty.kind === 'found' && empty.contracts).toEqual({ kind: 'none', window: { from: 2022, to: 2026 } });

    mockSummary.mockResolvedValue(null);
    const failed = await loadAreaMarketPage(db, 'municipality:0701', DAY);
    expect(failed.kind).toBe('found');
    expect(failed.kind === 'found' && failed.contracts).toEqual({ kind: 'unavailable' });
  });
});
