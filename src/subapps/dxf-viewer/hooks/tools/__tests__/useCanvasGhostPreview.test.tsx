/**
 * ADR-398 §4 — useCanvasGhostPreview harness unit tests.
 *
 * Το harness κατέχει το copy-pasted scaffolding (~19 hooks): cursor-gate + RAF +
 * DPR-clear + canonical frame + snapped-cursor + clear-on-exit. Αυτά τα tests
 * κλειδώνουν το συμβόλαιο:
 *   - draw delegate παίρνει το canonical frame (viewport+transform από το SSoT)
 *   - DPR-clear γίνεται πριν το draw ('on-gate-exit') / ΟΧΙ ('skip-clear')
 *   - snapped cursor όταν useImmediateSnap
 *   - clear-on-exit όταν το gate κλείνει
 *   - cursorMode 'none' → effectiveCursor null, χωρίς cursor subscription
 */

import { renderHook } from '@testing-library/react';
import { useCanvasGhostPreview } from '../useCanvasGhostPreview';
import { getCanonicalPreviewFrame } from '../../../systems/preview/ghost-preview-frame';
import { useCursorWorldPosition } from '../../../systems/cursor/useCursor';
import { getImmediateSnap } from '../../../systems/cursor/ImmediateSnapStore';

jest.mock('../../../systems/preview/ghost-preview-frame', () => ({
  getCanonicalPreviewFrame: jest.fn(),
}));
jest.mock('../../../systems/cursor/useCursor', () => ({
  useCursorWorldPosition: jest.fn(),
}));
jest.mock('../../../systems/cursor/ImmediateSnapStore', () => ({
  getImmediateSnap: jest.fn(),
}));

const mockFrame = getCanonicalPreviewFrame as jest.Mock;
const mockCursor = useCursorWorldPosition as jest.Mock;
const mockSnap = getImmediateSnap as jest.Mock;

// Synchronous RAF so drawFrame runs within the effect commit.
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
  mockCursor.mockReset().mockReturnValue({ x: 50, y: 60 });
  mockSnap.mockReset().mockReturnValue({ found: false, point: null });
});

describe('ADR-398 §4 — useCanvasGhostPreview', () => {
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

  it("cursorMode 'none' → effectiveCursor null and no cursor subscription", () => {
    const { canvas } = makeCanvas();
    const draw = jest.fn();
    renderHook(() =>
      useCanvasGhostPreview({
        isActive: true, getCanvas: () => canvas, transform: TRANSFORM,
        cursorMode: 'none', draw,
      }),
    );
    // useCursorWorldPosition called with `false` (no subscription while 'none')
    expect(mockCursor).toHaveBeenCalledWith(false);
    expect(draw.mock.calls[0][0].effectiveCursor).toBeNull();
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
