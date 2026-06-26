/**
 * ADR-538 — dxfEntityOutlineSegments: plan-mm outline of a raw DXF entity for the 3D
 * hover glow overlay (line / polyline / circle / arc).
 */

import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';
import { dxfEntityOutlineSegments } from '../dxf-entity-outline';

const line = (): DxfEntityUnion =>
  ({ id: 'l', type: 'line', visible: true, start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }) as unknown as DxfEntityUnion;

describe('dxfEntityOutlineSegments', () => {
  it('returns the two endpoints for a line', () => {
    expect(dxfEntityOutlineSegments(line())).toEqual([[{ x: 0, y: 0 }, { x: 100, y: 0 }]]);
  });

  it('returns the vertex list for an open polyline (no closing point)', () => {
    const p = { id: 'p', type: 'polyline', visible: true, vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], closed: false } as unknown as DxfEntityUnion;
    const [seg] = dxfEntityOutlineSegments(p);
    expect(seg).toHaveLength(3);
  });

  it('appends the closing point for a closed polyline', () => {
    const p = { id: 'p', type: 'polyline', visible: true, vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], closed: true } as unknown as DxfEntityUnion;
    const [seg] = dxfEntityOutlineSegments(p);
    expect(seg).toHaveLength(4);
    expect(seg[3]).toEqual({ x: 0, y: 0 });
  });

  it('samples a closed loop for a circle starting at (cx+r, cy)', () => {
    const c = { id: 'c', type: 'circle', visible: true, center: { x: 5, y: 5 }, radius: 10 } as unknown as DxfEntityUnion;
    const [seg] = dxfEntityOutlineSegments(c);
    expect(seg.length).toBeGreaterThan(8);
    expect(seg[0].x).toBeCloseTo(15);
    expect(seg[0].y).toBeCloseTo(5);
    // closed: last sample returns to the start
    expect(seg[seg.length - 1].x).toBeCloseTo(15);
    expect(seg[seg.length - 1].y).toBeCloseTo(5);
  });

  it('samples an arc from start to end angle', () => {
    const a = { id: 'a', type: 'arc', visible: true, center: { x: 0, y: 0 }, radius: 10, startAngle: 0, endAngle: 90 } as unknown as DxfEntityUnion;
    const [seg] = dxfEntityOutlineSegments(a);
    expect(seg[0].x).toBeCloseTo(10); // angle 0 → (r, 0)
    expect(seg[0].y).toBeCloseTo(0);
    const last = seg[seg.length - 1];
    expect(last.x).toBeCloseTo(0); // angle 90 → (0, r)
    expect(last.y).toBeCloseTo(10);
  });

  it('returns [] for an unsupported type (text)', () => {
    const t = { id: 't', type: 'text', visible: true } as unknown as DxfEntityUnion;
    expect(dxfEntityOutlineSegments(t)).toEqual([]);
  });
});
