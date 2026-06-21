/**
 * ADR-507 S2-fix-3 — hatch grip-drag transform tests.
 */

import { applyHatchGripDrag, decodeHatchVertexGripKind } from '../hatch-grips';
import type { Point2D } from '../../../rendering/types/Types';
import type { HatchGripKind } from '../../../hooks/grip-types';

const OUTER: Point2D[] = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
  { x: 1000, y: 1000 },
  { x: 0, y: 1000 },
];
const ISLAND: Point2D[] = [
  { x: 400, y: 400 },
  { x: 600, y: 400 },
  { x: 600, y: 600 },
];

describe('decodeHatchVertexGripKind', () => {
  it('decodes path + vertex indices', () => {
    expect(decodeHatchVertexGripKind('hatch-vertex-0-2')).toEqual([0, 2]);
    expect(decodeHatchVertexGripKind('hatch-vertex-1-0')).toEqual([1, 0]);
  });

  it('returns null on a malformed kind', () => {
    expect(decodeHatchVertexGripKind('hatch-vertex-0' as HatchGripKind)).toBeNull();
  });
});

describe('applyHatchGripDrag', () => {
  it('translates the targeted outer-ring vertex only', () => {
    const result = applyHatchGripDrag('hatch-vertex-0-1', {
      originalBoundaryPaths: [OUTER],
      delta: { x: 50, y: -30 },
    });
    expect(result[0][1]).toEqual({ x: 1050, y: -30 });
    // Other vertices untouched.
    expect(result[0][0]).toEqual({ x: 0, y: 0 });
    expect(result[0][2]).toEqual({ x: 1000, y: 1000 });
  });

  it('translates a vertex on an island ring (multi-ring decode)', () => {
    const result = applyHatchGripDrag('hatch-vertex-1-0', {
      originalBoundaryPaths: [OUTER, ISLAND],
      delta: { x: 10, y: 10 },
    });
    expect(result[1][0]).toEqual({ x: 410, y: 410 });
    // Outer ring shared untouched.
    expect(result[0]).toEqual(OUTER);
  });

  it('returns the original reference (no-op) on out-of-range index', () => {
    const original = [OUTER];
    expect(applyHatchGripDrag('hatch-vertex-0-9', { originalBoundaryPaths: original, delta: { x: 5, y: 5 } })).toBe(original);
    expect(applyHatchGripDrag('hatch-vertex-3-0', { originalBoundaryPaths: original, delta: { x: 5, y: 5 } })).toBe(original);
  });

  it('returns the original reference on zero delta', () => {
    const original = [OUTER];
    expect(applyHatchGripDrag('hatch-vertex-0-0', { originalBoundaryPaths: original, delta: { x: 0, y: 0 } })).toBe(original);
  });

  it('quantizes to the dominant axis when rectilinear', () => {
    const result = applyHatchGripDrag('hatch-vertex-0-0', {
      originalBoundaryPaths: [OUTER],
      delta: { x: 80, y: 20 },
      rectilinear: true,
    });
    // |dx| > |dy| → y component dropped.
    expect(result[0][0]).toEqual({ x: 80, y: 0 });
  });

  it('does not mutate the input boundaryPaths', () => {
    const original = [OUTER.map((p) => ({ ...p }))];
    const snapshot = JSON.stringify(original);
    applyHatchGripDrag('hatch-vertex-0-1', { originalBoundaryPaths: original, delta: { x: 50, y: 50 } });
    expect(JSON.stringify(original)).toBe(snapshot);
  });
});
