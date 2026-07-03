/**
 * ADR-363 «Δοκάρι από τοίχο» — unit tests for the beam-from-wall SSoT bridge.
 *
 * Covers: wall hit-test (nearest / tolerance / ignore non-walls) and the beam
 * build on the wall axis (width = wall thickness, axis = wall start→end).
 */

import { pickWallEntityAt, buildBeamFromWall } from '../beam-from-wall';
import type { Entity } from '../../../types/entities';
import type { WallEntity } from '../../types/wall-types';

const wall = (id: string, x1: number, y1: number, x2: number, y2: number, thickness = 250): WallEntity =>
  ({
    id,
    type: 'wall',
    kind: 'straight',
    params: {
      category: 'structural',
      start: { x: x1, y: y1, z: 0 },
      end: { x: x2, y: y2, z: 0 },
      height: 3000,
      thickness,
      flip: false,
    },
    geometry: {},
  } as unknown as WallEntity);

const line = (id: string): Entity =>
  ({ id, type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } } as unknown as Entity);

describe('pickWallEntityAt', () => {
  it('returns the wall whose axis is under the point', () => {
    const entities = [wall('w1', 0, 0, 1000, 0)] as unknown as Entity[];
    const hit = pickWallEntityAt({ x: 500, y: 5 }, entities, 50);
    expect(hit?.id).toBe('w1');
  });

  it('returns null when no wall is within tolerance', () => {
    const entities = [wall('w1', 0, 0, 1000, 0)] as unknown as Entity[];
    expect(pickWallEntityAt({ x: 500, y: 500 }, entities, 50)).toBeNull();
  });

  it('ignores non-wall entities', () => {
    expect(pickWallEntityAt({ x: 5, y: 0 }, [line('l1')], 50)).toBeNull();
  });

  it('picks the nearest of two overlapping walls', () => {
    const entities = [
      wall('far', 0, 100, 1000, 100),
      wall('near', 0, 0, 1000, 0),
    ] as unknown as Entity[];
    expect(pickWallEntityAt({ x: 500, y: 10 }, entities, 200)?.id).toBe('near');
  });

  // Regression: click on the wall BODY (off the invisible axis) selects it even with
  // the tiny pixel-derived tolerance. Before the body-hit fix the ~100mm off-axis
  // click vs tol=4 returned null → the «no beam is created» bug.
  it('picks a wall when the click is on its body but off the axis (tol=4)', () => {
    const entities = [wall('w1', 0, 0, 1000, 0, 250)] as unknown as Entity[]; // half = 125
    expect(pickWallEntityAt({ x: 500, y: 100 }, entities, 4)?.id).toBe('w1');
  });

  it('returns null when the click is outside the wall body (+margin)', () => {
    const entities = [wall('w1', 0, 0, 1000, 0, 250)] as unknown as Entity[]; // threshold = 129
    expect(pickWallEntityAt({ x: 500, y: 200 }, entities, 4)).toBeNull();
  });
});

describe('buildBeamFromWall', () => {
  it('builds a beam on the wall axis with width = wall thickness', () => {
    const w = wall('w1', 0, 0, 4000, 0, 300);
    const result = buildBeamFromWall(w, {}, '0', 'mm');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entity.type).toBe('beam');
    expect(result.entity.params.startPoint.x).toBe(0);
    expect(result.entity.params.endPoint.x).toBe(4000);
    expect(result.entity.params.width).toBe(300);
  });

  it('lets an explicit width override the wall thickness', () => {
    const w = wall('w1', 0, 0, 4000, 0, 300);
    const result = buildBeamFromWall(w, { width: 500 }, '0', 'mm');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entity.params.width).toBe(500);
  });

  it('uses beam defaults so the beam sits on top of a 3m wall (top 3000, depth 500)', () => {
    const w = wall('w1', 0, 0, 4000, 0);
    const result = buildBeamFromWall(w, {}, '0', 'mm');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entity.params.topElevation).toBe(3000);
    expect(result.entity.params.depth).toBe(500);
  });
});
