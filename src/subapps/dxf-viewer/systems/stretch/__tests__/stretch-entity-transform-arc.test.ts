/**
 * ADR-349 / ADR-537 — stretch-entity-transform arc reshape (commit side).
 *
 * Regression for the deg/rad bug: `ArcEntity` stores start/end angles in DEGREES, so the
 * commit math (`stretchArc*` → SSoT `arcFromMovedEndpoint` / `arcFrom3Points`) must treat
 * them as degrees — same as the 3D live ghost (preview ≡ commit).
 */

import { applyVertexDisplacement, translateEntityByAnchor } from '../stretch-entity-transform';
import type { Entity } from '../../../types/entities';
import type { VertexRef } from '../stretch-vertex-classifier';

// Quarter arc: centre (0,0), r=50, 0°→90°. start=(50,0), end=(0,50).
const arc = (): Entity =>
  ({ id: 'a', type: 'arc', center: { x: 0, y: 0 }, radius: 50, startAngle: 0, endAngle: 90 }) as unknown as Entity;

const ref = (kind: VertexRef['kind']): VertexRef => ({ entityId: 'a', kind });

describe('stretch arc — single endpoint (degrees)', () => {
  it('moving arc-start keeps the end fixed and preserves the 90° sweep', () => {
    const res = applyVertexDisplacement(arc(), [ref('arc-start')], { x: 10, y: 0 });
    expect(res.kind).toBe('update');
    if (res.kind !== 'update') return;
    const u = res.updates as { center: { x: number; y: number }; radius: number; startAngle: number; endAngle: number };
    const s = (u.startAngle * Math.PI) / 180;
    const e = (u.endAngle * Math.PI) / 180;
    // Recomputed arc passes through the moved start (60,0) and untouched end (0,50).
    expect(u.center.x + u.radius * Math.cos(s)).toBeCloseTo(60);
    expect(u.center.y + u.radius * Math.sin(s)).toBeCloseTo(0);
    expect(u.center.x + u.radius * Math.cos(e)).toBeCloseTo(0);
    expect(u.center.y + u.radius * Math.sin(e)).toBeCloseTo(50);
    expect(Math.abs(u.endAngle - u.startAngle)).toBeCloseTo(90);
  });
});

describe('stretch arc — both endpoints captured → rigid translate', () => {
  it('translates the centre by the delta', () => {
    const res = applyVertexDisplacement(arc(), [ref('arc-start'), ref('arc-end')], { x: 7, y: -3 });
    expect(res.kind).toBe('update');
    if (res.kind !== 'update') return;
    const u = res.updates as { center: { x: number; y: number } };
    expect(u.center.x).toBeCloseTo(7);
    expect(u.center.y).toBeCloseTo(-3);
  });
});

describe('stretch arc — anchor translate (centre grip)', () => {
  it('translates the centre, leaving radius/angles untouched', () => {
    const u = translateEntityByAnchor(arc(), { x: 5, y: 5 }) as { center: { x: number; y: number } };
    expect(u.center.x).toBeCloseTo(5);
    expect(u.center.y).toBeCloseTo(5);
  });
});
