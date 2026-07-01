/**
 * ADR-561 — `asOrientedRect` + bbox helpers tests.
 */
import { asOrientedRect, polylineBbox, polylineBboxCenter } from '../rectangle-detect';

describe('asOrientedRect (ADR-561)', () => {
  it('recovers an axis-aligned rectangle → rotationDeg 0, correct half extents + centre', () => {
    // 40 wide (x), 20 tall (y), CCW from origin.
    const verts = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }, { x: 0, y: 20 }];
    const rect = asOrientedRect(verts)!;
    expect(rect).not.toBeNull();
    expect(rect.center).toEqual({ x: 20, y: 10 });
    expect(rect.rotationDeg).toBeCloseTo(0, 6);
    expect(rect.halfWidth).toBeCloseTo(20, 6);  // |v0→v1| / 2
    expect(rect.halfLength).toBeCloseTo(10, 6);  // |v0→v3| / 2
  });

  it('recovers a rotated rectangle → rotationDeg follows the first edge', () => {
    // Square of side 10, rotated 90° (first edge points +Y).
    const verts = [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: -10, y: 10 }, { x: -10, y: 0 }];
    const rect = asOrientedRect(verts)!;
    expect(rect).not.toBeNull();
    expect(rect.rotationDeg).toBeCloseTo(90, 6);
    expect(rect.halfWidth).toBeCloseTo(5, 6);
    expect(rect.halfLength).toBeCloseTo(5, 6);
  });

  it('closes a ring that repeats the first vertex (5-point closed ring)', () => {
    const verts = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }, { x: 0, y: 20 }, { x: 0, y: 0 }];
    expect(asOrientedRect(verts)).not.toBeNull();
  });

  it('returns null for a non-right-angle quad (parallelogram)', () => {
    const verts = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 50, y: 20 }, { x: 10, y: 20 }];
    expect(asOrientedRect(verts)).toBeNull();
  });

  it('returns null for a triangle (wrong corner count)', () => {
    const verts = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 20, y: 20 }];
    expect(asOrientedRect(verts)).toBeNull();
  });

  it('bbox + bboxCenter cover an arbitrary ring', () => {
    const verts = [{ x: 2, y: 3 }, { x: 8, y: 1 }, { x: 6, y: 9 }];
    expect(polylineBbox(verts)).toEqual({ minX: 2, minY: 1, maxX: 8, maxY: 9 });
    expect(polylineBboxCenter(verts)).toEqual({ x: 5, y: 5 });
  });
});
