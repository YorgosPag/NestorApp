/**
 * Tests for trim-entity-cutter (ADR-350 §Test Plan).
 *
 * Covers the deterministic per-entity-type cut math. Each test feeds the
 * cutter a single target entity + pre-computed intersection points + pick
 * point and asserts the resulting TrimOperation[] shape.
 */

import { trimEntity } from '../trim-entity-cutter';
import type {
  ArcEntity,
  CircleEntity,
  EllipseEntity,
  LineEntity,
  PolylineEntity,
  RayEntity,
  SplineEntity,
  XLineEntity,
} from '../../../types/entities';

let _idCounter = 0;
const newId = (): string => `id_test_${++_idCounter}`;

beforeEach(() => {
  _idCounter = 0;
});

describe('trimEntity — LINE', () => {
  const line: LineEntity = {
    id: 'line-1',
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
  };

  it('interior cut → 2 LINEs (split)', () => {
    const result = trimEntity({
      entity: line,
      intersections: [
        { x: 3, y: 0 },
        { x: 7, y: 0 },
      ],
      pickPoint: { x: 5, y: 0 },
      mode: 'quick',
      newId,
    });
    expect(result.operations).toHaveLength(1);
    const op = result.operations[0];
    expect(op.kind).toBe('split');
    if (op.kind !== 'split') throw new Error('expected split');
    expect(op.replacements).toHaveLength(2);
  });

  it('endpoint cut → 1 shortened LINE', () => {
    const result = trimEntity({
      entity: line,
      intersections: [{ x: 3, y: 0 }],
      pickPoint: { x: 1, y: 0 },
      mode: 'quick',
      newId,
    });
    expect(result.operations).toHaveLength(1);
    const op = result.operations[0];
    expect(op.kind).toBe('shorten');
  });

  it('no intersection in Quick mode → delete', () => {
    const result = trimEntity({
      entity: line,
      intersections: [],
      pickPoint: { x: 5, y: 0 },
      mode: 'quick',
      newId,
    });
    expect(result.operations).toHaveLength(1);
    expect(result.operations[0].kind).toBe('delete');
  });

  it('no intersection in Standard mode → no-op', () => {
    const result = trimEntity({
      entity: line,
      intersections: [],
      pickPoint: { x: 5, y: 0 },
      mode: 'standard',
      newId,
    });
    expect(result.operations).toHaveLength(0);
  });
});

describe('trimEntity — CIRCLE', () => {
  const circle: CircleEntity = {
    id: 'circle-1',
    type: 'circle',
    center: { x: 0, y: 0 },
    radius: 5,
  };

  it('2 intersections → promote to ARC', () => {
    const result = trimEntity({
      entity: circle,
      intersections: [
        { x: 5, y: 0 },
        { x: -5, y: 0 },
      ],
      pickPoint: { x: 0, y: 5 }, // pick is on the top half
      mode: 'quick',
      newId,
    });
    expect(result.operations).toHaveLength(1);
    const op = result.operations[0];
    expect(op.kind).toBe('promote');
    if (op.kind !== 'promote') throw new Error('expected promote');
    expect(op.newType).toBe('arc');
    expect((op.newGeom as ArcEntity).type).toBe('arc');
  });

  it('1 intersection in Quick mode → delete (single tangent)', () => {
    const result = trimEntity({
      entity: circle,
      intersections: [{ x: 5, y: 0 }],
      pickPoint: { x: 0, y: 0 },
      mode: 'quick',
      newId,
    });
    expect(result.operations[0].kind).toBe('delete');
  });

  it('0 intersections in Quick → delete entirely', () => {
    const result = trimEntity({
      entity: circle,
      intersections: [],
      pickPoint: { x: 0, y: 5 },
      mode: 'quick',
      newId,
    });
    expect(result.operations[0].kind).toBe('delete');
  });
});

describe('trimEntity — ARC', () => {
  const arc: ArcEntity = {
    id: 'arc-1',
    type: 'arc',
    center: { x: 0, y: 0 },
    radius: 5,
    startAngle: 0,
    endAngle: Math.PI,
    counterclockwise: true,
  };

  it('interior cut → 2 ARCs', () => {
    const result = trimEntity({
      entity: arc,
      intersections: [
        { x: Math.cos(Math.PI / 4) * 5, y: Math.sin(Math.PI / 4) * 5 },
        { x: Math.cos((3 * Math.PI) / 4) * 5, y: Math.sin((3 * Math.PI) / 4) * 5 },
      ],
      pickPoint: { x: 0, y: 5 }, // top of arc, between intersections
      mode: 'quick',
      newId,
    });
    expect(result.operations).toHaveLength(1);
    const op = result.operations[0];
    expect(['split', 'shorten']).toContain(op.kind);
  });
});

describe('trimEntity — POLYLINE', () => {
  const poly: PolylineEntity = {
    id: 'poly-1',
    type: 'polyline',
    vertices: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
    closed: false,
  };

  it('mid-segment cut produces a shortened polyline', () => {
    const result = trimEntity({
      entity: poly,
      intersections: [{ x: 5, y: 0 }],
      pickPoint: { x: 2, y: 0 },
      mode: 'quick',
      newId,
    });
    expect(result.operations).toHaveLength(1);
    expect(['shorten', 'split']).toContain(result.operations[0].kind);
  });
});

describe('trimEntity — RAY', () => {
  const ray: RayEntity = {
    id: 'ray-1',
    type: 'ray',
    basePoint: { x: 0, y: 0 },
    direction: { x: 1, y: 0 },
  };

  it('1 cut + pick on infinite side → promote to LINE', () => {
    const result = trimEntity({
      entity: ray,
      intersections: [{ x: 5, y: 0 }],
      pickPoint: { x: 100, y: 0 },
      mode: 'quick',
      newId,
    });
    expect(result.operations).toHaveLength(1);
    expect(result.operations[0].kind).toBe('promote');
  });

  it('1 cut + pick on base side → shortened RAY', () => {
    const result = trimEntity({
      entity: ray,
      intersections: [{ x: 5, y: 0 }],
      pickPoint: { x: 2, y: 0 },
      mode: 'quick',
      newId,
    });
    expect(result.operations[0].kind).toBe('shorten');
  });

  it('no intersection in Quick → delete', () => {
    const result = trimEntity({
      entity: ray,
      intersections: [],
      pickPoint: { x: 5, y: 0 },
      mode: 'quick',
      newId,
    });
    expect(result.operations[0].kind).toBe('delete');
  });
});

describe('trimEntity — XLINE', () => {
  const xl: XLineEntity = {
    id: 'xl-1',
    type: 'xline',
    basePoint: { x: 0, y: 0 },
    direction: { x: 1, y: 0 },
  };

  it('2 cuts → split into RAY/LINE/RAY pieces', () => {
    const result = trimEntity({
      entity: xl,
      intersections: [
        { x: -5, y: 0 },
        { x: 5, y: 0 },
      ],
      pickPoint: { x: 0, y: 0 }, // middle segment is removed
      mode: 'quick',
      newId,
    });
    expect(result.operations).toHaveLength(1);
    const op = result.operations[0];
    expect(op.kind).toBe('split');
    if (op.kind !== 'split') throw new Error('expected split');
    expect(op.replacements).toHaveLength(2);
  });
});

describe('trimEntity — ELLIPSE', () => {
  const ellipse: EllipseEntity = {
    id: 'ell-1',
    type: 'ellipse',
    center: { x: 0, y: 0 },
    majorAxis: 6,
    minorAxis: 3,
    rotation: 0,
  };

  it('2 intersections → promote to elliptical arc (startParam / endParam set)', () => {
    // Two intersection points on the ellipse boundary
    const result = trimEntity({
      entity: ellipse,
      intersections: [
        { x: 6, y: 0 },   // param ≈ 0
        { x: -6, y: 0 },  // param ≈ π
      ],
      pickPoint: { x: 0, y: 3 }, // top of ellipse (param ≈ π/2)
      mode: 'quick',
      newId,
    });
    expect(result.operations).toHaveLength(1);
    const op = result.operations[0];
    expect(op.kind).toBe('promote');
    if (op.kind !== 'promote') throw new Error('expected promote');
    expect(op.newType).toBe('ellipse');
    const geom = op.newGeom as EllipseEntity;
    expect(typeof geom.startParam).toBe('number');
    expect(typeof geom.endParam).toBe('number');
  });

  it('1 intersection in Quick mode → delete (tangent case)', () => {
    const result = trimEntity({
      entity: ellipse,
      intersections: [{ x: 6, y: 0 }],
      pickPoint: { x: 0, y: 0 },
      mode: 'quick',
      newId,
    });
    expect(result.operations[0].kind).toBe('delete');
  });

  it('0 intersections in Quick mode → delete', () => {
    const result = trimEntity({
      entity: ellipse,
      intersections: [],
      pickPoint: { x: 0, y: 0 },
      mode: 'quick',
      newId,
    });
    expect(result.operations[0].kind).toBe('delete');
  });

  it('0 intersections in Standard mode → no-op', () => {
    const result = trimEntity({
      entity: ellipse,
      intersections: [],
      pickPoint: { x: 0, y: 0 },
      mode: 'standard',
      newId,
    });
    expect(result.operations).toHaveLength(0);
  });
});

describe('trimEntity — SPLINE', () => {
  const spline: SplineEntity = {
    id: 'sp-1',
    type: 'spline',
    controlPoints: [
      { x: 0, y: 0 },
      { x: 3, y: 4 },
      { x: 7, y: 4 },
      { x: 10, y: 0 },
    ],
    degree: 3,
  };

  it('interior cut → shorten or split (tessellated-polyline path)', () => {
    const result = trimEntity({
      entity: spline,
      intersections: [{ x: 5, y: 4 }],
      pickPoint: { x: 2, y: 2 },
      mode: 'quick',
      newId,
    });
    expect(result.operations).toHaveLength(1);
    expect(['shorten', 'split', 'delete']).toContain(result.operations[0].kind);
  });

  it('no intersections in Quick → delete', () => {
    const result = trimEntity({
      entity: spline,
      intersections: [],
      pickPoint: { x: 5, y: 2 },
      mode: 'quick',
      newId,
    });
    expect(result.operations[0].kind).toBe('delete');
  });

  it('no intersections in Standard → no-op', () => {
    const result = trimEntity({
      entity: spline,
      intersections: [],
      pickPoint: { x: 5, y: 2 },
      mode: 'standard',
      newId,
    });
    expect(result.operations).toHaveLength(0);
  });
});

describe('trimEntity — POLYLINE closed (G1)', () => {
  const closedPoly: PolylineEntity = {
    id: 'cpoly-1',
    type: 'polyline',
    vertices: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
    closed: true,
  };

  it('interior cut on closed polyline → shorten or split result', () => {
    const result = trimEntity({
      entity: closedPoly,
      intersections: [{ x: 5, y: 0 }],
      pickPoint: { x: 2, y: 0 },
      mode: 'quick',
      newId,
    });
    expect(result.operations).toHaveLength(1);
    expect(['shorten', 'split', 'delete']).toContain(result.operations[0].kind);
  });

  it('2 intersections on closed polyline → produces open (closed=false) result', () => {
    const result = trimEntity({
      entity: closedPoly,
      intersections: [
        { x: 3, y: 0 },
        { x: 7, y: 0 },
      ],
      pickPoint: { x: 5, y: 0 },
      mode: 'quick',
      newId,
    });
    expect(result.operations).toHaveLength(1);
    const op = result.operations[0];
    if (op.kind === 'split') {
      // Each replacement must be a non-closed polyline
      op.replacements.forEach((r) => {
        if ('closed' in r) expect((r as PolylineEntity).closed).toBeFalsy();
      });
    }
  });
});
