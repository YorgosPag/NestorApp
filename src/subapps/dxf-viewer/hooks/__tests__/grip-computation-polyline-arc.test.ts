/**
 * ADR-510 Φ3c — polyline grips carry `polylineGripKind` and arc segments expose
 * their grip at the APEX (`bulgeApexPoint`), not the chord midpoint, so dragging
 * it changes curvature and the context menu can offer Convert-to-Line.
 */
import { computeDxfEntityGrips } from '../grip-computation';
import { gripKindOf } from '../grip-kinds';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { bulgeApexPoint } from '../../rendering/entities/shared/geometry-bulge-utils';
import { calculateMidpoint, getNearestPointOnLine } from '../../rendering/entities/shared/geometry-utils';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import { buildSmoothedDisplayPath } from '../../rendering/entities/shared/geometry-smooth-display';
import type { Point2D } from '../../rendering/types/Types';

/** Min distance from `p` to an (open) polyline path — 0 ⇒ p lies on the curve. */
function distanceToPath(p: Point2D, path: readonly Point2D[]): number {
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i += 1) {
    best = Math.min(best, calculateDistance(p, getNearestPointOnLine(p, path[i], path[i + 1], true)));
  }
  return best;
}

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
    const vertexGrips = grips.filter((g) => gripKindOf(g, 'polyline')?.startsWith('polyline-vertex-'));
    expect(vertexGrips).toHaveLength(4);
    expect(gripKindOf(vertexGrips[0], 'polyline')).toBe('polyline-vertex-0');
  });

  it('places the arc segment grip at the apex and tags it polyline-arc-midpoint-0', () => {
    const arc = grips.find((g) => gripKindOf(g, 'polyline') === 'polyline-arc-midpoint-0');
    expect(arc).toBeDefined();
    const apex = bulgeApexPoint({ x: 0, y: 0 }, { x: 10, y: 0 }, 0.5);
    expect(arc!.position.x).toBeCloseTo(apex.x);
    expect(arc!.position.y).toBeCloseTo(apex.y);
  });

  it('keeps straight segment grips at the chord midpoint, tagged polyline-segment-midpoint-N', () => {
    const seg = grips.find((g) => gripKindOf(g, 'polyline') === 'polyline-segment-midpoint-1');
    expect(seg).toBeDefined();
    const mid = calculateMidpoint({ x: 10, y: 0 }, { x: 10, y: 10 });
    expect(seg!.position).toEqual(mid);
  });

  it('a fully straight polyline exposes only segment-midpoint edge grips', () => {
    const straight = computeDxfEntityGrips({
      id: 'poly-2', type: 'polyline', closed: false,
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }],
    } as unknown as DxfEntityUnion);
    const arcGrips = straight.filter((g) => gripKindOf(g, 'polyline')?.startsWith('polyline-arc-midpoint-'));
    expect(arcGrips).toHaveLength(0);
    const segGrips = straight.filter((g) => gripKindOf(g, 'polyline')?.startsWith('polyline-segment-midpoint-'));
    expect(segGrips).toHaveLength(2); // open polyline: 2 edges
  });

  // ADR-658 M3 — a smoothDisplay «Καμπύλη» (fitted curve) suppresses edge-midpoint grips
  // (they would float off the visible curve); only fit-point (vertex) grips remain, on the curve.
  it('a smoothDisplay «Καμπύλη» exposes vertex grips but NO edge-midpoint grips', () => {
    const curve = computeDxfEntityGrips({
      id: 'curve-1', type: 'polyline', closed: false, smoothDisplay: true,
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }, { x: 30, y: 10 }],
    } as unknown as DxfEntityUnion);
    const vertexGrips = curve.filter((g) => gripKindOf(g, 'polyline')?.startsWith('polyline-vertex-'));
    expect(vertexGrips).toHaveLength(4);
    const edgeGrips = curve.filter((g) => {
      const k = gripKindOf(g, 'polyline');
      return k?.startsWith('polyline-segment-midpoint-') || k?.startsWith('polyline-arc-midpoint-');
    });
    expect(edgeGrips).toHaveLength(0);
    // The whole-entity MOVE + ROTATION handles still follow (indices right after the vertices).
    const moveRotate = curve.filter((g) => {
      const k = gripKindOf(g, 'polyline');
      return k === 'polyline-move' || k === 'polyline-rotation';
    });
    expect(moveRotate).toHaveLength(2);
  });

  // ADR-658 M3 — the MOVE cross + ROTATION handle must sit ON the fitted curve, not on the
  // straight longest-chord (Giorgio 2026-07-15).
  it('MOVE + ROTATION handles land ON the smoothDisplay curve (not the chord)', () => {
    const verts = [{ x: 0, y: 0 }, { x: 10, y: 40 }, { x: 40, y: 40 }, { x: 60, y: 0 }, { x: 90, y: 30 }];
    const curveGrips = computeDxfEntityGrips({
      id: 'curve-2', type: 'polyline', closed: false, smoothDisplay: true, vertices: verts,
    } as unknown as DxfEntityUnion);
    const path = buildSmoothedDisplayPath(verts, false);
    for (const kind of ['polyline-move', 'polyline-rotation']) {
      const handle = curveGrips.find((g) => gripKindOf(g, 'polyline') === kind);
      expect(handle).toBeDefined();
      expect(distanceToPath(handle!.position, path)).toBeLessThan(1e-6);
    }
  });
});
