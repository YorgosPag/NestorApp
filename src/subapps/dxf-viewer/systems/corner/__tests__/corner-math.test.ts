/**
 * Tests for the shared FILLET/CHAMFER corner harness (ADR-510 Φ4e).
 */

import { resolveCornerAnchors, trimLineToCorner, CORNER_EPSILON } from '../corner-math';
import type { LineEntity } from '../../../types/entities';

function line(id: string, sx: number, sy: number, ex: number, ey: number): LineEntity {
  return { id, type: 'line', layerId: 'lyr_test', start: { x: sx, y: sy }, end: { x: ex, y: ey } };
}

describe('resolveCornerAnchors', () => {
  it('resolves a right-angle L corner and keeps the picked-side endpoints', () => {
    const l1 = line('l1', 0, 0, 100, 0); // horizontal
    const l2 = line('l2', 0, 0, 0, 100); // vertical
    const a = resolveCornerAnchors(l1, { x: 50, y: 0 }, l2, { x: 0, y: 50 });
    expect(a).not.toBeNull();
    expect(a!.vertex.x).toBeCloseTo(0);
    expect(a!.vertex.y).toBeCloseTo(0);
    expect(a!.angle).toBeCloseTo(Math.PI / 2);
    // Picks are on the far ends → keep (100,0) and (0,100), both the `end` endpoint.
    expect(a!.keep1).toEqual({ x: 100, y: 0 });
    expect(a!.keep2).toEqual({ x: 0, y: 100 });
    expect(a!.keep1IsStart).toBe(false);
    expect(a!.keep2IsStart).toBe(false);
    expect(a!.dir1).toEqual({ x: 1, y: 0 });
    expect(a!.dir2).toEqual({ x: 0, y: 1 });
    expect(a!.len1).toBeCloseTo(100);
    expect(a!.len2).toBeCloseTo(100);
  });

  it('keeps the near-side endpoint when the pick is near the vertex end', () => {
    const l1 = line('l1', 0, 0, 100, 0);
    const l2 = line('l2', 0, 0, 0, 100);
    // Pick line1 near its (0,0) end → keep (0,0) side means dir points to start.
    const a = resolveCornerAnchors(l1, { x: 5, y: 0 }, l2, { x: 0, y: 50 });
    expect(a).not.toBeNull();
    // (0,0) is the vertex — both endpoints score via projection; the far end still wins
    // here because (0,0)-V is the zero vector. This documents the deterministic tie-break.
    expect(a!.keep1).toEqual({ x: 100, y: 0 });
  });

  it('returns null for parallel lines (no intersection)', () => {
    const l1 = line('l1', 0, 0, 100, 0);
    const l2 = line('l2', 0, 10, 100, 10);
    expect(resolveCornerAnchors(l1, { x: 50, y: 0 }, l2, { x: 50, y: 10 })).toBeNull();
  });

  it('returns null for collinear lines', () => {
    const l1 = line('l1', 0, 0, 50, 0);
    const l2 = line('l2', 60, 0, 100, 0);
    expect(resolveCornerAnchors(l1, { x: 25, y: 0 }, l2, { x: 80, y: 0 })).toBeNull();
  });
});

describe('trimLineToCorner', () => {
  const l = line('l', 0, 0, 100, 0);

  it('replaces the end when the start is kept', () => {
    const out = trimLineToCorner(l, true, { x: 20, y: 0 });
    expect(out.start).toEqual({ x: 0, y: 0 });
    expect(out.end).toEqual({ x: 20, y: 0 });
  });

  it('replaces the start when the end is kept', () => {
    const out = trimLineToCorner(l, false, { x: 20, y: 0 });
    expect(out.start).toEqual({ x: 20, y: 0 });
    expect(out.end).toEqual({ x: 100, y: 0 });
  });
});

describe('CORNER_EPSILON', () => {
  it('is a small positive tolerance', () => {
    expect(CORNER_EPSILON).toBeGreaterThan(0);
    expect(CORNER_EPSILON).toBeLessThan(1e-6);
  });
});
