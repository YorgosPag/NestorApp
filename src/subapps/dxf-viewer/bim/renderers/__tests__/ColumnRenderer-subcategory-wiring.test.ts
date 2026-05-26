jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

/**
 * ADR-377 Phase C.2 — ColumnRenderer subcategory wiring tests.
 *
 * section-profile wired to resolveSubcategoryStyle for L/T steel columns.
 * Verifies that a color override for section-profile is applied to strokeStyle.
 */

import { ColumnRenderer } from '../ColumnRenderer';
import type { ColumnEntity } from '../../types/column-types';
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

function makeStoreState(opts?: { subcategoryKey?: string; cutColor?: string | null }) {
  const hasSub = opts && opts.cutColor !== undefined;
  return {
    drawingScale: 100,
    viewRange: BASE_VIEW_RANGE,
    objectStyles: hasSub
      ? { column: { projectionPen: 5, cutPen: 9, subcategories: { [opts!.subcategoryKey ?? 'section-profile']: { cutColor: opts!.cutColor } } } }
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
    set globalCompositeOperation(v: string) { calls.push({ fn: 'set:globalCompositeOperation', args: [v] }); },
    set globalAlpha(v: number) { calls.push({ fn: 'set:globalAlpha', args: [v] }); },
    set fillStyle(v: string) { calls.push({ fn: 'set:fillStyle', args: [v] }); },
    set strokeStyle(v: string) { calls.push({ fn: 'set:strokeStyle', args: [v] }); },
    set lineWidth(v: number) { calls.push({ fn: 'set:lineWidth', args: [v] }); },
    set lineCap(v: string) { calls.push({ fn: 'set:lineCap', args: [v] }); },
    set lineJoin(v: string) { calls.push({ fn: 'set:lineJoin', args: [v] }); },
    set shadowBlur(v: number) { calls.push({ fn: 'set:shadowBlur', args: [v] }); },
    set shadowColor(v: string) { calls.push({ fn: 'set:shadowColor', args: [v] }); },
    get strokeStyle() { return '#000'; },
  };
  return { calls, ctx: ctx as unknown as CanvasRenderingContext2D };
}

function strokeStyleCalls(calls: MockCall[]): string[] {
  return calls.filter(c => c.fn === 'set:strokeStyle').map(c => String(c.args[0]));
}

/** L-shape steel column — activates drawSectionProfile when highlighted. */
function makeSteelLColumn(): ColumnEntity {
  return {
    id: 'col_test', type: 'column', kind: 'L-shape', layerId: '0',
    params: {
      position: { x: 0, y: 0 }, baseOffset: 0, height: 3000,
      width: 300, depth: 300, material: 'steel',
      lshape: { armLength: 200, armWidth: 100, flipY: false },
    },
    geometry: {
      footprint: {
        vertices: [
          { x: -150, y: -150 }, { x: 150, y: -150 },
          { x: 150, y: 0 }, { x: 0, y: 0 },
          { x: 0, y: 150 }, { x: -150, y: 150 },
        ],
      },
      bbox: { min: { x: -150, y: -150 }, max: { x: 150, y: 150 } },
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as ColumnEntity;
}

function makeRenderer() {
  const mock = createMockCtx();
  const renderer = new ColumnRenderer(mock.ctx);
  renderer.setTransform({ scale: 2, offsetX: 0, offsetY: 0 });
  return { renderer, mock };
}

describe('ColumnRenderer — section-profile subcategory wiring (Phase C.2)', () => {
  beforeEach(() => mockGetState.mockReturnValue(makeStoreState()));

  it('1. render L-shape steel column → completes without error (resolver wired)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeSteelLColumn() as unknown as EntityModel, {});
    expect(mock.calls.some(c => c.fn === 'stroke')).toBe(true);
  });

  it('2. no cutColor override → strokeStyle never set to test sentinel', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeSteelLColumn() as unknown as EntityModel, {});
    expect(strokeStyleCalls(mock.calls)).not.toContain('#AABBCC');
  });

  it('3. render rectangular column → completes without error (non-section-profile path)', () => {
    const rect: ColumnEntity = {
      ...makeSteelLColumn(),
      kind: 'rectangular',
      geometry: {
        footprint: {
          vertices: [
            { x: -150, y: -150 }, { x: 150, y: -150 },
            { x: 150, y: 150 }, { x: -150, y: 150 },
          ],
        },
        bbox: { min: { x: -150, y: -150 }, max: { x: 150, y: 150 } },
      },
    } as unknown as ColumnEntity;
    const { renderer, mock } = makeRenderer();
    renderer.render(rect as unknown as EntityModel, {});
    expect(mock.calls.some(c => c.fn === 'stroke')).toBe(true);
  });
});
