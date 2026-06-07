jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

/**
 * ADR-377 Phase C.1 — WallRenderer subcategory wiring tests.
 *
 * Verifies that `drawFootprint` passes `subcategoryKey: 'common-edges'` and
 * `drawMaterialHatch` passes `subcategoryKey: 'cut-pattern'` to resolveSubcategoryStyle,
 * and that returned linePattern + color are applied to the canvas context.
 */

import { WallRenderer } from '../WallRenderer';
import type { WallEntity } from '../../types/wall-types';
import type { EntityModel } from '../../../rendering/types/Types';

// ── Store mock ────────────────────────────────────────────────────────────────

jest.mock('../../../state/drawing-scale-store', () => ({
  useDrawingScaleStore: { getState: jest.fn() },
}));

import { useDrawingScaleStore } from '../../../state/drawing-scale-store';
const mockGetState = useDrawingScaleStore.getState as jest.Mock;

const BASE_VIEW_RANGE = {
  topMm: 2300,
  cutPlaneMm: 1200,
  bottomMm: 0,
  viewDepthMm: -300,
  floorAdjustedRangeMm: 1220,
};

function makeStoreState(opts?: {
  category?: string;
  subcategoryKey?: string;
  linePattern?: string;
  cutColor?: string | null;
}) {
  const subEntry = opts ? {
    ...(opts.linePattern !== undefined ? { linePattern: opts.linePattern } : {}),
    ...(opts.cutColor !== undefined ? { cutColor: opts.cutColor } : {}),
  } : {};
  const hasSub = opts && (opts.linePattern !== undefined || opts.cutColor !== undefined);
  return {
    drawingScale: 100,
    viewRange: BASE_VIEW_RANGE,
    objectStyles: hasSub
      ? { [opts!.category ?? 'wall']: { projectionPen: 5, cutPen: 7, subcategories: { [opts!.subcategoryKey ?? 'common-edges']: subEntry } } }
      : {},
  };
}

// ── Canvas mock ───────────────────────────────────────────────────────────────

interface MockCall { fn: string; args: readonly unknown[] }

function createMockCtx(width = 800, height = 600) {
  const calls: MockCall[] = [];
  const record = (fn: string) => (...args: unknown[]): unknown => { calls.push({ fn, args }); return undefined; };
  const canvas = { width, height, getBoundingClientRect: () => ({ width, height, left: 0, top: 0, right: width, bottom: height, x: 0, y: 0 }) };
  const ctx = {
    canvas,
    save: record('save'), restore: record('restore'),
    beginPath: record('beginPath'), moveTo: record('moveTo'), lineTo: record('lineTo'), closePath: record('closePath'),
    stroke: record('stroke'), fill: record('fill'), clip: record('clip'), arc: record('arc'),
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
  return { calls, ctx: ctx as unknown as CanvasRenderingContext2D };
}

function lineDashCalls(calls: MockCall[]): string[] {
  return calls.filter(c => c.fn === 'setLineDash').map(c => JSON.stringify(c.args[0]));
}

function strokeStyleCalls(calls: MockCall[]): string[] {
  return calls.filter(c => c.fn === 'set:strokeStyle').map(c => String(c.args[0]));
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeWall(): WallEntity {
  return {
    id: 'wall_test', type: 'wall', kind: 'exterior', layerId: '0',
    params: { category: 'exterior', height: 3000, baseOffset: 0, thickness: 200 },
    geometry: {
      outerEdge: { points: [{ x: 0, y: -100, z: 0 }, { x: 5000, y: -100, z: 0 }, { x: 5000, y: -100, z: 3000 }] },
      innerEdge: { points: [{ x: 0, y: 100, z: 0 }, { x: 5000, y: 100, z: 0 }, { x: 5000, y: 100, z: 3000 }] },
      axisPolyline: { points: [{ x: 0, y: 0, z: 0 }, { x: 5000, y: 0, z: 0 }] },
      bbox: { min: { x: 0, y: -100, z: 0 }, max: { x: 5000, y: 100, z: 3000 } },
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as WallEntity;
}

function makeRenderer() {
  const mock = createMockCtx();
  const renderer = new WallRenderer(mock.ctx);
  renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  return { renderer, mock };
}

// ── Tests: common-edges subcategory ──────────────────────────────────────────

describe('WallRenderer — common-edges subcategory wiring (Phase C.1)', () => {
  beforeEach(() => mockGetState.mockReturnValue(makeStoreState()));

  it('1. default store → setLineDash called with [] (solid — no override)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeWall() as unknown as EntityModel, {});
    expect(lineDashCalls(mock.calls)).toContain('[]');
  });

  it('2. common-edges linePattern dashed → setLineDash gets [8,4]', () => {
    mockGetState.mockReturnValue(makeStoreState({ subcategoryKey: 'common-edges', linePattern: 'dashed' }));
    const { renderer, mock } = makeRenderer();
    renderer.render(makeWall() as unknown as EntityModel, {});
    expect(lineDashCalls(mock.calls)).toContain('[8,4]');
  });

  it('3. common-edges cutColor → strokeStyle overridden with that color', () => {
    mockGetState.mockReturnValue(makeStoreState({ subcategoryKey: 'common-edges', cutColor: '#FF0000' }));
    const { renderer, mock } = makeRenderer();
    renderer.render(makeWall() as unknown as EntityModel, {});
    expect(strokeStyleCalls(mock.calls)).toContain('#FF0000');
  });

  it('4. no color override → strokeStyle is never set to #FF0000', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeWall() as unknown as EntityModel, {});
    expect(strokeStyleCalls(mock.calls)).not.toContain('#FF0000');
  });
});

// ── Tests: cut-pattern subcategory (hatch) ────────────────────────────────────

describe('WallRenderer — cut-pattern subcategory wiring (Phase C.1)', () => {
  beforeEach(() => mockGetState.mockReturnValue(makeStoreState()));

  it('5. non-DNA wall → hatch setLineDash active (wiring executed)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeWall() as unknown as EntityModel, {});
    // drawMaterialHatch calls setLineDash; at least 1 setLineDash call present
    expect(mock.calls.some(c => c.fn === 'setLineDash')).toBe(true);
  });

  it('6. cut-pattern color override → hatch strokeStyle uses override color', () => {
    mockGetState.mockReturnValue(makeStoreState({ subcategoryKey: 'cut-pattern', cutColor: '#AABB00' }));
    const { renderer, mock } = makeRenderer();
    renderer.render(makeWall() as unknown as EntityModel, {});
    expect(strokeStyleCalls(mock.calls)).toContain('#AABB00');
  });
});

// ── ADR-375 C.9 — προκαθορισμένο χρώμα γραμμής ανά function (εξωτ. vs εσωτ.) ───

function makeInteriorWall(): WallEntity {
  const w = makeWall();
  (w as unknown as { kind: string }).kind = 'interior';
  (w.params as unknown as { category: string }).category = 'interior';
  return w;
}

describe('WallRenderer — ADR-375 C.9 default line color', () => {
  beforeEach(() => mockGetState.mockReturnValue(makeStoreState()));

  it('εξωτ. τοίχος → footprint strokeStyle = parent #2b2f36', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeWall() as unknown as EntityModel, {});
    expect(strokeStyleCalls(mock.calls)).toContain('#2b2f36');
  });

  it('εσωτ. τοίχος → footprint strokeStyle = #6b7280 (subcategory interior)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeInteriorWall() as unknown as EntityModel, {});
    expect(strokeStyleCalls(mock.calls)).toContain('#6b7280');
  });
});
