jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

/**
 * ADR-377 Phase C.3 — OpeningRenderer subcategory wiring tests.
 *
 * door   → door-opening (outline) + door-plan-swing (overlay)
 * window → window-opening (outline) + window-glass (overlay)
 * wall-cutout → wall-cutout-jambs (outline)
 * sliding-door → door-opening (outline) + sliding-track (overlay)
 */

import { OpeningRenderer } from '../OpeningRenderer';
import type { OpeningEntity } from '../../types/opening-types';
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
      ? { opening: { projectionPen: 3, cutPen: 4, subcategories: { [opts!.subcategoryKey ?? 'door-opening']: subEntry } } }
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
    get strokeStyle() { return '#000'; },
    set strokeStyle(v: string) { calls.push({ fn: 'set:strokeStyle', args: [v] }); },
    set globalAlpha(v: number) { calls.push({ fn: 'set:globalAlpha', args: [v] }); },
    set fillStyle(v: string) { calls.push({ fn: 'set:fillStyle', args: [v] }); },
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

function makeOpening(kind: string): OpeningEntity {
  return {
    id: 'op_test', type: 'opening', kind, layerId: '0',
    params: { sillHeight: 0, height: 2100, width: 900, hostWallId: 'w1' },
    geometry: {
      outline: {
        vertices: [
          { x: 0, y: -450, z: 0 }, { x: 900, y: -450, z: 0 },
          { x: 900, y: 450, z: 0 }, { x: 0, y: 450, z: 0 },
        ],
      },
      hingeArc: null,
      hingeAnchor: null,
      hingeAnchor2: null,
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as OpeningEntity;
}

function makeRenderer() {
  const mock = createMockCtx();
  const renderer = new OpeningRenderer(mock.ctx);
  renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  return { renderer, mock };
}

describe('OpeningRenderer — door-opening subcategory wiring (Phase C.3)', () => {
  beforeEach(() => mockGetState.mockReturnValue(makeStoreState()));

  it('1. default store → setLineDash contains [] (solid default)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeOpening('door') as unknown as EntityModel, {});
    expect(lineDashCalls(mock.calls)).toContain('[]');
  });

  it('2. door-opening linePattern dashed → setLineDash gets [8,4]', () => {
    mockGetState.mockReturnValue(makeStoreState({ subcategoryKey: 'door-opening', linePattern: 'dashed' }));
    const { renderer, mock } = makeRenderer();
    renderer.render(makeOpening('door') as unknown as EntityModel, {});
    expect(lineDashCalls(mock.calls)).toContain('[8,4]');
  });

  it('3. door-opening cutColor → strokeStyle overridden with that color', () => {
    mockGetState.mockReturnValue(makeStoreState({ subcategoryKey: 'door-opening', cutColor: '#CC0011' }));
    const { renderer, mock } = makeRenderer();
    renderer.render(makeOpening('door') as unknown as EntityModel, {});
    expect(strokeStyleCalls(mock.calls)).toContain('#CC0011');
  });

  it('4. no color override → strokeStyle never set to #CC0011', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeOpening('door') as unknown as EntityModel, {});
    expect(strokeStyleCalls(mock.calls)).not.toContain('#CC0011');
  });
});

describe('OpeningRenderer — window-opening subcategory wiring (Phase C.3)', () => {
  it('5. window-opening cutColor → strokeStyle overridden', () => {
    mockGetState.mockReturnValue(makeStoreState({ subcategoryKey: 'window-opening', cutColor: '#00AAFF' }));
    const { renderer, mock } = makeRenderer();
    renderer.render(makeOpening('window') as unknown as EntityModel, {});
    expect(strokeStyleCalls(mock.calls)).toContain('#00AAFF');
  });
});

describe('OpeningRenderer — wall-cutout-jambs subcategory wiring (Phase C.3)', () => {
  it('6. wall-cutout-jambs linePattern dashed → setLineDash gets [8,4]', () => {
    mockGetState.mockReturnValue(makeStoreState({ subcategoryKey: 'wall-cutout-jambs', linePattern: 'dashed' }));
    const { renderer, mock } = makeRenderer();
    renderer.render(makeOpening('wall-cutout') as unknown as EntityModel, {});
    expect(lineDashCalls(mock.calls)).toContain('[8,4]');
  });
});
