/**
 * ADR-920 Β6.8 — the contour interval follows the on-screen DENSITY, not only the relief.
 *
 *   - `RIDGE`: the «barcode» of the live test (HANDOFFS/topo-test-ridge-dense.txt, rebuilt): 12 × 60 m, a saw-tooth
 *     0 → 3 → 0 → 3 → 0 m across x (gradient exactly 1, i.e. 100 %), constant along y. The relief alone (3 m) says 0.1 m
 *     ⇒ 30 lines in 12 m. Content 12 × 60 m ⇒ margin 6 m ⇒ view box 24 m wide ⇒ 480 / 24 = 20 px per metre at the
 *     reference width ⇒ 0.1 m lines fall 2 px apart, 0.2 m → 4 px, 0.25 m → 5 px, 0.5 m → 10 px ≥ 6 ⇒ 0.5 m.
 */

import type { TopoPoint } from '@/lib/terrain/terrain-types';

import { chooseContourConfig } from '../contour-interval';
import {
  LISTING_TERRAIN_CONTOUR_MIN_SPACING_PX,
  LISTING_TERRAIN_CONTOUR_REFERENCE_WIDTH_PX,
} from '../listing-terrain-config';
import { buildListingTerrainSnapshot } from '../listing-terrain-snapshot';
import { areaWeightedGradientQuantile, contourSpacingPx, referencePxPerM } from '../terrain-contour-density';

const E0 = 400_000_000;
const N0 = 4_200_000_000;
const every = (from: number, to: number, step: number): number[] =>
  Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step);

function snapshotOf(xs: readonly number[], ys: readonly number[], zMmAt: (xM: number) => number) {
  const points: TopoPoint[] = xs.flatMap((x) => ys.map((y) => ({ x: E0 + x * 1000, y: N0 + y * 1000, z: zMmAt(x) })));
  const result = buildListingTerrainSnapshot({ points, boundaryWorldMm: null, envelope: null });
  if (!result.ok) throw new Error(`expected a snapshot, got ${result.reason}`);
  return result.snapshot;
}

/** 0 → 3 → 0 m every 6 m: gradient 1 everywhere. */
const sawToothMm = (xM: number) => 1000 * (3 - Math.abs((xM % 6) - 3));

describe('ADR-920 Β6.8 — the density measure', () => {
  it('spacing on screen = interval / gradient × px per metre; flat ground never crowds', () => {
    expect(contourSpacingPx(0.5, 1, 20)).toBe(10);
    expect(contourSpacingPx(0.1, 0.05, 3)).toBeCloseTo(6, 12);
    expect(contourSpacingPx(0.1, 0, 3)).toBe(Infinity);
  });

  it('the reference scale is the map width over the view box (content + margins)', () => {
    expect(referencePxPerM(12, 60)).toBeCloseTo(LISTING_TERRAIN_CONTOUR_REFERENCE_WIDTH_PX / 24, 9);
  });

  it('the steep quantile is AREA-weighted: a wall on a tenth of the plot does not decide it', () => {
    const gentle = { gradient: 0.02, area: 9 };
    const wall = { gradient: 5, area: 1 };
    expect(areaWeightedGradientQuantile([wall, gentle], 0.9)).toBe(0.02);
    expect(areaWeightedGradientQuantile([wall, gentle], 0.95)).toBe(5);
    expect(areaWeightedGradientQuantile([], 0.9)).toBe(0);
  });
});

describe('ADR-920 Β6.8 — chooseContourConfig', () => {
  it('a steep, narrow plot gets a coarser interval than its relief alone would give', () => {
    const steep = chooseContourConfig({ reliefMm: 3_000, steepGradient: 1, pxPerM: 20 });
    const flat = chooseContourConfig({ reliefMm: 3_000, steepGradient: 0, pxPerM: 20 });
    expect(flat.intervalMm).toBe(100);
    expect(steep.intervalMm).toBe(500);
    expect(contourSpacingPx(steep.intervalMm / 1000, 1, 20)).toBeGreaterThanOrEqual(LISTING_TERRAIN_CONTOUR_MIN_SPACING_PX);
    expect(contourSpacingPx(0.25, 1, 20)).toBeLessThan(LISTING_TERRAIN_CONTOUR_MIN_SPACING_PX);
  });

  it('the relief cap still holds when the screen would allow finer', () => {
    expect(chooseContourConfig({ reliefMm: 12_000, steepGradient: 0.01, pxPerM: 100 }).intervalMm).toBe(500);
  });

  it('the «barcode» ridge, built for real: 0.5 m instead of 0.1 m — the same for every caller', () => {
    const ridge = snapshotOf(every(0, 12, 1), every(0, 60, 5), sawToothMm);
    expect(ridge.stats.reliefM).toBe(3);
    expect(ridge.contourIntervalM).toBe(0.5);
    expect(snapshotOf(every(0, 12, 1), every(0, 60, 5), sawToothMm).contourIntervalM).toBe(0.5);
  });

  it('a gentle field keeps the fine interval (nothing to thin, nothing to coarsen)', () => {
    const field = snapshotOf(every(0, 100, 10), every(0, 100, 10), (x) => 100_000 + 20 * x);
    expect(field.contourIntervalM).toBe(0.1);
  });
});
