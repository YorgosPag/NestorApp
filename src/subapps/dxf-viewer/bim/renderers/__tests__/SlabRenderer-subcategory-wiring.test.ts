jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

/**
 * ADR-377 Phase C.1 — SlabRenderer subcategory wiring tests.
 *
 * Verifies that `render()` passes `subcategoryKey: 'common-edges'` to
 * resolveSubcategoryStyle and that returned linePattern + color are applied.
 */

import { SlabRenderer } from '../SlabRenderer';
import type { SlabEntity } from '../../types/slab-types';
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
      ? { slab: { projectionPen: 5, cutPen: 7, subcategories: { [opts!.subcategoryKey ?? 'common-edges']: subEntry } } }
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

function lineWidthCalls(calls: MockCall[]): number[] {
  return calls.filter(c => c.fn === 'set:lineWidth').map(c => c.args[0] as number);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSlab(): SlabEntity {
  // levelElevation=1400, thickness=400 → zTop=1400, zBottom=1000 → cut plane 1200 inside → 'cut'
  return {
    id: 'slab_test', type: 'slab', kind: 'floor', layerId: '0',
    params: { kind: 'floor', levelElevation: 1400, thickness: 400, geometryType: 'box', outline: { vertices: [] } },
    geometry: {
      polygon: { vertices: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 5000 }, { x: 0, y: 5000 }] },
      bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 5000, y: 5000, z: 400 } },
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as SlabEntity;
}

function makeRenderer() {
  const mock = createMockCtx();
  const renderer = new SlabRenderer(mock.ctx);
  renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  return { renderer, mock };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SlabRenderer — common-edges subcategory wiring (Phase C.1)', () => {
  beforeEach(() => mockGetState.mockReturnValue(makeStoreState()));

  it('1. default store → setLineDash called with [] (solid default)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeSlab() as unknown as EntityModel, {});
    expect(lineDashCalls(mock.calls)).toContain('[]');
  });

  it('2. common-edges linePattern dashed → setLineDash gets [8,4]', () => {
    mockGetState.mockReturnValue(makeStoreState({ subcategoryKey: 'common-edges', linePattern: 'dashed' }));
    const { renderer, mock } = makeRenderer();
    renderer.render(makeSlab() as unknown as EntityModel, {});
    expect(lineDashCalls(mock.calls)).toContain('[8,4]');
  });

  it('3. common-edges cutColor → strokeStyle overridden with that color', () => {
    mockGetState.mockReturnValue(makeStoreState({ subcategoryKey: 'common-edges', cutColor: '#C0FFEE' }));
    const { renderer, mock } = makeRenderer();
    renderer.render(makeSlab() as unknown as EntityModel, {});
    expect(strokeStyleCalls(mock.calls)).toContain('#C0FFEE');
  });

  it('4. no color override → strokeStyle uses KIND_STROKE[floor] = #6e6358', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeSlab() as unknown as EntityModel, {});
    expect(strokeStyleCalls(mock.calls)).toContain('#6e6358');
  });

  it('5. lineWidthPx from resolver is positive', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeSlab() as unknown as EntityModel, {});
    expect(lineWidthCalls(mock.calls).some(w => w > 0)).toBe(true);
  });

  it('6. subcategory color null → fallback to KIND_STROKE, no explicit null in strokeStyle', () => {
    mockGetState.mockReturnValue(makeStoreState({ subcategoryKey: 'common-edges', cutColor: null }));
    const { renderer, mock } = makeRenderer();
    renderer.render(makeSlab() as unknown as EntityModel, {});
    // color null → branch `_slabColor ?? KIND_STROKE[kind]` → KIND_STROKE used
    expect(strokeStyleCalls(mock.calls)).toContain('#6e6358');
  });
});
