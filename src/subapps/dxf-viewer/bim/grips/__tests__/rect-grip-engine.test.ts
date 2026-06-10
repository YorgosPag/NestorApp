/**
 * ADR-363 / ADR-436 — Rectangle grip engine + frame tests.
 *
 * Verifies the entity-agnostic SSoT: corner/edge world positions (rotation 0 +
 * rotated frame) and the resize transforms (opposite-element-fixed, dragged
 * element follows cursor 1:1, perpendicular dimension untouched on edge drag,
 * min-half clamp keeps the opposite element fixed). Pure functions — zero mocks.
 */

import {
  rectCornerWorld,
  rectEdgeWorld,
  RECT_CORNERS,
  type RectFrame,
} from '../rect-frame';
import {
  applyRectCornerDrag,
  applyRectEdgeDrag,
  type RectResizeLimits,
} from '../rect-grip-engine';

const frame = (over: Partial<RectFrame> = {}): RectFrame => ({
  center: { x: 0, y: 0 },
  rotationDeg: 0,
  halfWidth: 750,
  halfLength: 1000,
  ...over,
});

const LIMITS: RectResizeLimits = { minHalfWidth: 50, minHalfLength: 50 };

describe('rect-frame — corner / edge positions', () => {
  it('places the four corners at the local ±half extents (rotation 0)', () => {
    const f = frame();
    const ne = rectCornerWorld(f, { sx: 1, sy: 1 });
    const sw = rectCornerWorld(f, { sx: -1, sy: -1 });
    expect(ne).toEqual({ x: 750, y: 1000 });
    expect(sw).toEqual({ x: -750, y: -1000 });
  });

  it('exposes exactly four corners in stable NE/NW/SW/SE order', () => {
    expect(RECT_CORNERS).toEqual([
      { sx: 1, sy: 1 },
      { sx: -1, sy: 1 },
      { sx: -1, sy: -1 },
      { sx: 1, sy: -1 },
    ]);
  });

  it('places edge midpoints at the far face centres (rotation 0)', () => {
    const f = frame();
    expect(rectEdgeWorld(f, { axis: 'x', sign: 1 })).toEqual({ x: 750, y: 0 });
    expect(rectEdgeWorld(f, { axis: 'y', sign: 1 })).toEqual({ x: 0, y: 1000 });
  });

  it('rotates corner positions about the centroid (90° CCW)', () => {
    const f = frame({ rotationDeg: 90 });
    // +X half (750) maps to +Y; +Y half (1000) maps to −X.
    const ne = rectCornerWorld(f, { sx: 1, sy: 1 });
    expect(ne.x).toBeCloseTo(-1000);
    expect(ne.y).toBeCloseTo(750);
  });

  it('honours a non-zero centre offset', () => {
    const f = frame({ center: { x: 100, y: 200 } });
    expect(rectCornerWorld(f, { sx: 1, sy: 1 })).toEqual({ x: 850, y: 1200 });
  });
});

describe('applyRectCornerDrag — opposite corner fixed', () => {
  it('the dragged corner follows the cursor 1:1 (rotation 0)', () => {
    const f = frame();
    const next = applyRectCornerDrag(f, { sx: 1, sy: 1 }, { x: 100, y: 200 }, LIMITS);
    const ne = rectCornerWorld(next, { sx: 1, sy: 1 });
    expect(ne.x).toBeCloseTo(850); // 750 + 100
    expect(ne.y).toBeCloseTo(1200); // 1000 + 200
  });

  it('the opposite corner stays put', () => {
    const f = frame();
    const before = rectCornerWorld(f, { sx: -1, sy: -1 });
    const next = applyRectCornerDrag(f, { sx: 1, sy: 1 }, { x: 100, y: 200 }, LIMITS);
    const after = rectCornerWorld(next, { sx: -1, sy: -1 });
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('grows each half by half the corner displacement', () => {
    const next = applyRectCornerDrag(frame(), { sx: 1, sy: 1 }, { x: 100, y: 200 }, LIMITS);
    expect(next.halfWidth).toBeCloseTo(800); // 750 + 100/2
    expect(next.halfLength).toBeCloseTo(1100); // 1000 + 200/2
  });

  it('keeps the opposite corner fixed even after a min-half clamp', () => {
    const f = frame();
    const before = rectCornerWorld(f, { sx: -1, sy: -1 });
    // Huge inward drag on NE → both halves clamp to the minimum.
    const next = applyRectCornerDrag(f, { sx: 1, sy: 1 }, { x: -100000, y: -100000 }, LIMITS);
    expect(next.halfWidth).toBe(50);
    expect(next.halfLength).toBe(50);
    const after = rectCornerWorld(next, { sx: -1, sy: -1 });
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('projects the drag into the local frame on a rotated rect', () => {
    const f = frame({ rotationDeg: 90 });
    // World +Y drag projects to local +X on a 90° frame → grows width only.
    const next = applyRectCornerDrag(f, { sx: 1, sy: 1 }, { x: 0, y: 100 }, LIMITS);
    expect(next.halfWidth).toBeCloseTo(800); // 750 + 100/2
    expect(next.halfLength).toBeCloseTo(1000); // unchanged (no local-Y component)
  });
});

describe('applyRectEdgeDrag — opposite edge fixed', () => {
  it('the dragged edge follows the cursor, opposite edge holds (x axis)', () => {
    const f = frame();
    const beforeOpp = rectEdgeWorld(f, { axis: 'x', sign: -1 });
    const next = applyRectEdgeDrag(f, { axis: 'x', sign: 1 }, { x: 100, y: 0 }, LIMITS);
    expect(rectEdgeWorld(next, { axis: 'x', sign: 1 }).x).toBeCloseTo(850); // follows
    expect(rectEdgeWorld(next, { axis: 'x', sign: -1 }).x).toBeCloseTo(beforeOpp.x); // holds
    expect(next.halfWidth).toBeCloseTo(800); // 750 + 100/2
  });

  it('leaves the perpendicular dimension untouched', () => {
    const next = applyRectEdgeDrag(frame(), { axis: 'x', sign: 1 }, { x: 100, y: 999 }, LIMITS);
    expect(next.halfLength).toBe(1000);
  });

  it('resizes the length on a y-axis edge drag', () => {
    const next = applyRectEdgeDrag(frame(), { axis: 'y', sign: 1 }, { x: 0, y: 200 }, LIMITS);
    expect(next.halfLength).toBeCloseTo(1100); // 1000 + 200/2
    expect(next.halfWidth).toBe(750);
  });

  it('clamps to the minimum half and keeps the opposite edge fixed', () => {
    const f = frame();
    const beforeOpp = rectEdgeWorld(f, { axis: 'x', sign: -1 });
    const next = applyRectEdgeDrag(f, { axis: 'x', sign: 1 }, { x: -100000, y: 0 }, LIMITS);
    expect(next.halfWidth).toBe(50);
    expect(rectEdgeWorld(next, { axis: 'x', sign: -1 }).x).toBeCloseTo(beforeOpp.x);
  });
});
