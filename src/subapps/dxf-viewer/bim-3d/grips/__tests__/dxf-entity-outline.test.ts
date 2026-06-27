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

  it('returns [] for an unsupported type (e.g. dimension — text is now supported, ADR-537 β)', () => {
    const d = { id: 'd', type: 'dimension', visible: true } as unknown as DxfEntityUnion;
    expect(dxfEntityOutlineSegments(d)).toEqual([]);
  });

  // ADR-537 γ — non-mm scenes: native DXF coords scaled to mm by `unitToMm`.
  it('scales line endpoints to mm for a cm scene (unitToMm = 10)', () => {
    expect(dxfEntityOutlineSegments(line(), 10)).toEqual([[{ x: 0, y: 0 }, { x: 1000, y: 0 }]]);
  });

  it('scales circle centre + radius to mm for an m scene (unitToMm = 1000)', () => {
    const c = { id: 'c', type: 'circle', visible: true, center: { x: 5, y: 5 }, radius: 10 } as unknown as DxfEntityUnion;
    const [seg] = dxfEntityOutlineSegments(c, 1000);
    // first sample at angle 0 → (cx*k + r*k, cy*k) = (5000 + 10000, 5000)
    expect(seg[0].x).toBeCloseTo(15000);
    expect(seg[0].y).toBeCloseTo(5000);
  });

  it('is identity at unitToMm = 1 (default) — byte-identical to the no-arg call', () => {
    expect(dxfEntityOutlineSegments(line(), 1)).toEqual(dxfEntityOutlineSegments(line()));
  });

  // ADR-537 β — text glows as its closed bounding box (same box the pick uses).
  it('returns a closed bbox rectangle for text', () => {
    const t = { id: 't', type: 'text', visible: true, position: { x: 10, y: 20 }, height: 5, text: 'AB' } as unknown as DxfEntityUnion;
    const [seg] = dxfEntityOutlineSegments(t);
    // bbox x∈[10,17], y∈[15,25]; 5 corners (closed loop).
    expect(seg).toEqual([
      { x: 10, y: 15 }, { x: 17, y: 15 }, { x: 17, y: 25 }, { x: 10, y: 25 }, { x: 10, y: 15 },
    ]);
  });

  it('scales the text bbox to mm for a cm scene (unitToMm = 10)', () => {
    const t = { id: 't', type: 'text', visible: true, position: { x: 10, y: 20 }, height: 5, text: 'AB' } as unknown as DxfEntityUnion;
    const [seg] = dxfEntityOutlineSegments(t, 10);
    expect(seg[0]).toEqual({ x: 100, y: 150 });
    expect(seg[2]).toEqual({ x: 170, y: 250 });
  });
});
