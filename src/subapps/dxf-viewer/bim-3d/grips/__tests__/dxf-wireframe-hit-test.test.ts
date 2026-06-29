/**
 * ADR-537 — dxf-wireframe-hit-test: plan-space proximity pick over raw DXF entities.
 *
 * Covers the PURE core (`distanceToDxfEntityMm` + `nearestDxfEntityWithin`); the
 * `pickDxfEntityAt` wrapper (ray/plane projection) is exercised in the browser.
 */

import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';
import { distanceToDxfEntityMm, nearestDxfEntityWithin, nearestDxfEntityDetailed } from '../dxf-wireframe-hit-test';

const line = (id: string, x1: number, y1: number, x2: number, y2: number): DxfEntityUnion =>
  ({ id, type: 'line', visible: true, start: { x: x1, y: y1 }, end: { x: x2, y: y2 } }) as unknown as DxfEntityUnion;

const circle = (id: string, cx: number, cy: number, r: number): DxfEntityUnion =>
  ({ id, type: 'circle', visible: true, center: { x: cx, y: cy }, radius: r }) as unknown as DxfEntityUnion;

const poly = (id: string, verts: [number, number][], closed: boolean): DxfEntityUnion =>
  ({ id, type: 'polyline', visible: true, vertices: verts.map(([x, y]) => ({ x, y })), closed }) as unknown as DxfEntityUnion;

describe('distanceToDxfEntityMm', () => {
  it('measures point→segment for a line (perpendicular distance)', () => {
    const d = distanceToDxfEntityMm(line('l', 0, 0, 100, 0), { x: 50, y: 7 });
    expect(d).toBeCloseTo(7);
  });

  it('clamps a line to its endpoints (beyond the end → distance to the end)', () => {
    const d = distanceToDxfEntityMm(line('l', 0, 0, 100, 0), { x: 130, y: 0 });
    expect(d).toBeCloseTo(30);
  });

  it('measures |dist−radius| for a circle', () => {
    const d = distanceToDxfEntityMm(circle('c', 0, 0, 50), { x: 60, y: 0 });
    expect(d).toBeCloseTo(10);
  });

  it('measures the nearest edge of a closed polyline (incl. the closing edge)', () => {
    const square = poly('p', [[0, 0], [100, 0], [100, 100], [0, 100]], true);
    // point just outside the closing edge (x=0 side)
    expect(distanceToDxfEntityMm(square, { x: -5, y: 50 })).toBeCloseTo(5);
  });

  // ADR-557 Φ-attachment — text is picked by its attachment-aware box (`textBoxAABB` SSoT).
  // No textStyle → default TL (top-left): the box extends RIGHT + DOWN from position (10,20),
  // w = 2×5×0.6 = 6 → x∈[10,16], y∈[15,20]. (Was the old symmetric ±h, attachment-blind box.)
  const text = (): DxfEntityUnion =>
    ({ id: 't', type: 'text', visible: true, position: { x: 10, y: 20 }, height: 5, text: 'AB' }) as unknown as DxfEntityUnion;

  it('returns 0 for a point inside the text bbox', () => {
    expect(distanceToDxfEntityMm(text(), { x: 12, y: 17 })).toBe(0);
  });

  it('measures the perpendicular distance to the text bbox from outside', () => {
    // box: x∈[10,16], y∈[15,20]
    expect(distanceToDxfEntityMm(text(), { x: 5, y: 17 })).toBeCloseTo(5);   // 5 left of minX
    expect(distanceToDxfEntityMm(text(), { x: 12, y: 10 })).toBeCloseTo(5);  // 5 below minY
  });

  it('returns null for an unsupported type (still no wireframe — e.g. dimension)', () => {
    const dim = { id: 'd', type: 'dimension', visible: true } as unknown as DxfEntityUnion;
    expect(distanceToDxfEntityMm(dim, { x: 0, y: 0 })).toBeNull();
  });
});

describe('nearestDxfEntityWithin', () => {
  const entities = [line('a', 0, 0, 100, 0), line('b', 0, 50, 100, 50), circle('c', 200, 0, 20)];

  it('returns the nearest entity within tolerance', () => {
    expect(nearestDxfEntityWithin(entities, { x: 50, y: 4 }, 10)).toBe('a');
    expect(nearestDxfEntityWithin(entities, { x: 50, y: 47 }, 10)).toBe('b');
  });

  it('returns null when nothing is within tolerance', () => {
    expect(nearestDxfEntityWithin(entities, { x: 50, y: 25 }, 5)).toBeNull();
  });

  it('skips invisible entities', () => {
    const hidden = [{ ...(line('a', 0, 0, 100, 0) as object), visible: false } as unknown as DxfEntityUnion];
    expect(nearestDxfEntityWithin(hidden, { x: 50, y: 0 }, 10)).toBeNull();
  });
});

// ADR-537 δ — the detailed variant returns the distance so the multi-floor pick can compare
// hits across stacked floors.
describe('nearestDxfEntityDetailed', () => {
  const entities = [line('a', 0, 0, 100, 0), line('b', 0, 50, 100, 50)];

  it('returns the nearest id together with its distance', () => {
    expect(nearestDxfEntityDetailed(entities, { x: 50, y: 4 }, 10)).toEqual({ id: 'a', dist: 4 });
    expect(nearestDxfEntityDetailed(entities, { x: 50, y: 47 }, 10)).toEqual({ id: 'b', dist: 3 });
  });

  it('returns null when nothing is within tolerance', () => {
    expect(nearestDxfEntityDetailed(entities, { x: 50, y: 25 }, 5)).toBeNull();
  });
});
