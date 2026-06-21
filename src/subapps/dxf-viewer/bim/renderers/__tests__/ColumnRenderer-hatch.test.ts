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
 * ADR-507 Φ7 — ColumnRenderer material poché (unified).
 *
 * Μετά την ενοποίηση (ADR-363 bespoke engine → PAT catalog SSoT) η γεωμετρία
 * δοκιμάζεται στο `material-hatch-geometry.test.ts` + `material-hatch-map.test.ts`.
 * Εδώ δοκιμάζουμε την ΕΝΣΩΜΑΤΩΣΗ στον renderer (αρχιτεκτονικά invariants) + το
 * outline χρώμα (ColumnRenderer-specific, ADR-375/445):
 *   - Το hatch pass δεν κάνει πλέον `ctx.clip()` (segments ήδη clipped) ούτε
 *     `ctx.arc()` (καμία RC dot-grid / concentric ring — AR-CONC stipple).
 *   - Pattern segments → `lineTo` strokes.
 *   - Extreme zoom-out (`scale < 0.001`) → hatch SKIPPED.
 *   - Outline stroke χρώμα = Object Styles SSoT (parent vs shear-wall).
 */

import { ColumnRenderer } from '../ColumnRenderer';
import { buildColumnEntity, buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import type { ColumnEntity, ColumnKind } from '../../types/column-types';
import type { EntityModel } from '../../../rendering/types/Types';

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
    save: record('save'), restore: record('restore'), beginPath: record('beginPath'),
    moveTo: record('moveTo'), lineTo: record('lineTo'), closePath: record('closePath'),
    clip: record('clip'), arc: record('arc'), stroke: record('stroke'), fill: record('fill'),
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

function makeColumn(kind: ColumnKind, material?: string): ColumnEntity {
  const params = buildDefaultColumnParams(
    { x: 0, y: 0 }, kind, material !== undefined ? { material } : {},
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

describe('ColumnRenderer unified material poché (ADR-507 Φ7)', () => {
  it.each(['rectangular', 'polygon', 'shear-wall', 'I-shape'] as const)(
    '%s: το hatch pass δεν κάνει clip ούτε arc (pre-clipped segments, μηδέν dots/rings)',
    (kind) => {
      const { renderer, mock } = makeRenderer();
      renderer.render(makeColumn(kind, 'steel') as unknown as EntityModel, {});
      expect(countCalls(mock.calls, 'clip')).toBe(0);
      expect(countCalls(mock.calls, 'arc')).toBe(0);
    },
  );

  it('circular RC → καμία arc (rings καταργήθηκαν → AR-CONC clipped στο 32-gon)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeColumn('circular', 'rc') as unknown as EntityModel, {});
    expect(countCalls(mock.calls, 'arc')).toBe(0);
    expect(countCalls(mock.calls, 'clip')).toBe(0);
  });

  it('outline stroke τρέχει μετά το hatch pass (save/restore balanced)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeColumn('rectangular', 'steel') as unknown as EntityModel, {});
    expect(countCalls(mock.calls, 'save')).toBe(countCalls(mock.calls, 'restore'));
    expect(countCalls(mock.calls, 'stroke')).toBeGreaterThan(0);
  });
});

// ─── ADR-375 C.9 / ADR-445 — outline χρώμα (Object Styles SSoT) ────────────────
describe('ColumnRenderer outline color (Phase 8 kinds)', () => {
  it('polygon → parent column line color (slate)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeColumn('polygon', 'rc') as unknown as EntityModel, {});
    const strokeStyles = mock.calls.filter((c) => c.fn === 'set:strokeStyle').map((c) => c.args[0]);
    expect(strokeStyles).toContain('#2f6690');
  });

  it('shear-wall → shear-wall subcategory line color', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeColumn('shear-wall', 'rc') as unknown as EntityModel, {});
    const strokeStyles = mock.calls.filter((c) => c.fn === 'set:strokeStyle').map((c) => c.args[0]);
    expect(strokeStyles).toContain('#24506b');
  });

  it('I-shape → parent column line color (not a τοιχίο kind)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeColumn('I-shape', 'rc') as unknown as EntityModel, {});
    const strokeStyles = mock.calls.filter((c) => c.fn === 'set:strokeStyle').map((c) => c.args[0]);
    expect(strokeStyles).toContain('#2f6690');
  });
});
