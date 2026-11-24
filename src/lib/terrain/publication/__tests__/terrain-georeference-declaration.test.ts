/**
 * ADR-920 §14.12 phase Α — what the owner SAYS about where the survey is: the door's two amendments, the ONE judge of a
 * Greek-grid declaration (what the card shows IS what the door enforces), and the status the card reads.
 *
 * Fixture: a 40 m × 40 m survey at E 400 km / N 4 200 km (inside the EPSG:2100 area of use). Its own WGS84 centre is
 * taken from the built snapshot and listing positions are placed relative to it.
 */

import { parsePlotOutlineAmendment } from '@/lib/terrain/plot-outline/plot-outline-confirmation';
import type { ListingPosition } from '@/types/public-listing';

import { judgeListingTerrainSource } from '../listing-terrain-judge';
import { parseListingTerrainSource, withCoordinateSystem, type ListingTerrainSource } from '../listing-terrain-source';
import {
  parseTerrainGeoreferenceAmendment,
  parseTerrainGeoreferenceView,
  readAsGreekGrid,
  refusalOfGreekGridReading,
  terrainGeoreferenceStatusOf,
} from '../terrain-georeference-declaration';
import { isTerrainRefusalCode } from '../terrain-publication-contract';

const AT = '2026-11-24T00:00:00.000Z';

function survey(e0: number, n0: number): ListingTerrainSource {
  const source = parseListingTerrainSource({
    version: 3,
    points: [[e0, n0, 100_000], [e0 + 40_000, n0, 101_000], [e0 + 40_000, n0 + 40_000, 102_000], [e0, n0 + 40_000, 101_000]],
    breaklines: [], boundary: null, envelope: null, plotOutline: null, coordinateSystem: null, showLocationInListing: false,
  });
  if (source === null) throw new Error('fixture source refused');
  return source;
}

const IN_GREECE = survey(400_000_000, 4_200_000_000);
const LOCAL = survey(0, 0);

/** The survey's own centre, as the builder computes it once declared. */
function centreOf(source: ListingTerrainSource): { lat: number; lng: number } {
  const verdict = judgeListingTerrainSource(withCoordinateSystem(source, 'EPSG:2100'));
  if (!verdict.ok || verdict.snapshot.georeference === null) throw new Error('fixture has no georeference');
  return verdict.snapshot.georeference.centre;
}

const CENTRE = centreOf(IN_GREECE);
const pinAt = (metresNorth: number): ListingPosition =>
  ({ kind: 'known', provenance: 'manual', point: { lat: CENTRE.lat + metresNorth / 111_195, lng: CENTRE.lng }, locatedAt: AT });
const UNKNOWN: ListingPosition = { kind: 'unknown', reason: 'owner-declined' };

describe('ADR-920 §14.12 Α — the door\'s two amendments', () => {
  it('accepts exactly the two kinds', () => {
    expect(parseTerrainGeoreferenceAmendment({ kind: 'coordinate-system', system: 'EPSG:2100' }))
      .toStrictEqual({ kind: 'coordinate-system', system: 'EPSG:2100' });
    expect(parseTerrainGeoreferenceAmendment({ kind: 'coordinate-system', system: 'local' }))
      .toStrictEqual({ kind: 'coordinate-system', system: 'local' });
    expect(parseTerrainGeoreferenceAmendment({ kind: 'location-visibility', showInListing: true }))
      .toStrictEqual({ kind: 'location-visibility', showInListing: true });
  });

  it.each<[string, unknown]>([
    ['a system nobody can declare', { kind: 'coordinate-system', system: 'EPSG:4326' }],
    ['«undeclare» — the door has no such act', { kind: 'coordinate-system', system: null }],
    ['a coordinate smuggled next to the choice', { kind: 'coordinate-system', system: 'EPSG:2100', centre: { lat: 38, lng: 23 } }],
    ['a consent that is not a yes or a no', { kind: 'location-visibility', showInListing: 'yes' }],
    ['a consent with an extra key', { kind: 'location-visibility', showInListing: true, coordinateSystem: 'EPSG:2100' }],
    ['the outline\'s visibility kind', { kind: 'visibility', showInListing: true }],
    ['nothing', null],
  ])('refuses %s', (_label, raw) => {
    expect(parseTerrainGeoreferenceAmendment(raw)).toBeNull();
  });

  it('the two vocabularies do not overlap: the outline\'s parser refuses both georeference kinds', () => {
    expect(parsePlotOutlineAmendment({ kind: 'coordinate-system', system: 'EPSG:2100' })).toBeNull();
    expect(parsePlotOutlineAmendment({ kind: 'location-visibility', showInListing: true })).toBeNull();
  });
});

describe('ADR-920 §14.12 Α — reading a survey as the Greek grid (the ONE judge)', () => {
  it('near the listing ⇒ agrees, with the measured distance and the tolerance', () => {
    const reading = readAsGreekGrid(IN_GREECE, pinAt(120));
    expect(reading).toMatchObject({ kind: 'agrees' });
    if (reading?.kind !== 'agrees') throw new Error('expected agreement');
    expect(Math.abs(reading.distanceM - 120)).toBeLessThan(3);
    expect(reading.toleranceM).toBe(Math.ceil(250 + Math.hypot(20, 20)));
    expect(refusalOfGreekGridReading(reading)).toBeNull();
  });

  it('far from the listing ⇒ refused by name', () => {
    const reading = readAsGreekGrid(IN_GREECE, pinAt(5_000))!;
    expect(reading.kind).toBe('far-from-listing');
    expect(refusalOfGreekGridReading(reading)).toBe('TERRAIN_GEOREFERENCE_FAR_FROM_LISTING');
  });

  it('local numbers ⇒ outside the area of use — whatever the listing says', () => {
    const reading = readAsGreekGrid(LOCAL, pinAt(0))!;
    expect(reading).toStrictEqual({ kind: 'outside-area-of-use' });
    expect(refusalOfGreekGridReading(reading)).toBe('TERRAIN_GEOREFERENCE_OUTSIDE_AREA_OF_USE');
  });

  it('a listing without a position ⇒ refused by name: nothing independent to check against', () => {
    const reading = readAsGreekGrid(IN_GREECE, UNKNOWN)!;
    expect(reading).toStrictEqual({ kind: 'listing-position-unknown' });
    expect(refusalOfGreekGridReading(reading)).toBe('TERRAIN_GEOREFERENCE_LISTING_POSITION_UNKNOWN');
  });

  it('every refusal is a code of the closed list', () => {
    for (const position of [pinAt(5_000), UNKNOWN]) {
      expect(isTerrainRefusalCode(refusalOfGreekGridReading(readAsGreekGrid(IN_GREECE, position)!))).toBe(true);
    }
  });

  it('the reading never depends on what is ALREADY declared — it answers «what if it were the Greek grid»', () => {
    const declaredLocal = withCoordinateSystem(IN_GREECE, 'local')!;
    expect(readAsGreekGrid(declaredLocal, pinAt(120))).toStrictEqual(readAsGreekGrid(IN_GREECE, pinAt(120)));
  });
});

describe('ADR-920 §14.12 Α — the status the owner\'s card reads', () => {
  it('reports what is declared, what the numbers suggest, and the reading — and survives the wire', () => {
    const status = terrainGeoreferenceStatusOf(IN_GREECE, pinAt(120))!;
    expect(status).toMatchObject({
      coordinateSystem: null, showLocationInListing: false, suggestion: 'EPSG:2100', greekGrid: { kind: 'agrees' },
    });
    const wire = JSON.parse(JSON.stringify({ georeference: status }));
    expect(parseTerrainGeoreferenceView(wire)).toStrictEqual({ georeference: status });
  });

  it('local numbers are suggested as local, and the reading says why the Greek grid is not on offer', () => {
    expect(terrainGeoreferenceStatusOf(LOCAL, pinAt(0))).toMatchObject({
      suggestion: 'local', greekGrid: { kind: 'outside-area-of-use' },
    });
  });

  it('carries NO coordinate: the card is told a distance, never where the plot is', () => {
    const bytes = JSON.stringify(terrainGeoreferenceStatusOf(withCoordinateSystem(IN_GREECE, 'EPSG:2100')!, pinAt(120)));
    expect(bytes).not.toMatch(/"lat"|"lng"|centre/);
  });

  it('the view without a relief is `null`, and anything else is refused', () => {
    expect(parseTerrainGeoreferenceView({ georeference: null })).toStrictEqual({ georeference: null });
    expect(parseTerrainGeoreferenceView({})).toBeNull();
    expect(parseTerrainGeoreferenceView({ georeference: { coordinateSystem: 'EPSG:2100' } })).toBeNull();
  });
});
