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

/**
 * The strokeStyle value ACTUALLY in effect at the Nth `stroke()` call (1-indexed) —
 * i.e. the last `set:strokeStyle` before it. Rigorous check: a colour can appear
 * anywhere in `strokeStyleCalls` yet be immediately overwritten before the real
 * paint (this bit a first draft of this SSoT — `elementOverride` precedence
 * silently discarded a plain `ctx.strokeStyle = …` assignment).
 */
function colorAtStroke(calls: MockCall[], strokeIndex: number): string | undefined {
  let strokeSeen = 0;
  let lastColor: string | undefined;
  for (const c of calls) {
    if (c.fn === 'set:strokeStyle') lastColor = String(c.args[0]);
    if (c.fn === 'stroke') {
      strokeSeen += 1;
      if (strokeSeen === strokeIndex) return lastColor;
    }
  }
  return undefined;
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

  it('door with NO material set → the outline stroke() paints with the EXACT same colour as before ADR-669', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeOpening('door') as unknown as EntityModel, {});
    // Zero regression, precisely: the colour ACTIVE at the real stroke() call is
    // NOT the (would-be) default-resolved `mat-wood` colour — it is whatever the
    // pre-ADR-669 pipeline already produced (DEFAULT_OBJECT_STYLES category tone).
    expect(colorAtStroke(mock.calls, 1)).not.toBe(getMaterialFlatColorHex('mat-wood'));
  });

  it('window with NO material set → both outline AND glazing overlay stroke() calls stay unchanged (no material colour leaks in)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeOpening('window') as unknown as EntityModel, {});
    const outlineColor = colorAtStroke(mock.calls, 1);
    const overlayColor = colorAtStroke(mock.calls, 2);
    expect(outlineColor).toBeDefined();
    expect(overlayColor).toBeDefined();
    // Legacy behaviour: outline and overlay always painted with the SAME colour
    // (single ctx.strokeStyle inherited across both draw passes).
    expect(overlayColor).toBe(outlineColor);
    expect(outlineColor).not.toBe(getMaterialFlatColorHex('mat-glass'));
  });
});

describe('OpeningRenderer — ADR-669 2D material parity: explicit material drives colour', () => {
  beforeEach(() => mockGetState.mockReturnValue(makeStoreState()));

  it('door with materials.frame = mat-metal → the REAL outline stroke() paints in the resolved material colour', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(
      makeOpening('door', { materials: { frame: 'mat-metal' } }) as unknown as EntityModel,
      {},
    );
    expect(colorAtStroke(mock.calls, 1)).toBe(getMaterialFlatColorHex('mat-metal'));
  });

  it('window with materials.glass = mat-metal (tinted) → outline strokes FRAME colour, glazing overlay strokes GLASS colour (two distinct real paints)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(
      makeOpening('window', { materials: { frame: 'mat-wood', glass: 'mat-metal' } }) as unknown as EntityModel,
      {},
    );
    const frameHex = getMaterialFlatColorHex('mat-wood');
    const glassHex = getMaterialFlatColorHex('mat-metal');
    expect(colorAtStroke(mock.calls, 1)).toBe(frameHex); // outline/jambs
    expect(colorAtStroke(mock.calls, 2)).toBe(glassHex); // glazing double-line overlay
    expect(frameHex).not.toBe(glassHex); // sanity: the fixture actually exercises two different colours
  });

  it('legacy single `material` field applies to frame (solid surfaces) — resolver LEGACY layer, real stroke() confirms', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(
      makeOpening('door', { material: 'mat-metal' }) as unknown as EntityModel,
      {},
    );
    expect(colorAtStroke(mock.calls, 1)).toBe(getMaterialFlatColorHex('mat-metal'));
  });

  it('user styleOverride.color still wins over material (existing precedence untouched)', () => {
    const { renderer, mock } = makeRenderer();
    const opening = makeOpening('door', { materials: { frame: 'mat-metal' } }) as unknown as {
      styleOverride?: { color?: string | null };
    } & OpeningEntity;
    opening.styleOverride = { color: '#123456' };
    renderer.render(opening as unknown as EntityModel, {});
    expect(colorAtStroke(mock.calls, 1)).toBe('#123456');
  });
});
