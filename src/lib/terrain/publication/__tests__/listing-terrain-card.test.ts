/**
 * ADR-920 Β3β — the card a listing carries next to the snapshot URL: ONE derivation, ONE reader.
 *
 * Fixture: the Β2 plane (20 m × 20 m at ΕΓΣΑ'87 magnitudes, rising 10 % to the east), built by the real
 * builder, so the card is checked against what the shelf will actually bake.
 */

import type { TopoPoint } from '@/lib/terrain/terrain-types';
import type { PlanarPoint } from '@/lib/geometry/planar-polygon';
import { buildListingTerrainSnapshot } from '../listing-terrain-snapshot';
import { listingTerrainCardOf, readListingTerrainCard } from '../listing-terrain-card';
import type { ListingTerrainInput, ListingTerrainSnapshot } from '../listing-terrain-types';
import type { TerrainSurveyDeclaration } from '../terrain-survey-declaration';

const E0 = 400_000_000;
const N0 = 4_200_000_000;
const SIZE = 20_000;
const DECLARATION: TerrainSurveyDeclaration = { surveyorName: 'Τοπογράφος Α', surveyedOn: '2026-05-04', rightsAffirmed: true };

function grid(): TopoPoint[] {
  const points: TopoPoint[] = [];
  for (let x = E0; x <= E0 + SIZE; x += 2_000) {
    for (let y = N0; y <= N0 + SIZE; y += 2_000) points.push({ x, y, z: 120_000 + 0.1 * (x - E0) });
  }
  return points;
}

function square(half: number): PlanarPoint[] {
  const cx = E0 + SIZE / 2;
  const cy = N0 + SIZE / 2;
  return [
    { x: cx - half, y: cy - half }, { x: cx + half, y: cy - half },
    { x: cx + half, y: cy + half }, { x: cx - half, y: cy + half },
  ];
}

function snapshotOf(envelope: ListingTerrainInput['envelope']): ListingTerrainSnapshot {
  const result = buildListingTerrainSnapshot({ points: grid(), boundaryWorldMm: null, envelope });
  if (!result.ok) throw new Error(result.reason);
  return result.snapshot;
}

describe('listingTerrainCardOf — the ONE derivation', () => {
  it('carries the snapshot stats and the survey, never the rights answer', () => {
    const snapshot = snapshotOf(null);
    const card = listingTerrainCardOf(snapshot, DECLARATION);
    expect(card.stats).toEqual(snapshot.stats);
    expect(card.snapshotVersion).toBe(snapshot.version);
    expect(card.contourIntervalM).toBe(snapshot.contourIntervalM);
    expect(card.survey).toEqual({ surveyorName: 'Τοπογράφος Α', surveyedOn: '2026-05-04' });
    expect(card).not.toHaveProperty('survey.rightsAffirmed');
    expect(card.envelope).toBeNull();
  });

  it('Α3: a prism only with a numeric height — otherwise the footprint, named', () => {
    expect(listingTerrainCardOf(snapshotOf({ footprintWorldMm: square(4_000), maxHeightM: 7.5 }), DECLARATION).envelope)
      .toEqual({ kind: 'volume', maxHeightM: 7.5 });
    expect(listingTerrainCardOf(snapshotOf({ footprintWorldMm: square(4_000), maxHeightM: null }), DECLARATION).envelope)
      .toEqual({ kind: 'footprint' });
  });

  it('an envelope the builder refused travels as an omission with its reason', () => {
    const outside = snapshotOf({ footprintWorldMm: square(40_000), maxHeightM: 7.5 });
    expect(listingTerrainCardOf(outside, DECLARATION).envelope).toEqual({ kind: 'omitted', reason: 'outside-surface' });
  });

  it('carries no coordinate of the plan (Δ3)', () => {
    const card = listingTerrainCardOf(snapshotOf({ footprintWorldMm: square(4_000), maxHeightM: 7.5 }), DECLARATION);
    const numbers = JSON.stringify(card).match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(numbers.every((n) => Math.abs(n) < 1_000_000)).toBe(true);
  });
});

describe('readListingTerrainCard — the ONE reader', () => {
  const card = listingTerrainCardOf(snapshotOf({ footprintWorldMm: square(4_000), maxHeightM: 7.5 }), DECLARATION);

  it('round-trips a derived card unchanged, and is idempotent', () => {
    const once = readListingTerrainCard(JSON.parse(JSON.stringify(card)));
    expect(once).toEqual(card);
    expect(readListingTerrainCard(once)).toEqual(once);
  });

  it.each([
    ['no survey', { ...card, survey: null }],
    ['empty surveyor', { ...card, survey: { surveyorName: ' ', surveyedOn: '2026-05-04' } }],
    ['azimuth out of range', { ...card, stats: { ...card.stats, downslopeAzimuthDeg: 360 } }],
    ['negative relief', { ...card, stats: { ...card.stats, reliefM: -1 } }],
    ['unknown envelope kind', { ...card, envelope: { kind: 'tower' } }],
    ['zero contour interval', { ...card, contourIntervalM: 0 }],
  ])('refuses %s', (_label, value) => {
    expect(readListingTerrainCard(value)).toBeNull();
  });
});
