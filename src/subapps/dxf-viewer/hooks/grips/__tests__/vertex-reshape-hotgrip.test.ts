/**
 * ADR-513 §grip-parity — which grips arm the click-move-click vertex/edge RESHAPE hot-grip.
 *
 * The entry gate decides press-drag vs click-armed. It must arm: ARC start/end, POLYLINE vertex,
 * POLYLINE straight edge-midpoint (incl. a projected rectangle whose grips carry polyline kinds).
 * It must NOT arm: whole-entity move/rotation gizmo, the polyline arc-apex curvature grip, or a
 * plain LINE endpoint (handled by its own `resolveLineEndpointHotGrip`, different typed semantics).
 */

import { isVertexReshapeGrip, resolveVertexReshapeHotGrip } from '../vertex-reshape-hotgrip';
import type { UnifiedGripInfo } from '../unified-grip-types';

// UnifiedGripInfo factory — only the fields the resolver reads.
function grip(over: Partial<UnifiedGripInfo>): UnifiedGripInfo {
  return {
    source: 'dxf', entityId: 'e', gripIndex: 0, type: 'vertex',
    position: { x: 0, y: 0 }, movesEntity: false,
    ...over,
  } as unknown as UnifiedGripInfo;
}
const polyKind = (kind: string) => ({ gripKind: { on: 'polyline', kind } });

describe('isVertexReshapeGrip — eligibility (pure)', () => {
  it('ARC start/end (gripIndex 1/2, no kind) → true', () => {
    expect(isVertexReshapeGrip({ entityType: 'arc', gripIndex: 1, movesEntity: false, polylineKind: null, isEdge: false })).toBe(true);
    expect(isVertexReshapeGrip({ entityType: 'arc', gripIndex: 2, movesEntity: false, polylineKind: null, isEdge: false })).toBe(true);
  });
  it('ARC other indices / edge → false', () => {
    expect(isVertexReshapeGrip({ entityType: 'arc', gripIndex: 0, movesEntity: false, polylineKind: null, isEdge: false })).toBe(false);
    expect(isVertexReshapeGrip({ entityType: 'arc', gripIndex: 3, movesEntity: false, polylineKind: null, isEdge: false })).toBe(false);
    expect(isVertexReshapeGrip({ entityType: 'arc', gripIndex: 1, movesEntity: false, polylineKind: null, isEdge: true })).toBe(false);
  });
  it('POLYLINE vertex + straight edge-midpoint → true', () => {
    expect(isVertexReshapeGrip({ entityType: 'polyline', gripIndex: 0, movesEntity: false, polylineKind: 'polyline-vertex-0', isEdge: false })).toBe(true);
    expect(isVertexReshapeGrip({ entityType: 'polyline', gripIndex: 4, movesEntity: false, polylineKind: 'polyline-segment-midpoint-0', isEdge: true })).toBe(true);
  });
  it('POLYLINE arc-apex (curvature) + move/rotation gizmo → false', () => {
    expect(isVertexReshapeGrip({ entityType: 'polyline', gripIndex: 4, movesEntity: false, polylineKind: 'polyline-arc-midpoint-0', isEdge: true })).toBe(false);
    expect(isVertexReshapeGrip({ entityType: 'polyline', gripIndex: 9, movesEntity: false, polylineKind: 'polyline-move', isEdge: false })).toBe(false);
    expect(isVertexReshapeGrip({ entityType: 'polyline', gripIndex: 10, movesEntity: false, polylineKind: 'polyline-rotation', isEdge: false })).toBe(false);
  });
  it('projected RECTANGLE (raw type rectangle, polyline-kind grips) → true', () => {
    expect(isVertexReshapeGrip({ entityType: 'rectangle', gripIndex: 0, movesEntity: false, polylineKind: 'polyline-vertex-0', isEdge: false })).toBe(true);
    expect(isVertexReshapeGrip({ entityType: 'rect', gripIndex: 4, movesEntity: false, polylineKind: 'polyline-segment-midpoint-1', isEdge: true })).toBe(true);
  });
  it('LINE (own entry) + movesEntity + other types → false', () => {
    expect(isVertexReshapeGrip({ entityType: 'line', gripIndex: 0, movesEntity: false, polylineKind: null, isEdge: false })).toBe(false);
    expect(isVertexReshapeGrip({ entityType: 'polyline', gripIndex: 0, movesEntity: true, polylineKind: 'polyline-vertex-0', isEdge: false })).toBe(false);
    expect(isVertexReshapeGrip({ entityType: 'circle', gripIndex: 1, movesEntity: false, polylineKind: null, isEdge: false })).toBe(false);
  });
});

describe('resolveVertexReshapeHotGrip — entity+grip gate', () => {
  it('arms an arc endpoint + a polyline vertex + a projected-rectangle corner', () => {
    expect(resolveVertexReshapeHotGrip({ type: 'arc' }, grip({ gripIndex: 1 }))).toBe(true);
    expect(resolveVertexReshapeHotGrip({ type: 'polyline' }, grip({ ...polyKind('polyline-vertex-2'), gripIndex: 2 }))).toBe(true);
    expect(resolveVertexReshapeHotGrip({ type: 'rectangle' }, grip({ ...polyKind('polyline-vertex-0') }))).toBe(true);
  });
  it('arms a polyline straight edge-midpoint (whole side)', () => {
    expect(resolveVertexReshapeHotGrip(
      { type: 'polyline' },
      grip({ ...polyKind('polyline-segment-midpoint-0'), type: 'edge', gripIndex: 4, edgeVertexIndices: [0, 1] }),
    )).toBe(true);
  });
  it('does NOT arm a line endpoint, a non-dxf grip, or a null entity', () => {
    expect(resolveVertexReshapeHotGrip({ type: 'line' }, grip({ gripIndex: 0 }))).toBe(false);
    expect(resolveVertexReshapeHotGrip({ type: 'polyline' }, grip({ ...polyKind('polyline-vertex-0'), source: 'overlay' }))).toBe(false);
    expect(resolveVertexReshapeHotGrip(null, grip({}))).toBe(false);
  });
});
