/**
 * ADR-920 Β2 — the published terrain of a plot listing.
 *
 * Fixture: a 20 m × 20 m plot at real ΕΓΣΑ'87 magnitudes (E 400 km, N 4 200 km, in canonical mm),
 * rising 10 % to the east from 120 m. Every expectation below is derivable by hand from that plane.
 */

import type { TopoPoint } from '@/lib/terrain/terrain-types';
import type { PlanarPoint } from '@/lib/geometry/planar-polygon';
import { buildListingTerrainSnapshot } from '../listing-terrain-snapshot';
import { chooseContourConfig } from '../contour-interval';
import { classifySlope } from '../terrain-slope';
import type { ListingTerrainInput, ListingTerrainSnapshot } from '../listing-terrain-types';

const E0 = 400_000_000;
const N0 = 4_200_000_000;
const STEP = 2_000;
const SIZE = 20_000;

function planeZ(x: number, slope = 0.1): number {
  return 120_000 + slope * (x - E0);
}

function grid(slope = 0.1): TopoPoint[] {
  const points: TopoPoint[] = [];
  for (let x = E0; x <= E0 + SIZE; x += STEP) {
    for (let y = N0; y <= N0 + SIZE; y += STEP) points.push({ x, y, z: planeZ(x, slope) });
  }
  return points;
}

function square(cx: number, cy: number, half: number): PlanarPoint[] {
  return [
    { x: cx - half, y: cy - half },
    { x: cx + half, y: cy - half },
    { x: cx + half, y: cy + half },
    { x: cx - half, y: cy + half },
  ];
}

const CENTRE = { x: E0 + SIZE / 2, y: N0 + SIZE / 2 };

function build(overrides: Partial<ListingTerrainInput> = {}): ListingTerrainSnapshot {
  const result = buildListingTerrainSnapshot({ points: grid(), boundaryWorldMm: null, envelope: null, ...overrides });
  if (!result.ok) throw new Error(`expected a snapshot, got ${result.reason}`);
  return result.snapshot;
}

describe('ADR-920 Β2 — no world coordinate leaves the snapshot (Δ3)', () => {
  it('every plan coordinate is metres from the surface centre, not ΕΓΣΑ', () => {
    const s = build({
      boundaryWorldMm: square(CENTRE.x, CENTRE.y, 8_000),
      envelope: { footprintWorldMm: square(CENTRE.x, CENTRE.y, 4_000), maxHeightM: 7.5 },
    });
    const plan: number[] = [];
    for (let i = 0; i < s.mesh.positions.length; i += 3) plan.push(s.mesh.positions[i], s.mesh.positions[i + 1]);
    plan.push(...(s.boundary ?? []), ...(s.envelope?.footprint ?? []));
    s.contours.forEach((c) => plan.push(...c.points));
    expect(plan.length).toBeGreaterThan(0);
    expect(Math.max(...plan.map(Math.abs))).toBeLessThanOrEqual(10);
  });

  it('keeps elevations absolute, in metres', () => {
    const s = build();
    const z = s.mesh.positions.filter((_, i) => i % 3 === 2);
    expect(Math.min(...z)).toBeCloseTo(120, 2);
    expect(Math.max(...z)).toBeCloseTo(122, 2);
  });
});

describe('ADR-920 Β2 — slope', () => {
  it('reads a 10 % plane as 10 %, falling west', () => {
    const { stats, mesh } = build();
    expect(stats.meanSlopePct).toBeCloseTo(10, 1);
    expect(stats.maxSlopePct).toBeCloseTo(10, 1);
    expect(stats.downslopeAzimuthDeg).toBeCloseTo(270, 1);
    expect(new Set(mesh.slopeClass)).toEqual(new Set([1]));
    expect(mesh.slopeClass).toHaveLength(mesh.triangles.length / 3);
  });

  it('gives flat ground no direction', () => {
    const result = buildListingTerrainSnapshot({ points: grid(0), boundaryWorldMm: null, envelope: null });
    expect(result.ok && result.snapshot.stats.downslopeAzimuthDeg).toBeNull();
  });

  it('classifies on the band bounds: lower bound inclusive', () => {
    const bands = [5, 15, 25];
    expect([0, 4.99, 5, 14.99, 15, 25, 80].map((p) => classifySlope(p, bands))).toEqual([0, 0, 1, 1, 2, 3, 3]);
  });
});

describe('ADR-920 Β2 — statistics and contours', () => {
  it('measures the surveyed surface', () => {
    const { stats } = build();
    expect(stats.planAreaM2).toBeCloseTo(400, 1);
    expect(stats.minElevationM).toBe(120);
    expect(stats.maxElevationM).toBe(122);
    expect(stats.reliefM).toBe(2);
  });

  it('chooses the finest readable interval and contours on it', () => {
    const s = build();
    expect(s.contourIntervalM).toBe(0.1);
    expect(s.contourMajorEvery).toBe(5);
    expect(s.contours.length).toBeGreaterThan(10);
    for (const c of s.contours) {
      expect(c.levelM).toBeGreaterThanOrEqual(120);
      expect(c.levelM).toBeLessThanOrEqual(122);
      expect(Math.abs(c.levelM * 10 - Math.round(c.levelM * 10))).toBeLessThan(1e-6);
    }
    expect(s.contours.some((c) => c.major)).toBe(true);
  });

  it('follows the cartographic ladder as the relief grows', () => {
    expect(chooseContourConfig(2_000).intervalMm).toBe(100);
    expect(chooseContourConfig(12_000)).toMatchObject({ intervalMm: 500, majorEvery: 5, labelDecimals: 1 });
    expect(chooseContourConfig(7_000)).toMatchObject({ intervalMm: 250, majorEvery: 4, labelDecimals: 2 });
    expect(chooseContourConfig(300_000)).toMatchObject({ intervalMm: 10_000, labelDecimals: 0 });
  });
});

describe('ADR-920 Β2 — the plot boundary', () => {
  it('publishes only the plot', () => {
    const s = build({ boundaryWorldMm: square(CENTRE.x, CENTRE.y, 5_000) });
    expect(s.stats.planAreaM2).toBeCloseTo(100, 1);
    expect(s.boundary).toHaveLength(8);
  });

  it('refuses a boundary that misses the surface instead of publishing the unclipped survey', () => {
    const result = buildListingTerrainSnapshot({
      points: grid(),
      boundaryWorldMm: square(E0 + 900_000, N0, 5_000),
      envelope: null,
    });
    expect(result).toEqual({ ok: false, reason: 'empty-after-clip' });
  });
});

describe('ADR-920 Β2 — the indicative envelope', () => {
  it('stands the footprint on the ground under each vertex', () => {
    const footprint = square(CENTRE.x, CENTRE.y, 4_000);
    const { envelope, envelopeOmission } = build({ envelope: { footprintWorldMm: footprint, maxHeightM: 7.5 } });
    expect(envelopeOmission).toBeNull();
    expect(envelope?.maxHeightM).toBe(7.5);
    expect(envelope?.groundM).toEqual(footprint.map((p) => planeZ(p.x) / 1000));
  });

  it('never guesses a height nobody declared', () => {
    for (const maxHeightM of [null, 0, -3, Number.NaN]) {
      const { envelope } = build({ envelope: { footprintWorldMm: square(CENTRE.x, CENTRE.y, 4_000), maxHeightM } });
      expect(envelope?.maxHeightM).toBeNull();
      expect(envelope?.footprint).toHaveLength(8);
    }
  });

  it('omits, with a reason, a footprint that leaves the surface or has no area', () => {
    const outside = build({ envelope: { footprintWorldMm: square(CENTRE.x, CENTRE.y, 15_000), maxHeightM: 7 } });
    expect(outside).toMatchObject({ envelope: null, envelopeOmission: 'outside-surface' });
    const flat = build({ envelope: { footprintWorldMm: [CENTRE, CENTRE, CENTRE], maxHeightM: 7 } });
    expect(flat).toMatchObject({ envelope: null, envelopeOmission: 'degenerate-footprint' });
  });
});

describe('ADR-920 Β2 — rejections and determinism', () => {
  it('refuses a survey with no surface', () => {
    const noZ: TopoPoint[] = grid().map(({ x, y }) => ({ x, y }));
    expect(buildListingTerrainSnapshot({ points: noZ, boundaryWorldMm: null, envelope: null })).toEqual({
      ok: false,
      reason: 'insufficient-surface',
    });
  });

  it('refuses a surface denser than a listing should carry', () => {
    const result = buildListingTerrainSnapshot(
      { points: grid(), boundaryWorldMm: null, envelope: null },
      { maxTriangles: 10 },
    );
    expect(result).toEqual({ ok: false, reason: 'too-dense' });
  });

  it('builds the same bytes from the same survey', () => {
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });
});
