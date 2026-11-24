/**
 * ADR-920 §14.12 phase Α — where the published relief sits on the earth, and whether the owner's declaration can be true.
 *
 * Anchor: Syntagma square (WGS84), taken to the Greek grid through the FORWARD road (`wgs84ToGgrs87` → `geographicToGrid`)
 * — the opposite direction of the code under test, so the expectation is not produced by the function it checks.
 * A 40 m × 40 m survey is laid around that grid point; every number below follows from it.
 */

import { geographicToGrid, gridToGeographic } from '@/lib/geo/egsa87-projection';
import { distanceMeters } from '@/lib/geo/geo-distance';
import { wgs84ToGgrs87 } from '@/lib/geo/ggrs87-datum';
import type { ListingPosition } from '@/types/public-listing';

import { LISTING_TERRAIN_GEOREFERENCE_MIN_TOLERANCE_M } from '../listing-terrain-config';
import { crossCheckWithListing, halfDiagonalM, suggestCoordinateSystem } from '../listing-terrain-georeference';
import { buildListingTerrainSnapshot } from '../listing-terrain-snapshot';
import {
  parseListingTerrainSource,
  toListingTerrainInput,
  type ListingTerrainSource,
  type TerrainSourcePoint,
} from '../listing-terrain-source';
import type { ListingTerrainSnapshot, TerrainCoordinateSystem } from '../listing-terrain-types';

const SYNTAGMA = { lat: 37.9755, lng: 23.7348 };
const HALF_MM = 20_000;
const AT = '2026-11-24T00:00:00.000Z';

function gridOf(point: { lat: number; lng: number }): { E: number; N: number } {
  const local = wgs84ToGgrs87(point.lat, point.lng);
  return geographicToGrid(local.lat, local.lon);
}

/** Four corners + the centre, canonical mm, around a grid point given in METRES. */
function surveyAround(eastingM: number, northingM: number): TerrainSourcePoint[] {
  const e = Math.round(eastingM * 1000);
  const n = Math.round(northingM * 1000);
  return [
    [e - HALF_MM, n - HALF_MM, 100_000], [e + HALF_MM, n - HALF_MM, 101_000],
    [e + HALF_MM, n + HALF_MM, 102_000], [e - HALF_MM, n + HALF_MM, 101_000], [e, n, 101_000],
  ];
}

function sourceOf(points: TerrainSourcePoint[], system: TerrainCoordinateSystem | null, consent = false): ListingTerrainSource {
  const source = parseListingTerrainSource({
    version: 3, points, breaklines: [], boundary: null, envelope: null, plotOutline: null,
    coordinateSystem: system, showLocationInListing: consent,
  });
  if (source === null) throw new Error('fixture source refused');
  return source;
}

function snapshotOf(source: ListingTerrainSource, audience: 'owner' | 'public'): ListingTerrainSnapshot {
  const built = buildListingTerrainSnapshot(toListingTerrainInput(source, audience));
  if (!built.ok) throw new Error(`expected a snapshot, got ${built.reason}`);
  return built.snapshot;
}

const SYNTAGMA_GRID = gridOf(SYNTAGMA);
const AT_SYNTAGMA = surveyAround(SYNTAGMA_GRID.E, SYNTAGMA_GRID.N);

describe('ADR-920 §14.12 Α — the georeference of a declared Greek-grid survey', () => {
  const snapshot = snapshotOf(sourceOf(AT_SYNTAGMA, 'EPSG:2100'), 'owner');

  it('the centre is the WGS84 point the survey was laid around — within a centimetre of rounding', () => {
    expect(snapshot.georeferenceOmission).toBeNull();
    expect(distanceMeters(snapshot.georeference!.centre, SYNTAGMA)).toBeLessThan(0.02);
  });

  it('the datum shift is applied: projection alone would sit hundreds of metres away', () => {
    const projectionOnly = gridToGeographic(SYNTAGMA_GRID.E, SYNTAGMA_GRID.N);
    const offset = distanceMeters(snapshot.georeference!.centre, { lat: projectionOnly.lat, lng: projectionOnly.lon });
    expect(offset).toBeGreaterThan(200);
  });

  it('degrees are rounded to 1e-7 and the convergence to 1e-4 — byte-stable', () => {
    const { centre, gridConvergenceDeg } = snapshot.georeference!;
    expect(Number(centre.lat.toFixed(7))).toBe(centre.lat);
    expect(Number(centre.lng.toFixed(7))).toBe(centre.lng);
    expect(Number(gridConvergenceDeg.toFixed(4))).toBe(gridConvergenceDeg);
  });

  it('grid convergence: west of the central meridian it is negative, on it zero, east of it positive', () => {
    const at = (eastingM: number) =>
      snapshotOf(sourceOf(surveyAround(eastingM, SYNTAGMA_GRID.N), 'EPSG:2100'), 'owner').georeference!.gridConvergenceDeg;
    expect(SYNTAGMA_GRID.E).toBeLessThan(500_000);
    expect(snapshot.georeference!.gridConvergenceDeg).toBeLessThan(0);
    expect(at(500_000)).toBe(0);
    expect(at(600_000)).toBeGreaterThan(0);
  });

  it('the geometry is unchanged by the declaration — only the two new fields differ', () => {
    const undeclared = snapshotOf(sourceOf(AT_SYNTAGMA, null), 'owner');
    expect({ ...snapshot, georeference: null, georeferenceOmission: 'crs-undeclared' }).toStrictEqual(undeclared);
  });
});

describe('ADR-920 §14.12 Α — a position nobody vouched for is never published', () => {
  it('undeclared ⇒ omitted by name; local ⇒ omitted by name', () => {
    expect(snapshotOf(sourceOf(AT_SYNTAGMA, null), 'owner')).toMatchObject({ georeference: null, georeferenceOmission: 'crs-undeclared' });
    expect(snapshotOf(sourceOf(AT_SYNTAGMA, 'local'), 'owner')).toMatchObject({ georeference: null, georeferenceOmission: 'crs-local' });
  });

  it('declared Greek grid, but local numbers (around the origin) ⇒ outside the area of use, no position', () => {
    const local = snapshotOf(sourceOf(surveyAround(100, 100), 'EPSG:2100'), 'owner');
    expect(local).toMatchObject({ georeference: null, georeferenceOmission: 'outside-area-of-use' });
  });

  it('ONE corner outside the area of use is enough — the declaration cannot be true for part of a survey', () => {
    // The registry's western edge is E 94 874.71 m: a survey straddling it has its centre inside and a corner outside.
    const straddling = snapshotOf(sourceOf(surveyAround(94_880, 4_200_000), 'EPSG:2100'), 'owner');
    expect(straddling.georeferenceOmission).toBe('outside-area-of-use');
  });

  it('the PUBLIC derivative carries nothing without the consent — neither a position nor a note that one exists', () => {
    const withheld = snapshotOf(sourceOf(AT_SYNTAGMA, 'EPSG:2100', false), 'public');
    expect(withheld).toMatchObject({ georeference: null, georeferenceOmission: null });
    const bytes = JSON.stringify(withheld);
    // No world coordinate in any spelling: neither the grid metres nor the WGS84 degrees of the centre.
    expect(bytes).not.toContain(String(Math.round(SYNTAGMA_GRID.E)));
    expect(bytes).not.toContain('37.975');
    expect(bytes).not.toContain('23.734');
  });

  it('with the consent the public derivative carries exactly what the owner sees', () => {
    const consented = sourceOf(AT_SYNTAGMA, 'EPSG:2100', true);
    expect(snapshotOf(consented, 'public').georeference).toStrictEqual(snapshotOf(consented, 'owner').georeference);
  });

  it('the consent alone moves nothing in the owner\'s own derivative', () => {
    expect(snapshotOf(sourceOf(AT_SYNTAGMA, 'EPSG:2100', true), 'owner'))
      .toStrictEqual(snapshotOf(sourceOf(AT_SYNTAGMA, 'EPSG:2100', false), 'owner'));
  });
});

describe('ADR-920 §14.12 Α — what the numbers suggest (never applied)', () => {
  it('all inside ⇒ the Greek grid; none inside ⇒ local; split ⇒ no suggestion', () => {
    expect(suggestCoordinateSystem(AT_SYNTAGMA)).toStrictEqual({ system: 'EPSG:2100', insideShare: 1 });
    expect(suggestCoordinateSystem(surveyAround(100, 100))).toStrictEqual({ system: 'local', insideShare: 0 });
    expect(suggestCoordinateSystem([...AT_SYNTAGMA, [0, 0, 0]])).toBeNull();
    expect(suggestCoordinateSystem([])).toBeNull();
  });
});

describe('ADR-920 §14.12 Α — the cross-check against the listing\'s position', () => {
  const snapshot = snapshotOf(sourceOf(AT_SYNTAGMA, 'EPSG:2100'), 'owner');
  const georeference = snapshot.georeference!;
  const reach = halfDiagonalM(snapshot);

  /** A point `metres` due north of Syntagma (one degree of latitude ≈ 111 195 m on the sphere the SSoT uses). */
  const north = (metres: number) => ({ lat: SYNTAGMA.lat + metres / 111_195, lng: SYNTAGMA.lng });
  const geocoded = (metres: number, accuracy: 'exact' | 'interpolated' | 'approximate' | 'center'): ListingPosition =>
    ({ kind: 'known', provenance: 'geocoded', point: north(metres), locatedAt: AT, accuracy });
  const pin = (metres: number): ListingPosition => ({ kind: 'known', provenance: 'manual', point: north(metres), locatedAt: AT });

  it('the reach of a 40 m × 40 m survey is half its diagonal', () => {
    expect(reach).toBeCloseTo(Math.hypot(20, 20), 2);
  });

  it('a pin has NO uncertainty of its own — the floor applies, plus the survey\'s reach', () => {
    const tolerance = Math.ceil(LISTING_TERRAIN_GEOREFERENCE_MIN_TOLERANCE_M + reach);
    expect(crossCheckWithListing(georeference, reach, pin(200))).toMatchObject({ ok: true, toleranceM: tolerance });
    expect(crossCheckWithListing(georeference, reach, pin(400))).toMatchObject({ ok: false, reason: 'far-from-listing', toleranceM: tolerance });
  });

  it.each<['exact' | 'interpolated' | 'approximate' | 'center', number, number]>([
    ['exact', 200, 400],
    ['interpolated', 200, 400],
    ['approximate', 1_400, 1_700],
    ['center', 9_900, 10_300],
  ])('a geocoded position (%s) tolerates its own uncertainty: %d m agrees, %d m is refused', (accuracy, near, far) => {
    expect(crossCheckWithListing(georeference, reach, geocoded(near, accuracy)).ok).toBe(true);
    expect(crossCheckWithListing(georeference, reach, geocoded(far, accuracy))).toMatchObject({ ok: false, reason: 'far-from-listing' });
  });

  it('the refusal carries the MEASURED distance, in whole metres', () => {
    const check = crossCheckWithListing(georeference, reach, pin(3_200));
    expect(check).toMatchObject({ ok: false, reason: 'far-from-listing' });
    if (check.ok || check.reason !== 'far-from-listing') throw new Error('expected a measured refusal');
    expect(Number.isInteger(check.distanceM)).toBe(true);
    expect(Math.abs(check.distanceM - 3_200)).toBeLessThan(5);
  });

  it.each<['owner-declined' | 'never-asked']>([['owner-declined'], ['never-asked']])(
    'a listing that says nothing about where it is (%s) cannot vouch for anything', (reason) => {
      expect(crossCheckWithListing(georeference, reach, { kind: 'unknown', reason }))
        .toStrictEqual({ ok: false, reason: 'listing-position-unknown' });
    });
});
