/**
 * ADR-455 — 2D plan-side ghost classification (pure).
 */

import { axisCutGhostFactor, anyAxisCutActive, AXIS_CUT_GHOST_ALPHA } from '../axis-cut-plan-side';
import type { AxisCutSetting } from '../../../config/bim-render-settings-types';

const c = (active: boolean, position: number, sign: 1 | -1): AxisCutSetting => ({ active, position, sign });
const bbox = (minX: number, maxX: number, minY: number, maxY: number) => ({ minX, maxX, minY, maxY });

describe('anyAxisCutActive', () => {
  it('true only when at least one cut is active', () => {
    expect(anyAxisCutActive(null, null)).toBe(false);
    expect(anyAxisCutActive(c(false, 0, 1), c(false, 0, 1))).toBe(false);
    expect(anyAxisCutActive(c(true, 0, 1), null)).toBe(true);
  });
});

describe('axisCutGhostFactor — X cut', () => {
  it('ghosts entities fully on the cut-away side (sign +1 keeps lower X)', () => {
    const x = c(true, 5, 1);
    expect(axisCutGhostFactor(bbox(6, 8, 0, 1), x, null)).toBe(AXIS_CUT_GHOST_ALPHA); // fully above → ghost
    expect(axisCutGhostFactor(bbox(0, 2, 0, 1), x, null)).toBe(1); // fully below → solid
    expect(axisCutGhostFactor(bbox(4, 6, 0, 1), x, null)).toBe(1); // straddling → solid
  });

  it('sign −1 flips the kept side', () => {
    const x = c(true, 5, -1);
    expect(axisCutGhostFactor(bbox(0, 2, 0, 1), x, null)).toBe(AXIS_CUT_GHOST_ALPHA); // fully below → ghost
    expect(axisCutGhostFactor(bbox(6, 8, 0, 1), x, null)).toBe(1);
  });
});

describe('axisCutGhostFactor — Y cut + combined', () => {
  it('ghosts on the Y cut-away side', () => {
    const y = c(true, 5, 1);
    expect(axisCutGhostFactor(bbox(0, 1, 6, 8), null, y)).toBe(AXIS_CUT_GHOST_ALPHA);
    expect(axisCutGhostFactor(bbox(0, 1, 0, 2), null, y)).toBe(1);
  });

  it('ghosts when fully cut-away on EITHER active axis', () => {
    const x = c(true, 5, 1);
    const y = c(true, 5, 1);
    expect(axisCutGhostFactor(bbox(0, 2, 6, 8), x, y)).toBe(AXIS_CUT_GHOST_ALPHA); // cut-away on Y only
    expect(axisCutGhostFactor(bbox(0, 2, 0, 2), x, y)).toBe(1); // kept on both
  });

  it('inactive cuts never ghost', () => {
    expect(axisCutGhostFactor(bbox(6, 8, 6, 8), c(false, 5, 1), c(false, 5, 1))).toBe(1);
  });
});
