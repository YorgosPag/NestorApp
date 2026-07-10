/**
 * ADR-358 Q19 — StairToThreeConverter sub-element index tagging.
 *
 * Verifies every tread / riser mesh carries a 0-based `userData.stairComponentIndex`
 * (sequential, matching `resolveStairMaterial`'s `treadIndex`) so the 3D raycast can
 * resolve WHICH step was clicked («click-into components», single parametric stair).
 *
 * @see ../StairToThreeConverter.ts
 */

import { stairToMeshes } from '../StairToThreeConverter';
import type { StairEntity } from '../../../bim/types/stair-types';

const P = (x: number, y: number, z: number) => ({ x, y, z });

/** A minimal stair with 3 treads (below cut) + 3 closed risers, monolithic (no stringers). */
function makeStair(): StairEntity {
  const treadAt = (z: number) => [P(0, 0, z), P(900, 0, z), P(900, 270, z), P(0, 270, z)];
  // Diagonal riser encoding (ADR-370 Φ5.3): start = corner A @zLow, end = opposite B @zHigh.
  const riserAt = (i: number) => ({ start: P(0, i * 270, i * 175), end: P(900, i * 270, (i + 1) * 175) });
  return {
    id: 'stair_subindex_test',
    type: 'stair',
    params: {
      basePoint: P(0, 0, 0),
      direction: 0,
      rise: 175,
      tread: 270,
      width: 900,
      stepCount: 3,
      riserType: 'closed',
      structureType: 'monolithic',
      handrails: { inner: false, outer: false, height: 900 },
    },
    geometry: {
      treads: [treadAt(175), treadAt(350), treadAt(525)],
      treadsBelowCut: [treadAt(175), treadAt(350), treadAt(525)],
      treadsAboveCut: [],
      risers: [riserAt(0), riserAt(1), riserAt(2)],
      stringers: { inner: [], outer: [] },
      walkline: [P(450, 0, 0), P(450, 810, 525)],
      handrails: {},
      landings: [],
      arrowSymbol: { start: P(450, 0, 0), end: P(450, 500, 0), label: 'UP' },
      bbox: { min: P(0, 0, 0), max: P(900, 810, 525) },
    },
  } as unknown as StairEntity;
}

function indicesFor(component: string): number[] {
  const meshes = stairToMeshes(makeStair());
  return meshes
    .filter((m) => m.userData['stairComponent'] === component)
    .map((m) => m.userData['stairComponentIndex'] as number);
}

describe('StairToThreeConverter — sub-element index tagging (ADR-358 Q19)', () => {
  it('treads carry sequential 0-based stairComponentIndex', () => {
    expect(indicesFor('tread')).toEqual([0, 1, 2]);
  });

  it('risers carry sequential 0-based stairComponentIndex', () => {
    expect(indicesFor('riser')).toEqual([0, 1, 2]);
  });

  it('every tagged tread/riser mesh keeps bimId + bimType alongside the index', () => {
    const meshes = stairToMeshes(makeStair());
    const stepMeshes = meshes.filter((m) =>
      m.userData['stairComponent'] === 'tread' || m.userData['stairComponent'] === 'riser',
    );
    expect(stepMeshes.length).toBe(6);
    for (const m of stepMeshes) {
      expect(m.userData['bimId']).toBe('stair_subindex_test');
      expect(m.userData['bimType']).toBe('stair');
      expect(typeof m.userData['stairComponentIndex']).toBe('number');
    }
  });
});
