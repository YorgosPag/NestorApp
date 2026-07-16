/**
 * ADR-665 — terrain level-cut math tests.
 *
 * The contract: each level gets its OWN cut elevation, and the cut is suppressed only in the four
 * cases where it is meaningless (toggle off / hill hidden / all-floors scope / no storey context).
 */

import { computeTerrainClipWorldY, type TerrainClipInputs } from '../terrain-clip-math';

/** Ground floor of a building sitting on the site datum, hill visible, auto-clip on. */
const BASE: TerrainClipInputs = {
  autoClip: true,
  terrainVisible: true,
  allFloors: false,
  floorElevationMm: 0,
  buildingBaseElevationM: 0,
};

const EPSILON_M = 0.001;

describe('ADR-665 — computeTerrainClipWorldY: when NOT to cut', () => {
  it('auto-clip off → no cut (the user opted out)', () => {
    expect(computeTerrainClipWorldY({ ...BASE, autoClip: false })).toBeNull();
  });

  it('terrain hidden → no cut (nothing to cut, and no plane to hold)', () => {
    expect(computeTerrainClipWorldY({ ...BASE, terrainVisible: false })).toBeNull();
  });

  it('«Όλοι οι όροφοι» → no cut (no single active level; the site view is whole)', () => {
    expect(computeTerrainClipWorldY({ ...BASE, allFloors: true })).toBeNull();
  });

  it('no active-storey context → no cut (rather than silently cutting at the datum)', () => {
    expect(computeTerrainClipWorldY({ ...BASE, floorElevationMm: null })).toBeNull();
  });
});

describe('ADR-665 — computeTerrainClipWorldY: where the plane sits', () => {
  it('ground floor at the datum → cuts at 0 (+ε) — the ground floor IS a cut, not a no-op', () => {
    // The regression that would let «Θεμελίωση»/«Ισόγειο» bury itself: 0 must not read as falsy.
    expect(computeTerrainClipWorldY(BASE)).toBeCloseTo(EPSILON_M, 6);
  });

  it('1st floor (FFL 3000 mm) on a building based 2 m up → 5.001', () => {
    const y = computeTerrainClipWorldY({
      ...BASE,
      floorElevationMm: 3000,
      buildingBaseElevationM: 2,
    });
    expect(y).toBeCloseTo(5 + EPSILON_M, 6);
  });

  it('basement (FFL −3000 mm) → −2.999 (cuts BELOW the datum, soil still above it)', () => {
    expect(computeTerrainClipWorldY({ ...BASE, floorElevationMm: -3000 })).toBeCloseTo(
      -3 + EPSILON_M,
      6,
    );
  });

  it('each level gets its OWN elevation — two levels never share a cut', () => {
    const ground = computeTerrainClipWorldY({ ...BASE, floorElevationMm: 0 });
    const first = computeTerrainClipWorldY({ ...BASE, floorElevationMm: 3000 });
    expect(ground).not.toBeCloseTo(first!, 6);
    expect(first! - ground!).toBeCloseTo(3, 6);
  });

  it('the building base offset shifts the cut with the building', () => {
    const onDatum = computeTerrainClipWorldY({ ...BASE, floorElevationMm: 3000 });
    const raised = computeTerrainClipWorldY({
      ...BASE,
      floorElevationMm: 3000,
      buildingBaseElevationM: 10,
    });
    expect(raised! - onDatum!).toBeCloseTo(10, 6);
  });

  it('the ε bias is applied upward (kept side is BELOW the plane, no boundary shimmer)', () => {
    expect(computeTerrainClipWorldY({ ...BASE, floorElevationMm: 3000 })!).toBeGreaterThan(3);
  });
});
