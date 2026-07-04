/**
 * Tests for the FILLET curve solver (ADR-510 Φ4e.2) — tangent arc of radius R between
 * {line, arc, circle}, AutoCAD pick-nearest disambiguation, line/arc trim, circle-not-trimmed,
 * plus the rad→deg regression guard on the shared `solveTangentArc` / `computeFilletArc`.
 */

import { computeFilletCurve } from '../fillet-curve-geometry';
import { computeFilletArc, computeFilletPolylineCorner } from '../fillet-geometry';
import { resolveCornerAnchors, resolveSharedPolylineCorner } from '../corner-math';
import type { ArcEntity, CircleEntity, LineEntity, PolylineEntity } from '../../../types/entities';

function line(id: string, sx: number, sy: number, ex: number, ey: number): LineEntity {
  return { id, type: 'line', layerId: 'lyr_test', start: { x: sx, y: sy }, end: { x: ex, y: ey } };
}
function circle(id: string, cx: number, cy: number, r: number): CircleEntity {
  return { id, type: 'circle', layerId: 'lyr_test', center: { x: cx, y: cy }, radius: r };
}
function arc(id: string, cx: number, cy: number, r: number, s: number, e: number): ArcEntity {
  return { id, type: 'arc', layerId: 'lyr_test', center: { x: cx, y: cy }, radius: r, startAngle: s, endAngle: e };
}
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('computeFilletCurve — line ↔ circle', () => {
  // Line = x-axis; circle centre (50,25) r=10; the R=7.5 fillet sits at (50,7.5):
  //   tangent to the line at (50,0), externally tangent to the circle at (50,15).
  const ln = line('L', 0, 0, 100, 0);
  const ci = circle('C', 50, 25, 10);

  it('solves the tangent arc (centre equidistant R from both entities)', () => {
    const res = computeFilletCurve(ln, { x: 50, y: 0 }, ci, { x: 50, y: 15 }, 7.5, true, 'arc_new');
    expect(res).not.toBeNull();
    expect(res!.arc.radius).toBeCloseTo(7.5);
    expect(res!.arc.center.x).toBeCloseTo(50);
    expect(res!.arc.center.y).toBeCloseTo(7.5);
    // line tangency: perpendicular distance to y=0 equals R
    expect(Math.abs(res!.arc.center.y)).toBeCloseTo(7.5);
    // circle tangency: |centre−O| = r + R (external)
    expect(dist(res!.arc.center, ci.center)).toBeCloseTo(17.5);
  });

  it('emits angles in DEGREES (arc spans a real sweep, not a radian sliver)', () => {
    const res = computeFilletCurve(ln, { x: 50, y: 0 }, ci, { x: 50, y: 15 }, 7.5, true, 'arc_new')!;
    // A radian bug would leave |start−end| ≤ ~6; a real degree sweep here is far larger.
    const sweep = Math.abs(res.arc.startAngle - res.arc.endAngle);
    expect(Math.max(Math.abs(res.arc.startAngle), Math.abs(res.arc.endAngle), sweep)).toBeGreaterThan(30);
  });

  it('trims the line but NEVER the circle (AutoCAD)', () => {
    const res = computeFilletCurve(ln, { x: 50, y: 0 }, ci, { x: 50, y: 15 }, 7.5, true, 'arc_new')!;
    expect(res.trims).toHaveLength(1);
    expect(res.trims[0].entityId).toBe('L');
  });

  it('returns no trims when Trim is off', () => {
    const res = computeFilletCurve(ln, { x: 50, y: 0 }, ci, { x: 50, y: 15 }, 7.5, false, 'arc_new')!;
    expect(res.trims).toHaveLength(0);
  });
});

describe('computeFilletCurve — line ↔ arc', () => {
  const ln = line('L', 0, 0, 100, 0);
  // Bottom half of the same circle (covers the tangent point at 270°).
  const ar = arc('A', 50, 25, 10, 180, 360);

  it('trims BOTH the line and the arc', () => {
    const res = computeFilletCurve(ln, { x: 50, y: 0 }, ar, { x: 50, y: 15 }, 7.5, true, 'arc_new');
    expect(res).not.toBeNull();
    expect(res!.trims).toHaveLength(2);
    const ids = res!.trims.map((t) => t.entityId).sort();
    expect(ids).toEqual(['A', 'L']);
    const arcTrim = res!.trims.find((t) => t.entityId === 'A')!;
    expect(arcTrim.newGeom.type).toBe('arc');
  });
});

describe('computeFilletCurve — circle ↔ circle / arc ↔ arc', () => {
  // Two r=30 circles 100 apart; the R=20 fillet centre is (50,0), tangent at (30,0)/(70,0).
  it('circle–circle: solves the tangent arc and trims NEITHER circle', () => {
    const res = computeFilletCurve(circle('C1', 0, 0, 30), { x: 30, y: 0 }, circle('C2', 100, 0, 30), { x: 70, y: 0 }, 20, true, 'a');
    expect(res).not.toBeNull();
    expect(res!.arc.radius).toBeCloseTo(20);
    expect(res!.arc.center.x).toBeCloseTo(50);
    expect(res!.arc.center.y).toBeCloseTo(0);
    expect(res!.trims).toHaveLength(0); // full circles are never trimmed
  });

  it('arc–arc: same geometry as arcs → trims BOTH arcs', () => {
    const a1 = arc('A1', 0, 0, 30, -90, 90); // right half (covers tangent at 0°)
    const a2 = arc('A2', 100, 0, 30, 90, 270); // left half (covers tangent at 180°)
    const res = computeFilletCurve(a1, { x: 30, y: 0 }, a2, { x: 70, y: 0 }, 20, true, 'a');
    expect(res).not.toBeNull();
    expect(res!.arc.radius).toBeCloseTo(20);
    expect(res!.trims.map((t) => t.entityId).sort()).toEqual(['A1', 'A2']);
    expect(res!.trims.every((t) => t.newGeom.type === 'arc')).toBe(true);
  });
});

describe('computeFilletCurve — guards', () => {
  it('returns null for R ≤ 0', () => {
    const res = computeFilletCurve(line('L', 0, 0, 100, 0), { x: 50, y: 0 }, circle('C', 50, 25, 10), { x: 50, y: 15 }, 0, true, 'a');
    expect(res).toBeNull();
  });

  it('returns null when no tangent circle of radius R exists (entities too far)', () => {
    const ln = line('L', 0, 0, 100, 0);
    const ci = circle('C', 50, 500, 10); // far above the line
    const res = computeFilletCurve(ln, { x: 50, y: 0 }, ci, { x: 50, y: 490 }, 1, true, 'a');
    expect(res).toBeNull();
  });
});

function polyline(id: string, verts: Array<[number, number]>, closed: boolean): PolylineEntity {
  return { id, type: 'polyline', layerId: 'lyr_test', vertices: verts.map(([x, y]) => ({ x, y })), closed };
}

describe('resolveSharedPolylineCorner — same-polyline two-segment pick (Φ4e.2)', () => {
  const square = polyline('P', [[0, 0], [100, 0], [100, 100], [0, 100]], true); // segs 0..3

  it('adjacent segments → the shared vertex index', () => {
    expect(resolveSharedPolylineCorner(square, { x: 50, y: 0 }, { x: 100, y: 50 })).toBe(1);
  });

  it('closing↔first segments → wrap vertex 0', () => {
    expect(resolveSharedPolylineCorner(square, { x: 50, y: 0 }, { x: 0, y: 50 })).toBe(0);
  });

  it('non-adjacent segments → null', () => {
    expect(resolveSharedPolylineCorner(square, { x: 50, y: 0 }, { x: 50, y: 100 })).toBeNull();
  });

  it('same segment → null', () => {
    expect(resolveSharedPolylineCorner(square, { x: 30, y: 0 }, { x: 70, y: 0 })).toBeNull();
  });
});

describe('computeFilletPolylineCorner — round ONE corner', () => {
  it('rounds only the picked corner (vertex replaced by tangentIn + arc + tangentOut)', () => {
    const l = polyline('L', [[0, 0], [100, 0], [100, 100]], false); // open, corner at vertex 1
    const res = computeFilletPolylineCorner(l, 1, 20);
    expect(res).not.toBeNull();
    expect(res!.filleted).toBe(1);
    // 3 vertices, one corner rounded → the corner vertex becomes two tangent vertices.
    expect(res!.entity.vertices).toHaveLength(4);
    expect(res!.entity.bulges).toHaveLength(4);
  });

  it('returns null for a non-corner index (open-polyline endpoint)', () => {
    const l = polyline('L', [[0, 0], [100, 0], [100, 100]], false);
    expect(computeFilletPolylineCorner(l, 0, 20)).toBeNull(); // vertex 0 is an endpoint, not a corner
  });
});

describe('computeFilletArc — rad→deg regression (line–line)', () => {
  it('produces DEGREES angles for a 90° corner (not radians)', () => {
    const anchors = resolveCornerAnchors(
      line('l1', 0, 0, 100, 0), { x: 50, y: 0 },
      line('l2', 0, 0, 0, 100), { x: 0, y: 50 },
    )!;
    const fa = computeFilletArc(anchors, 20)!;
    // The 90° fillet spans exactly 90° — a radian build would give |sweep| ≈ 1.57.
    const endpoints = [Math.abs(fa.startAngle), Math.abs(fa.endAngle)];
    expect(Math.max(...endpoints)).toBeGreaterThan(30); // degree-scale, not radian-scale
  });
});
