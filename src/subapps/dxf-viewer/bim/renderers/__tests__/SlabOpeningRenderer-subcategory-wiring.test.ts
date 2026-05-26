jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

/**
 * ADR-377 Phase C.1 — SlabOpeningRenderer subcategory wiring tests.
 *
 * Verifies that `render()` passes `subcategoryKey: 'edges'` to
 * resolveSubcategoryStyle. Key behaviours:
 *   - Default (solid linePattern) → KIND_DASH preserved per-kind (fallback)
 *   - Explicit linePattern → linePatternToDashArray used (override active)
 *   - Color null → KIND_STROKE used; color string → overrides strokeStyle
 */

import { SlabOpeningRenderer } from '../SlabOpeningRenderer';
import type { SlabOpeningEntity, SlabOpeningKind } from '../../types/slab-opening-types';
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
      ? { 'slab-opening': { projectionPen: 3, cutPen: 4, subcategories: { [opts!.subcategoryKey ?? 'edges']: subEntry } } }
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

function makeOpening(kind: SlabOpeningKind = 'shaft'): SlabOpeningEntity {
  // elevationOverride=1300 → zTop=1300, zBottom=1100 → cut plane 1200 inside → 'cut'
  return {
    id: 'so_test', type: 'slab-opening', kind, layerId: '0',
    params: { kind, slabId: 'slab_test', outline: { vertices: [] }, elevationOverride: 1300 },
    geometry: {
      polygon: { vertices: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }] },
      bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 1000, y: 1000, z: 200 } },
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as SlabOpeningEntity;
}

function makeRenderer() {
  const mock = createMockCtx();
  const renderer = new SlabOpeningRenderer(mock.ctx);
  renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  return { renderer, mock };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SlabOpeningRenderer — edges subcategory wiring (Phase C.1)', () => {
  beforeEach(() => mockGetState.mockReturnValue(makeStoreState()));

  it('1. default (solid linePattern) → setLineDash uses KIND_DASH[shaft] = [8,4]', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeOpening('shaft') as unknown as EntityModel, {});
    // solid linePattern → fallback to KIND_DASH['shaft'] = [8,4]
    expect(lineDashCalls(mock.calls)).toContain('[8,4]');
  });

  it('2. default (solid linePattern) for well → KIND_DASH[well] = [6,3]', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeOpening('well') as unknown as EntityModel, {});
    expect(lineDashCalls(mock.calls)).toContain('[6,3]');
  });

  it('3. edges linePattern center → setLineDash gets [20,6,4,6] (override active)', () => {
    mockGetState.mockReturnValue(makeStoreState({ subcategoryKey: 'edges', linePattern: 'center' }));
    const { renderer, mock } = makeRenderer();
    renderer.render(makeOpening('shaft') as unknown as EntityModel, {});
    expect(lineDashCalls(mock.calls)).toContain('[20,6,4,6]');
  });

  it('4. edges linePattern dashed → setLineDash gets [8,4] (from linePatternToDashArray, not KIND_DASH)', () => {
    mockGetState.mockReturnValue(makeStoreState({ subcategoryKey: 'edges', linePattern: 'dashed' }));
    const { renderer, mock } = makeRenderer();
    renderer.render(makeOpening('well') as unknown as EntityModel, {});
    // well KIND_DASH is [6,3], but dashed override → [8,4]
    expect(lineDashCalls(mock.calls)).toContain('[8,4]');
  });

  it('5. no color override → strokeStyle uses KIND_STROKE[shaft] = #1f3a5f', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeOpening('shaft') as unknown as EntityModel, {});
    expect(strokeStyleCalls(mock.calls)).toContain('#1f3a5f');
  });

  it('6. color override → strokeStyle set to override, not KIND_STROKE', () => {
    mockGetState.mockReturnValue(makeStoreState({ subcategoryKey: 'edges', cutColor: '#DEAD00' }));
    const { renderer, mock } = makeRenderer();
    renderer.render(makeOpening('shaft') as unknown as EntityModel, {});
    expect(strokeStyleCalls(mock.calls)).toContain('#DEAD00');
    expect(strokeStyleCalls(mock.calls)).not.toContain('#1f3a5f');
  });

  it('7. lineWidthPx from resolver is positive', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeOpening() as unknown as EntityModel, {});
    expect(lineWidthCalls(mock.calls).some(w => w > 0)).toBe(true);
  });
});
