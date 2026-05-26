jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

/**
 * ADR-377 Phase C.3 — StairRenderer subcategory wiring tests.
 *
 * walkline  → 'walkline'  subcategory (default: dashed)
 * handrails → 'handrails' subcategory (default: dashed2)
 * treads    → 'treads'    subcategory (lineWidthPx flows into scx)
 * stringers → 'outlines'  subcategory (lineWidthPx flows into scx)
 */

import { StairRenderer } from '../StairRenderer';
import type { StairEntity } from '../../types/stair-types';
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
      ? { stair: { projectionPen: 3, cutPen: 5, subcategories: { [opts!.subcategoryKey ?? 'walkline']: subEntry } } }
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
    get font() { return '10px sans-serif'; }, set font(_v: string) {},
    get textAlign() { return 'left'; }, set textAlign(_v: string) {},
    get textBaseline() { return 'alphabetic'; }, set textBaseline(_v: string) {},
    fillText: record('fillText'), measureText: () => ({ width: 50 }),
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

function makeStair(): StairEntity {
  const tread = [
    { x: 0, y: 0, z: 0 }, { x: 900, y: 0, z: 0 },
    { x: 900, y: 270, z: 0 }, { x: 0, y: 270, z: 0 },
  ];
  return {
    id: 'stair_test', type: 'stair', layerId: '0',
    params: {
      basePoint: { x: 0, y: 0, z: 0 },
      totalRise: 3000, direction: 0, tread: 270,
      structureType: 'monolithic',
      handrails: { inner: false, outer: false },
      treadLabelDisplay: 'none',
      codeProfile: 'standard',
    },
    geometry: {
      treadsBelowCut: [tread],
      treadLabels: [],
      walkline: [
        { x: 450, y: 0, z: 0 }, { x: 450, y: 2700, z: 0 },
      ],
      stringers: {
        inner: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 2700, z: 0 }],
        outer: [{ x: 900, y: 0, z: 0 }, { x: 900, y: 2700, z: 0 }],
      },
      arrowSymbol: {
        start: { x: 450, y: 0, z: 0 },
        end: { x: 450, y: 500, z: 0 },
        label: 'UP' as const,
      },
      bbox: { min: { x: 0, y: 0 }, max: { x: 900, y: 2700 } },
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as StairEntity;
}

function makeRenderer() {
  const mock = createMockCtx();
  const renderer = new StairRenderer(mock.ctx);
  renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  return { renderer, mock };
}

describe('StairRenderer — walkline subcategory wiring (Phase C.3)', () => {
  beforeEach(() => mockGetState.mockReturnValue(makeStoreState()));

  it('1. default store → walkline setLineDash uses dashed [8,4] (DEFAULT_OBJECT_STYLES)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeStair() as unknown as EntityModel, {});
    expect(lineDashCalls(mock.calls)).toContain('[8,4]');
  });

  it('2. walkline linePattern solid → setLineDash gets []', () => {
    mockGetState.mockReturnValue(makeStoreState({ subcategoryKey: 'walkline', linePattern: 'solid' }));
    const { renderer, mock } = makeRenderer();
    renderer.render(makeStair() as unknown as EntityModel, {});
    expect(lineDashCalls(mock.calls)).toContain('[]');
  });

  it('3. walkline linePattern hidden → setLineDash gets [4,2]', () => {
    mockGetState.mockReturnValue(makeStoreState({ subcategoryKey: 'walkline', linePattern: 'hidden' }));
    const { renderer, mock } = makeRenderer();
    renderer.render(makeStair() as unknown as EntityModel, {});
    expect(lineDashCalls(mock.calls)).toContain('[4,2]');
  });
});

describe('StairRenderer — handrails subcategory wiring (Phase C.3)', () => {
  it('4. default store → handrails uses dashed2 [4,2] (DEFAULT_OBJECT_STYLES)', () => {
    mockGetState.mockReturnValue(makeStoreState());
    const { renderer, mock } = makeRenderer();
    const stairWithHandrails = {
      ...makeStair(),
      params: { ...makeStair().params, handrails: { inner: true, outer: true } },
    } as unknown as StairEntity;
    renderer.render(stairWithHandrails as unknown as EntityModel, {});
    expect(lineDashCalls(mock.calls)).toContain('[4,2]');
  });

  it('5. handrails linePattern solid override → setLineDash gets []', () => {
    mockGetState.mockReturnValue(makeStoreState({ subcategoryKey: 'handrails', linePattern: 'solid' }));
    const { renderer, mock } = makeRenderer();
    const stairWithHandrails = {
      ...makeStair(),
      params: { ...makeStair().params, handrails: { inner: true, outer: false } },
    } as unknown as StairEntity;
    renderer.render(stairWithHandrails as unknown as EntityModel, {});
    expect(lineDashCalls(mock.calls)).toContain('[]');
  });
});
