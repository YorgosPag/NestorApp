/**
 * ADR-543 — wall HUD projector seam tests.
 *
 * `paintWallHudCore` is the ONE layout SSoT shared by the 2D canvas and the 3D
 * overlay; the projection + aligned-dim primitive are injected. These tests verify
 * the core delegates to the injected projector (so 3D reuses the exact 2D layout)
 * and that the projected aligned-dim primitive strokes the dim line + 2 extension
 * lines + a label.
 */

import { paintWallHudCore, paintProjectedAlignedDim, type WallHudMeta } from '../wall-hud-paint';
import type { Point2D } from '../../../rendering/types/Types';

/** Permissive Canvas2D mock — records nothing we assert on, just must not throw. */
function fakeCtx(): CanvasRenderingContext2D {
  const noop = () => {};
  return new Proxy(
    { measureText: () => ({ width: 10 }) } as unknown as CanvasRenderingContext2D,
    {
      get(target, prop) {
        if (prop in target) return (target as Record<string, unknown>)[prop as string];
        return noop;
      },
      set() {
        return true;
      },
    },
  );
}

const META: WallHudMeta = {
  start: { x: 0, y: 0 },
  end: { x: 1000, y: 0 },
  lengthMm: 1000,
  angleDeg: 0,
  thicknessMm: 200,
  heightMm: 2800,
  sceneUnits: 'mm',
};

describe('paintWallHudCore — projector seam', () => {
  it('delegates the length dimension to the injected drawAlignedDim and projects the labels', () => {
    const drawAlignedDim = jest.fn();
    const toScreen = jest.fn((p: Point2D) => ({ x: p.x, y: p.y }));
    paintWallHudCore(fakeCtx(), META, '20 · 280', {
      toScreen,
      worldPerPixel: 1,
      drawAlignedDim,
    });
    // (1) aligned length dim between start and end, with a formatted label.
    expect(drawAlignedDim).toHaveBeenCalledTimes(1);
    const [p1, p2, , label] = drawAlignedDim.mock.calls[0];
    expect(p1).toEqual(META.start);
    expect(p2).toEqual(META.end);
    expect(typeof label).toBe('string');
    // (2)+(3) spec label + angle label each project a world point → toScreen ≥ 2.
    expect(toScreen.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('draws nothing for a degenerate (zero-length) wall', () => {
    const drawAlignedDim = jest.fn();
    const toScreen = jest.fn((p: Point2D) => p);
    paintWallHudCore(fakeCtx(), { ...META, end: { x: 0, y: 0 } }, 's', {
      toScreen,
      worldPerPixel: 1,
      drawAlignedDim,
    });
    expect(drawAlignedDim).not.toHaveBeenCalled();
    expect(toScreen).not.toHaveBeenCalled();
  });

  it('worldPerPixel widens the dim/label clearances (offsets scale with it)', () => {
    const refs: Point2D[] = [];
    const run = (wpp: number): Point2D => {
      const drawAlignedDim = jest.fn();
      paintWallHudCore(fakeCtx(), META, 's', {
        toScreen: (p) => p,
        worldPerPixel: wpp,
        drawAlignedDim,
      });
      return drawAlignedDim.mock.calls[0][2] as Point2D; // dimRef
    };
    refs.push(run(1), run(10));
    // Larger worldPerPixel → dim line sits farther from the wall axis (|y| grows).
    expect(Math.abs(refs[1].y)).toBeGreaterThan(Math.abs(refs[0].y));
  });
});

describe('paintProjectedAlignedDim — 3D dim primitive', () => {
  it('projects the 4 dim corners + the dimRef label anchor', () => {
    const toScreen = jest.fn((p: Point2D) => ({ x: p.x, y: p.y }));
    paintProjectedAlignedDim(
      fakeCtx(),
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 500, y: -300 },
      '1.00 m',
      toScreen,
      '#888',
    );
    // start, end, dimStart, dimEnd, dimRef = 5 projected points.
    expect(toScreen).toHaveBeenCalledTimes(5);
  });
});
