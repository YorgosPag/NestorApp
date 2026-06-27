// Dim renderer transitively pulls config that may import firebase — stub it.
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

/**
 * ADR-544 — paintPlacement3DOverlay routing: κάθε overlay πεδίο του meta δρομολογεί τον αντίστοιχο
 * 2D painter μέσω του `project`. Άδειο meta → μηδέν draw.
 */

import { paintPlacement3DOverlay } from '../placement-overlay-paint';
import type { Placement3DMeta } from '../../../stores/Placement3DOverlayStore';
import type { OverlayProjector } from '../../../../canvas-v2/preview-canvas/overlay-projector';
import type { PolarDiskGrid } from '../../../../bim/columns/polar-disk-snap';
import type { ViewTransform } from '../../../../rendering/types/Types';

interface MockCtxCall { fn: string; }
function createMockCtx(): { calls: MockCtxCall[]; ctx: CanvasRenderingContext2D } {
  const calls: MockCtxCall[] = [];
  const record = (fn: string) => () => { calls.push({ fn }); };
  const ctx = {
    canvas: { width: 800, height: 600 },
    save: record('save'), restore: record('restore'), beginPath: record('beginPath'),
    moveTo: record('moveTo'), lineTo: record('lineTo'), stroke: record('stroke'),
    fill: record('fill'), fillText: record('fillText'), arc: record('arc'),
    setLineDash: record('setLineDash'), measureText: () => ({ width: 10 }),
    set strokeStyle(_v: string) {}, set lineWidth(_v: number) {}, set lineCap(_v: string) {},
    set globalAlpha(_v: number) {}, set fillStyle(_v: string) {}, set font(_v: string) {},
    set textAlign(_v: string) {}, set textBaseline(_v: string) {},
  };
  return { calls, ctx: ctx as unknown as CanvasRenderingContext2D };
}

const IDENTITY: OverlayProjector = (p) => ({ x: p.x, y: p.y });
const TRANSFORM: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
const VIEWPORT = { width: 800, height: 600 };
const POLAR = { center: { x: 0, y: 0 }, rings: [100, 200], spokesDeg: [0, 90], outerR: 200 } as unknown as PolarDiskGrid;

const baseMeta = (over: Partial<Placement3DMeta>): Placement3DMeta => ({
  polarDiskGrid: null, rectGrid: null, faceDimensions: null, alignmentGuide: null,
  elevMm: 0, sceneUnits: 'mm', anchorScene: { x: 0, y: 0 }, ...over,
});

const count = (calls: MockCtxCall[], fn: string): number => calls.filter((c) => c.fn === fn).length;

describe('paintPlacement3DOverlay', () => {
  it('strokes the polar grid (rings + spokes + centre cross) when present', () => {
    const m = createMockCtx();
    paintPlacement3DOverlay(m.ctx, baseMeta({ polarDiskGrid: POLAR }), IDENTITY, TRANSFORM, VIEWPORT);
    expect(count(m.calls, 'stroke')).toBeGreaterThan(0);
  });

  it('strokes the alignment guide when present', () => {
    const m = createMockCtx();
    const guide = { a: { x: 0, y: 0 }, b: { x: 100, y: 0 } } as Placement3DMeta['alignmentGuide'];
    paintPlacement3DOverlay(m.ctx, baseMeta({ alignmentGuide: guide }), IDENTITY, TRANSFORM, VIEWPORT);
    expect(count(m.calls, 'stroke')).toBeGreaterThan(0);
  });

  it('draws nothing for an empty meta (all overlay fields null)', () => {
    const m = createMockCtx();
    paintPlacement3DOverlay(m.ctx, baseMeta({}), IDENTITY, TRANSFORM, VIEWPORT);
    expect(count(m.calls, 'stroke')).toBe(0);
  });
});
