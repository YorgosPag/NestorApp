/**
 * ADR-436 Slice 2 (Phase 2b) — «Πεδιλοδοκός από τοίχο» tests.
 *
 * Verifies `buildStripFromWall` (strip on the wall axis, width = wall thickness)
 * + the re-exported `pickWallEntityAt` (shared SSoT). Pure functions — μηδέν mocks.
 */

import { buildStripFromWall, pickWallEntityAt } from '../foundation-from-wall';
import type { WallEntity } from '../../types/wall-types';
import type { Entity } from '../../../types/entities';

const wall = (over: Record<string, unknown> = {}): WallEntity =>
  ({
    id: 'wall-1',
    type: 'wall',
    params: { start: { x: 0, y: 0, z: 0 }, end: { x: 4000, y: 0, z: 0 }, thickness: 300, ...((over as { params?: object }).params ?? {}) },
    ...over,
  } as unknown as WallEntity);

describe('buildStripFromWall', () => {
  it('builds a strip on the wall axis with width = wall thickness', () => {
    const result = buildStripFromWall(wall(), {}, 'layer-1', 'mm');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p = result.entity.params;
    expect(p.kind).toBe('strip');
    if (p.kind === 'pad') throw new Error('expected line');
    expect(p.start).toEqual({ x: 0, y: 0, z: 0 });
    expect(p.end).toEqual({ x: 4000, y: 0, z: 0 });
    expect(p.width).toBe(300); // = wall thickness
  });

  it('lets a ribbon width override win over the wall thickness', () => {
    const result = buildStripFromWall(wall(), { width: 500 }, 'layer-1', 'mm');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entity.params.width).toBe(500);
  });
});

describe('pickWallEntityAt (re-exported SSoT)', () => {
  it('picks the nearest wall under the point within tolerance', () => {
    const entities: Entity[] = [wall()];
    const picked = pickWallEntityAt({ x: 2000, y: 5 }, entities, 50);
    expect(picked?.id).toBe('wall-1');
  });

  it('returns null when no wall is within tolerance', () => {
    const entities: Entity[] = [wall()];
    const picked = pickWallEntityAt({ x: 2000, y: 5000 }, entities, 50);
    expect(picked).toBeNull();
  });
});
