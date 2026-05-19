/**
 * ADR-363 Phase 4.5c.6 — `column-section-profile` pure-function tests.
 *
 * Verifies:
 *   - `computeLProfileOutline` returns 6 vertices + correct shape
 *   - `computeLProfileOutline` flipY negates all Y-coords
 *   - `computeTProfileOutline` returns 8 vertices + correct shape
 *   - `computeTProfileOutline` flipY negates all Y-coords
 *   - Both symbols are centred (min+max X/Y symmetric around 0)
 *   - Custom params are respected
 *   - Exported constants have expected values
 */

import {
  computeLProfileOutline,
  computeTProfileOutline,
  COL_L_SECTION_W_PX,
  COL_L_SECTION_H_PX,
  COL_L_LEG_T_PX,
  COL_T_FLANGE_W_PX,
  COL_T_TOTAL_H_PX,
  COL_T_FLANGE_T_PX,
  COL_T_WEB_W_PX,
  COL_SECTION_OFFSET_PX,
  COL_SECTION_MIN_SCALE,
  COL_SECTION_MIN_FOOTPRINT_PX,
  COL_SECTION_LINE_WIDTH_PX,
} from '../column-section-profile';

// ─── L-shape ─────────────────────────────────────────────────────────────────

describe('computeLProfileOutline', () => {
  it('returns 6 vertices by default', () => {
    expect(computeLProfileOutline()).toHaveLength(6);
  });

  it('is centred on X-axis: x-range is [-hw, +hw]', () => {
    const pts = computeLProfileOutline();
    const hw = COL_L_SECTION_W_PX / 2;
    const xs = pts.map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(-hw);
    expect(Math.max(...xs)).toBeCloseTo(hw);
  });

  it('is centred on Y-axis: y-range is [-hh, +hh]', () => {
    const pts = computeLProfileOutline();
    const hh = COL_L_SECTION_H_PX / 2;
    const ys = pts.map((p) => p.y);
    expect(Math.min(...ys)).toBeCloseTo(-hh);
    expect(Math.max(...ys)).toBeCloseTo(hh);
  });

  it('flipY negates all Y-coords', () => {
    const normal = computeLProfileOutline();
    const flipped = computeLProfileOutline(undefined, undefined, undefined, true);
    for (let i = 0; i < normal.length; i++) {
      expect(flipped[i].x).toBeCloseTo(normal[i].x);
      expect(flipped[i].y).toBeCloseTo(-normal[i].y);
    }
  });

  it('flipY preserves vertex count', () => {
    expect(computeLProfileOutline(undefined, undefined, undefined, true)).toHaveLength(6);
  });

  it('respects custom width + height', () => {
    const pts = computeLProfileOutline(30, 40, 5);
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    expect(Math.min(...xs)).toBeCloseTo(-15);
    expect(Math.max(...xs)).toBeCloseTo(15);
    expect(Math.min(...ys)).toBeCloseTo(-20);
    expect(Math.max(...ys)).toBeCloseTo(20);
  });

  it('leg thickness is reflected in inner corner X', () => {
    const lt = 6;
    const w = 20;
    const pts = computeLProfileOutline(w, 20, lt);
    // v3 = notch inner corner: x should be -hw + lt
    const hw = w / 2;
    expect(pts[3].x).toBeCloseTo(-hw + lt);
  });

  it('bottom flange spans full width at screen-bottom (positive Y)', () => {
    const pts = computeLProfileOutline();
    const hh = COL_L_SECTION_H_PX / 2;
    // v0 and v1 share the same max Y (screen bottom = positive Y)
    expect(pts[0].y).toBeCloseTo(hh);
    expect(pts[1].y).toBeCloseTo(hh);
  });

  it('left leg spans full height (v5 at top-left, v0 at bottom-left)', () => {
    const pts = computeLProfileOutline();
    const hw = COL_L_SECTION_W_PX / 2;
    const hh = COL_L_SECTION_H_PX / 2;
    expect(pts[0].x).toBeCloseTo(-hw);   // bottom-left
    expect(pts[5].x).toBeCloseTo(-hw);   // top-left
    expect(pts[5].y).toBeCloseTo(-hh);   // top = negative Y
  });
});

// ─── T-shape ─────────────────────────────────────────────────────────────────

describe('computeTProfileOutline', () => {
  it('returns 8 vertices by default', () => {
    expect(computeTProfileOutline()).toHaveLength(8);
  });

  it('is centred on X-axis: x-range is [-hfl, +hfl]', () => {
    const pts = computeTProfileOutline();
    const hfl = COL_T_FLANGE_W_PX / 2;
    const xs = pts.map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(-hfl);
    expect(Math.max(...xs)).toBeCloseTo(hfl);
  });

  it('is centred on Y-axis: y-range is [-hh, +hh]', () => {
    const pts = computeTProfileOutline();
    const hh = COL_T_TOTAL_H_PX / 2;
    const ys = pts.map((p) => p.y);
    expect(Math.min(...ys)).toBeCloseTo(-hh);
    expect(Math.max(...ys)).toBeCloseTo(hh);
  });

  it('flipY negates all Y-coords', () => {
    const normal = computeTProfileOutline();
    const flipped = computeTProfileOutline(undefined, undefined, undefined, undefined, true);
    for (let i = 0; i < normal.length; i++) {
      expect(flipped[i].x).toBeCloseTo(normal[i].x);
      expect(flipped[i].y).toBeCloseTo(-normal[i].y);
    }
  });

  it('flipY preserves vertex count', () => {
    expect(computeTProfileOutline(undefined, undefined, undefined, undefined, true)).toHaveLength(8);
  });

  it('respects custom flangeW + totalH', () => {
    const pts = computeTProfileOutline(24, 30, 6, 6);
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    expect(Math.min(...xs)).toBeCloseTo(-12);
    expect(Math.max(...xs)).toBeCloseTo(12);
    expect(Math.min(...ys)).toBeCloseTo(-15);
    expect(Math.max(...ys)).toBeCloseTo(15);
  });

  it('flange top at screen-top (negative Y, v4 and v5)', () => {
    const pts = computeTProfileOutline();
    const hh = COL_T_TOTAL_H_PX / 2;
    expect(pts[4].y).toBeCloseTo(-hh);  // flange top-right
    expect(pts[5].y).toBeCloseTo(-hh);  // flange top-left
  });

  it('web bottom at screen-bottom (positive Y, v0 and v1)', () => {
    const pts = computeTProfileOutline();
    const hh = COL_T_TOTAL_H_PX / 2;
    expect(pts[0].y).toBeCloseTo(hh);  // web bottom-left
    expect(pts[1].y).toBeCloseTo(hh);  // web bottom-right
  });

  it('web is symmetric around X=0', () => {
    const pts = computeTProfileOutline();
    const hwb = COL_T_WEB_W_PX / 2;
    expect(pts[0].x).toBeCloseTo(-hwb);  // web bottom-left
    expect(pts[1].x).toBeCloseTo(hwb);   // web bottom-right
  });
});

// ─── Constants ───────────────────────────────────────────────────────────────

describe('column-section-profile constants', () => {
  it('COL_L_SECTION_W_PX is positive', () => {
    expect(COL_L_SECTION_W_PX).toBeGreaterThan(0);
  });

  it('COL_L_SECTION_H_PX is positive', () => {
    expect(COL_L_SECTION_H_PX).toBeGreaterThan(0);
  });

  it('COL_L_LEG_T_PX < COL_L_SECTION_W_PX (leg thinner than total width)', () => {
    expect(COL_L_LEG_T_PX).toBeLessThan(COL_L_SECTION_W_PX);
  });

  it('COL_T_FLANGE_T_PX < COL_T_TOTAL_H_PX (flange thinner than total height)', () => {
    expect(COL_T_FLANGE_T_PX).toBeLessThan(COL_T_TOTAL_H_PX);
  });

  it('COL_T_WEB_W_PX < COL_T_FLANGE_W_PX (web narrower than flange)', () => {
    expect(COL_T_WEB_W_PX).toBeLessThan(COL_T_FLANGE_W_PX);
  });

  it('COL_SECTION_OFFSET_PX is positive', () => {
    expect(COL_SECTION_OFFSET_PX).toBeGreaterThan(0);
  });

  it('COL_SECTION_MIN_SCALE is between 0 and 1', () => {
    expect(COL_SECTION_MIN_SCALE).toBeGreaterThan(0);
    expect(COL_SECTION_MIN_SCALE).toBeLessThan(1);
  });

  it('COL_SECTION_MIN_FOOTPRINT_PX is positive', () => {
    expect(COL_SECTION_MIN_FOOTPRINT_PX).toBeGreaterThan(0);
  });

  it('COL_SECTION_LINE_WIDTH_PX is positive', () => {
    expect(COL_SECTION_LINE_WIDTH_PX).toBeGreaterThan(0);
  });
});
