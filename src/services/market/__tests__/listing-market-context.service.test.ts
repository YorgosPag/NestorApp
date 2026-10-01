/**
 * @jest-environment node
 *
 * ADR-889 Φ5 — η σύνθεση «συμβόλαια + ζώνη αντικειμενικής αξίας» της σελίδας αγγελίας: η ζώνη υπάρχει σε **κάθε**
 * παραλλαγή, και αποτυχία στις ζώνες **δεν** ρίχνει τα συμβόλαια.
 *
 * ADR-890 §13.Α — ο κάδος έτους της αγγελίας: ζητούμενη + συμβόλαιο του **ίδιου** κάδου, και αποτυχία των ζητούμενων
 * **δεν** ρίχνει την απάντηση.
 */

import type { AdminFirestore } from '@/lib/api/guarded-route';
import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import type { AdminAreaAssignment } from '@/lib/geo/admin-area-of-point';
import type { ReportedStatCell } from '@/lib/market/market-statistics';
import type { ValueZoneVerdict } from '@/lib/market/value-zone-at-point';

const mockValueZone = jest.fn<Promise<ValueZoneVerdict>, [unknown]>();
jest.mock('@/services/market/value-zones.reader', () => ({
  readValueZoneAt: (position: unknown) => mockValueZone(position),
}));
const mockRows = jest.fn();
const mockSummary = jest.fn();
jest.mock('@/services/market/market-transactions.reader', () => ({
  readAreaRows: (id: string) => mockRows(id),
  readAreaSummary: (id: string) => mockSummary(id),
}));
jest.mock('@/services/places/admin-boundaries.reader', () => ({
  readAdminAreaDirectory: async () => ({ areas: new Map([['municipality:0701', { id: 'municipality:0701', name: 'Δήμος Θεσσαλονίκης' }]]) }),
}));
const mockLatest = jest.fn();
jest.mock('@/services/market/area-market-snapshot.reader', () => ({
  readLatestAreaMarket: (...args: unknown[]) => mockLatest(...args),
}));

import { listingObjectiveValue } from '@/lib/objective-value/listing-objective-value';

import { loadListingMarketContext } from '../listing-market-context.service';

const DB = {} as AdminFirestore;
const TODAY = '2026-09-28';

const READY: ValueZoneVerdict = {
  kind: 'ready',
  zone: { id: 4953, name: 'Θ', price: 3850, validFrom: '2022-01-01' },
  nearEdge: false,
  fronts: [],
};

const THESSALONIKI: AdminAreaAssignment = {
  regionId: 'region:112',
  regionalUnitId: 'regional_unit:07',
  municipalityId: 'municipality:0701',
  municipalUnitId: null,
  communityId: null,
  nearBoundary: false,
};

const CONTRACT: ReportedStatCell = { n: 40, median: 1500, p25: 1200, p75: 1800 };
const ASKING: ReportedStatCell = { n: 6, median: 1800, p25: 1600, p75: 2000 };
const INDEX = { asOf: '2026-06-30', window: { from: 2022, to: 2026 }, categorySegments: [] };

function located(year: number | null) {
  return listing({
    id: 'prop_y',
    adminArea: THESSALONIKI,
    constructionYear: year === null ? null : { provenance: 'declared', value: year, at: '2026-09-02T00:00:00.000Z' },
  });
}

function snapshotWith(buckets: Record<string, unknown> | undefined) {
  const apartment = { unitPrice: { n: 1 }, price: { n: 1 }, size: { n: 1 }, breakdowns: buckets === undefined ? {} : { yearBuilt: { buckets, undeclared: 0 } } };
  return { run: { day: TODAY }, snapshots: new Map([['municipality:0701', { offers: { sale: { segments: { apartment } } } }]]) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockValueZone.mockResolvedValue(READY);
  mockRows.mockResolvedValue({ kind: 'none', index: INDEX });
  mockSummary.mockResolvedValue({
    kind: 'ready',
    index: INDEX,
    file: { segments: { apartment: { last12: CONTRACT, quarters: {}, yearBuilt: { '1960-1984': CONTRACT }, zone: null, priceToZonePct: null } } },
  });
});

describe('loadListingMarketContext — ζώνη αντικειμενικής αξίας', () => {
  it('η ζώνη φτάνει και όταν η αγγελία δεν έχει περιοχή για συμβόλαια', async () => {
    const subject = listing({ id: 'prop_1', adminArea: null });
    expect(await loadListingMarketContext(subject, DB, TODAY)).toMatchObject({ kind: 'no-area', valueZone: READY });
    expect(mockValueZone).toHaveBeenCalledWith(subject.position);
  });

  it('ζώνες μη διαθέσιμες ⇒ valueZone: unavailable — η απάντηση ΔΕΝ πέφτει', async () => {
    mockValueZone.mockResolvedValue({ kind: 'unavailable' });
    const context = await loadListingMarketContext(listing({ id: 'prop_2', adminArea: null }), DB, TODAY);
    expect(context).toEqual({ kind: 'no-area', valueZone: { kind: 'unavailable' }, objectiveValue: { kind: 'no-zone' } });
  });
});

/** ADR-898 Φ3 — η αντικειμενική της αγγελίας υπολογίζεται εδώ, κατά την ανάγνωση, πάνω στη ζώνη που μόλις διαβάστηκε. */
describe('loadListingMarketContext — αντικειμενική αξία της αγγελίας', () => {
  it('ίδια ζώνη, ίδια μέρα αποτίμησης: η σύνθεση = `listingObjectiveValue` — καμία δεύτερη ανάγνωση', async () => {
    const subject = listing({ id: 'prop_3', adminArea: null, heatingType: 'central', amenities: [] });
    const context = await loadListingMarketContext(subject, DB, TODAY);
    expect(context?.objectiveValue).toEqual(listingObjectiveValue(subject, READY, TODAY));
    expect(context?.objectiveValue.kind).toBe('evaluated');
    expect(mockValueZone).toHaveBeenCalledTimes(1);
  });

  it('είδος εκτός εντύπων 1/4 ⇒ `unsupported` — τα συμβόλαια και η ζώνη μένουν', async () => {
    const context = await loadListingMarketContext(listing({ id: 'prop_4', adminArea: null, type: 'shop' }), DB, TODAY);
    expect(context).toMatchObject({ valueZone: READY, objectiveValue: { kind: 'unsupported', reason: 'type' } });
  });
});

describe('loadListingMarketContext — ο κάδος έτους της αγγελίας (ADR-890 §13.Α)', () => {
  it('ζητούμενη ΚΑΙ συμβόλαιο του ίδιου κάδου, με την απόσταση', async () => {
    mockLatest.mockResolvedValue(snapshotWith({ '1960-1984': ASKING }));
    const context = await loadListingMarketContext(located(1978), DB, TODAY);
    if (context?.kind !== 'ready') throw new Error('not ready');
    expect(context.yearBuilt).toEqual({ bucket: '1960-1984', asking: ASKING, contract: CONTRACT, gapPct: 20 });
    expect(mockLatest).toHaveBeenCalledWith(DB, ['municipality:0701'], TODAY);
  });

  it('μετρήθηκε ο άξονας, κανείς στον κάδο ⇒ { n: 0 }, όχι «δεν ξέρω»', async () => {
    mockLatest.mockResolvedValue(snapshotWith({}));
    const context = await loadListingMarketContext(located(1978), DB, TODAY);
    if (context?.kind !== 'ready') throw new Error('not ready');
    expect(context.yearBuilt?.asking).toEqual({ n: 0 });
    expect(context.yearBuilt?.gapPct).toBeNull();
  });

  it('στιγμιότυπο πριν από τον άξονα ⇒ asking: null (δεν μετρήθηκε), ποτέ «0»', async () => {
    mockLatest.mockResolvedValue(snapshotWith(undefined));
    const context = await loadListingMarketContext(located(1978), DB, TODAY);
    if (context?.kind !== 'ready') throw new Error('not ready');
    expect(context.yearBuilt?.asking).toBeNull();
  });

  it('η Firestore πέφτει ⇒ asking: null, τα συμβόλαια ΜΕΝΟΥΝ (όχι 503)', async () => {
    mockLatest.mockRejectedValue(new Error('UNAVAILABLE'));
    const context = await loadListingMarketContext(located(1978), DB, TODAY);
    if (context?.kind !== 'ready') throw new Error('not ready');
    expect(context.yearBuilt).toEqual({ bucket: '1960-1984', asking: null, contract: CONTRACT, gapPct: null });
  });

  it('αγγελία χωρίς έτος ⇒ yearBuilt: null, και καμία ανάγνωση ζητούμενων', async () => {
    const context = await loadListingMarketContext(located(null), DB, TODAY);
    if (context?.kind !== 'ready') throw new Error('not ready');
    expect(context.yearBuilt).toBeNull();
    expect(mockLatest).not.toHaveBeenCalled();
  });
});
