/**
 * @jest-environment node
 */
/**
 * ADR-891 Φ2 — η κλιμακωτή κάλυψη του χάρτη φόντου: ζώνες zoom, επικράτεια από τα όρια, ζώνη ασφαλείας σε km.
 */

import {
  BASEMAP_MAX_ZOOM,
  BASEMAP_TIERS,
  assertTierPartition,
  bboxArgument,
  expandBox,
  territoryLeaves,
  tierExtent,
  unionBox,
  type BasemapTier,
  type TerritoryBoundary,
} from '../basemap-coverage';

const box = (west: number, south: number, east: number, north: number) => ({ west, south, east, north });

/** Μικρή ιεραρχία: περιφέρεια με δύο δήμους, και «Άγιο Όρος» όπου η ιεραρχία σταματά στην περιφέρεια. */
const PARENTS = new Map<string, string | null>([
  ['region:1', null],
  ['regional_unit:11', 'region:1'],
  ['municipality:1101', 'regional_unit:11'],
  ['municipality:1102', 'regional_unit:11'],
  ['region:9', null],
  ['community:110101', 'municipality:1101'],
]);
const parentOf = (id: string) => PARENTS.get(id) ?? null;

const BOUNDARIES: TerritoryBoundary[] = [
  { id: 'region:1', level: 3, bbox: box(20, 37, 24, 40) },
  { id: 'municipality:1101', level: 5, bbox: box(20, 37, 22, 38) },
  { id: 'municipality:1102', level: 5, bbox: box(22, 38, 24, 40) },
  { id: 'region:9', level: 3, bbox: box(24, 40, 24.4, 40.4) },
  { id: 'community:110101', level: 7, bbox: box(20.1, 37.1, 20.2, 37.2) },
];

describe('ζώνες zoom', () => {
  it('ο πίνακας χωρίζει ακριβώς το 0…15, συνεχείς και ξένες (το merge θέλει ξένα αρχεία)', () => {
    expect(() => assertTierPartition(BASEMAP_TIERS)).not.toThrow();
    expect(BASEMAP_TIERS[BASEMAP_TIERS.length - 1].maxZoom).toBe(BASEMAP_MAX_ZOOM);
  });

  it.each([
    ['κενό zoom', [{ id: 'a', minZoom: 0, maxZoom: 5 }, { id: 'b', minZoom: 7, maxZoom: 15 }]],
    ['επικάλυψη', [{ id: 'a', minZoom: 0, maxZoom: 8 }, { id: 'b', minZoom: 8, maxZoom: 15 }]],
    ['σταματά νωρίς', [{ id: 'a', minZoom: 0, maxZoom: 14 }]],
    ['δεν αρχίζει στο 0', [{ id: 'a', minZoom: 1, maxZoom: 15 }]],
  ])('απορρίπτεται: %s', (_label, partial) => {
    const tiers = partial.map((t) => ({ ...t, area: { kind: 'world' as const }, why: '' }));
    expect(() => assertTierPartition(tiers)).toThrow();
  });

  it('όσο μεγαλώνει το zoom, η περιοχή μόνο στενεύει (αλλιώς πληρώνουμε λεπτομέρεια εκτός στόχου)', () => {
    const radii = BASEMAP_TIERS.map((t) => (t.area.kind === 'world' ? Infinity : t.area.kind === 'territory-radius' ? t.area.radiusKm : t.area.marginKm));
    expect([...radii].sort((a, b) => b - a)).toEqual(radii);
  });
});

describe('επικράτεια = φύλλα της ιεραρχίας έως τον δήμο', () => {
  const leaves = territoryLeaves(BOUNDARIES, parentOf).map((l) => l.id).sort();

  it('όπου υπάρχουν δήμοι, κρατούνται οι δήμοι — όχι η περιφέρειά τους', () => {
    expect(leaves).toEqual(expect.arrayContaining(['municipality:1101', 'municipality:1102']));
    expect(leaves).not.toContain('region:1');
  });

  it('όπου η ιεραρχία σταματά νωρίτερα (Άγιο Όρος), κρατείται ό,τι υπάρχει — δεν χάνεται', () => {
    expect(leaves).toContain('region:9');
  });

  it('ο γονέας χωρίς αρχείο (περιφερειακή ενότητα) δεν σπάει τη σύνδεση με τον πρόγονο', () => {
    expect(leaves).not.toContain('region:1');
  });

  it('βαθμίδες κάτω από τον δήμο αγνοούνται', () => {
    expect(leaves).not.toContain('community:110101');
  });
});

describe('ζώνη ασφαλείας σε km', () => {
  it('διευρύνει τουλάχιστον κατά km σε κάθε κατεύθυνση (γεωγραφικό μήκος στο πιο πολικό άκρο)', () => {
    const expanded = expandBox(box(20, 37, 24, 40), 15);
    const kmPerLonDegreeAtNorth = 111.32 * Math.cos((expanded.north * Math.PI) / 180);
    expect((20 - expanded.west) * kmPerLonDegreeAtNorth).toBeCloseTo(15, 6);
    expect((37 - expanded.south) * 111.32).toBeCloseTo(15, 6);
  });

  it('δεν ξεπερνά τα όρια του Web Mercator', () => {
    const huge = expandBox(box(-170, -80, 170, 80), 5000);
    expect(huge.west).toBe(-180);
    expect(huge.east).toBe(180);
    expect(huge.north).toBeLessThanOrEqual(85.0511);
  });
});

describe('περιοχή ανά ζώνη', () => {
  const leaves = territoryLeaves(BOUNDARIES, parentOf);
  const tier = (area: BasemapTier['area']): BasemapTier => ({ id: 't', minZoom: 0, maxZoom: 15, area, why: '' });

  it('world = όλη η Γη', () => {
    expect(tierExtent(tier({ kind: 'world' }), leaves)).toEqual({ kind: 'bbox', bbox: box(-180, -85.0511, 180, 85.0511) });
  });

  it('territory-radius = ορθογώνιο της επικράτειας + ακτίνα', () => {
    const extent = tierExtent(tier({ kind: 'territory-radius', radiusKm: 100 }), leaves);
    if (extent.kind !== 'bbox') throw new Error('αναμενόταν bbox');
    expect(extent.bbox).toEqual(expandBox(unionBox(leaves.map((l) => l.bbox)), 100));
  });

  it('territory = ένα ορθογώνιο ανά όριο, το καθένα με τη ζώνη του — ποτέ ένα ενιαίο ορθογώνιο', () => {
    const extent = tierExtent(tier({ kind: 'territory', marginKm: 15 }), leaves);
    if (extent.kind !== 'region') throw new Error('αναμενόταν region');
    expect(extent.region.coordinates).toHaveLength(leaves.length);
    const [ring] = extent.region.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('επικράτεια χωρίς όρια = σφάλμα, όχι άδειο αρχείο', () => {
    expect(() => tierExtent(tier({ kind: 'territory', marginKm: 15 }), [])).toThrow();
    expect(() => unionBox([])).toThrow();
  });

  it('--bbox = west,south,east,north με 6 δεκαδικά', () => {
    expect(bboxArgument(box(19.123456789, 34.7, 29.75, 41.8))).toBe('19.123457,34.7,29.75,41.8');
  });
});
