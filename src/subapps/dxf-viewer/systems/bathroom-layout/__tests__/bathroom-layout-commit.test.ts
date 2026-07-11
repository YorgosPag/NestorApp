/**
 * Bathroom layout Στάδιο 2 tests · ADR-638.
 *
 * Covers the scene-commit builder (solution → `mep-fixture` entities, mm→scene unit
 * bridge, vanity skip) and the RecognizedSpace→RoomInput adapter (scene→mm polygon,
 * door keep-clear derivation). Pure — no scene mutation / command history touched.
 */

import type { Point2D } from '../../../rendering/types/Types';
import {
  solveBathroomLayout,
  buildBathroomFixtureEntities,
  commitBathroomSolution,
  recognizedSpaceToRoomInput,
  spacePolygonToMm,
  buildDoorKeepClear,
  type BathroomLayoutSolution,
  type LayoutFixtureKind,
} from '../index';

function rectRoomMm(w: number, d: number): Point2D[] {
  return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: d }, { x: 0, y: d }];
}

function firstSolution(fixtures: LayoutFixtureKind[], w = 2400, d = 2400): BathroomLayoutSolution {
  const [best] = solveBathroomLayout({ polygonMm: rectRoomMm(w, d), fixtures });
  expect(best).toBeDefined();
  return best;
}

describe('buildBathroomFixtureEntities — solution → mep-fixture entities', () => {
  it('materialises every plumbing placement as a mep-fixture entity', () => {
    const sol = firstSolution(['wc', 'washbasin', 'shower']);
    const { entities, skipped } = buildBathroomFixtureEntities(sol, { layerId: 'layer-1', sceneUnits: 'mm' });
    expect(entities.length).toBe(sol.placements.length);
    expect(skipped).toHaveLength(0);
    for (const e of entities) {
      expect(e.type).toBe('mep-fixture');
      expect(e.params.kind).toBeDefined();
    }
  });

  it('skips the vanity (no entity kind yet) with a clear reason', () => {
    const sol = firstSolution(['wc', 'vanity'], 2600, 2600);
    const hasVanity = sol.placements.some((p) => p.kind === 'vanity');
    const { entities, skipped } = buildBathroomFixtureEntities(sol, { layerId: 'layer-1', sceneUnits: 'mm' });
    if (hasVanity) {
      expect(skipped.some((s) => s.kind === 'vanity' && s.reason === 'no-entity-kind')).toBe(true);
    }
    expect(entities.every((e) => e.params.kind !== 'vanity')).toBe(true);
  });

  it('scales the placement centre mm→scene for non-mm scenes', () => {
    const sol = firstSolution(['wc']);
    const wc = sol.placements.find((p) => p.kind === 'wc');
    expect(wc).toBeDefined();
    const { entities } = buildBathroomFixtureEntities(sol, { layerId: 'layer-1', sceneUnits: 'm' });
    const wcEntity = entities.find((e) => e.params.kind === 'wc');
    expect(wcEntity).toBeDefined();
    expect(wcEntity!.params.position.x).toBeCloseTo(wc!.center.x * 0.001, 5);
    expect(wcEntity!.params.position.y).toBeCloseTo(wc!.center.y * 0.001, 5);
    // Footprint dims stay in mm regardless of scene units.
    expect(wcEntity!.params.width).toBe(wc!.widthMm);
    expect(wcEntity!.params.length).toBe(wc!.depthMm);
  });

  it('commit is a no-op (no throw) when there is no active level', () => {
    const sol = firstSolution(['wc', 'washbasin']);
    const accessor = { currentLevelId: null, getLevelScene: () => null, setLevelScene: () => undefined };
    const summary = commitBathroomSolution(accessor, sol, { layerId: 'layer-1', sceneUnits: 'mm' });
    expect(summary.committed).toBe(sol.placements.length);
  });
});

describe('recognizedSpaceToRoomInput — scene→mm + door keep-clear', () => {
  const spaceMeters: Point2D[] = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2.2 }, { x: 0, y: 2.2 }];

  it('scales a metre-unit space polygon to millimetres', () => {
    const mm = spacePolygonToMm(spaceMeters, 'm');
    expect(mm[1].x).toBeCloseTo(2000, 5);
    expect(mm[2].y).toBeCloseTo(2200, 5);
  });

  it('derives a keep-clear from the widest door and passes fixtures through', () => {
    const input = recognizedSpaceToRoomInput(spaceMeters, 'm', ['wc', 'washbasin'], {
      doorsMm: [
        { positionMm: { x: 400, y: 0 }, widthMm: 800 },
        { positionMm: { x: 1600, y: 0 }, widthMm: 900 },
      ],
    });
    expect(input.fixtures).toEqual(['wc', 'washbasin']);
    expect(input.doorKeepClearMm).toBeDefined();
    expect(input.doorKeepClearMm).toHaveLength(4);
  });

  it('omits the keep-clear when no doors are supplied', () => {
    const input = recognizedSpaceToRoomInput(spaceMeters, 'm', ['wc']);
    expect(input.doorKeepClearMm).toBeUndefined();
  });

  it('buildDoorKeepClear extends the zone toward the room centroid', () => {
    const zone = buildDoorKeepClear({ positionMm: { x: 1000, y: 0 }, widthMm: 800 }, { x: 1000, y: 1100 }, 700);
    expect(zone).toHaveLength(4);
    // Front edge (last two points) sits deeper into the room (+y) than the door line.
    expect(zone[2].y).toBeGreaterThan(zone[1].y);
    expect(zone[3].y).toBeGreaterThan(zone[0].y);
  });
});
