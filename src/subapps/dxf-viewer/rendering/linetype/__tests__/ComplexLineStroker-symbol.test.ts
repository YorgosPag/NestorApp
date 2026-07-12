/**
 * Tests — ADR-642 Φ3 (#3): the stroker routes symbol elements through the walk.
 *
 * A `[gap, symbol]` cycle has no dash, so any stroke ops on the canvas come ONLY from
 * the stamped glyph — proving the stroker reaches `drawSymbolElement` (not skipped like
 * Φ1/Φ2). The `cross` glyph = two spokes, so we expect an even, non-zero moveTo count.
 */

import { describe, it, expect } from '@jest/globals';
import { strokeStyledPolyline } from '../ComplexLineStroker';
import type { ComplexLinetypeDef } from '../../../config/complex-linetype-types';
import type { Point } from '../complex-stroke-geometry';

interface Call { fn: string; args: readonly unknown[] }

function createMockCtx() {
  const calls: Call[] = [];
  const rec = (fn: string) => (...args: unknown[]): void => { calls.push({ fn, args }); };
  const ctx = {
    beginPath: rec('beginPath'), closePath: rec('closePath'),
    moveTo: rec('moveTo'), lineTo: rec('lineTo'), arc: rec('arc'),
    stroke: rec('stroke'), fill: rec('fill'),
    save: rec('save'), restore: rec('restore'),
    translate: rec('translate'), rotate: rec('rotate'), transform: rec('transform'),
    setLineDash: rec('setLineDash'), fillText: rec('fillText'),
    set font(_v: string) {}, set fillStyle(_v: unknown) {},
    set textAlign(_v: string) {}, set textBaseline(_v: string) {},
    set lineJoin(_v: string) {}, set miterLimit(_v: number) {},
    get lineWidth(): number { return 1; }, set lineWidth(_v: number) {},
    get strokeStyle(): string { return '#111'; }, set strokeStyle(_v: string) {},
  };
  return { calls, ctx: ctx as unknown as CanvasRenderingContext2D };
}

/** A gap-then-`×` cycle: no dash, so strokes come only from the stamped fence symbol. */
const fenceDef: ComplexLinetypeDef = {
  name: 'Fence-X',
  description: '──×──',
  layers: [{ elements: [
    { kind: 'gap', lengthMm: 10 },
    { kind: 'symbol', glyphId: 'cross', role: 'side', scale: 1, rotationDeg: 0, offsetXMm: 0, offsetYMm: 0 },
  ] }],
  scaleSpace: 'model',
  origin: 'user-created',
};

const line: readonly Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];

describe('strokeStyledPolyline — symbol routing', () => {
  it('stamps the fence glyph along the line (even, non-zero spoke count)', () => {
    const { ctx, calls } = createMockCtx();
    strokeStyledPolyline(ctx, line, fenceDef, { worldToScreenScale: 4, ltscale: 1 });
    const moveTos = calls.filter((c) => c.fn === 'moveTo').length;
    expect(moveTos).toBeGreaterThan(0);
    expect(moveTos % 2).toBe(0); // cross = 2 spokes per stamp
    // no native dash fast-path (the type is not simple-expressible with a symbol)
    expect(calls.some((c) => c.fn === 'setLineDash')).toBe(false);
  });

  it('draws nothing extra for a degenerate (too-short) line but never throws', () => {
    const { ctx } = createMockCtx();
    expect(() =>
      strokeStyledPolyline(ctx, [{ x: 0, y: 0 }], fenceDef, { worldToScreenScale: 4, ltscale: 1 }),
    ).not.toThrow();
  });
});

// ── ADR-642 Φ4: corner/start/end role placement + alignDash corner policy ──────────

/** A `[gap, ×-symbol]` cycle with the symbol at a given role — the gap alone draws nothing. */
const roleDef = (role: 'innerCorner' | 'outerCorner' | 'start' | 'end'): ComplexLinetypeDef => ({
  name: `Corner-${role}`,
  description: '',
  layers: [{ elements: [
    { kind: 'gap', lengthMm: 10 },
    { kind: 'symbol', glyphId: 'cross', role, scale: 1, rotationDeg: 0, offsetXMm: 0, offsetYMm: 0 },
  ] }],
  scaleSpace: 'model',
  origin: 'user-created',
});

/** ⌐ shape: one interior vertex at (10,0), a right/CW (screen) turn → INNER corner. */
const elbow: readonly Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];

describe('strokeStyledPolyline — corner/start/end role placement', () => {
  const moveTos = (def: ComplexLinetypeDef, pts: readonly Point[]) => {
    const { ctx, calls } = createMockCtx();
    strokeStyledPolyline(ctx, pts, def, { worldToScreenScale: 4, ltscale: 1 });
    return calls.filter((c) => c.fn === 'moveTo').length;
  };

  it('stamps an innerCorner glyph at the concave elbow (one × = 2 spokes)', () => {
    expect(moveTos(roleDef('innerCorner'), elbow)).toBe(2);
  });

  it('does NOT stamp an outerCorner glyph at an inner elbow', () => {
    expect(moveTos(roleDef('outerCorner'), elbow)).toBe(0);
  });

  it('stamps a start glyph only at the first vertex', () => {
    expect(moveTos(roleDef('start'), elbow)).toBe(2);
  });

  it('stamps an end glyph only at the last vertex', () => {
    expect(moveTos(roleDef('end'), elbow)).toBe(2);
  });

  it('corner roles ride the vertices, NOT the arc-length cycle (immune to line length)', () => {
    // A long straight line has NO interior vertex → an innerCorner symbol never stamps.
    expect(moveTos(roleDef('innerCorner'), [{ x: 0, y: 0 }, { x: 1000, y: 0 }])).toBe(0);
  });
});

describe('strokeStyledPolyline — alignDash corner policy', () => {
  const patternDef = (cornerPolicy: 'alignDash' | 'break'): ComplexLinetypeDef => ({
    name: 'Align',
    description: '',
    layers: [{ elements: [{ kind: 'gap', lengthMm: 5 }, { kind: 'dash', lengthMm: 5 }] }],
    cornerPolicy,
    scaleSpace: 'model',
    origin: 'user-created',
  });
  const seg: readonly Point[] = [{ x: 0, y: 0 }, { x: 20, y: 0 }];
  const firstMoveToX = (def: ComplexLinetypeDef): number => {
    const { ctx, calls } = createMockCtx();
    strokeStyledPolyline(ctx, seg, def, { worldToScreenScale: 1, ltscale: 1 });
    const m = calls.find((c) => c.fn === 'moveTo');
    return m ? (m.args[0] as number) : NaN;
  };

  it('alignDash shifts the phase so a DASH begins at the corner (dist 0)', () => {
    expect(firstMoveToX(patternDef('alignDash'))).toBeCloseTo(0, 6);
  });

  it('break keeps the leading gap → the first dash starts after it (dist 5)', () => {
    expect(firstMoveToX(patternDef('break'))).toBeCloseTo(5, 6);
  });
});

describe('strokeStyledPolyline — compound layers (#9)', () => {
  const compoundDef: ComplexLinetypeDef = {
    name: 'Rail',
    description: '',
    layers: [
      { elements: [{ kind: 'dash', lengthMm: 10 }], offsetMm: 5 },
      { elements: [{ kind: 'dash', lengthMm: 10 }], offsetMm: -5 },
    ],
    scaleSpace: 'model',
    origin: 'user-created',
  };

  it('strokes each layer at its perpendicular offset (two parallel rails)', () => {
    const { ctx, calls } = createMockCtx();
    strokeStyledPolyline(ctx, [{ x: 0, y: 0 }, { x: 100, y: 0 }], compoundDef, {
      worldToScreenScale: 1,
      ltscale: 1,
    });
    const ys = calls.filter((c) => c.fn === 'moveTo').map((c) => c.args[1] as number);
    expect(ys).toContain(5); // top rail
    expect(ys).toContain(-5); // bottom rail
  });
});
