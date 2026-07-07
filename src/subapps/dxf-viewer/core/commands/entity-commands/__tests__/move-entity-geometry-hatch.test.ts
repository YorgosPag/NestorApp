/**
 * ADR-507 / ADR-575 — `calculateMovedGeometry` is the canonical rigid-move SSoT. It lacked a
 * HATCH case, so a hatch translated to `{}` (no move). A GROUP move recurses this SSoT per
 * member, so a grouped hatch stayed put while its boundary lines moved (Giorgio 2026-07-07:
 * «μετακινείται μόνο οι γραμμές και όχι όλο το σύστημα»). Guard the hatch move + the group move.
 */

import { calculateMovedGeometry } from '../move-entity-geometry';
import type { SceneEntity } from '../interfaces';

const hatch = (): SceneEntity =>
  ({ id: 'h', type: 'hatch', layer: 'L0', visible: true,
     boundaryPaths: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]],
     seedPoints: [{ x: 5, y: 5 }] } as unknown as SceneEntity);

const line = (): SceneEntity =>
  ({ id: 'l', type: 'line', layer: 'L0', visible: true, start: { x: 0, y: 0 }, end: { x: 10, y: 0 } } as unknown as SceneEntity);

describe('calculateMovedGeometry — HATCH (ADR-507)', () => {
  it('translates every boundary-path point + the seed points', () => {
    const patch = calculateMovedGeometry(hatch(), { x: 3, y: -4, z: 0 }) as { boundaryPaths?: { x: number; y: number }[][]; seedPoints?: unknown };
    expect(patch.boundaryPaths).toEqual([[{ x: 3, y: -4 }, { x: 13, y: -4 }, { x: 13, y: 6 }, { x: 3, y: 6 }]]);
    expect(patch.seedPoints).toEqual([{ x: 8, y: 1 }]);
  });

  it('omits seedPoints when the hatch has none (no undefined write)', () => {
    const noSeed = { id: 'h2', type: 'hatch', layer: 'L0', visible: true, boundaryPaths: [[{ x: 1, y: 1 }]] } as unknown as SceneEntity;
    const patch = calculateMovedGeometry(noSeed, { x: 5, y: 5, z: 0 }) as { boundaryPaths?: unknown; seedPoints?: unknown };
    expect(patch.boundaryPaths).toEqual([[{ x: 6, y: 6 }]]);
    expect('seedPoints' in patch).toBe(false);
  });
});

describe('calculateMovedGeometry — GROUP with a hatch member (ADR-575)', () => {
  it('moves the hatch AND the line together (the whole system translates)', () => {
    const group = { id: 'g', type: 'group', layer: 'L0', visible: true, members: [line(), hatch()] } as unknown as SceneEntity;
    const patch = calculateMovedGeometry(group, { x: 100, y: 50, z: 0 }) as { members?: Array<Record<string, unknown>> };
    const members = patch.members!;
    // Line member translated.
    expect(members[0].start).toEqual({ x: 100, y: 50 });
    expect(members[0].end).toEqual({ x: 110, y: 50 });
    // Hatch member translated too (was: left behind → only lines moved).
    expect(members[1].boundaryPaths).toEqual([[{ x: 100, y: 50 }, { x: 110, y: 50 }, { x: 110, y: 60 }, { x: 100, y: 60 }]]);
    expect(members[1].seedPoints).toEqual([{ x: 105, y: 55 }]);
  });
});
