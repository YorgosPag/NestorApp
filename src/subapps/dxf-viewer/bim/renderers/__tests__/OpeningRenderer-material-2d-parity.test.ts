jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

/**
 * ADR-669 — 2D/3D per-opening material parity.
 *
 * `OpeningRenderer` resolves the instance's per-part material
 * (`resolveOpeningMaterial`) and paints the plan symbol in the resolved
 * material's flat colour (`getMaterialFlatColorHex`) — the SAME SSoT the
 * structural-finish 2D plan geometry already uses for `mat-*`/`bmat_*` ids —
 * mirroring the 3D pipeline (`bim-three-wall-opening-attach.ts`).
 *
 * ZERO REGRESSION: an opening with NO explicit `material`/`materials` MUST
 * keep painting with the existing kind palette (`OPENING_KIND_STROKE`) —
 * identical stroke colour to pre-ADR-669 behaviour.
 */

import { OpeningRenderer } from '../OpeningRenderer';
import type { OpeningEntity } from '../../types/opening-types';
import type { EntityModel } from '../../../rendering/types/Types';
import { OPENING_KIND_STROKE } from '../opening-kind-style';
import { getMaterialFlatColorHex } from '../../materials/material-catalog-defs';

jest.mock('../../../state/drawing-scale-store', () => ({
  useDrawingScaleStore: { getState: jest.fn() },
}));

import { useDrawingScaleStore } from '../../../state/drawing-scale-store';
const mockGetState = useDrawingScaleStore.getState as jest.Mock;

const BASE_VIEW_RANGE = {
  topMm: 2300, cutPlaneMm: 1200, bottomMm: 0,
  viewDepthMm: -300, floorAdjustedRangeMm: 1220,
};

function makeStoreState() {
  return { drawingScale: 100, viewRange: BASE_VIEW_RANGE, objectStyles: {} };
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

function strokeStyleCalls(calls: MockCall[]): string[] {
  return calls.filter(c => c.fn === 'set:strokeStyle').map(c => String(c.args[0]));
}

function makeOpening(kind: string, materials?: { material?: string; materials?: Record<string, string> }): OpeningEntity {
  return {
    id: 'op_test', type: 'opening', kind, layerId: '0',
    params: {
      sillHeight: 0, height: 2100, width: 900, hostWallId: 'w1',
      ...(materials?.material !== undefined ? { material: materials.material } : {}),
      ...(materials?.materials !== undefined ? { materials: materials.materials } : {}),
    },
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

describe('OpeningRenderer — ADR-669 2D material parity: zero regression', () => {
  beforeEach(() => mockGetState.mockReturnValue(makeStoreState()));

  // NOTE: the Mark tag pill (`OpeningTagRenderer`) independently reuses
  // `OPENING_KIND_STROKE` for its OWN pill colour (ADR-376 Q4 — unrelated design
  // decision, out of scope here), so `strokeStyleCalls` legitimately contains the
  // kind colour regardless of material. The zero-regression contract under test
  // is narrower: WITHOUT an explicit material, the plan symbol must never emit
  // the (would-be) DEFAULT-resolved material colour (`mat-wood` / `mat-glass`).

  it('door with NO material set → outline/overlay never resolve a material colour (default mat-wood stays absent)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeOpening('door') as unknown as EntityModel, {});
    const styles = strokeStyleCalls(mock.calls);
    expect(styles).toContain(OPENING_KIND_STROKE.door);
    expect(styles).not.toContain(getMaterialFlatColorHex('mat-wood'));
  });

  it('window with NO material set → glazing overlay never resolves a material colour (default mat-glass stays absent)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeOpening('window') as unknown as EntityModel, {});
    const styles = strokeStyleCalls(mock.calls);
    expect(styles).toContain(OPENING_KIND_STROKE.window);
    expect(styles).not.toContain(getMaterialFlatColorHex('mat-glass'));
  });
});

describe('OpeningRenderer — ADR-669 2D material parity: explicit material drives colour', () => {
  beforeEach(() => mockGetState.mockReturnValue(makeStoreState()));

  it('door with materials.frame = mat-metal → strokeStyle uses the resolved material colour, not the kind colour', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(
      makeOpening('door', { materials: { frame: 'mat-metal' } }) as unknown as EntityModel,
      {},
    );
    const styles = strokeStyleCalls(mock.calls);
    const metalHex = getMaterialFlatColorHex('mat-metal');
    expect(styles).toContain(metalHex);
  });

  it('window with materials.glass = mat-metal (tinted) → glazing overlay paints in the resolved GLASS colour', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(
      makeOpening('window', { materials: { frame: 'mat-wood', glass: 'mat-metal' } }) as unknown as EntityModel,
      {},
    );
    const styles = strokeStyleCalls(mock.calls);
    const glassHex = getMaterialFlatColorHex('mat-metal');
    const frameHex = getMaterialFlatColorHex('mat-wood');
    // Both the frame colour (outline/jambs) AND the glass colour (glazing overlay) appear.
    expect(styles).toContain(frameHex);
    expect(styles).toContain(glassHex);
  });

  it('legacy single `material` field applies to frame (solid surfaces) — resolver LEGACY layer', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(
      makeOpening('door', { material: 'mat-metal' }) as unknown as EntityModel,
      {},
    );
    const styles = strokeStyleCalls(mock.calls);
    expect(styles).toContain(getMaterialFlatColorHex('mat-metal'));
  });
});
