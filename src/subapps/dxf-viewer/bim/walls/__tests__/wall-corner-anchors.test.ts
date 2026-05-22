/**
 * ADR-370 §5.1 — `getWallCornerWorldPoints` tests.
 *
 * Verifies:
 *   - Returns exactly 4 corners (outer-start, outer-end, inner-end, inner-start).
 *   - Horizontal straight wall: correct +Y/-Y edge offsets.
 *   - Vertical straight wall: correct +X/-X edge offsets.
 *   - flip=true swaps outer/inner.
 *   - Degenerate wall (zero length) returns 4 coincident points without throwing.
 */

import { getWallCornerWorldPoints } from '../wall-corner-anchors';
import type { WallEntity } from '../../types/wall-types';
import type { WallParams } from '../../types/wall-types';

const EPS = 1e-6;

function makeWallEntity(overrides: Partial<WallParams> = {}, id = 'wall_test'): WallEntity {
  const params: WallParams = {
    category: 'exterior',
    start: { x: 0, y: 0 },
    end: { x: 1000, y: 0 },
    height: 3000,
    thickness: 200,
    flip: false,
    ...overrides,
  } as WallParams;
  return {
    id,
    type: 'wall',
    kind: 'straight',
    layerId: '0',
    params,
    geometry: undefined as never,
    validation: undefined as never,
    visible: true,
  } as unknown as WallEntity;
}

describe('getWallCornerWorldPoints', () => {
  it('returns exactly 4 corners', () => {
    const result = getWallCornerWorldPoints(makeWallEntity());
    expect(result).toHaveLength(4);
  });

  it('tags: outer-start, outer-end, inner-end, inner-start (CCW order)', () => {
    const result = getWallCornerWorldPoints(makeWallEntity());
    expect(result[0]!.side).toBe('outer');
    expect(result[0]!.end).toBe('start');
    expect(result[1]!.side).toBe('outer');
    expect(result[1]!.end).toBe('end');
    expect(result[2]!.side).toBe('inner');
    expect(result[2]!.end).toBe('end');
    expect(result[3]!.side).toBe('inner');
    expect(result[3]!.end).toBe('start');
  });

  it('horizontal wall: outer edge at +halfThickness Y, inner at −halfThickness Y', () => {
    // Wall from (0,0)→(1000,0), thickness=200 → half=100
    const result = getWallCornerWorldPoints(makeWallEntity({ thickness: 200 }));
    const outerStart = result[0]!.point;
    const outerEnd   = result[1]!.point;
    const innerEnd   = result[2]!.point;
    const innerStart = result[3]!.point;

    expect(outerStart.y).toBeCloseTo(100, 6);
    expect(outerEnd.y).toBeCloseTo(100, 6);
    expect(innerEnd.y).toBeCloseTo(-100, 6);
    expect(innerStart.y).toBeCloseTo(-100, 6);

    expect(outerStart.x).toBeCloseTo(0, 6);
    expect(outerEnd.x).toBeCloseTo(1000, 6);
    expect(innerEnd.x).toBeCloseTo(1000, 6);
    expect(innerStart.x).toBeCloseTo(0, 6);
  });

  it('vertical wall: outer edge at +halfThickness X', () => {
    const result = getWallCornerWorldPoints(
      makeWallEntity({ start: { x: 0, y: 0 }, end: { x: 0, y: 1000 }, thickness: 200 }),
    );
    // For a vertical wall (pointing +Y), perpendicular is −X for outer
    expect(Math.abs(result[0]!.point.x)).toBeCloseTo(100, 6);
  });

  it('flip=true swaps outer and inner Y offsets for horizontal wall', () => {
    const flipped = getWallCornerWorldPoints(makeWallEntity({ thickness: 200, flip: true }));
    // Outer should now be at −halfThickness
    expect(flipped[0]!.point.y).toBeCloseTo(-100, 6);
    expect(flipped[3]!.point.y).toBeCloseTo(100, 6);
  });

  it('degenerate wall (start === end) returns 4 coincident points without throwing', () => {
    const result = getWallCornerWorldPoints(
      makeWallEntity({ start: { x: 50, y: 50 }, end: { x: 50, y: 50 } }),
    );
    expect(result).toHaveLength(4);
    for (const { point } of result) {
      expect(Math.abs(point.x - 50)).toBeLessThan(EPS + 200);
      expect(Math.abs(point.y - 50)).toBeLessThan(EPS + 200);
    }
  });
});
