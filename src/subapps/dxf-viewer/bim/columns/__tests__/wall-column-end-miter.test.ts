/**
 * ADR-363 §wall-column-end-miter — trapezoidal cut of a wall END on a column face.
 *
 * Guards the load-bearing behaviour (Revit/AutoCAD parity):
 *   1. oblique wall end on a column face → TRAPEZOID (outer/inner land on the face line
 *      at different along-axis positions).
 *   2. perpendicular (90°) wall → the trapezoid degenerates to a STRAIGHT cut
 *      (outer/inner at the SAME along-axis position) — one code path, no branch.
 *   3. no column supplied → null (no change).
 *   4. column far from both ends → null.
 *   5. both ends frame a column → startMiter AND endMiter.
 *   6. curved / degenerate wall → null.
 *   7. idempotent.
 */
import { describe, it, expect } from '@jest/globals';

import { computeWallColumnEndMiter } from '../wall-column-end-miter';
import { buildDefaultWallParams, buildWallEntity } from '../../../hooks/drawing/wall-completion';
import type { WallEntity, WallKind, WallParams } from '../../types/wall-types';
import type { Point2D } from '../../../rendering/types/Types';

function makeWall(
  start: { x: number; y: number },
  end: { x: number; y: number },
  kind: WallKind = 'straight',
  thickness = 200,
): WallEntity {
  const params = buildDefaultWallParams(start, end);
  const overrideParams: WallParams = { ...params, thickness, dna: undefined };
  const result = buildWallEntity(overrideParams, '0', kind);
  if (!result.ok) throw new Error('Failed to build wall: ' + result.hardErrors.join(', '));
  return result.entity as WallEntity;
}

/** Axis-aligned square footprint (CCW), side `size`, centered at (cx, cy). */
function squareFootprint(cx: number, cy: number, size: number): Point2D[] {
  const h = size / 2;
  return [
    { x: cx - h, y: cy - h },
    { x: cx + h, y: cy - h },
    { x: cx + h, y: cy + h },
    { x: cx - h, y: cy + h },
  ];
}

/** Along-axis component of (outer − inner) — 0 ⇒ straight cut, ≠0 ⇒ trapezoid slant. */
function outerMinusInnerAlong(
  m: { outer: Point2D; inner: Point2D },
  ux: number,
  uy: number,
): number {
  return (m.outer.x - m.inner.x) * ux + (m.outer.y - m.inner.y) * uy;
}

describe('computeWallColumnEndMiter — wall END trapezoidal cut on column face', () => {
  // Column: 400×400 square centered at origin. West face x = −200.
  const column = squareFootprint(0, 0, 400);

  it('1. oblique wall end on the west face → trapezoid (outer/inner on face, different along)', () => {
    // Wall comes from the SW at ~20°, ending exactly on the west face x = −200.
    const wall = makeWall({ x: -1000, y: -300 }, { x: -200, y: 0 });
    const res = computeWallColumnEndMiter(wall, [column], 'mm');

    expect(res).not.toBeNull();
    expect(res!.startMiter).toBeUndefined(); // start is far from the column
    expect(res!.endMiter).toBeDefined();

    const em = res!.endMiter!;
    // Both miter points land ON the west face line x = −200.
    expect(em.outer.x).toBeCloseTo(-200, 3);
    expect(em.inner.x).toBeCloseTo(-200, 3);
    // Oblique ⇒ trapezoid: the two corners project to DIFFERENT along-axis positions.
    const len = Math.hypot(800, 300);
    const ux = 800 / len, uy = 300 / len;
    expect(Math.abs(outerMinusInnerAlong(em, ux, uy))).toBeGreaterThan(1);
  });

  it('2. perpendicular wall (90°) → straight cut (outer/inner at same along position)', () => {
    // Horizontal wall ending on the vertical west face → cut is perpendicular ⇒ straight.
    const wall = makeWall({ x: -1000, y: 0 }, { x: -200, y: 0 });
    const res = computeWallColumnEndMiter(wall, [column], 'mm');

    expect(res!.endMiter).toBeDefined();
    const em = res!.endMiter!;
    expect(em.outer.x).toBeCloseTo(-200, 3);
    expect(em.inner.x).toBeCloseTo(-200, 3);
    // u = (1,0): straight cut ⇒ zero along-axis difference (trapezoid degenerated).
    expect(outerMinusInnerAlong(em, 1, 0)).toBeCloseTo(0, 3);
    // Non-degenerate cut still has thickness across the face.
    expect(Math.abs(em.outer.y - em.inner.y)).toBeCloseTo(200, 3);
  });

  it('3. no column supplied → null', () => {
    const wall = makeWall({ x: -1000, y: 0 }, { x: -200, y: 0 });
    expect(computeWallColumnEndMiter(wall, [], 'mm')).toBeNull();
  });

  it('4. column far from both ends → null', () => {
    const wall = makeWall({ x: -5000, y: -5000 }, { x: -4000, y: -5000 });
    expect(computeWallColumnEndMiter(wall, [column], 'mm')).toBeNull();
  });

  it('5. both ends frame a column → startMiter AND endMiter', () => {
    const west = squareFootprint(-2000, 0, 400); // end near (−1800)
    const east = squareFootprint(2000, 0, 400); // end near (1800)
    // Horizontal wall spanning both columns, each end on the inner face.
    const wall = makeWall({ x: -1800, y: 0 }, { x: 1800, y: 0 });
    const res = computeWallColumnEndMiter(wall, [west, east], 'mm');

    expect(res).not.toBeNull();
    expect(res!.startMiter).toBeDefined();
    expect(res!.endMiter).toBeDefined();
    // start end cut on east face of the WEST column (x = −1800).
    expect(res!.startMiter!.outer.x).toBeCloseTo(-1800, 3);
    // end cut on west face of the EAST column (x = 1800).
    expect(res!.endMiter!.outer.x).toBeCloseTo(1800, 3);
  });

  it('6. curved / degenerate wall → null', () => {
    const curved = makeWall({ x: -1000, y: 0 }, { x: -200, y: 0 }, 'curved');
    expect(computeWallColumnEndMiter(curved, [column], 'mm')).toBeNull();

    // Degenerate (zero-length) — the builder rejects it, so mutate a valid wall's params.
    const base = makeWall({ x: -1000, y: 0 }, { x: -200, y: 0 });
    const degenerate: WallEntity = {
      ...base,
      params: { ...base.params, end: { ...base.params.start } },
    };
    expect(computeWallColumnEndMiter(degenerate, [column], 'mm')).toBeNull();
  });

  it('7. idempotent — same input → same output', () => {
    const wall = makeWall({ x: -1000, y: -300 }, { x: -200, y: 0 });
    const a = computeWallColumnEndMiter(wall, [column], 'mm');
    const b = computeWallColumnEndMiter(wall, [column], 'mm');
    expect(a).toEqual(b);
  });
});
