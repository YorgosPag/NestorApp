/**
 * Bathroom layout Στάδιο 3 tests · ADR-638 — fixture facing / orientation.
 *
 * Guards the "room-bounding fixture facing" rule: every auto-placed sanitary fixture
 * must sit with its BACK on the host wall and its FRONT into the room. We read each
 * committed `mep-fixture`'s ACTUAL rotated footprint geometry and assert the symbol's
 * front edge (local −Y, `symbol-vector-helpers` `v=0`) has a positive projection onto
 * the wall's inward normal (`segmentRoomWalls` ground truth) — i.e. it looks inward,
 * not at the wall. Pure — no scene mutation.
 */

import type { Point2D } from '../../../rendering/types/Types';
import {
  solveBathroomLayout,
  buildBathroomFixtureEntities,
  segmentRoomWalls,
  type BathroomLayoutSolution,
  type LayoutFixtureKind,
} from '../index';
import {
  MEP_FIXTURE_SYMBOL_FRONT_OFFSET_DEG,
} from '../bathroom-fixture-commit';

function rectRoomMm(w: number, d: number): Point2D[] {
  return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: d }, { x: 0, y: d }];
}

function firstSolution(fixtures: LayoutFixtureKind[], w = 2400, d = 2400): BathroomLayoutSolution {
  const [best] = solveBathroomLayout({ polygonMm: rectRoomMm(w, d), fixtures });
  expect(best).toBeDefined();
  return best;
}

/** Front edge midpoint of a rotated rectangular footprint (verts[0],[1] = local −Y = front). */
function frontMidpoint(verts: readonly { x: number; y: number }[]): Point2D {
  return { x: (verts[0].x + verts[1].x) / 2, y: (verts[0].y + verts[1].y) / 2 };
}

describe('bathroom fixture facing — back on wall, front into room (ADR-638 Στάδιο 3)', () => {
  it('every committed fixture faces into the room (front · inward > 0)', () => {
    const roomW = 2400;
    const roomD = 2400;
    const sol = firstSolution(['wc', 'washbasin', 'shower', 'bathtub'], roomW, roomD);
    const walls = segmentRoomWalls(rectRoomMm(roomW, roomD));
    const { entities } = buildBathroomFixtureEntities(sol, { layerId: 'layer-1', sceneUnits: 'mm' });
    expect(entities.length).toBeGreaterThan(0);

    const plumbing = sol.placements.filter((p) => entities.some((e) => e.params.kind === p.kind));
    for (const entity of entities) {
      const placement = plumbing.find((p) => p.kind === entity.params.kind);
      expect(placement).toBeDefined();
      const wall = walls[placement!.wallIndex];
      expect(wall).toBeDefined();

      const verts = entity.geometry.footprint.vertices;
      const center = entity.params.position;
      const front = frontMidpoint(verts);
      const frontDir = { x: front.x - center.x, y: front.y - center.y };
      // Front must point INTO the room: positive projection onto the wall inward normal.
      const proj = frontDir.x * wall.inward.x + frontDir.y * wall.inward.y;
      expect(proj).toBeGreaterThan(0);

      // And the entity rotation must be the solver's inward angle + the symbol front offset.
      expect(entity.params.rotation).toBeCloseTo(placement!.rotationDeg + MEP_FIXTURE_SYMBOL_FRONT_OFFSET_DEG, 6);
    }
  });

  it('canonical wall (dir=+X, inward=+Y) → fixture front looks +Y (into the room)', () => {
    // A fixture on the bottom wall of a room: inward = (0,1). Its front (local −Y) must
    // end up pointing +Y. rotationDeg (solver) = atan2(inward) = 90° → entity rotation 180°.
    const sol = firstSolution(['wc'], 2400, 2400);
    const wcPlacement = sol.placements.find((p) => p.kind === 'wc');
    expect(wcPlacement).toBeDefined();
    const { entities } = buildBathroomFixtureEntities(sol, { layerId: 'layer-1', sceneUnits: 'mm' });
    const wc = entities.find((e) => e.params.kind === 'wc');
    expect(wc).toBeDefined();

    const walls = segmentRoomWalls(rectRoomMm(2400, 2400));
    const wall = walls[wcPlacement!.wallIndex];
    const verts = wc!.geometry.footprint.vertices;
    const front = frontMidpoint(verts);
    const frontDir = { x: front.x - wc!.params.position.x, y: front.y - wc!.params.position.y };
    // Front points along inward (not away from it).
    const proj = frontDir.x * wall.inward.x + frontDir.y * wall.inward.y;
    expect(proj).toBeGreaterThan(0);
  });

  it('front offset is a fixed +90° (uniform symbol convention, not per-kind)', () => {
    expect(MEP_FIXTURE_SYMBOL_FRONT_OFFSET_DEG).toBe(90);
  });
});
