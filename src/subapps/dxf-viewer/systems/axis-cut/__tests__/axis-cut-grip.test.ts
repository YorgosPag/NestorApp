/**
 * ADR-455 — on-canvas section-cut handle geometry + hit-test (transform-synced).
 *
 * The renderer and the mouse pipeline share this SSoT, so these tests assert the handle
 * is world-anchored on the section line (centred on `worldToScreen(position)`) and rests
 * inside the rulers, and that the hit-test only matches an ACTIVE cut.
 */

import { CoordinateTransforms, COORDINATE_LAYOUT } from '../../../rendering/core/CoordinateTransforms';
import type { ViewTransform, Viewport } from '../../../rendering/types/Types';
import type { AxisCutSetting } from '../../../config/bim-render-settings-types';

// Controllable cut SSoT for the hit-test (avoids booting the full zustand store).
const storeState = {
  xAxisCut: { active: false, position: 0, sign: 1 } as AxisCutSetting,
  yAxisCut: { active: false, position: 0, sign: 1 } as AxisCutSetting,
};
jest.mock('../../../state/bim-render-settings-store', () => ({
  useBimRenderSettingsStore: { getState: () => storeState },
}));

import {
  getAxisCutGripRect,
  hitTestAxisCutGrip,
  AXIS_CUT_GRIP_LONG,
  AXIS_CUT_GRIP_SHORT,
} from '../axis-cut-grip';

const VIEWPORT: Viewport = { width: 800, height: 600 };
const TRANSFORM: ViewTransform = { scale: 2, offsetX: 50, offsetY: 30 };
const cut = (active: boolean, position: number, sign: 1 | -1): AxisCutSetting => ({ active, position, sign });

describe('getAxisCutGripRect', () => {
  it('returns null for a degenerate viewport', () => {
    expect(getAxisCutGripRect('x', cut(true, 10, 1), TRANSFORM, { width: 0, height: 0 })).toBeNull();
  });

  it('centres the X handle on the line and rests above the bottom ruler', () => {
    const c = cut(true, 12, 1);
    const px = CoordinateTransforms.worldToScreen({ x: 12, y: 0 }, TRANSFORM, VIEWPORT).x;
    const r = getAxisCutGripRect('x', c, TRANSFORM, VIEWPORT)!;
    expect(r).not.toBeNull();
    expect(r.x + r.w / 2).toBeCloseTo(px, 6); // centred on the vertical line
    expect(r.w).toBe(AXIS_CUT_GRIP_LONG); // long side along the horizontal drag axis
    expect(r.h).toBe(AXIS_CUT_GRIP_SHORT);
    expect(r.y + r.h).toBeLessThanOrEqual(VIEWPORT.height - COORDINATE_LAYOUT.MARGINS.bottom);
  });

  it('centres the Y handle on the line and rests right of the left ruler', () => {
    const c = cut(true, 7, -1);
    const py = CoordinateTransforms.worldToScreen({ x: 0, y: 7 }, TRANSFORM, VIEWPORT).y;
    const r = getAxisCutGripRect('y', c, TRANSFORM, VIEWPORT)!;
    expect(r.y + r.h / 2).toBeCloseTo(py, 6); // centred on the horizontal line
    expect(r.w).toBe(AXIS_CUT_GRIP_SHORT);
    expect(r.h).toBe(AXIS_CUT_GRIP_LONG); // long side along the vertical drag axis
    expect(r.x).toBeGreaterThanOrEqual(COORDINATE_LAYOUT.MARGINS.left);
  });
});

describe('hitTestAxisCutGrip', () => {
  beforeEach(() => {
    storeState.xAxisCut = cut(false, 0, 1);
    storeState.yAxisCut = cut(false, 0, 1);
  });

  it('matches the X handle centre when the X cut is active', () => {
    storeState.xAxisCut = cut(true, 12, 1);
    const r = getAxisCutGripRect('x', storeState.xAxisCut, TRANSFORM, VIEWPORT)!;
    const centre = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    expect(hitTestAxisCutGrip(centre, TRANSFORM, VIEWPORT)).toBe('x');
  });

  it('returns null over a handle position whose cut is inactive', () => {
    const r = getAxisCutGripRect('x', cut(true, 12, 1), TRANSFORM, VIEWPORT)!;
    const centre = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    // xAxisCut is inactive (beforeEach) → no handle to grab.
    expect(hitTestAxisCutGrip(centre, TRANSFORM, VIEWPORT)).toBeNull();
  });

  it('returns null for a point far from any handle', () => {
    storeState.xAxisCut = cut(true, 12, 1);
    storeState.yAxisCut = cut(true, 7, -1);
    expect(hitTestAxisCutGrip({ x: 400, y: 300 }, TRANSFORM, VIEWPORT)).toBeNull();
  });
});
