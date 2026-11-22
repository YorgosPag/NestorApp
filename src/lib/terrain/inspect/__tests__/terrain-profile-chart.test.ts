/**
 * ADR-920 §14.10 Ε3 — the profile chart model.
 *
 *   Κ  the declared vertical exaggeration is the one the drawing actually uses
 *   Λ  the slope strip uses the map's classes; off-surface stretches get no ground, no strip
 *   Χ  chart x ↔ distance round-trip
 */

import { terrainInspectIndexOf } from '../terrain-inspect-index';
import { terrainProfileOf } from '../terrain-profile';
import {
  PROFILE_CHART_WIDTH, profileChartModelOf, profileChartS, profileChartX,
} from '../terrain-profile-chart';
import type { ListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-types';

/** 21 × 21 grid, 1 m, z = 100 + 0.1·x (10 % rising east). */
function ramp(): ListingTerrainSnapshot {
  const positions: number[] = [];
  for (let j = -10; j <= 10; j++) for (let i = -10; i <= 10; i++) positions.push(i, j, 100 + 0.1 * i);
  const triangles: number[] = [];
  for (let j = 0; j < 20; j++) {
    for (let i = 0; i < 20; i++) {
      const a = j * 21 + i;
      triangles.push(a, a + 1, a + 22, a, a + 22, a + 21);
    }
  }
  return {
    version: 1, mesh: { positions, triangles, slopeClass: new Array(triangles.length / 3).fill(1) }, contours: [],
    contourIntervalM: 0.5, contourMajorEvery: 5, slopeBandsPct: [5, 15, 25], boundary: null,
    stats: { planAreaM2: 400, minElevationM: 99, maxElevationM: 101, reliefM: 2, meanSlopePct: 10, maxSlopePct: 10, downslopeAzimuthDeg: 270 },
    envelope: null, envelopeOmission: null,
  };
}

const index = terrainInspectIndexOf(ramp());

describe('profile chart model', () => {
  it('Κ — declares the vertical exaggeration it draws with', () => {
    const profile = terrainProfileOf(index, { x: -4.5, y: 0.3 }, { x: 4.5, y: 0.3 })!;
    const model = profileChartModelOf(profile, [5, 15, 25]);
    // Relief 0.9 m, padded by max(10 %, 0.25 m) each side ⇒ 1.4 m over 156 units; 9 m over 600 units.
    expect(model.zTopM - model.zBottomM).toBeCloseTo(1.4, 9);
    expect(model.verticalRatio).toBeCloseTo((156 / 1.4) / (600 / 9), 9);
  });

  it('Λ — the strip has the map classes; a gap has no ground and no strip', () => {
    const whole = profileChartModelOf(terrainProfileOf(index, { x: -4.5, y: 0.3 }, { x: 4.5, y: 0.3 })!, [5, 15, 25]);
    expect(whole.strip.every((piece) => piece.classIndex === 1)).toBe(true);
    expect(whole.areaPaths).toHaveLength(1);

    const gapped = terrainProfileOf(index, { x: -20, y: 0.5 }, { x: 0, y: 0.5 })!;
    const model = profileChartModelOf(gapped, [5, 15, 25]);
    expect(model.areaPaths).toHaveLength(1);
    expect(Math.min(...model.strip.map((piece) => piece.x))).toBeCloseTo(PROFILE_CHART_WIDTH / 2, 6);
  });

  it('Χ — x ↔ distance', () => {
    const profile = terrainProfileOf(index, { x: -4.5, y: 0.3 }, { x: 4.5, y: 0.3 })!;
    expect(profileChartS(profile, profileChartX(profile, 3.25))).toBeCloseTo(3.25, 2);
    expect(profileChartS(profile, -50)).toBe(0);
    expect(profileChartS(profile, PROFILE_CHART_WIDTH + 50)).toBeCloseTo(9, 9);
  });
});
