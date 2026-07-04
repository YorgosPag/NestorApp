/**
 * ADR-510 Φ5 — explodeEntity (pure geometry SSoT) tests.
 *   - polyline (open/closed) → lines· bulged segment → arc (degrees)
 *   - rectangle → 4 lines (rotation-aware)· style inheritance· primitive → null
 */

import { explodeEntity, isExplodable } from '../explode-entity';
import type { Entity, LineEntity, ArcEntity } from '../../../types/entities';

const mkPoly = (vertices: { x: number; y: number }[], extra: Record<string, unknown> = {}): Entity =>
  ({ id: 'p1', type: 'polyline', layerId: 'lyr_a', color: '#ff0000', vertices, ...extra } as unknown as Entity);

const mkRect = (extra: Record<string, unknown> = {}): Entity =>
  ({ id: 'r1', type: 'rectangle', layerId: 'lyr_a', color: '#00ff00', x: 0, y: 0, width: 10, height: 4, ...extra } as unknown as Entity);

// A REAL drawn rectangle persists ONLY corner1/corner2 (no x/y/width/height) —
// this is the shape that broke Bug 1 while the x/y/w/h fixture above passed.
const mkRectCorners = (extra: Record<string, unknown> = {}): Entity =>
  ({ id: 'r2', type: 'rectangle', layerId: 'lyr_a', color: '#00ff00',
     corner1: { x: 0, y: 0 }, corner2: { x: 10, y: 4 }, ...extra } as unknown as Entity);

const allFinite = (lines: LineEntity[]): boolean =>
  lines.every((l) => [l.start.x, l.start.y, l.end.x, l.end.y].every(Number.isFinite));

describe('ADR-510 Φ5 — isExplodable', () => {
  it('flags compound types, rejects primitives', () => {
    expect(isExplodable(mkPoly([{ x: 0, y: 0 }, { x: 1, y: 0 }]))).toBe(true);
    expect(isExplodable(mkRect())).toBe(true);
    expect(isExplodable({ id: 'l', type: 'line', layerId: 'lyr_a' } as unknown as Entity)).toBe(false);
    expect(isExplodable({ id: 'c', type: 'circle', layerId: 'lyr_a' } as unknown as Entity)).toBe(false);
  });
});

describe('ADR-510 Φ5 — explodeEntity: polyline', () => {
  it('open polyline (3 verts) → 2 lines with correct endpoints', () => {
    const out = explodeEntity(mkPoly([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }])) as LineEntity[];
    expect(out).toHaveLength(2);
    expect(out.every((e) => e.type === 'line')).toBe(true);
    expect(out[0].start).toEqual({ x: 0, y: 0 });
    expect(out[0].end).toEqual({ x: 10, y: 0 });
    expect(out[1].end).toEqual({ x: 10, y: 5 });
  });

  it('closed polyline (3 verts) → 3 lines (last closes the loop)', () => {
    const out = explodeEntity(mkPoly(
      [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 8 }], { closed: true },
    )) as LineEntity[];
    expect(out).toHaveLength(3);
    expect(out[2].start).toEqual({ x: 5, y: 8 });
    expect(out[2].end).toEqual({ x: 0, y: 0 });
  });

  it('inherits style + assigns fresh unique ids', () => {
    const out = explodeEntity(mkPoly([{ x: 0, y: 0 }, { x: 10, y: 0 }])) as LineEntity[];
    expect(out[0].color).toBe('#ff0000');
    expect(out[0].layerId).toBe('lyr_a');
    expect(out[0].id).not.toBe('p1');
  });

  it('bulged segment → arc (radians→degrees), straight segment stays a line', () => {
    // bulge=1 on segment 0 → semicircle: center (5,0), r=5, 180°→0°, CCW.
    const out = explodeEntity(mkPoly(
      [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }], { bulges: [1, 0] },
    )) as Entity[];
    expect(out).toHaveLength(2);
    const arc = out[0] as ArcEntity;
    expect(arc.type).toBe('arc');
    expect(arc.center.x).toBeCloseTo(5, 6);
    expect(arc.center.y).toBeCloseTo(0, 6);
    expect(arc.radius).toBeCloseTo(5, 6);
    expect(arc.startAngle).toBeCloseTo(180, 4);
    expect(arc.endAngle).toBeCloseTo(0, 4);
    expect(arc.counterclockwise).toBe(true);
    expect(out[1].type).toBe('line');
  });

  it('degenerate polyline (< 2 verts) → null', () => {
    expect(explodeEntity(mkPoly([{ x: 0, y: 0 }]))).toBeNull();
  });
});

describe('ADR-510 Φ5 — explodeEntity: rectangle', () => {
  it('unrotated rectangle → 4 boundary lines with the right corners', () => {
    const out = explodeEntity(mkRect()) as LineEntity[];
    expect(out).toHaveLength(4);
    expect(out.every((e) => e.type === 'line')).toBe(true);
    expect(out[0].start).toEqual({ x: 0, y: 0 });
    expect(out[0].end).toEqual({ x: 10, y: 0 });
    expect(out[2].end).toEqual({ x: 0, y: 4 });
    expect(out[3].end).toEqual({ x: 0, y: 0 }); // closes back to origin
  });

  it('rotated rectangle → 4 lines whose corners are no longer axis-aligned', () => {
    const out = explodeEntity(mkRect({ rotation: 90 })) as LineEntity[];
    expect(out).toHaveLength(4);
    // rotation applied → first corner moved off (0,0)
    expect(out[0].start).not.toEqual({ x: 0, y: 0 });
  });

  // 🔴 Bug 1 (ADR-510 Φ5): a drawn rectangle has corner1/corner2, NOT x/y/w/h.
  it('corner-based rectangle (corner1/corner2, no x/y/w/h) → 4 FINITE lines', () => {
    const out = explodeEntity(mkRectCorners()) as LineEntity[];
    expect(out).toHaveLength(4);
    expect(out.every((e) => e.type === 'line')).toBe(true);
    expect(allFinite(out)).toBe(true); // ← would be false (NaN) before the fix
    expect(out[0].start).toEqual({ x: 0, y: 0 });
    expect(out[0].end).toEqual({ x: 10, y: 0 });
    expect(out[2].end).toEqual({ x: 0, y: 4 });
    expect(out[3].end).toEqual({ x: 0, y: 0 }); // closes back to origin
  });

  it('corner-based rectangle inherits style + fresh ids', () => {
    const out = explodeEntity(mkRectCorners()) as LineEntity[];
    expect(out[0].color).toBe('#00ff00');
    expect(out[0].layerId).toBe('lyr_a');
    expect(out[0].id).not.toBe('r2');
  });
});

describe('ADR-510 Φ5 — explodeEntity: finite-geometry guard (Bug 1 belt-and-suspenders)', () => {
  it('a degenerate source producing only NaN geometry → null (never injected)', () => {
    // No corner1/corner2 AND no x/y/w/h → every corner resolves to NaN.
    const broken = { id: 'rx', type: 'rectangle', layerId: 'lyr_a' } as unknown as Entity;
    expect(explodeEntity(broken)).toBeNull();
  });
});

describe('ADR-510 Φ5 — explodeEntity: primitives', () => {
  it('a line / circle / arc → null (nothing to explode)', () => {
    expect(explodeEntity({ id: 'l', type: 'line', layerId: 'lyr_a' } as unknown as Entity)).toBeNull();
    expect(explodeEntity({ id: 'c', type: 'circle', layerId: 'lyr_a' } as unknown as Entity)).toBeNull();
    expect(explodeEntity({ id: 'a', type: 'arc', layerId: 'lyr_a' } as unknown as Entity)).toBeNull();
  });
});
