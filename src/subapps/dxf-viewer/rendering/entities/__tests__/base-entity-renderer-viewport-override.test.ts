// Firebase auth chain reaches BaseEntityRenderer via PhaseManager → GripProvider
// → user-settings → firestore. Stub it before any imports execute so the test
// env doesn't need fetch / real firebase init. (Mirror DimensionRenderer.test.ts.)
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
 * ADR-398 — BaseEntityRenderer.setViewportOverride() unit test.
 *
 * Root cause of the beam-ghost +Y offset: the WYSIWYG BIM preview ghost is drawn
 * on the shared PreviewCanvas, but the real entity renderers measured the y-flip
 * against their OWN `ctx.canvas.getBoundingClientRect()` (the PreviewCanvas),
 * whose height diverges a few px from the canonical DxfCanvas / container rect
 * that the committed entity + column ghost use. The y-flip formula
 *   screenY = (viewport.height − top) − worldY·scale − offsetY
 * turns that height delta into a constant screen-Y offset.
 *
 * Fix: `setViewportOverride(viewport)` injects the canonical viewport for the
 * preview pass; `getViewport()` returns it instead of getBoundingClientRect.
 * `null` restores the default (zero regression on the main render path).
 *
 * These tests assert exactly that contract on `worldToScreen`.
 */

import type { EntityModel, RenderOptions, GripInfo, Point2D, Viewport } from '../../types/Types';
import { BaseEntityRenderer } from '../BaseEntityRenderer';
import { CoordinateTransforms } from '../../core/CoordinateTransforms';

// Minimal concrete subclass exposing the protected worldToScreen for assertions.
class TestRenderer extends BaseEntityRenderer {
  render(): void {
    /* not exercised */
  }
  getGrips(): GripInfo[] {
    return [];
  }
  hitTest(_e: EntityModel, _p: Point2D, _t: number): boolean {
    return false;
  }
  public wts(p: Point2D): Point2D {
    return this.worldToScreen(p);
  }
}

function makeCtx(canvasRectHeight: number): CanvasRenderingContext2D {
  const canvas = {
    width: 800,
    height: canvasRectHeight,
    getBoundingClientRect: () => ({
      width: 800,
      height: canvasRectHeight,
      top: 0,
      left: 0,
      right: 800,
      bottom: canvasRectHeight,
    }),
  };
  return { canvas } as unknown as CanvasRenderingContext2D;
}

describe('ADR-398 — BaseEntityRenderer.setViewportOverride', () => {
  const transform = { scale: 1, offsetX: 0, offsetY: 0 };
  const worldPoint: Point2D = { x: 100, y: 200 };

  // PreviewCanvas rect (what the renderer reads by default) vs the canonical
  // DxfCanvas/container rect — diverge by 7px, the kind of few-px gap that
  // produced the visible +Y offset.
  const PREVIEW_CANVAS_HEIGHT = 593;
  const CANONICAL: Viewport = { width: 800, height: 600 };

  it('defaults to its own canvas getBoundingClientRect when no override is set', () => {
    const r = new TestRenderer(makeCtx(PREVIEW_CANVAS_HEIGHT));
    r.setTransform(transform);
    const expected = CoordinateTransforms.worldToScreen(worldPoint, transform, {
      width: 800,
      height: PREVIEW_CANVAS_HEIGHT,
    });
    expect(r.wts(worldPoint)).toEqual(expected);
  });

  it('uses the injected canonical viewport when an override is set', () => {
    const r = new TestRenderer(makeCtx(PREVIEW_CANVAS_HEIGHT));
    r.setTransform(transform);
    r.setViewportOverride(CANONICAL);
    const expected = CoordinateTransforms.worldToScreen(worldPoint, transform, CANONICAL);
    expect(r.wts(worldPoint)).toEqual(expected);
  });

  it('shifts screen-Y by exactly the height delta (the +Y offset signature)', () => {
    const r = new TestRenderer(makeCtx(PREVIEW_CANVAS_HEIGHT));
    r.setTransform(transform);
    const withoutOverride = r.wts(worldPoint).y;
    r.setViewportOverride(CANONICAL);
    const withOverride = r.wts(worldPoint).y;
    // screenY = (height − top) − worldY·scale − offsetY ⇒ Δy = Δheight.
    expect(withOverride - withoutOverride).toBeCloseTo(
      CANONICAL.height - PREVIEW_CANVAS_HEIGHT,
      6,
    );
  });

  it('restores default getBoundingClientRect behaviour when cleared with null', () => {
    const r = new TestRenderer(makeCtx(PREVIEW_CANVAS_HEIGHT));
    r.setTransform(transform);
    r.setViewportOverride(CANONICAL);
    r.setViewportOverride(null);
    const expected = CoordinateTransforms.worldToScreen(worldPoint, transform, {
      width: 800,
      height: PREVIEW_CANVAS_HEIGHT,
    });
    expect(r.wts(worldPoint)).toEqual(expected);
  });
});
