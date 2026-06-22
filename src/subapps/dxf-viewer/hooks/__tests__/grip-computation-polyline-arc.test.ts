/**
 * ADR-510 Φ3c — polyline grips carry `polylineGripKind` and arc segments expose
 * their grip at the APEX (`bulgeApexPoint`), not the chord midpoint, so dragging
 * it changes curvature and the context menu can offer Convert-to-Line.
 */
import { computeDxfEntityGrips } from '../grip-computation';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { bulgeApexPoint } from '../../rendering/entities/shared/geometry-bulge-utils';
import { calculateMidpoint } from '../../rendering/entities/shared/geometry-utils';

// Closed square; segment 0 (bottom edge) is an arc (bulge 0.5), the rest straight.
function makeArcedSquare(): DxfEntityUnion {
  return {
    id: 'poly-1',
    type: 'polyline',
    vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
    closed: true,
    bulges: [0.5, 0, 0, 0],
  } as unknown as DxfEntityUnion;
}

describe('computeDxfEntityGrips — polyline multifunctional grip tagging', () => {
  const grips = computeDxfEntityGrips(makeArcedSquare());

  it('tags every vertex grip with polyline-vertex-N', () => {
    const vertexGrips = grips.filter((g) => g.polylineGripKind?.startsWith('polyline-vertex-'));
    expect(vertexGrips).toHaveLength(4);
    expect(vertexGrips[0].polylineGripKind).toBe('polyline-vertex-0');
  });

  it('places the arc segment grip at the apex and tags it polyline-arc-midpoint-0', () => {
    const arc = grips.find((g) => g.polylineGripKind === 'polyline-arc-midpoint-0');
    expect(arc).toBeDefined();
    const apex = bulgeApexPoint({ x: 0, y: 0 }, { x: 10, y: 0 }, 0.5);
    expect(arc!.position.x).toBeCloseTo(apex.x);
    expect(arc!.position.y).toBeCloseTo(apex.y);
  });

  it('keeps straight segment grips at the chord midpoint, tagged polyline-segment-midpoint-N', () => {
    const seg = grips.find((g) => g.polylineGripKind === 'polyline-segment-midpoint-1');
    expect(seg).toBeDefined();
    const mid = calculateMidpoint({ x: 10, y: 0 }, { x: 10, y: 10 });
    expect(seg!.position).toEqual(mid);
  });

  it('a fully straight polyline exposes only segment-midpoint edge grips', () => {
    const straight = computeDxfEntityGrips({
      id: 'poly-2', type: 'polyline', closed: false,
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }],
    } as unknown as DxfEntityUnion);
    const arcGrips = straight.filter((g) => g.polylineGripKind?.startsWith('polyline-arc-midpoint-'));
    expect(arcGrips).toHaveLength(0);
    const segGrips = straight.filter((g) => g.polylineGripKind?.startsWith('polyline-segment-midpoint-'));
    expect(segGrips).toHaveLength(2); // open polyline: 2 edges
  });
});
