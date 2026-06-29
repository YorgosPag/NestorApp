/**
 * ADR-553 — ViewCube scissored sub-viewport rect math.
 *
 * Validates `computeViewCubeScissorRect`: the hit-layer rect mapped into a WebGL scissor box
 * relative to the main canvas, with the Y axis flipped (WebGL origin = bottom-left) and a guard
 * that returns `null` for degenerate (hidden / zero-size) rects.
 */

import { computeViewCubeScissorRect, type ScissorSourceRect } from '../view-cube-scissor';

const canvas = (over: Partial<ScissorSourceRect> = {}): ScissorSourceRect => ({
  left: 0, top: 0, width: 1000, height: 800, ...over,
});

describe('computeViewCubeScissorRect', () => {
  it('maps a top-right 160×160 hit-layer to the bottom-left-origin scissor box (Y flipped)', () => {
    // hit-layer 160×160 at top:12, right:12 of a 1000×800 canvas → left = 1000-12-160 = 828.
    const hit: ScissorSourceRect = { left: 828, top: 12, width: 160, height: 160 };
    const rect = computeViewCubeScissorRect(hit, canvas(), 800);
    expect(rect).not.toBeNull();
    expect(rect!.x).toBe(828);
    expect(rect!.w).toBe(160);
    expect(rect!.h).toBe(160);
    // y = canvasHeight - topOffset - height = 800 - 12 - 160 = 628.
    expect(rect!.y).toBe(628);
  });

  it('offsets by the canvas position (canvas not at viewport origin)', () => {
    const cv = canvas({ left: 100, top: 50 });
    const hit: ScissorSourceRect = { left: 928, top: 62, width: 160, height: 160 };
    const rect = computeViewCubeScissorRect(hit, cv, 800);
    expect(rect!.x).toBe(828); // 928 - 100
    expect(rect!.y).toBe(628); // 800 - (62-50) - 160
  });

  it('returns null when the hit-layer has zero or negative size (hidden / collapsed)', () => {
    expect(computeViewCubeScissorRect({ left: 828, top: 12, width: 0, height: 0 }, canvas(), 800)).toBeNull();
    expect(computeViewCubeScissorRect({ left: 828, top: 12, width: 160, height: -5 }, canvas(), 800)).toBeNull();
  });

  it('returns null when the canvas height is zero (renderer not sized yet)', () => {
    expect(computeViewCubeScissorRect({ left: 828, top: 12, width: 160, height: 160 }, canvas(), 0)).toBeNull();
  });

  it('handles a non-square (portrait) canvas correctly', () => {
    const cv = canvas({ width: 400, height: 1200 });
    const hit: ScissorSourceRect = { left: 228, top: 12, width: 160, height: 160 };
    const rect = computeViewCubeScissorRect(hit, cv, 1200);
    expect(rect!.x).toBe(228);
    expect(rect!.y).toBe(1028); // 1200 - 12 - 160
  });
});
