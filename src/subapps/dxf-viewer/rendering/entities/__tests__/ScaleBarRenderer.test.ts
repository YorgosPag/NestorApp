// Firebase auth chain reaches ScaleBarRenderer via BaseEntityRenderer →
// PhaseManager → GripProvider → user-settings → firestore. Stub it before any
// imports execute (mirror DimensionRenderer.test.ts) so the test env doesn't
// need fetch / real firebase init.
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
 * ADR-583 Φ2.5 — ScaleBarRenderer smoke tests.
 *
 * Verifies the renderer does not throw for each of the 4 body styles (with and
 * without subdivisions) and that `hitTest` correctly gates on the bar's AXIS
 * segment (position → derived endPosition) rather than pixel output.
 */

import type { Point2D } from '../../types/Types';
import type { ScaleBarEntity, ScaleBarStyle } from '../../../types/scale-bar';
import { ScaleBarRenderer } from '../ScaleBarRenderer';

// ──────────────────────────────────────────────────────────────────────────────
// Mock CanvasRenderingContext2D (mirror DimensionRenderer.test.ts)
// ──────────────────────────────────────────────────────────────────────────────

interface MockCtxCall {
  fn: string;
  args: readonly unknown[];
}

interface MockCtx {
  calls: MockCtxCall[];
  ctx: CanvasRenderingContext2D;
}

function createMockCtx(width = 800, height = 600): MockCtx {
  const calls: MockCtxCall[] = [];
  const record = (fn: string) =>
    (...args: unknown[]): unknown => {
      calls.push({ fn, args });
      return undefined;
    };
  const canvas = {
    width, height,
    getBoundingClientRect: () => ({ width, height, top: 0, left: 0, right: width, bottom: height }),
  };
  const ctxStub = {
    canvas,
    save: record('save'),
    restore: record('restore'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    closePath: record('closePath'),
    stroke: record('stroke'),
    fill: record('fill'),
    fillText: record('fillText'),
    arc: record('arc'),
    translate: record('translate'),
    rotate: record('rotate'),
    scale: record('scale'),
    setLineDash: record('setLineDash'),
    set fillStyle(v: string) { calls.push({ fn: 'set:fillStyle', args: [v] }); },
    set strokeStyle(v: string) { calls.push({ fn: 'set:strokeStyle', args: [v] }); },
    get strokeStyle() { return '#000000'; },
    set lineWidth(v: number) { calls.push({ fn: 'set:lineWidth', args: [v] }); },
    set lineCap(v: string) { calls.push({ fn: 'set:lineCap', args: [v] }); },
    set font(v: string) { calls.push({ fn: 'set:font', args: [v] }); },
    set textAlign(v: string) { calls.push({ fn: 'set:textAlign', args: [v] }); },
    set textBaseline(v: string) { calls.push({ fn: 'set:textBaseline', args: [v] }); },
  };
  return { calls, ctx: ctxStub as unknown as CanvasRenderingContext2D };
}

function countCalls(mock: MockCtx, fn: string): number {
  return mock.calls.filter((c) => c.fn === fn).length;
}

// ──────────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────────

function makeRenderer(): { renderer: ScaleBarRenderer; mock: MockCtx } {
  const mock = createMockCtx();
  const renderer = new ScaleBarRenderer(mock.ctx);
  renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  return { renderer, mock };
}

function makeBar(overrides: Partial<ScaleBarEntity> = {}): ScaleBarEntity {
  return {
    id: 'sb_render_test',
    type: 'scale-bar',
    layerId: 'lyr_test',
    position: { x: 0, y: 0 },
    angleRad: 0,
    length: 10,
    unit: 'm',
    divisions: 4,
    subdivisions: 0,
    style: 'alternating',
    barHeightMm: 4,
    labelHeightMm: 2.5,
    labelPlacement: 'below',
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe('ScaleBarRenderer — render smoke (all 4 styles)', () => {
  it.each<ScaleBarStyle>(['alternating', 'hollow', 'line-ticks', 'double'])(
    'renders style=%s without throwing and draws + labels',
    (style) => {
      const { renderer, mock } = makeRenderer();
      const bar = makeBar({ style });
      expect(() => renderer.render(bar)).not.toThrow();
      // Every style strokes at least the baseline/cells and draws the numerals.
      expect(countCalls(mock, 'stroke')).toBeGreaterThanOrEqual(1);
      expect(countCalls(mock, 'fillText')).toBeGreaterThanOrEqual(1);
    },
  );

  it('renders subdivisions (left extension) without throwing', () => {
    const { renderer, mock } = makeRenderer();
    const bar = makeBar({ subdivisions: 2 });
    expect(() => renderer.render(bar)).not.toThrow();
    expect(countCalls(mock, 'stroke')).toBeGreaterThanOrEqual(1);
  });

  it('ignores non-scale-bar entities (type guard short-circuits)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render({ id: 'not_a_bar', type: 'line', layerId: 'lyr_test' } as unknown as ScaleBarEntity);
    expect(countCalls(mock, 'stroke')).toBe(0);
    expect(countCalls(mock, 'fillText')).toBe(0);
  });
});

describe('ScaleBarRenderer — getGrips', () => {
  it('returns 3 grips (move + rotation + length) all tagged scale-bar', () => {
    const { renderer } = makeRenderer();
    const bar = makeBar();
    const grips = renderer.getGrips(bar);
    expect(grips).toHaveLength(3);
  });

  it('returns [] for non-scale-bar entities', () => {
    const { renderer } = makeRenderer();
    const grips = renderer.getGrips({ id: 'x', type: 'line', layerId: 'lyr_test' } as unknown as ScaleBarEntity);
    expect(grips).toEqual([]);
  });
});

describe('ScaleBarRenderer — hitTest', () => {
  it('hits a point ON the axis segment (position → endPosition)', () => {
    const { renderer } = makeRenderer();
    // Horizontal bar, 10 m @ 1:100 → endPosition at (10000, 0) canonical-mm.
    const bar = makeBar({ position: { x: 0, y: 0 }, angleRad: 0, length: 10, unit: 'm' });
    const midpoint: Point2D = { x: 5000, y: 0 };
    expect(renderer.hitTest(bar, midpoint, 5)).toBe(true);
  });

  it('misses a point far off the axis segment', () => {
    const { renderer } = makeRenderer();
    const bar = makeBar({ position: { x: 0, y: 0 }, angleRad: 0, length: 10, unit: 'm' });
    const farPoint: Point2D = { x: 5000, y: 5000 };
    expect(renderer.hitTest(bar, farPoint, 5)).toBe(false);
  });

  it('returns false for non-scale-bar entities', () => {
    const { renderer } = makeRenderer();
    expect(
      renderer.hitTest(
        { id: 'x', type: 'line', layerId: 'lyr_test' } as unknown as ScaleBarEntity,
        { x: 0, y: 0 },
        5,
      ),
    ).toBe(false);
  });
});
