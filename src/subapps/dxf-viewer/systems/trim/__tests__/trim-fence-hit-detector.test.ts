/**
 * Tests for trim-fence-hit-detector (ADR-350 §Phase 5 — G10 test plan).
 *
 * Covers: detectFenceHits (hit/miss, layer filtering, mode gating),
 * buildEntityPreviewPath (entity-type coverage), closestToOrigin ordering.
 */

import { detectFenceHits, buildEntityPreviewPath } from '../trim-fence-hit-detector';
import type { SceneLayer, SceneModel } from '../../../types/scene';
import type {
  ArcEntity,
  CircleEntity,
  EllipseEntity,
  LineEntity,
  LWPolylineEntity,
} from '../../../types/entities';

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeLine(id: string, x1: number, y1: number, x2: number, y2: number, layer = 'L0'): LineEntity {
  return { id, type: 'line', start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, layer };
}

function makeScene(
  entities: LineEntity[],
  layers: Record<string, Partial<SceneLayer>> = {},
): SceneModel {
  return { entities, layers: layers as Record<string, SceneLayer> } as SceneModel;
}

const DEFAULT_ARGS = { mode: 'quick' as const, cuttingEdgeIds: [] as string[] };

// ── detectFenceHits ───────────────────────────────────────────────────────────

describe('detectFenceHits', () => {
  it('returns empty array for empty scene', () => {
    const scene = makeScene([]);
    const hits = detectFenceHits({ fenceStart: { x: 0, y: 0 }, fenceEnd: { x: 10, y: 0 }, scene, ...DEFAULT_ARGS });
    expect(hits).toHaveLength(0);
  });

  it('detects a line crossing the fence', () => {
    // Vertical line at x=5 from y=-5 to y=5; fence is horizontal y=0, x=0→10
    const scene = makeScene([makeLine('e1', 5, -5, 5, 5)]);
    const hits = detectFenceHits({ fenceStart: { x: 0, y: 0 }, fenceEnd: { x: 10, y: 0 }, scene, ...DEFAULT_ARGS });
    expect(hits).toHaveLength(1);
    expect(hits[0].entityId).toBe('e1');
    expect(hits[0].pickPoint.x).toBeCloseTo(5);
    expect(hits[0].pickPoint.y).toBeCloseTo(0);
  });

  it('misses a line parallel and offset from fence', () => {
    // Horizontal line at y=5, fence at y=0 — parallel, no intersection
    const scene = makeScene([makeLine('e1', 0, 5, 10, 5)]);
    const hits = detectFenceHits({ fenceStart: { x: 0, y: 0 }, fenceEnd: { x: 10, y: 0 }, scene, ...DEFAULT_ARGS });
    expect(hits).toHaveLength(0);
  });

  it('misses a line that does not overlap the fence segment bbox', () => {
    // Vertical line far to the right of the fence segment
    const scene = makeScene([makeLine('e1', 50, -5, 50, 5)]);
    const hits = detectFenceHits({ fenceStart: { x: 0, y: 0 }, fenceEnd: { x: 10, y: 0 }, scene, ...DEFAULT_ARGS });
    expect(hits).toHaveLength(0);
  });

  it('skips entity on a locked layer', () => {
    const scene = makeScene(
      [makeLine('e1', 5, -5, 5, 5, 'locked')],
      { locked: { locked: true, visible: true, name: 'locked', color: '' } },
    );
    const hits = detectFenceHits({ fenceStart: { x: 0, y: 0 }, fenceEnd: { x: 10, y: 0 }, scene, ...DEFAULT_ARGS });
    expect(hits).toHaveLength(0);
  });

  it('skips entity on a hidden layer', () => {
    const scene = makeScene(
      [makeLine('e1', 5, -5, 5, 5, 'hidden')],
      { hidden: { visible: false, locked: false, name: 'hidden', color: '' } },
    );
    const hits = detectFenceHits({ fenceStart: { x: 0, y: 0 }, fenceEnd: { x: 10, y: 0 }, scene, ...DEFAULT_ARGS });
    expect(hits).toHaveLength(0);
  });

  it('skips non-trimmable entity types (hatch)', () => {
    const scene = { entities: [{ id: 'h1', type: 'hatch', layer: 'L0' }], layers: {} } as unknown as SceneModel;
    const hits = detectFenceHits({ fenceStart: { x: 0, y: 0 }, fenceEnd: { x: 10, y: 0 }, scene, ...DEFAULT_ARGS });
    expect(hits).toHaveLength(0);
  });

  it('returns multiple hits when fence crosses multiple lines', () => {
    const scene = makeScene([
      makeLine('e1', 2, -5, 2, 5),
      makeLine('e2', 7, -5, 7, 5),
    ]);
    const hits = detectFenceHits({ fenceStart: { x: 0, y: 0 }, fenceEnd: { x: 10, y: 0 }, scene, ...DEFAULT_ARGS });
    expect(hits).toHaveLength(2);
    const ids = hits.map((h) => h.entityId).sort();
    expect(ids).toEqual(['e1', 'e2']);
  });

  it('standard mode: only includes cuttingEdgeIds entities', () => {
    const scene = makeScene([
      makeLine('e1', 2, -5, 2, 5),
      makeLine('e2', 7, -5, 7, 5),
    ]);
    const hits = detectFenceHits({
      fenceStart: { x: 0, y: 0 }, fenceEnd: { x: 10, y: 0 },
      scene, mode: 'standard', cuttingEdgeIds: ['e1'],
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].entityId).toBe('e1');
  });

  it('standard mode with empty cuttingEdgeIds → no hits', () => {
    const scene = makeScene([makeLine('e1', 5, -5, 5, 5)]);
    const hits = detectFenceHits({
      fenceStart: { x: 0, y: 0 }, fenceEnd: { x: 10, y: 0 },
      scene, mode: 'standard', cuttingEdgeIds: [],
    });
    expect(hits).toHaveLength(0);
  });

  it('pick point is closest intersection to fenceStart', () => {
    // Circle centred at (5,0) radius 3 — fence horizontal at y=0, x=0→10.
    // Two intersections: (2,0) and (8,0). fenceStart=(0,0) → closest is (2,0).
    const circle = { id: 'c1', type: 'circle', center: { x: 5, y: 0 }, radius: 3, layer: 'L0' } as CircleEntity;
    const scene = { entities: [circle], layers: {} } as unknown as SceneModel;
    const hits = detectFenceHits({ fenceStart: { x: 0, y: 0 }, fenceEnd: { x: 10, y: 0 }, scene, ...DEFAULT_ARGS });
    expect(hits).toHaveLength(1);
    expect(hits[0].pickPoint.x).toBeCloseTo(2);
  });
});

// ── buildEntityPreviewPath ────────────────────────────────────────────────────

describe('buildEntityPreviewPath', () => {
  it('LINE → 2 points [start, end]', () => {
    const line: LineEntity = { id: 'l1', type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, layer: '' };
    const path = buildEntityPreviewPath(line);
    expect(path).toHaveLength(2);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[1]).toEqual({ x: 10, y: 0 });
  });

  it('ARC → n+1 points along arc sweep', () => {
    const arc: ArcEntity = { id: 'a1', type: 'arc', center: { x: 0, y: 0 }, radius: 5, startAngle: 0, endAngle: Math.PI, layer: '' };
    const path = buildEntityPreviewPath(arc);
    expect(path.length).toBeGreaterThan(2);
    expect(path[0].x).toBeCloseTo(5);   // cos(0)*5
    expect(path[0].y).toBeCloseTo(0);
  });

  it('CIRCLE → closed loop of points', () => {
    const circle: CircleEntity = { id: 'ci1', type: 'circle', center: { x: 0, y: 0 }, radius: 3, layer: '' };
    const path = buildEntityPreviewPath(circle);
    expect(path.length).toBeGreaterThan(4);
    // First and last point should be on the circle
    expect(Math.hypot(path[0].x, path[0].y)).toBeCloseTo(3);
  });

  it('ELLIPSE → tessellated points', () => {
    const ell: EllipseEntity = { id: 'ell1', type: 'ellipse', center: { x: 0, y: 0 }, majorAxis: 4, minorAxis: 2, layer: '' };
    const path = buildEntityPreviewPath(ell);
    expect(path.length).toBeGreaterThan(4);
  });

  it('LWPOLYLINE → vertex array', () => {
    const poly: LWPolylineEntity = {
      id: 'pl1', type: 'lwpolyline',
      vertices: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }],
      closed: false, layer: '',
    };
    const path = buildEntityPreviewPath(poly);
    expect(path).toHaveLength(3);
    expect(path[1]).toEqual({ x: 5, y: 0 });
  });
});
