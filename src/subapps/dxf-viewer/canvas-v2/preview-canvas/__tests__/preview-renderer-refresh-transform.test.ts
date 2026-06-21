/**
 * ADR-398 §4 / ADR-040 — PreviewRenderer.refreshTransform (world-locked zoom).
 *
 * Bug: when the user zooms with the mouse wheel WITHOUT moving the cursor, the
 * transform changes but `drawPreview()` is never re-called (it only fires on
 * mousemove). The cached ghost froze at its old scale until the next mousemove.
 *
 * Fix: `refreshTransform()` re-paints the SAME cached world-coord entity with the
 * new transform — locked to its world point, correctly rescaled, NO re-snap.
 * These tests lock that contract:
 *   - no cached ghost → no-op (bare pan/zoom over empty canvas is free)
 *   - cached ghost → re-painted with the new transform, SAME entity (no re-snap)
 */

// Break the heavy module-level import chain (BimPreviewRenderer → entity
// renderers → firebase, which needs `fetch`). These tests mock `render()`, so the
// real renderers are never exercised — only the refreshTransform cache contract.
jest.mock('../bim-preview-render', () => ({ BimPreviewRenderer: class {} }));

import { PreviewRenderer } from '../PreviewRenderer';
import type { ExtendedSceneEntity } from '../../../hooks/drawing/useUnifiedDrawing';
import type { ViewTransform } from '../../../rendering/types/Types';

describe('PreviewRenderer.refreshTransform — world-locked zoom (ADR-398 §4)', () => {
  // Mock render() so the contract is tested without a real canvas/ctx pipeline.
  let renderSpy: jest.SpyInstance;
  beforeEach(() => {
    renderSpy = jest.spyOn(PreviewRenderer.prototype, 'render').mockImplementation(() => {});
  });
  afterEach(() => renderSpy.mockRestore());

  const VP = { width: 800, height: 600 };
  const T1: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  const T2: ViewTransform = { scale: 4, offsetX: 120, offsetY: -50 };
  const LINE = {
    id: 'preview', type: 'line', start: { x: 0, y: 0 }, end: { x: 1000, y: 0 },
  } as unknown as ExtendedSceneEntity;

  function internals(r: PreviewRenderer) {
    return r as unknown as {
      currentTransform: ViewTransform | null;
      currentPreview: ExtendedSceneEntity | null;
    };
  }

  it('is a no-op when no ghost is cached (bare pan/zoom over empty canvas)', () => {
    const r = new PreviewRenderer();
    renderSpy.mockClear();
    r.refreshTransform(T2, VP);
    expect(renderSpy).not.toHaveBeenCalled();
    expect(internals(r).currentTransform).toBeNull();
  });

  it('re-paints the SAME cached entity with the new transform (no re-snap)', () => {
    const r = new PreviewRenderer();
    r.drawPreview(LINE, T1, VP); // mousemove paint
    expect(internals(r).currentTransform).toBe(T1);
    renderSpy.mockClear();

    r.refreshTransform(T2, VP); // wheel-zoom, no mousemove
    expect(renderSpy).toHaveBeenCalledTimes(1); // re-painted (was frozen before the fix)
    expect(internals(r).currentTransform).toBe(T2); // new transform applied
    expect(internals(r).currentPreview).toBe(LINE); // SAME entity → world-locked, no re-snap
  });

  it('keeps following successive zoom steps without a mousemove in between', () => {
    const r = new PreviewRenderer();
    r.drawPreview(LINE, T1, VP);
    renderSpy.mockClear();

    r.refreshTransform(T2, VP);
    const T3: ViewTransform = { scale: 9, offsetX: 5, offsetY: 5 };
    r.refreshTransform(T3, VP);

    expect(renderSpy).toHaveBeenCalledTimes(2);
    expect(internals(r).currentTransform).toBe(T3);
    expect(internals(r).currentPreview).toBe(LINE);
  });
});
