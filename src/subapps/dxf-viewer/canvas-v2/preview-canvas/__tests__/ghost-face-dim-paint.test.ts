// Dim text renderer transitively pulls config that may import firebase — stub it
// (same guard as preview-dimension-renderer.test.ts).
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

/**
 * ADR-508 §dim — ghost-face-dim-paint smoke tests. Verifies the pure dims → 2D dimension
 * SSoT (`renderPreviewDimension`) chain: 3 along-face dims paint without throwing and emit
 * stroke + text per dim.
 */

import { paintGhostFaceDimensions } from '../ghost-face-dim-paint';
import { resolveGhostFaceDimensions } from '../../../bim/framing/ghost-face-dim-references';
import type { GhostFaceFrame } from '../../../bim/framing/linear-member-face-snap';

interface MockCtxCall { fn: string; args: readonly unknown[]; }
interface MockCtx { calls: MockCtxCall[]; ctx: CanvasRenderingContext2D; }

function createMockCtx(width = 800, height = 600): MockCtx {
  const calls: MockCtxCall[] = [];
  const record = (fn: string) => (...args: unknown[]): unknown => { calls.push({ fn, args }); return undefined; };
  const ctxStub = {
    canvas: { width, height },
    save: record('save'), restore: record('restore'), beginPath: record('beginPath'),
    moveTo: record('moveTo'), lineTo: record('lineTo'), closePath: record('closePath'),
    stroke: record('stroke'), fill: record('fill'), fillText: record('fillText'),
    fillRect: record('fillRect'),
    measureText: () => ({ width: 10 }), arc: record('arc'), translate: record('translate'),
    rotate: record('rotate'), scale: record('scale'), setLineDash: record('setLineDash'),
    setTransform: record('setTransform'), clearRect: record('clearRect'), rect: record('rect'),
    set fillStyle(v: string) { calls.push({ fn: 'set:fillStyle', args: [v] }); },
    set strokeStyle(v: string) { calls.push({ fn: 'set:strokeStyle', args: [v] }); },
    set lineWidth(v: number) { calls.push({ fn: 'set:lineWidth', args: [v] }); },
    set lineCap(v: string) { calls.push({ fn: 'set:lineCap', args: [v] }); },
    set globalAlpha(v: number) { calls.push({ fn: 'set:globalAlpha', args: [v] }); },
    set font(v: string) { calls.push({ fn: 'set:font', args: [v] }); },
    set textAlign(v: string) { calls.push({ fn: 'set:textAlign', args: [v] }); },
    set textBaseline(v: string) { calls.push({ fn: 'set:textBaseline', args: [v] }); },
  };
  return { calls, ctx: ctxStub as unknown as CanvasRenderingContext2D };
}

const countCalls = (m: MockCtx, fn: string): number => m.calls.filter((c) => c.fn === fn).length;

/** Horizontal wall, ghost left of centre → 3 dims (left/right gap + centre). */
const FRAME: GhostFaceFrame = {
  origin: { x: 0, y: 0 }, axisDir: { x: 1, y: 0 }, perpDir: { x: 0, y: -1 },
  facePerp: 0, outwardSign: -1, faceAlongMin: 0, faceAlongMax: 4000,
  ghostCenterAlong: 1200, ghostHalfWidth: 100,
};

describe('paintGhostFaceDimensions', () => {
  it('paints all 3 along-face dims (stroke + text) without throwing', () => {
    const dims = resolveGhostFaceDimensions(FRAME, { gapOffsetScene: 24, centerOffsetScene: 52 });
    expect(dims).toHaveLength(3);
    const mock = createMockCtx();
    expect(() =>
      paintGhostFaceDimensions(
        mock.ctx,
        { sceneUnits: 'mm', dims },
        { scale: 1, offsetX: 0, offsetY: 0 },
        { width: 800, height: 600 },
      ),
    ).not.toThrow();
    expect(countCalls(mock, 'stroke')).toBeGreaterThan(0);
    expect(countCalls(mock, 'fillText')).toBeGreaterThan(0);
    // Overlay-line SSoT applied: 0.5px dashed [8,5] reaches the dim lines.
    expect(mock.calls.some((c) => c.fn === 'set:lineWidth' && c.args[0] === 0.5)).toBe(true);
    expect(mock.calls.some((c) => c.fn === 'setLineDash'
      && Array.isArray(c.args[0]) && (c.args[0] as number[]).join(',') === '8,5')).toBe(true);
  });

  it('is a no-op (no stroke) when there are no dims', () => {
    const mock = createMockCtx();
    paintGhostFaceDimensions(
      mock.ctx,
      { sceneUnits: 'mm', dims: [] },
      { scale: 1, offsetX: 0, offsetY: 0 },
      { width: 800, height: 600 },
    );
    expect(countCalls(mock, 'stroke')).toBe(0);
  });
});
