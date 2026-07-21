/**
 * Riser flush-seating (Giorgio 2026-07-21) — the closed-riser panel must sit
 * BETWEEN the two treads (its face flush with the tread edge), NOT centred on the
 * edge. `buildRiserBox` shifts the box by half its thickness along the ascent
 * (travel) direction, derived from the adjacent tread's centroid.
 *
 * Without the shift a riser at plan edge `xEdge` renders centred at `xEdge`, so
 * half its 20 mm thickness buries under the tread. With it, the panel is offset by
 * +thickness/2 toward the upper tread.
 *
 * @see ../StairToThreeConverter.ts (buildRiserBox / riserAscentDir)
 */

import { stairToMeshes } from '../StairToThreeConverter';
import { inferSceneUnitsFromWidth, sceneUnitsToMeters } from '../../../utils/scene-units';
import type { StairEntity } from '../../../bim/types/stair-types';

const P = (x: number, y: number, z: number) => ({ x, y, z });
const RISER_THICKNESS_MM = 20; // DEFAULT_RISER_THICKNESS_MM (converter-private)
const WIDTH = 900;

/**
 * Straight run ascending along +X: tread i spans x∈[i·270, i·270+270], y∈[0,900],
 * z=i·175; riser i sits on the shared edge x=(i+1)·270 between tread i and i+1
 * (diagonal encoding: start @zLow on one width edge, end @zHigh on the other).
 */
function makeStraightStairPlusX(): StairEntity {
  const treadAt = (i: number) => [
    P(i * 270, 0, i * 175),
    P(i * 270 + 270, 0, i * 175),
    P(i * 270 + 270, WIDTH, i * 175),
    P(i * 270, WIDTH, i * 175),
  ];
  const riserAt = (i: number) => ({
    start: P((i + 1) * 270, 0, i * 175),
    end: P((i + 1) * 270, WIDTH, (i + 1) * 175),
  });
  return {
    id: 'stair_riser_seating',
    type: 'stair',
    params: {
      basePoint: P(0, 0, 0),
      direction: 0,
      rise: 175,
      tread: 270,
      width: WIDTH,
      stepCount: 3,
      riserType: 'closed',
      structureType: 'monolithic',
      handrails: { inner: false, outer: false, height: 900 },
    },
    geometry: {
      treads: [treadAt(0), treadAt(1), treadAt(2)],
      treadsBelowCut: [treadAt(0), treadAt(1), treadAt(2)],
      treadsAboveCut: [],
      risers: [riserAt(0), riserAt(1)],
      stringers: { inner: [], outer: [] },
      walkline: [P(0, 450, 0), P(810, 450, 350)],
      handrails: {},
      landings: [],
      arrowSymbol: { start: P(0, 450, 0), end: P(500, 450, 0), label: 'UP' },
      bbox: { min: P(0, 0, 0), max: P(810, 900, 350) },
    },
  } as unknown as StairEntity;
}

describe('StairToThreeConverter — riser flush seating', () => {
  const sceneToM = sceneUnitsToMeters(inferSceneUnitsFromWidth(WIDTH));
  const halfThickM = RISER_THICKNESS_MM * 0.001 * 0.5;

  it('shifts each riser panel by +half-thickness along the ascent direction (+X)', () => {
    const risers = stairToMeshes(makeStraightStairPlusX()).filter(
      (m) => m.userData['stairComponent'] === 'riser',
    );
    expect(risers).toHaveLength(2);
    // riser i sits on edge x=(i+1)·270; ascent = +X → position.x = edge·sceneToM + halfThick.
    risers.forEach((mesh, i) => {
      const edgeX = (i + 1) * 270;
      expect(mesh.position.x).toBeCloseTo(edgeX * sceneToM + halfThickM, 9);
      // width axis is along Y → no Z shift (ascent has no Y component here).
      expect(mesh.position.z).toBeCloseTo(-450 * sceneToM, 9);
    });
  });

  it('offset is a real shift, not zero (panel no longer centred on the edge)', () => {
    const risers = stairToMeshes(makeStraightStairPlusX()).filter(
      (m) => m.userData['stairComponent'] === 'riser',
    );
    // Centred (old) x would be exactly edge·sceneToM; the shift must be > 0.
    expect(risers[0]!.position.x - 270 * sceneToM).toBeCloseTo(halfThickM, 9);
    expect(halfThickM).toBeGreaterThan(0);
  });
});
