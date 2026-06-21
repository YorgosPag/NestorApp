/**
 * ADR-398 §4 / ADR-040 — PreviewRenderer reads the LIVE transform (world-locked).
 *
 * Bug: on a mouse-wheel zoom WITHOUT a mousemove, `drawPreview()` is never
 * re-called (it only fires on mousemove). Previously the renderer cached the
 * transform passed into `drawPreview`, so a scheduler repaint drew the ghost at
 * the OLD scale → frozen until the next mousemove.
 *
 * Fix (SSoT, same pattern as the main `dxf-canvas-renderer`): `render()` reads
 * the transform live from `getImmediateTransform()`, and `'preview-canvas'` is in
 * `TRANSFORM_CANVAS_IDS`, so `updateImmediateTransform` already marks it dirty.
 * The scheduler repaints the cached world-coord ghost at the new scale — no
 * re-snap, no extra subscription.
 */

// Break the heavy module-level import chain (BimPreviewRenderer → entity
// renderers → firebase, which needs `fetch`).
jest.mock('../bim-preview-render', () => ({ BimPreviewRenderer: class {} }));
jest.mock('../../../systems/cursor/ImmediateTransformStore', () => ({
  getImmediateTransform: jest.fn(() => ({ scale: 1, offsetX: 0, offsetY: 0 })),
}));

import { PreviewRenderer } from '../PreviewRenderer';
import { getImmediateTransform } from '../../../systems/cursor/ImmediateTransformStore';
import type { ExtendedSceneEntity } from '../../../hooks/drawing/useUnifiedDrawing';

const mockGetTransform = getImmediateTransform as jest.Mock;

const VP = { width: 800, height: 600 };
const LINE = {
  id: 'preview', type: 'line', start: { x: 0, y: 0 }, end: { x: 1000, y: 0 },
} as unknown as ExtendedSceneEntity;

function makeRenderer(): PreviewRenderer {
  const r = new PreviewRenderer();
  const ctx = new Proxy({}, {
    get: () => () => undefined, // every ctx method is a no-op
    set: () => true, // strokeStyle/fillStyle/… assignments ignored
  }) as unknown as CanvasRenderingContext2D;
  const canvas = {
    width: 800, height: 600, style: {},
    getContext: () => ctx,
    getBoundingClientRect: () => ({ width: 800, height: 600, top: 0, left: 0 }),
  } as unknown as HTMLCanvasElement;
  r.initialize(canvas);
  return r;
}

describe('PreviewRenderer — live transform (world-locked zoom, ADR-398 §4)', () => {
  beforeEach(() => {
    mockGetTransform.mockReset().mockReturnValue({ scale: 1, offsetX: 0, offsetY: 0 });
  });

  it('drawPreview signature is (entity, viewport, options) — no transform param', () => {
    const r = makeRenderer();
    expect(() => r.drawPreview(LINE, VP)).not.toThrow();
  });

  it('render() reads the LIVE transform from the SSoT (zero-lag, not cached)', () => {
    const r = makeRenderer();
    mockGetTransform.mockClear();
    r.render(); // no drawPreview yet → returns at viewport guard, AFTER reading transform
    expect(mockGetTransform).toHaveBeenCalledTimes(1);
  });

  it('repaints at the NEW scale on a scheduler frame with no mousemove (wheel-zoom)', () => {
    const r = makeRenderer();
    r.drawPreview(LINE, VP); // mousemove paint @ scale 1
    mockGetTransform.mockClear();

    // wheel-zoom: live transform changes, scheduler re-invokes render() — NO drawPreview
    mockGetTransform.mockReturnValue({ scale: 6, offsetX: 50, offsetY: 50 });
    r.render();
    expect(mockGetTransform).toHaveBeenCalled(); // read live → world-locked repaint @ scale 6
  });
});
