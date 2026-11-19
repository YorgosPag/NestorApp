/**
 * @fileoverview 🏆 **Η σειρά των πηγών** — αρχείο πρώτα, Overpass για φρεσκάδα/εμπλουτισμό (ADR-777 §8.104).
 *
 * | Άγκυρα | Μετάλλαξη που πιάνει |
 * |---|---|
 * | Σ1 αρχείο ✅ + Overpass κάτω ⇒ verified **χωρίς** οδό, με `snapshot` | εμπλουτισμός ως πύλη (Overpass κάτω ⇒ «δεν απάντησε») |
 * | Σ2 αρχείο ✅ + Overpass ✅ ⇒ ετικέτες του Overpass, **σημείο του αρχείου** | σημείο από τη ζωντανή πηγή (μη αναπαραγώγιμο) |
 * | Σ3 αρχείο ✅ + Overpass «έσβησε» ⇒ απόρριψη | γραφή στοιχείου που το OSM σήμερα αρνείται |
 * | Σ4 χωρίς `near` / όχι `way` ⇒ μόνο Overpass, `snapshot: null` | άνοιγμα πλακιδίου χωρίς θέση |
 * | Σ5 αρχείο «όχι σε αυτό το build» ⇒ Overpass (φρεσκάδα) | το `absent` του αρχείου ως «δεν υπάρχει στο OSM» |
 * | Σ6 lookup: αρχείο `none` + Overpass κάτω ⇒ `none` · και τα δύο κάτω ⇒ `unavailable` | σύμπτυξη των δύο |
 * | Σ7 περίγραμμα από το αρχείο, Overpass **δεν** ρωτιέται | κάθε εμφάνιση ακόμη στον δημόσιο διακομιστή |
 */
jest.mock('../osm-archive', () => ({
  OSM_ARCHIVE_BUILD: '20260926',
  findArchiveBuildingAt: jest.fn(),
  verifyArchiveBuilding: jest.fn(),
}));
jest.mock('../osm-building', () => ({
  fetchOsmBuildingOutline: jest.fn(),
  findOsmBuildingAt: jest.fn(),
  verifyOsmBuilding: jest.fn(),
}));

import { createDeadline } from '@/lib/async-utils';

import { findArchiveBuildingAt, verifyArchiveBuilding } from '../osm-archive';
import type { ArchiveBuilding } from '../osm-archive-building';
import { fetchOsmBuildingOutline, findOsmBuildingAt, verifyOsmBuilding, type OsmBuildingFact } from '../osm-building';
import {
  buildingOutlineFromSources,
  findBuildingFromSources,
  verifyBuildingFromSources,
} from '../osm-building-source';

const archiveVerify = verifyArchiveBuilding as jest.MockedFunction<typeof verifyArchiveBuilding>;
const archiveFind = findArchiveBuildingAt as jest.MockedFunction<typeof findArchiveBuildingAt>;
const liveVerify = verifyOsmBuilding as jest.MockedFunction<typeof verifyOsmBuilding>;
const liveFind = findOsmBuildingAt as jest.MockedFunction<typeof findOsmBuildingAt>;
const liveOutline = fetchOsmBuildingOutline as jest.MockedFunction<typeof fetchOsmBuildingOutline>;

const NEAR = { lat: 40.5609, lng: 23.0213 };
const BUILDING: ArchiveBuilding = {
  featureId: 2 ** 45 + 980875811,
  ref: { elementType: 'way', elementId: '980875811' },
  outline: [{ lat: 40.5608, lng: 23.0212 }, { lat: 40.561, lng: 23.0212 }, { lat: 40.561, lng: 23.0214 }],
  areaSqm: 155.4,
  point: { lat: 40.56089, lng: 23.02129 },
  houseNumber: '12',
};
const LIVE_FACT: OsmBuildingFact = {
  elementType: 'way',
  elementId: '980875811',
  point: { lat: 40.5, lng: 23.0 },
  address: { street: 'Ελπίδος', houseNumber: '12', city: 'Θέρμη', postalCode: '57001' },
  floorsAboveGround: 2,
  constructionYear: null,
};

beforeEach(() => jest.clearAllMocks());

describe('verifyBuildingFromSources', () => {
  it('🔴 Σ1 — αρχείο ✅ + Overpass κάτω ⇒ verified από το αρχείο, οδός `null`, snapshot', async () => {
    archiveVerify.mockResolvedValue({ kind: 'verified', building: BUILDING });
    liveVerify.mockResolvedValue({ kind: 'unavailable' });
    const verdict = await verifyBuildingFromSources('way', '980875811', NEAR);
    expect(verdict).toEqual({
      kind: 'verified',
      snapshot: { build: '20260926' },
      fact: expect.objectContaining({
        point: BUILDING.point,
        address: { street: null, houseNumber: '12', city: null, postalCode: null },
        floorsAboveGround: null,
      }),
    });
  });

  it('🔴 Σ2 — αρχείο ✅ + Overpass ✅ ⇒ ετικέτες του Overpass, σημείο του αρχείου', async () => {
    archiveVerify.mockResolvedValue({ kind: 'verified', building: BUILDING });
    liveVerify.mockResolvedValue({ kind: 'verified', fact: LIVE_FACT });
    const verdict = await verifyBuildingFromSources('way', '980875811', NEAR);
    expect(verdict).toEqual({ kind: 'verified', snapshot: { build: '20260926' }, fact: { ...LIVE_FACT, point: BUILDING.point } });
  });

  it.each(['absent', 'not-a-building'] as const)('🔴 Σ3 — αρχείο ✅ + Overpass «%s» ⇒ νικά η νεότερη πηγή', async (kind) => {
    archiveVerify.mockResolvedValue({ kind: 'verified', building: BUILDING });
    liveVerify.mockResolvedValue({ kind });
    expect(await verifyBuildingFromSources('way', '980875811', NEAR)).toEqual({ kind });
  });

  it.each([
    ['χωρίς near', 'way', null],
    ['relation', 'relation', NEAR],
  ] as const)('🔑 Σ4 — %s ⇒ μόνο Overpass, snapshot null', async (_label, type, near) => {
    liveVerify.mockResolvedValue({ kind: 'verified', fact: LIVE_FACT });
    expect(await verifyBuildingFromSources(type, '1', near)).toEqual({ kind: 'verified', fact: LIVE_FACT, snapshot: null });
    expect(archiveVerify).not.toHaveBeenCalled();
  });

  it('🔴 Σ5 — «όχι σε αυτό το build» ⇒ Overpass για φρεσκάδα', async () => {
    archiveVerify.mockResolvedValue({ kind: 'absent' });
    liveVerify.mockResolvedValue({ kind: 'verified', fact: LIVE_FACT });
    expect(await verifyBuildingFromSources('way', '980875811', NEAR)).toEqual({ kind: 'verified', fact: LIVE_FACT, snapshot: null });
  });
});

describe('findBuildingFromSources — Σ6', () => {
  const run = async () => {
    const deadline = createDeadline(1_000);
    try {
      return await findBuildingFromSources(NEAR, deadline);
    } finally {
      deadline.dispose();
    }
  };

  it('🔑 αρχείο found ⇒ καμία κλήση Overpass', async () => {
    archiveFind.mockResolvedValue({ kind: 'found', building: { ...BUILDING, ref: { elementType: 'way', elementId: '980875811' } } });
    expect((await run()).kind).toBe('found');
    expect(liveFind).not.toHaveBeenCalled();
  });

  it('🔴 αρχείο none + Overpass κάτω ⇒ none (το αρχείο ΑΠΑΝΤΗΣΕ)', async () => {
    archiveFind.mockResolvedValue({ kind: 'none' });
    liveFind.mockResolvedValue({ kind: 'unavailable' });
    expect(await run()).toEqual({ kind: 'none' });
  });

  it('🔴 και τα δύο κάτω ⇒ unavailable (ποτέ «δεν υπάρχει κτίριο»)', async () => {
    archiveFind.mockResolvedValue({ kind: 'unavailable' });
    liveFind.mockResolvedValue({ kind: 'unavailable' });
    expect(await run()).toEqual({ kind: 'unavailable' });
  });
});

describe('buildingOutlineFromSources — Σ7', () => {
  it('🔴 περίγραμμα από το αρχείο, ο Overpass δεν ρωτιέται', async () => {
    archiveVerify.mockResolvedValue({ kind: 'verified', building: BUILDING });
    expect(await buildingOutlineFromSources('way', '980875811', NEAR)).toEqual({ kind: 'outline', outline: BUILDING.outline });
    expect(liveOutline).not.toHaveBeenCalled();
  });

  it('🔑 παρονομαστής: αρχείο absent ⇒ Overpass', async () => {
    archiveVerify.mockResolvedValue({ kind: 'absent' });
    liveOutline.mockResolvedValue({ kind: 'no-shape' });
    expect(await buildingOutlineFromSources('way', '980875811', NEAR)).toEqual({ kind: 'no-shape' });
    expect(liveOutline).toHaveBeenCalledTimes(1);
  });
});
