/**
 * Riser seating — the closed-riser panel tucks UNDER the tread (Giorgio 2026-07-22),
 * extending the earlier flush-behind seating (2026-07-21):
 *   • ALONG ascent: start at flush-behind (+thickness/2) then pull BACK by the nosing
 *     overhang (`params.nosing`) → the front face sits behind the nose, under the tread.
 *   • VERTICAL: drop by one tread thickness (`DEFAULT_TREAD_THICKNESS_MM`) → the riser
 *     TOP face meets the tread BOTTOM face (the tread rests ON the riser), not level
 *     with the walking surface.
 *
 * Paired change (same builder): each TREAD slides BACKWARD away from the nose by
 * `TREAD_BACK_SHIFT_MM` (Giorgio 2026-07-22).
 *
 * @see ../StairToThreeConverter.ts (buildRiserBox / riserAscentDir / treadForwardDir)
 */

import { stairToMeshes } from '../StairToThreeConverter';
import { inferSceneUnitsFromWidth, sceneUnitsToMeters } from '../../../utils/scene-units';
import type { StairEntity } from '../../../bim/types/stair-types';

const P = (x: number, y: number, z: number) => ({ x, y, z });
const RISER_THICKNESS_MM = 20; // DEFAULT_RISER_THICKNESS_MM (converter-private)
const TREAD_THICKNESS_MM = 40; // DEFAULT_TREAD_THICKNESS_MM (converter-private)
const TREAD_BACK_SHIFT_MM = 40; // TREAD_BACK_SHIFT_MM (converter-private)
const WAIST_DROP_MM = 40; // WAIST_DROP_MM (converter-private)
const NOSING_MM = 20; // params.nosing below
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
      nosing: NOSING_MM,
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

describe('StairToThreeConverter — riser tuck-under-tread seating', () => {
  const sceneToM = sceneUnitsToMeters(inferSceneUnitsFromWidth(WIDTH));
  const halfThickM = RISER_THICKNESS_MM * 0.001 * 0.5;
  const nosingBackM = NOSING_MM * sceneToM;
  const treadDropM = TREAD_THICKNESS_MM * 0.001; // absolute mm, not scene-scaled
  const alongM = halfThickM - nosingBackM; // flush-behind, then pulled back by the nose

  it('pulls each riser BACK along ascent by (half-thickness − nosing) (+X run)', () => {
    const risers = stairToMeshes(makeStraightStairPlusX()).filter(
      (m) => m.userData['stairComponent'] === 'riser',
    );
    expect(risers).toHaveLength(2);
    // riser i sits on edge x=(i+1)·270; ascent = +X → position.x = edge·sceneToM + alongM.
    risers.forEach((mesh, i) => {
      const edgeX = (i + 1) * 270;
      expect(mesh.position.x).toBeCloseTo(edgeX * sceneToM + alongM, 9);
      // width axis is along Y → no Z shift (ascent has no Y component here).
      expect(mesh.position.z).toBeCloseTo(-450 * sceneToM, 9);
    });
  });

  it('nosing pull-back exceeds the flush-behind offset → net BACKWARD shift', () => {
    const risers = stairToMeshes(makeStraightStairPlusX()).filter(
      (m) => m.userData['stairComponent'] === 'riser',
    );
    // nosing (20) > half-thickness (10) → the panel ends up behind the plan edge.
    expect(alongM).toBeLessThan(0);
    expect(risers[0]!.position.x).toBeLessThan(270 * sceneToM);
  });

  it('drops each riser by one tread thickness → top face meets tread underside', () => {
    const risers = stairToMeshes(makeStraightStairPlusX()).filter(
      (m) => m.userData['stairComponent'] === 'riser',
    );
    // baseY = 0; riser i spans z∈[i·175,(i+1)·175] → mid z = (2i+1)·87.5, dropped by treadDrop.
    risers.forEach((mesh, i) => {
      const midZScene = (i * 175 + (i + 1) * 175) * 0.5;
      expect(mesh.position.y).toBeCloseTo(midZScene * sceneToM - treadDropM, 9);
    });
  });
});

describe('StairToThreeConverter — tread backward nudge', () => {
  const sceneToM = sceneUnitsToMeters(inferSceneUnitsFromWidth(WIDTH));
  const treadBackM = TREAD_BACK_SHIFT_MM * 0.001; // absolute mm, not scene-scaled

  it('slides each tread BACKWARD away from the nose (−X) by TREAD_BACK_SHIFT_MM', () => {
    const treads = stairToMeshes(makeStraightStairPlusX()).filter(
      (m) => m.userData['stairComponent'] === 'tread',
    );
    expect(treads).toHaveLength(3);
    // extrudeFlatSlab bakes world xy into geometry (position.xz start at 0), so the
    // backward nudge shows up directly as position.x; ascent = +X → shift is −X, zero Z.
    treads.forEach((mesh) => {
      expect(mesh.position.x).toBeCloseTo(-treadBackM, 9);
      expect(mesh.position.z).toBeCloseTo(0, 9);
    });
  });

  it('nudge is a real backward (down-slope) shift, not zero', () => {
    const treads = stairToMeshes(makeStraightStairPlusX()).filter(
      (m) => m.userData['stairComponent'] === 'tread',
    );
    // treads move −X (away from the +X nose) → strictly negative.
    expect(treads[0]!.position.x).toBeLessThan(0);
  });
});

describe('StairToThreeConverter — waist slab drop', () => {
  const waistDropM = WAIST_DROP_MM * 0.001; // absolute mm, not scene-scaled

  it('lowers the monolithic waist slab toward the floor by WAIST_DROP_MM', () => {
    const waist = stairToMeshes(makeStraightStairPlusX()).filter(
      (m) => m.userData['stairComponent'] === 'waist',
    );
    // buildFlightWaist bakes all geometry (incl. origin) into the buffer → mesh
    // position starts at 0; the converter drop shows up directly as position.y.
    expect(waist.length).toBeGreaterThan(0);
    waist.forEach((mesh) => {
      expect(mesh.position.y).toBeCloseTo(-waistDropM, 9);
    });
  });
});
