jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

/**
 * ADR-377 Phase C.2 — BeamRenderer subcategory wiring tests.
 *
 * hidden-lines: outline uses dashed pattern by default (from DEFAULT_OBJECT_STYLES).
 * section-profile: wired for steel beams when highlighted.
 */

import { BeamRenderer } from '../BeamRenderer';
import type { BeamEntity } from '../../types/beam-types';
import type { EntityModel } from '../../../rendering/types/Types';

jest.mock('../../../state/drawing-scale-store', () => ({
  useDrawingScaleStore: { getState: jest.fn() },
}));

import { useDrawingScaleStore } from '../../../state/drawing-scale-store';
const mockGetState = useDrawingScaleStore.getState as jest.Mock;

const BASE_VIEW_RANGE = {
  topMm: 2300, cutPlaneMm: 1200, bottomMm: 0,
  viewDepthMm: -300, floorAdjustedRangeMm: 1220,
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
      ? { beam: { projectionPen: 4, cutPen: 6, subcategories: { [opts!.subcategoryKey ?? 'hidden-lines']: subEntry } } }
      : {},
  };
}

interface MockCall { fn: string; args: readonly unknown[] }

function createMockCtx() {
  const calls: MockCall[] = [];
  const record = (fn: string) => (...args: unknown[]): unknown => { calls.push({ fn, args }); return undefined; };
  const canvas = { width: 800, height: 600, getBoundingClientRect: () => ({ width: 800, height: 600, left: 0, top: 0, right: 800, bottom: 600, x: 0, y: 0 }) };
  const ctx = {
    canvas,
    save: record('save'), restore: record('restore'),
    beginPath: record('beginPath'), moveTo: record('moveTo'), lineTo: record('lineTo'),
    closePath: record('closePath'), stroke: record('stroke'), fill: record('fill'),
    clip: record('clip'), arc: record('arc'),
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

function makeBeam(): BeamEntity {
  return {
    id: 'beam_test', type: 'beam', kind: 'straight', layerId: '0',
    params: {
      topElevation: 1400, zOffset: 0, depth: 400, width: 200,
      material: 'rc', sectionType: 'I',
      startPoint: { x: 0, y: 0, z: 1000 },
      endPoint: { x: 5000, y: 0, z: 1000 },
    },
    geometry: {
      outline: {
        vertices: [
          { x: 0, y: -100 }, { x: 5000, y: -100 },
          { x: 5000, y: 100 }, { x: 0, y: 100 },
        ],
      },
      axisPolyline: { points: [{ x: 0, y: 0, z: 0 }, { x: 5000, y: 0, z: 0 }] },
      bbox: { min: { x: 0, y: -100 }, max: { x: 5000, y: 100 } },
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as BeamEntity;
}

function makeRenderer() {
  const mock = createMockCtx();
  const renderer = new BeamRenderer(mock.ctx);
  renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  return { renderer, mock };
}

// ── hidden-lines subcategory ──────────────────────────────────────────────────

describe('BeamRenderer — hidden-lines subcategory wiring (Phase C.2)', () => {
  beforeEach(() => mockGetState.mockReturnValue(makeStoreState()));

  it('1. default store → setLineDash [8,4] (dashed default from DEFAULT_OBJECT_STYLES)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeBeam() as unknown as EntityModel, {});
    expect(lineDashCalls(mock.calls)).toContain('[8,4]');
  });

  it('2. hidden-lines linePattern solid override → setLineDash gets []', () => {
    mockGetState.mockReturnValue(makeStoreState({ subcategoryKey: 'hidden-lines', linePattern: 'solid' }));
    const { renderer, mock } = makeRenderer();
    renderer.render(makeBeam() as unknown as EntityModel, {});
    expect(lineDashCalls(mock.calls)).toContain('[]');
  });

  it('3. hidden-lines linePattern dashed2 → setLineDash gets [4,2]', () => {
    mockGetState.mockReturnValue(makeStoreState({ subcategoryKey: 'hidden-lines', linePattern: 'dashed2' }));
    const { renderer, mock } = makeRenderer();
    renderer.render(makeBeam() as unknown as EntityModel, {});
    expect(lineDashCalls(mock.calls)).toContain('[4,2]');
  });

  it('4. hidden-lines cutColor → strokeStyle overridden with that color', () => {
    mockGetState.mockReturnValue(makeStoreState({ subcategoryKey: 'hidden-lines', cutColor: '#BEEF00' }));
    const { renderer, mock } = makeRenderer();
    renderer.render(makeBeam() as unknown as EntityModel, {});
    expect(strokeStyleCalls(mock.calls)).toContain('#BEEF00');
  });

  it('5. no cutColor override → strokeStyle is never set to #BEEF00', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeBeam() as unknown as EntityModel, {});
    expect(strokeStyleCalls(mock.calls)).not.toContain('#BEEF00');
  });

  // ── ADR-363 §5.7 (2026-06-17) — δοκάρι «hidden above floor» → overhead dashed ──
  // Default δοκάρι (top 3000 / depth 500 → zBottom 2500 > topMm 2300) κατατάσσεται
  // 'hidden' από το view range. Ο BeamRenderer το χαρτογραφεί σε 'projection' ώστε
  // να δείχνει το πορτοκαλί DASHED outline αντί για lineWidthPx:0 (αόρατο). Κλειδώνει
  // το fix του Giorgio: το preview/committed δοκάρι στην οροφή φαίνεται με περίγραμμα.
  function makeOverheadBeam(): BeamEntity {
    return {
      ...makeBeam(),
      params: {
        ...(makeBeam().params),
        topElevation: 3000, depth: 500,
        startPoint: { x: 0, y: 0, z: 3000 },
        endPoint: { x: 5000, y: 0, z: 3000 },
      },
    } as unknown as BeamEntity;
  }

  it('6. overhead-hidden beam (zBottom > topMm) → dashed [8,4] outline (όχι αόρατο solid)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeOverheadBeam() as unknown as EntityModel, {});
    // 'projection' mapping → 'hidden-lines' sub default dashed· χωρίς το fix το
    // cutState='hidden' θα έδινε linePattern:'solid' → setLineDash([]) + lineWidthPx:0.
    expect(lineDashCalls(mock.calls)).toContain('[8,4]');
  });
});
