/**
 * ADR-537 — dxf-grip-ghost-paint: live ghost geometry for a raw DXF grip drag.
 *
 * The dragged grip's vertices follow `livePlanPos`; a `movesEntity` grip translates the
 * whole entity; an `edgeVertexIndices` grip moves both edge vertices. Mirrors the vertex
 * semantics of `computeDxfEntityGrips` (the same SSoT the commit resolves through).
 */

import type { GripInfo } from '../../../hooks/grip-types';
import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';
import { buildDxfGhostSegments } from '../dxf-grip-ghost-paint';

const grip = (p: Partial<GripInfo>): GripInfo =>
  ({ entityId: 'e', gripIndex: 0, type: 'vertex', position: { x: 0, y: 0 }, movesEntity: false, ...p });

const line = (): DxfEntityUnion =>
  ({ id: 'e', type: 'line', visible: true, start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }) as unknown as DxfEntityUnion;

const polyOpen = (): DxfEntityUnion =>
  ({ id: 'e', type: 'polyline', visible: true, vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], closed: false }) as unknown as DxfEntityUnion;

describe('buildDxfGhostSegments — line', () => {
  it('moves only the dragged endpoint (grip 0 → start)', () => {
    const g = grip({ gripIndex: 0, position: { x: 0, y: 0 } });
    const [seg] = buildDxfGhostSegments(line(), g, { x: 10, y: 20 });
    expect(seg[0]).toEqual({ x: 10, y: 20 });
    expect(seg[1]).toEqual({ x: 100, y: 0 });
  });

  it('translates the whole line for a movesEntity midpoint grip', () => {
    const g = grip({ gripIndex: 2, type: 'edge', movesEntity: true, edgeVertexIndices: [0, 1], position: { x: 50, y: 0 } });
    const [seg] = buildDxfGhostSegments(line(), g, { x: 60, y: 5 }); // delta (10,5)
    expect(seg[0]).toEqual({ x: 10, y: 5 });
    expect(seg[1]).toEqual({ x: 110, y: 5 });
  });
});

describe('buildDxfGhostSegments — polyline', () => {
  it('moves one vertex by gripIndex', () => {
    const g = grip({ gripIndex: 1, position: { x: 100, y: 0 } });
    const [seg] = buildDxfGhostSegments(polyOpen(), g, { x: 120, y: 0 });
    expect(seg[1]).toEqual({ x: 120, y: 0 });
    expect(seg[0]).toEqual({ x: 0, y: 0 });
    expect(seg[2]).toEqual({ x: 100, y: 100 });
  });

  it('moves both edge vertices for an edge grip', () => {
    const g = grip({ gripIndex: 3, type: 'edge', position: { x: 50, y: 0 }, edgeVertexIndices: [0, 1] });
    const [seg] = buildDxfGhostSegments(polyOpen(), g, { x: 60, y: 0 }); // delta (10,0)
    expect(seg[0]).toEqual({ x: 10, y: 0 });
    expect(seg[1]).toEqual({ x: 110, y: 0 });
    expect(seg[2]).toEqual({ x: 100, y: 100 });
  });
});

describe('buildDxfGhostSegments — circle', () => {
  const circle = (): DxfEntityUnion =>
    ({ id: 'e', type: 'circle', visible: true, center: { x: 0, y: 0 }, radius: 50 }) as unknown as DxfEntityUnion;

  it('resizes the radius to the live point for a quadrant grip', () => {
    const g = grip({ gripIndex: 1, position: { x: 50, y: 0 } });
    const [seg] = buildDxfGhostSegments(circle(), g, { x: 80, y: 0 }); // new radius 80
    // first sample is at angle 0 → (radius, 0)
    expect(seg[0].x).toBeCloseTo(80);
    expect(seg[0].y).toBeCloseTo(0);
  });

});

describe('buildDxfGhostSegments — arc', () => {
  const arc = (): DxfEntityUnion =>
    ({ id: 'e', type: 'arc', visible: true, center: { x: 0, y: 0 }, radius: 50, startAngle: 0, endAngle: 90 }) as unknown as DxfEntityUnion;

  it('translates the whole arc for the centre grip (gripIndex 0, movesEntity)', () => {
    const g = grip({ gripIndex: 0, type: 'center', movesEntity: true, position: { x: 0, y: 0 } });
    const [seg] = buildDxfGhostSegments(arc(), g, { x: 10, y: 20 }); // delta (10,20)
    // First sample = start angle 0 → (cx+dx + r, cy+dy) = (60, 20).
    expect(seg[0].x).toBeCloseTo(60);
    expect(seg[0].y).toBeCloseTo(20);
  });

  it('translates the whole arc for the mid grip too (gripIndex 3, movesEntity)', () => {
    const g = grip({ gripIndex: 3, type: 'edge', movesEntity: true, position: { x: 0, y: 0 } });
    const [seg] = buildDxfGhostSegments(arc(), g, { x: 10, y: 20 });
    expect(seg[0].x).toBeCloseTo(60);
    expect(seg[0].y).toBeCloseTo(20);
  });

  it('moves the start endpoint, keeping the end fixed (gripIndex 1)', () => {
    const g = grip({ gripIndex: 1, type: 'vertex', position: { x: 50, y: 0 } }); // start endpoint
    const [seg] = buildDxfGhostSegments(arc(), g, { x: 60, y: 0 }); // drag start +10 in x
    // Ghost starts at the moved start endpoint and ends at the untouched end endpoint (0,50).
    expect(seg[0].x).toBeCloseTo(60);
    expect(seg[0].y).toBeCloseTo(0);
    const last = seg[seg.length - 1];
    expect(last.x).toBeCloseTo(0);
    expect(last.y).toBeCloseTo(50);
  });

  it('moves the end endpoint, keeping the start fixed (gripIndex 2)', () => {
    const g = grip({ gripIndex: 2, type: 'vertex', position: { x: 0, y: 50 } }); // end endpoint
    const [seg] = buildDxfGhostSegments(arc(), g, { x: 0, y: 60 }); // drag end +10 in y
    expect(seg[0].x).toBeCloseTo(50); // start untouched (50,0)
    expect(seg[0].y).toBeCloseTo(0);
    const last = seg[seg.length - 1];
    expect(last.x).toBeCloseTo(0);
    expect(last.y).toBeCloseTo(60);
  });
});
