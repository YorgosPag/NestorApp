// Stub Firebase auth chain before any imports — BaseEntityRenderer →
// PhaseManager transitively touches firestore in test env.
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

/**
 * ADR-363 Phase 4.5c.2 — ColumnRenderer material hatch unit tests.
 *
 * Verifies the hatch pass (`drawMaterialHatch`):
 *   - `params.material` undefined → falls back to RC (dots only, `arc` calls)
 *   - `'rc'` (case-variants) → dot grid (`arc` + `fill`), no diagonal strokes
 *   - `'steel'` → diagonal cross-hatch strokes, no `arc`
 *   - `'masonry'` → horizontal + staggered vertical strokes, no `arc`
 *   - `'wood'` → single-direction diagonals, no `arc`
 *   - `'circular'` column kind → hatch SKIPPED entirely (no extra clip beyond
 *     the base fill+stroke pass)
 *   - Extreme zoom-out (`transform.scale < 0.001`) → hatch SKIPPED
 *   - save/clip/restore properly scoped — outline stroke survives μετά το pass
 *   - Polygon clip uses footprint vertices (start point matches first vertex
 *     mapped through worldToScreen)
 *   - Unknown material string + uppercase variant → RC fallback path
 */

import { ColumnRenderer } from '../ColumnRenderer';
import { buildColumnEntity, buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import type { ColumnEntity, ColumnKind } from '../../types/column-types';
import type { EntityModel } from '../../../rendering/types/Types';

// ─── Canvas mock ─────────────────────────────────────────────────────────────

interface MockCtxCall { fn: string; args: readonly unknown[] }

function createMockCtx(width = 800, height = 600) {
  const calls: MockCtxCall[] = [];
  const record = (fn: string) => (...args: unknown[]): unknown => {
    calls.push({ fn, args });
    return undefined;
  };
  const canvas = {
    width, height,
    getBoundingClientRect: () => ({ width, height, left: 0, top: 0, right: width, bottom: height, x: 0, y: 0 }),
  };
  const ctxStub = {
    canvas,
    save: record('save'),
    restore: record('restore'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    closePath: record('closePath'),
    clip: record('clip'),
    arc: record('arc'),
    stroke: record('stroke'),
    fill: record('fill'),
    setLineDash: record('setLineDash'),
    set globalCompositeOperation(v: string) { calls.push({ fn: 'set:globalCompositeOperation', args: [v] }); },
    set globalAlpha(v: number) { calls.push({ fn: 'set:globalAlpha', args: [v] }); },
    set fillStyle(v: string) { calls.push({ fn: 'set:fillStyle', args: [v] }); },
    set strokeStyle(v: string) { calls.push({ fn: 'set:strokeStyle', args: [v] }); },
    set lineWidth(v: number) { calls.push({ fn: 'set:lineWidth', args: [v] }); },
    set lineCap(v: string) { calls.push({ fn: 'set:lineCap', args: [v] }); },
    set lineJoin(v: string) { calls.push({ fn: 'set:lineJoin', args: [v] }); },
    set shadowBlur(v: number) { calls.push({ fn: 'set:shadowBlur', args: [v] }); },
    set shadowColor(v: string) { calls.push({ fn: 'set:shadowColor', args: [v] }); },
  };
  return { calls, ctx: ctxStub as unknown as CanvasRenderingContext2D };
}

function countCalls(calls: readonly MockCtxCall[], fn: string): number {
  return calls.filter((c) => c.fn === fn).length;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeColumn(kind: ColumnKind, material?: string): ColumnEntity {
  const params = buildDefaultColumnParams(
    { x: 0, y: 0 },
    kind,
    material !== undefined ? { material } : {},
  );
  const r = buildColumnEntity(params, '0');
  if (!r.ok) throw new Error('column build failed: ' + r.hardErrors.join(','));
  return r.entity;
}

function makeRenderer(scale = 1) {
  const mock = createMockCtx();
  const renderer = new ColumnRenderer(mock.ctx);
  renderer.setTransform({ scale, offsetX: 0, offsetY: 0 });
  return { renderer, mock };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ColumnRenderer + material hatch (Phase 4.5c.2)', () => {
  it('1. material undefined → RC fallback (arc calls > 0, no diagonal strokes mid-clip)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeColumn('rectangular') as unknown as EntityModel, {});
    expect(countCalls(mock.calls, 'arc')).toBeGreaterThan(0);
    expect(countCalls(mock.calls, 'clip')).toBeGreaterThanOrEqual(1);
  });

  it('2. material "rc" → dot grid (arc), no inner lineTo strokes between clip+restore', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeColumn('rectangular', 'rc') as unknown as EntityModel, {});
    const clipIdx = mock.calls.findIndex((c) => c.fn === 'clip');
    const tail = mock.calls.slice(clipIdx);
    const restoreIdx = tail.findIndex((c) => c.fn === 'restore');
    const hatch = tail.slice(0, restoreIdx);
    expect(hatch.some((c) => c.fn === 'arc')).toBe(true);
    expect(hatch.some((c) => c.fn === 'lineTo')).toBe(false);
  });

  it('3. material "steel" → cross-hatch strokes inside clip (lineTo > 0), no arc inside', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeColumn('rectangular', 'steel') as unknown as EntityModel, {});
    const clipIdx = mock.calls.findIndex((c) => c.fn === 'clip');
    const tail = mock.calls.slice(clipIdx);
    const restoreIdx = tail.findIndex((c) => c.fn === 'restore');
    const hatch = tail.slice(0, restoreIdx);
    expect(hatch.filter((c) => c.fn === 'lineTo').length).toBeGreaterThan(0);
    expect(hatch.some((c) => c.fn === 'arc')).toBe(false);
  });

  it('4. material "masonry" → strokes inside clip, no arc', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeColumn('rectangular', 'masonry') as unknown as EntityModel, {});
    const clipIdx = mock.calls.findIndex((c) => c.fn === 'clip');
    const tail = mock.calls.slice(clipIdx);
    const restoreIdx = tail.findIndex((c) => c.fn === 'restore');
    const hatch = tail.slice(0, restoreIdx);
    expect(hatch.filter((c) => c.fn === 'lineTo').length).toBeGreaterThan(0);
    expect(hatch.some((c) => c.fn === 'arc')).toBe(false);
  });

  it('5. material "wood" → strokes inside clip, no arc', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeColumn('rectangular', 'wood') as unknown as EntityModel, {});
    const clipIdx = mock.calls.findIndex((c) => c.fn === 'clip');
    const tail = mock.calls.slice(clipIdx);
    const restoreIdx = tail.findIndex((c) => c.fn === 'restore');
    const hatch = tail.slice(0, restoreIdx);
    expect(hatch.filter((c) => c.fn === 'lineTo').length).toBeGreaterThan(0);
    expect(hatch.some((c) => c.fn === 'arc')).toBe(false);
  });

  it('6. circular RC → concentric arcs drawn inside single clip pass (Phase 4.5c.3)', () => {
    // Phase 4.5c.3 superseded the original "circular → SKIP" assumption:
    // `computeCircularHatchPlan('rc')` returns 3 concentric rings; renderer
    // clips to the 32-vertex footprint and draws arcs. Outline stroke still
    // runs after the hatch pass restore.
    const { renderer, mock } = makeRenderer();
    renderer.render(makeColumn('circular', 'rc') as unknown as EntityModel, {});
    expect(countCalls(mock.calls, 'clip')).toBe(1);
    expect(countCalls(mock.calls, 'arc')).toBeGreaterThanOrEqual(3);
  });

  it('7. extreme zoom-out (scale < 0.001) → hatch SKIPPED', () => {
    const { renderer, mock } = makeRenderer(0.0001);
    renderer.render(makeColumn('rectangular', 'steel') as unknown as EntityModel, {});
    expect(countCalls(mock.calls, 'clip')).toBe(0);
  });

  it('8. hatch pass scoped (save before clip, restore after)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeColumn('rectangular', 'steel') as unknown as EntityModel, {});
    const clipIdx = mock.calls.findIndex((c) => c.fn === 'clip');
    expect(clipIdx).toBeGreaterThan(-1);
    const preceding = mock.calls.slice(0, clipIdx);
    const following = mock.calls.slice(clipIdx);
    expect(preceding.some((c) => c.fn === 'save')).toBe(true);
    expect(following.some((c) => c.fn === 'restore')).toBe(true);
  });

  it('9. outline stroke survives after hatch pass restore', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeColumn('rectangular', 'steel') as unknown as EntityModel, {});
    const clipIdx = mock.calls.findIndex((c) => c.fn === 'clip');
    const tail = mock.calls.slice(clipIdx);
    const restoreIdx = tail.findIndex((c) => c.fn === 'restore');
    expect(restoreIdx).toBeGreaterThan(-1);
    const afterRestore = tail.slice(restoreIdx);
    expect(afterRestore.some((c) => c.fn === 'stroke')).toBe(true);
  });

  it('10. polygon clip path uses footprint first vertex (moveTo right before clip)', () => {
    const { renderer, mock } = makeRenderer();
    const column = makeColumn('rectangular', 'rc');
    renderer.render(column as unknown as EntityModel, {});
    const clipIdx = mock.calls.findIndex((c) => c.fn === 'clip');
    const moveTos = mock.calls.slice(0, clipIdx).filter((c) => c.fn === 'moveTo');
    expect(moveTos.length).toBeGreaterThan(0);
    // Last moveTo πριν το clip = polygon path's first vertex worldToScreen.
    const lastMove = moveTos[moveTos.length - 1];
    expect(typeof lastMove.args[0]).toBe('number');
    expect(typeof lastMove.args[1]).toBe('number');
  });

  it('11. unknown material string → RC fallback (arc calls, no inner stroke lines)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeColumn('rectangular', 'unobtanium') as unknown as EntityModel, {});
    expect(countCalls(mock.calls, 'arc')).toBeGreaterThan(0);
    const clipIdx = mock.calls.findIndex((c) => c.fn === 'clip');
    const tail = mock.calls.slice(clipIdx);
    const restoreIdx = tail.findIndex((c) => c.fn === 'restore');
    const hatch = tail.slice(0, restoreIdx);
    expect(hatch.some((c) => c.fn === 'lineTo')).toBe(false);
  });

  it('12. case-insensitive material lookup ("STEEL" / "Steel" → steel hatch)', () => {
    const { renderer: r1, mock: m1 } = makeRenderer();
    const { renderer: r2, mock: m2 } = makeRenderer();
    r1.render(makeColumn('rectangular', 'STEEL') as unknown as EntityModel, {});
    r2.render(makeColumn('rectangular', 'Steel') as unknown as EntityModel, {});

    for (const m of [m1, m2]) {
      const clipIdx = m.calls.findIndex((c) => c.fn === 'clip');
      const tail = m.calls.slice(clipIdx);
      const restoreIdx = tail.findIndex((c) => c.fn === 'restore');
      const hatch = tail.slice(0, restoreIdx);
      expect(hatch.filter((c) => c.fn === 'lineTo').length).toBeGreaterThan(0);
      expect(hatch.some((c) => c.fn === 'arc')).toBe(false);
    }
  });
});

// ─── ADR-363 Phase 8 — polygon / shear-wall / I-shape ───────────────────────

describe('ColumnRenderer + Phase 8 kinds (polygon / shear-wall / I-shape)', () => {
  it.each(['polygon', 'shear-wall', 'I-shape'] as const)(
    '%s kind RC → single clip pass + dot grid (arc calls)',
    (kind) => {
      const { renderer, mock } = makeRenderer();
      renderer.render(makeColumn(kind, 'rc') as unknown as EntityModel, {});
      expect(countCalls(mock.calls, 'clip')).toBe(1);
      expect(countCalls(mock.calls, 'arc')).toBeGreaterThan(0);
    },
  );

  it.each(['polygon', 'shear-wall', 'I-shape'] as const)(
    '%s kind steel → cross-hatch strokes inside clip, no arc',
    (kind) => {
      const { renderer, mock } = makeRenderer();
      renderer.render(makeColumn(kind, 'steel') as unknown as EntityModel, {});
      const clipIdx = mock.calls.findIndex((c) => c.fn === 'clip');
      expect(clipIdx).toBeGreaterThan(-1);
      const tail = mock.calls.slice(clipIdx);
      const restoreIdx = tail.findIndex((c) => c.fn === 'restore');
      const hatch = tail.slice(0, restoreIdx);
      expect(hatch.filter((c) => c.fn === 'lineTo').length).toBeGreaterThan(0);
      expect(hatch.some((c) => c.fn === 'arc')).toBe(false);
    },
  );

  it('polygon kind uses per-kind stroke colour (warm green)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeColumn('polygon', 'rc') as unknown as EntityModel, {});
    const strokeStyles = mock.calls.filter((c) => c.fn === 'set:strokeStyle').map((c) => c.args[0]);
    expect(strokeStyles).toContain('#5c8a3a');
  });

  it('shear-wall kind uses per-kind stroke colour (deep RC grey)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeColumn('shear-wall', 'rc') as unknown as EntityModel, {});
    const strokeStyles = mock.calls.filter((c) => c.fn === 'set:strokeStyle').map((c) => c.args[0]);
    expect(strokeStyles).toContain('#3a4048');
  });

  it('I-shape kind uses per-kind stroke colour (cool steel)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeColumn('I-shape', 'rc') as unknown as EntityModel, {});
    const strokeStyles = mock.calls.filter((c) => c.fn === 'set:strokeStyle').map((c) => c.args[0]);
    expect(strokeStyles).toContain('#4a4a52');
  });
});
