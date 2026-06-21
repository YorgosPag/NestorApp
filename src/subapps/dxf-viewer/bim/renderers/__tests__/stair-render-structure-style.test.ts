/**
 * ADR-358 Phase 7c — unit tests for `stair-render-structure-style`.
 *
 * The module is pure (no class state, no Firebase) so it can be exercised
 * with a stub `CanvasRenderingContext2D` that records every call. Each
 * `structureType` produces a distinct render trace; this suite locks in
 * the §6.2 symbology mapping table so a regression would fail loudly.
 */

import type { Point2D, Point3D } from '../../../rendering/types/Types';
import type {
  StairGeometry,
  StairStructureType,
} from '../../types/stair-types';
import {
  renderStringersForStructure,
  renderTreadsForStructure,
  type StairStyleContext,
} from '../stair-render-structure-style';
// FULL SSoT (bim-body-fill) — οι treads περνούν πλέον από το ΚΟΙΝΟ adaptive layer
// (ADR-509) όπως όλα τα BIM body fills· το expected υπολογίζεται από τον ΙΔΙΟ helper
// (bg-agnostic) ώστε το test να κλειδώνει «περνά από το SSoT», όχι ένα boosted literal.
import { adaptFillTintForCanvas } from '../../../config/adaptive-entity-color';

// ─── Canvas mock ─────────────────────────────────────────────────────────────

interface MockCtxCall { fn: string; args: readonly unknown[] }

function createMockCtx() {
  const calls: MockCtxCall[] = [];
  const record = (fn: string) => (...args: unknown[]): unknown => {
    calls.push({ fn, args });
    return undefined;
  };
  const ctxStub = {
    save: record('save'),
    restore: record('restore'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    closePath: record('closePath'),
    clip: record('clip'),
    stroke: record('stroke'),
    fill: record('fill'),
    setLineDash: record('setLineDash'),
    set fillStyle(v: string) { calls.push({ fn: 'set:fillStyle', args: [v] }); },
    set lineWidth(v: number) { calls.push({ fn: 'set:lineWidth', args: [v] }); },
  };
  return { calls, ctx: ctxStub as unknown as CanvasRenderingContext2D };
}

function makeScx(baseLineWidth = 1.5): { scx: StairStyleContext; calls: MockCtxCall[] } {
  const { ctx, calls } = createMockCtx();
  const worldToScreen = (p: { x: number; y: number }): Point2D => ({
    x: p.x * 10,
    y: p.y * 10,
  });
  return { scx: { ctx, worldToScreen, baseLineWidth }, calls };
}

function countCalls(calls: readonly MockCtxCall[], fn: string): number {
  return calls.filter((c) => c.fn === fn).length;
}

function countSetLineDashEmpty(calls: readonly MockCtxCall[]): number {
  return calls.filter((c) => {
    if (c.fn !== 'setLineDash') return false;
    const arg = c.args[0] as number[] | undefined;
    return Array.isArray(arg) && arg.length === 0;
  }).length;
}

function countSetLineDashNonEmpty(calls: readonly MockCtxCall[]): number {
  return calls.filter((c) => {
    if (c.fn !== 'setLineDash') return false;
    const arg = c.args[0] as number[] | undefined;
    return Array.isArray(arg) && arg.length > 0;
  }).length;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

function p(x: number, y: number, z = 0): Point3D {
  return { x, y, z };
}

function makeGeometry(): StairGeometry {
  // Minimal geometry — only the fields the helpers consume.
  const inner = [p(0, 0), p(1, 0), p(2, 0)];
  const outer = [p(0, 1), p(1, 1), p(2, 1)];
  const walkline = [p(0, 0.5), p(1, 0.5), p(2, 0.5)];
  const treads = [
    [p(0, 0), p(1, 0), p(1, 1), p(0, 1)],
    [p(1, 0), p(2, 0), p(2, 1), p(1, 1)],
  ];
  return {
    treads,
    treadsBelowCut: treads,
    treadsAboveCut: [],
    risers: [],
    stringers: { inner, outer },
    walkline,
    handrails: {},
    landings: [],
    arrowSymbol: { start: p(0, 0.5), end: p(2, 0.5), label: 'UP' },
    bbox: { min: p(0, 0), max: p(2, 1) },
  };
}

const ALL_STRUCTURE_TYPES: readonly StairStructureType[] = [
  'monolithic',
  'stringer-1side',
  'stringer-2side',
  'central-stringer',
  'cantilever',
  'suspended',
  'glass-tread',
  'steel-grating',
];

// ─── Stringers per structureType ─────────────────────────────────────────────

describe('renderStringersForStructure — §6.2 symbology mapping', () => {
  test('monolithic → emits zero stroke (no stringer line)', () => {
    const { scx, calls } = makeScx();
    renderStringersForStructure(scx, 'monolithic', makeGeometry());
    expect(countCalls(calls, 'stroke')).toBe(0);
    expect(countCalls(calls, 'moveTo')).toBe(0);
  });

  test('stringer-1side → strokes outer only (single polyline)', () => {
    const { scx, calls } = makeScx();
    renderStringersForStructure(scx, 'stringer-1side', makeGeometry());
    expect(countCalls(calls, 'stroke')).toBe(1);
    // first moveTo lands on outer[0] = (0, 1) → screen (0, 10)
    const firstMoveTo = calls.find((c) => c.fn === 'moveTo');
    expect(firstMoveTo?.args).toEqual([0, 10]);
  });

  test('stringer-2side → strokes both inner+outer (legacy default)', () => {
    const { scx, calls } = makeScx();
    renderStringersForStructure(scx, 'stringer-2side', makeGeometry());
    expect(countCalls(calls, 'stroke')).toBe(2);
  });

  test('central-stringer → strokes walkline (geometric centerline)', () => {
    const { scx, calls } = makeScx();
    renderStringersForStructure(scx, 'central-stringer', makeGeometry());
    expect(countCalls(calls, 'stroke')).toBe(1);
    // walkline[0] = (0, 0.5) → screen (0, 5)
    const firstMoveTo = calls.find((c) => c.fn === 'moveTo');
    expect(firstMoveTo?.args).toEqual([0, 5]);
  });

  test('cantilever → strokes inner only (wall mount edge)', () => {
    const { scx, calls } = makeScx();
    renderStringersForStructure(scx, 'cantilever', makeGeometry());
    expect(countCalls(calls, 'stroke')).toBe(1);
    // inner[0] = (0, 0) → screen (0, 0)
    const firstMoveTo = calls.find((c) => c.fn === 'moveTo');
    expect(firstMoveTo?.args).toEqual([0, 0]);
  });

  test('suspended → strokes both stringers with dashed line', () => {
    const { scx, calls } = makeScx();
    renderStringersForStructure(scx, 'suspended', makeGeometry());
    expect(countCalls(calls, 'stroke')).toBe(2);
    // Two non-empty setLineDash calls (one per polyline).
    expect(countSetLineDashNonEmpty(calls)).toBe(2);
  });

  test('glass-tread → strokes both stringers solid (frame metal)', () => {
    const { scx, calls } = makeScx();
    renderStringersForStructure(scx, 'glass-tread', makeGeometry());
    expect(countCalls(calls, 'stroke')).toBe(2);
    expect(countSetLineDashEmpty(calls)).toBe(2);
    expect(countSetLineDashNonEmpty(calls)).toBe(0);
  });

  test('steel-grating → strokes both stringers solid (frame metal)', () => {
    const { scx, calls } = makeScx();
    renderStringersForStructure(scx, 'steel-grating', makeGeometry());
    expect(countCalls(calls, 'stroke')).toBe(2);
    expect(countSetLineDashEmpty(calls)).toBe(2);
    expect(countSetLineDashNonEmpty(calls)).toBe(0);
  });

  test('exhaustiveness — every StairStructureType is handled (no throw)', () => {
    for (const t of ALL_STRUCTURE_TYPES) {
      const { scx } = makeScx();
      expect(() => renderStringersForStructure(scx, t, makeGeometry())).not.toThrow();
    }
  });
});

// ─── Treads per structureType ────────────────────────────────────────────────

describe('renderTreadsForStructure — §6.2 symbology mapping', () => {
  test('default (stringer-2side) → solid fill + stroke per tread', () => {
    const { scx, calls } = makeScx();
    renderTreadsForStructure(scx, 'stringer-2side', makeGeometry().treadsBelowCut);
    // 2 treads × (fill + stroke)
    expect(countCalls(calls, 'fill')).toBe(2);
    expect(countCalls(calls, 'stroke')).toBe(2);
    // No dashed outline.
    expect(countSetLineDashNonEmpty(calls)).toBe(0);
    // Default translucent slate fill (α=0.12) → κοινό adaptive SSoT layer.
    const fillStyle = calls.find((c) => c.fn === 'set:fillStyle');
    expect(fillStyle?.args[0]).toBe(adaptFillTintForCanvas('rgba(120, 144, 156, 0.12)'));
  });

  test('glass-tread → dashed outline + ultra-light fill (α=0.04)', () => {
    const { scx, calls } = makeScx();
    renderTreadsForStructure(scx, 'glass-tread', makeGeometry().treadsBelowCut);
    expect(countCalls(calls, 'fill')).toBe(2);
    expect(countCalls(calls, 'stroke')).toBe(2);
    // One non-empty setLineDash before the loop.
    expect(countSetLineDashNonEmpty(calls)).toBeGreaterThanOrEqual(1);
    const fillStyle = calls.find((c) => c.fn === 'set:fillStyle');
    expect(fillStyle?.args[0]).toBe(adaptFillTintForCanvas('rgba(120, 144, 156, 0.04)'));
  });

  test('steel-grating → solid fill + per-tread clip + hatch lines (ISO 128)', () => {
    const { scx, calls } = makeScx();
    renderTreadsForStructure(scx, 'steel-grating', makeGeometry().treadsBelowCut);
    // Base fill+stroke per tread (2 treads).
    expect(countCalls(calls, 'fill')).toBe(2);
    // Per-tread clip (one per tread → 2 clip calls).
    expect(countCalls(calls, 'clip')).toBe(2);
    // Hatch generates many extra moveTo/lineTo pairs inside the clip — assert
    // we got at least more than the polygon-tracing baseline (8 moveTo for 2
    // polys + clip re-trace).
    expect(countCalls(calls, 'moveTo')).toBeGreaterThan(10);
  });

  test('skipFill option suppresses fill (glow pre-pass parity)', () => {
    const { scx, calls } = makeScx();
    renderTreadsForStructure(
      scx,
      'stringer-2side',
      makeGeometry().treadsBelowCut,
      { skipFill: true },
    );
    expect(countCalls(calls, 'fill')).toBe(0);
    expect(countCalls(calls, 'stroke')).toBe(2);
    // No fillStyle assignment when fill is suppressed.
    expect(calls.find((c) => c.fn === 'set:fillStyle')).toBeUndefined();
  });

  test('empty tread array → no-op (defensive)', () => {
    const { scx, calls } = makeScx();
    renderTreadsForStructure(scx, 'stringer-2side', []);
    expect(countCalls(calls, 'fill')).toBe(0);
    expect(countCalls(calls, 'stroke')).toBe(0);
  });

  test('degenerate tread (<3 vertices) skipped without crash', () => {
    const { scx, calls } = makeScx();
    const treads: ReadonlyArray<ReadonlyArray<Point3D>> = [
      [p(0, 0), p(1, 0)], // 2 vertices — skipped
      [p(0, 0), p(1, 0), p(1, 1), p(0, 1)], // valid
    ];
    renderTreadsForStructure(scx, 'stringer-2side', treads);
    expect(countCalls(calls, 'fill')).toBe(1);
    expect(countCalls(calls, 'stroke')).toBe(1);
  });

  test('exhaustiveness — every StairStructureType is handled (no throw)', () => {
    for (const t of ALL_STRUCTURE_TYPES) {
      const { scx } = makeScx();
      expect(() =>
        renderTreadsForStructure(scx, t, makeGeometry().treadsBelowCut),
      ).not.toThrow();
    }
  });
});
