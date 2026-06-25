/**
 * ADR-398 §4 / ADR-040 Φ12 — useCanvasGhostPreview harness unit tests.
 *
 * Το harness κατέχει το copy-pasted scaffolding (~19 hooks): cursor-gate + RAF +
 * DPR-clear + canonical frame + snapped-cursor + clear-on-exit. Αυτά τα tests
 * κλειδώνουν το συμβόλαιο:
 *   - draw delegate παίρνει το canonical frame (viewport+transform από το SSoT)
 *   - DPR-clear γίνεται πριν το draw ('on-gate-exit') / ΟΧΙ ('skip-clear')
 *   - snapped cursor όταν useImmediateSnap
 *   - clear-on-exit όταν το gate κλείνει
 *   - cursorMode 'none' → effectiveCursor null, ΧΩΡΙΣ realtime subscription
 *   - ADR-040 Φ12: σύγχρονο redraw όταν αλλάζει το realtime effective-world (leading-edge,
 *     ΧΩΡΙΣ React re-render) + gating: idle → μηδέν realtime listener
 */

import { renderHook } from '@testing-library/react';
import { useCanvasGhostPreview } from '../useCanvasGhostPreview';
import { getCanonicalPreviewFrame } from '../../../systems/preview/ghost-preview-frame';
import {
  getRealtimeWorldCursor,
  subscribeRealtimeWorldCursor,
} from '../../../systems/cursor/ImmediatePositionStore';
import { getImmediateSnap } from '../../../systems/cursor/ImmediateSnapStore';

jest.mock('../../../systems/preview/ghost-preview-frame', () => ({
  getCanonicalPreviewFrame: jest.fn(),
}));
// ADR-040 Φ12 — the harness now reads the realtime effective-world cursor IMPERATIVELY
// (no useSyncExternalStore) and arms a synchronous redraw off `subscribeRealtimeWorldCursor`.
jest.mock('../../../systems/cursor/ImmediatePositionStore', () => ({
  getRealtimeWorldCursor: jest.fn(),
  subscribeRealtimeWorldCursor: jest.fn(),
}));
jest.mock('../../../systems/cursor/ImmediateSnapStore', () => ({
  getImmediateSnap: jest.fn(),
}));
// ADR-398 §4 — live transform SSoT: harness subscribes here for zero-lag redraw
// on mouse-wheel zoom/pan (no mousemove). Mock it so a test can fire the callback.
jest.mock('../../../systems/cursor/ImmediateTransformStore', () => ({
  subscribeTransform: jest.fn(),
}));

import { subscribeTransform } from '../../../systems/cursor/ImmediateTransformStore';

const mockFrame = getCanonicalPreviewFrame as jest.Mock;
const mockWorld = getRealtimeWorldCursor as jest.Mock;
const mockSubscribeWorld = subscribeRealtimeWorldCursor as jest.Mock;
const mockSnap = getImmediateSnap as jest.Mock;
const mockSubscribeTransform = subscribeTransform as jest.Mock;

// Synchronous RAF so the RAF-coalesced throttle's trailing flush runs inline.
let rafSpy: jest.SpyInstance;
beforeAll(() => {
  rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterAll(() => rafSpy.mockRestore());

interface MockCtx {
  calls: string[];
  ctx: CanvasRenderingContext2D;
}
function makeCanvas(): { canvas: HTMLCanvasElement; mock: MockCtx } {
  const calls: string[] = [];
  const ctx = {
    setTransform: (...a: number[]) => calls.push(`setTransform(${a.join(',')})`),
    clearRect: (...a: number[]) => calls.push(`clearRect(${a.join(',')})`),
  } as unknown as CanvasRenderingContext2D;
  const canvas = {
    width: 1000, height: 800,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
  return { canvas, mock: { calls, ctx } };
}

const TRANSFORM = { scale: 1, offsetX: 0, offsetY: 0 };
const CANON = { viewport: { width: 1000, height: 800 }, transform: { scale: 3, offsetX: 7, offsetY: 9 } };

beforeEach(() => {
  mockFrame.mockReset().mockReturnValue(CANON);
  mockWorld.mockReset().mockReturnValue({ x: 50, y: 60 });
  mockSnap.mockReset().mockReturnValue({ found: false, point: null });
  mockSubscribeTransform.mockReset().mockReturnValue(() => {});
  mockSubscribeWorld.mockReset().mockReturnValue(() => {});
});

describe('ADR-398 §4 / ADR-040 Φ12 — useCanvasGhostPreview', () => {
  it('passes the canonical frame (viewport+transform from SSoT) to the draw delegate', () => {
    const { canvas, mock } = makeCanvas();
    const draw = jest.fn();
    renderHook(() =>
      useCanvasGhostPreview({ isActive: true, getCanvas: () => canvas, transform: TRANSFORM, draw }),
    );
    expect(draw).toHaveBeenCalledTimes(1);
    const frame = draw.mock.calls[0][0];
    expect(frame.ctx).toBe(mock.ctx);
    expect(frame.viewport).toEqual(CANON.viewport);
    expect(frame.transform).toBe(CANON.transform); // LIVE transform, not the prop
    expect(frame.effectiveCursor).toEqual({ x: 50, y: 60 }); // live realtime world (raw)
  });

  it("DPR-clears before draw in 'on-gate-exit' mode", () => {
    const { canvas, mock } = makeCanvas();
    renderHook(() =>
      useCanvasGhostPreview({ isActive: true, getCanvas: () => canvas, transform: TRANSFORM, draw: jest.fn() }),
    );
    expect(mock.calls).toEqual([
      'setTransform(1,0,0,1,0,0)',
      'clearRect(0,0,1000,800)',
      expect.stringContaining('setTransform'),
    ]);
  });

  it("does NOT per-frame clear in 'skip-clear' mode", () => {
    const { canvas, mock } = makeCanvas();
    renderHook(() =>
      useCanvasGhostPreview({
        isActive: true, getCanvas: () => canvas, transform: TRANSFORM,
        clearMode: 'skip-clear', draw: jest.fn(),
      }),
    );
    expect(mock.calls).toEqual([]); // no clear; delegate draws layered
  });

  it('uses the snapped cursor when useImmediateSnap is set', () => {
    mockSnap.mockReturnValue({ found: true, point: { x: 111, y: 222 } });
    const { canvas } = makeCanvas();
    const draw = jest.fn();
    renderHook(() =>
      useCanvasGhostPreview({
        isActive: true, getCanvas: () => canvas, transform: TRANSFORM,
        useImmediateSnap: true, draw,
      }),
    );
    expect(draw.mock.calls[0][0].effectiveCursor).toEqual({ x: 111, y: 222 });
  });

  it("cursorMode 'none' → effectiveCursor null and NO realtime subscription", () => {
    const { canvas } = makeCanvas();
    const draw = jest.fn();
    renderHook(() =>
      useCanvasGhostPreview({
        isActive: true, getCanvas: () => canvas, transform: TRANSFORM,
        cursorMode: 'none', draw,
      }),
    );
    // No subscription to the 60fps world stream while 'none' (cursor comes via props).
    expect(mockSubscribeWorld).not.toHaveBeenCalled();
    expect(draw.mock.calls[0][0].effectiveCursor).toBeNull();
  });

  it('re-draws synchronously when the realtime effective-world changes (ADR-040 Φ12)', () => {
    let worldCb: (() => void) | null = null;
    mockSubscribeWorld.mockImplementation((cb: () => void) => {
      worldCb = cb;
      return () => { worldCb = null; };
    });
    const { canvas } = makeCanvas();
    const draw = jest.fn();
    renderHook(() =>
      useCanvasGhostPreview({ isActive: true, getCanvas: () => canvas, transform: TRANSFORM, draw }),
    );
    expect(draw).toHaveBeenCalledTimes(1); // initial paint
    expect(worldCb).not.toBeNull(); // subscribed to the realtime world SSoT

    mockWorld.mockReturnValue({ x: 70, y: 80 }); // simulate mousemove publishing new world
    worldCb!();
    expect(draw).toHaveBeenCalledTimes(2);
    expect(draw.mock.calls[1][0].effectiveCursor).toEqual({ x: 70, y: 80 });
  });

  it('does NOT subscribe to the realtime world while inactive (idle gating)', () => {
    const { canvas } = makeCanvas();
    const draw = jest.fn();
    renderHook(() =>
      useCanvasGhostPreview({ isActive: false, getCanvas: () => canvas, transform: TRANSFORM, draw }),
    );
    expect(mockSubscribeWorld).not.toHaveBeenCalled();
    expect(draw).not.toHaveBeenCalled();
  });

  it('re-draws on a live transform change (mouse-wheel zoom with no mousemove)', () => {
    let transformCb: (() => void) | null = null;
    mockSubscribeTransform.mockImplementation((cb: () => void) => {
      transformCb = cb;
      return () => { transformCb = null; };
    });
    const { canvas } = makeCanvas();
    const draw = jest.fn();
    renderHook(() =>
      useCanvasGhostPreview({ isActive: true, getCanvas: () => canvas, transform: TRANSFORM, draw }),
    );
    expect(draw).toHaveBeenCalledTimes(1); // initial paint
    expect(transformCb).not.toBeNull(); // subscribed to the transform SSoT

    transformCb!(); // simulate wheel-zoom: store notifies, cursor did NOT move
    expect(draw).toHaveBeenCalledTimes(2); // ghost re-painted in lockstep (Revit world-lock)
  });

  it('unsubscribes from the transform SSoT on unmount', () => {
    const unsub = jest.fn();
    mockSubscribeTransform.mockReturnValue(unsub);
    const { canvas } = makeCanvas();
    const { unmount } = renderHook(() =>
      useCanvasGhostPreview({ isActive: true, getCanvas: () => canvas, transform: TRANSFORM, draw: jest.fn() }),
    );
    unmount();
    expect(unsub).toHaveBeenCalledTimes(1);
  });

  it('does not draw while inactive, and clears on exit transition', () => {
    const { canvas, mock } = makeCanvas();
    const draw = jest.fn();
    const { rerender } = renderHook(
      ({ active }: { active: boolean }) =>
        useCanvasGhostPreview({ isActive: active, getCanvas: () => canvas, transform: TRANSFORM, draw }),
      { initialProps: { active: true } },
    );
    expect(draw).toHaveBeenCalledTimes(1);
    mock.calls.length = 0;

    rerender({ active: false });
    // gate closed → clear-on-exit fired, delegate not called again
    expect(draw).toHaveBeenCalledTimes(1);
    expect(mock.calls).toEqual([
      'setTransform(1,0,0,1,0,0)',
      'clearRect(0,0,1000,800)',
      expect.stringContaining('setTransform'),
    ]);
  });
});
