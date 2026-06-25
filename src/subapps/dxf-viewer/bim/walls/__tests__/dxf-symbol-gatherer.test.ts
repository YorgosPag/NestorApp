/**
 * ADR-533 — Unit tests για το χωρικό μάζεμα υποψηφίων κοντά στον τοίχο.
 * Οριζόντιος τοίχος (0,0)→(1000,0)· margin = 300 scene units.
 */

import { gatherSymbolCandidates } from '../dxf-symbol-gatherer';
import type { SceneModel } from '../../../types/scene';
import type { WallEntity } from '../../types/wall-types';
import type { ArcEntity, LineEntity } from '../../../types/entities';

// Μόνο `params.start/end` διαβάζει ο gatherer — minimal cast (όχι `any`).
const WALL = {
  params: { start: { x: 0, y: 0, z: 0 }, end: { x: 1000, y: 0, z: 0 }, thickness: 200 },
} as unknown as WallEntity;

function line(id: string, x1: number, y1: number, x2: number, y2: number): LineEntity {
  return { id, layerId: 'lyr_test', type: 'line', start: { x: x1, y: y1 }, end: { x: x2, y: y2 } };
}
function arc(id: string, cx: number, cy: number, r: number): ArcEntity {
  return { id, layerId: 'lyr_test', type: 'arc', center: { x: cx, y: cy }, radius: r, startAngle: 0, endAngle: 90 };
}

function scene(entities: Array<LineEntity | ArcEntity>): SceneModel {
  return {
    entities,
    layersById: {},
    bounds: { min: { x: 0, y: 0 }, max: { x: 1000, y: 1000 } },
    units: 'mm',
  } as unknown as SceneModel;
}

describe('gatherSymbolCandidates', () => {
  it('returns lines and arcs within the expanded AABB', () => {
    const near = [line('l1', 100, 50, 400, 50), arc('a1', 300, 0, 90)];
    const out = gatherSymbolCandidates(WALL, scene(near), 300);
    expect(out.map((e) => e.id).sort()).toEqual(['a1', 'l1']);
  });

  it('excludes entities far outside the band', () => {
    const far = [line('far', 0, 5000, 100, 5000), arc('farc', 300, 5000, 90)];
    const out = gatherSymbolCandidates(WALL, scene(far), 300);
    expect(out).toHaveLength(0);
  });

  it('keeps near and drops far in a mixed scene', () => {
    const mixed = [line('near', 200, 100, 500, 100), line('far', 0, 9000, 50, 9000)];
    const out = gatherSymbolCandidates(WALL, scene(mixed), 300);
    expect(out.map((e) => e.id)).toEqual(['near']);
  });

  it('ignores non-line/arc entities', () => {
    const withCircle = [
      line('l', 100, 50, 400, 50),
      { id: 'c', layerId: 'lyr_test', type: 'circle', center: { x: 300, y: 0 }, radius: 50 },
    ] as unknown as Array<LineEntity | ArcEntity>;
    const out = gatherSymbolCandidates(WALL, scene(withCircle), 300);
    expect(out.map((e) => e.id)).toEqual(['l']);
  });
});
