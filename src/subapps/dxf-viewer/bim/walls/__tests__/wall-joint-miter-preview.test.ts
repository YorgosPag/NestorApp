/**
 * ADR-363 §wall-joint-miter-preview («Επίπεδο 2») — LIVE Revit-grade miter preview.
 *
 * Guards the load-bearing behaviour: while drawing a wall next to an existing one,
 * the ghost AND the affected neighbour show their join (miter) in real time, via the
 * SAME `computeWallTrims`/`applyTrimPatches` SSoT as commit (preview === commit).
 *
 *   1. Corner join → ghost augmented (own miter) + neighbour returned as `jointNeighbors`.
 *   2. Free-floating ghost (no near wall) → no-op (same ref).
 *   3. Curved ghost → no-op (miter is straight-only).
 *   4. 🔴 overlap ghost → no-op (renders red schematic, no valid join).
 *   5. null → null.
 */
import { describe, it, expect } from '@jest/globals';

import { applyJointMiterPreview } from '../wall-joint-miter-preview';
import { buildDefaultWallParams, buildWallEntity } from '../../../hooks/drawing/wall-completion';
import type { WallEntity, WallKind, WallParams } from '../../types/wall-types';
import type { ExtendedSceneEntity } from '../../../hooks/drawing/drawing-types';

function makeWall(
  start: { x: number; y: number },
  end: { x: number; y: number },
  id: string,
  kind: WallKind = 'straight',
): WallEntity {
  const params = buildDefaultWallParams(start, end);
  const overrideParams: WallParams = { ...params, thickness: 200, dna: undefined };
  const result = buildWallEntity(overrideParams, '0', kind);
  if (!result.ok) throw new Error('Failed to build wall: ' + result.hardErrors.join(', '));
  return { ...result.entity, id } as WallEntity;
}

/** Wrap a WallEntity as a WYSIWYG ghost (mirror `toWysiwygPreviewEntity`). */
function asGhost(w: WallEntity, extra: Record<string, unknown> = {}): ExtendedSceneEntity {
  return { ...w, id: 'preview_wall_ghost', preview: true, wysiwygPreview: true, ...extra } as unknown as ExtendedSceneEntity;
}

describe('applyJointMiterPreview — live joint miter (Επίπεδο 2)', () => {
  it('1. corner join → augments ghost + returns the neighbour as jointNeighbors', () => {
    const existing = makeWall({ x: 0, y: 0 }, { x: 3000, y: 0 }, 'wall_existing');
    // Ghost shares the corner at (3000,0), heading north → 90° miter.
    const ghost = asGhost(makeWall({ x: 3000, y: 0 }, { x: 3000, y: 3000 }, 'ignored'));

    const result = applyJointMiterPreview(ghost, [existing], 'mm');

    expect(result).not.toBe(ghost); // augmented
    const neighbors = (result as { jointNeighbors?: readonly ExtendedSceneEntity[] }).jointNeighbors;
    expect(neighbors).toBeDefined();
    expect(neighbors!.map((n) => n.id)).toContain('wall_existing');
  });

  it('2. free-floating ghost (no near wall) → no-op (same ref)', () => {
    const existing = makeWall({ x: 0, y: 0 }, { x: 3000, y: 0 }, 'wall_existing');
    const ghost = asGhost(makeWall({ x: 50000, y: 50000 }, { x: 50000, y: 53000 }, 'ignored'));

    expect(applyJointMiterPreview(ghost, [existing], 'mm')).toBe(ghost);
  });

  it('3. curved ghost → no-op (miter is straight-only)', () => {
    const existing = makeWall({ x: 0, y: 0 }, { x: 3000, y: 0 }, 'wall_existing');
    const ghost = asGhost(makeWall({ x: 3000, y: 0 }, { x: 3000, y: 3000 }, 'ignored', 'curved'));

    expect(applyJointMiterPreview(ghost, [existing], 'mm')).toBe(ghost);
  });

  it('4. overlap ghost (ghostStatusColor set) → no-op', () => {
    const existing = makeWall({ x: 0, y: 0 }, { x: 3000, y: 0 }, 'wall_existing');
    const ghost = asGhost(
      makeWall({ x: 3000, y: 0 }, { x: 3000, y: 3000 }, 'ignored'),
      { ghostStatusColor: { stroke: '#f00', fill: '#f00' } },
    );

    expect(applyJointMiterPreview(ghost, [existing], 'mm')).toBe(ghost);
  });

  it('5. null ghost → null', () => {
    expect(applyJointMiterPreview(null, [], 'mm')).toBeNull();
  });
});
