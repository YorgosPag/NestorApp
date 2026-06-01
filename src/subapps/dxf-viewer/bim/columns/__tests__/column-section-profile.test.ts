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

import type { ColumnEntity } from '../../types/column-types';
import { resolveColumnSectionOutline } from '../column-section-symbol';
import {
  computeIProfileOutline,
  computeLProfileOutline,
  computePolygonBackedOutline,
  computePolygonOutline,
  computeShearWallOutline,
  computeTProfileOutline,
  computeUProfileOutline,
  COL_I_FLANGE_T_PX,
  COL_I_FLANGE_W_PX,
  COL_I_TOTAL_H_PX,
  COL_I_WEB_W_PX,
  COL_L_SECTION_W_PX,
  COL_L_SECTION_H_PX,
  COL_L_LEG_T_PX,
  COL_POLYGON_D_PX,
  COL_SHEAR_WALL_LEN_PX,
  COL_SHEAR_WALL_THK_PX,
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

// ─── ADR-363 Phase 8 — polygon outline ─────────────────────────────────────

describe('computePolygonOutline', () => {
  it('returns 6 vertices by default (hexagon)', () => {
    expect(computePolygonOutline()).toHaveLength(6);
  });

  it('respects sides override (pentagon = 5)', () => {
    expect(computePolygonOutline(undefined, 5)).toHaveLength(5);
  });

  it('clamps sides below 3 → 3', () => {
    expect(computePolygonOutline(undefined, 2)).toHaveLength(3);
  });

  it('clamps sides above 12 → 12', () => {
    expect(computePolygonOutline(undefined, 20)).toHaveLength(12);
  });

  it('vertices sit on circumscribed circle (radius = d/2)', () => {
    const pts = computePolygonOutline(20, 6);
    for (const p of pts) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(10, 5);
    }
  });

  it('flipY negates all Y-coords', () => {
    const normal = computePolygonOutline(20, 5);
    const flipped = computePolygonOutline(20, 5, true);
    for (let i = 0; i < normal.length; i++) {
      expect(flipped[i].x).toBeCloseTo(normal[i].x);
      expect(flipped[i].y).toBeCloseTo(-normal[i].y);
    }
  });
});

// ─── ADR-363 Phase 8 — shear-wall outline ──────────────────────────────────

describe('computeShearWallOutline', () => {
  it('returns 4 vertices', () => {
    expect(computeShearWallOutline()).toHaveLength(4);
  });

  it('bbox spans length × thickness (defaults)', () => {
    const pts = computeShearWallOutline();
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(COL_SHEAR_WALL_LEN_PX);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(COL_SHEAR_WALL_THK_PX);
  });

  it('respects custom length + thickness', () => {
    const pts = computeShearWallOutline(40, 8);
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(40);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(8);
  });

  it('flipY negates all Y-coords', () => {
    const normal = computeShearWallOutline();
    const flipped = computeShearWallOutline(undefined, undefined, true);
    for (let i = 0; i < normal.length; i++) {
      expect(flipped[i].y).toBeCloseTo(-normal[i].y);
    }
  });
});

// ─── ADR-363 Phase 8 — I-shape outline ─────────────────────────────────────

describe('computeIProfileOutline', () => {
  it('returns 12 vertices by default', () => {
    expect(computeIProfileOutline()).toHaveLength(12);
  });

  it('bbox spans b × h (defaults)', () => {
    const pts = computeIProfileOutline();
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(COL_I_FLANGE_W_PX);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(COL_I_TOTAL_H_PX);
  });

  it('top and bottom flanges span full width (v0/v1/v6/v7)', () => {
    const pts = computeIProfileOutline();
    const hb = COL_I_FLANGE_W_PX / 2;
    expect(pts[0].x).toBeCloseTo(-hb);  // bottom-left
    expect(pts[1].x).toBeCloseTo( hb);  // bottom-right
    expect(pts[6].x).toBeCloseTo( hb);  // top-right
    expect(pts[7].x).toBeCloseTo(-hb);  // top-left
  });

  it('web narrower than flange', () => {
    expect(COL_I_WEB_W_PX).toBeLessThan(COL_I_FLANGE_W_PX);
  });

  it('flange thinner than total height', () => {
    expect(COL_I_FLANGE_T_PX * 2).toBeLessThan(COL_I_TOTAL_H_PX);
  });

  it('flipY negates all Y-coords', () => {
    const normal = computeIProfileOutline();
    const flipped = computeIProfileOutline(undefined, undefined, undefined, undefined, true);
    for (let i = 0; i < normal.length; i++) {
      expect(flipped[i].x).toBeCloseTo(normal[i].x);
      expect(flipped[i].y).toBeCloseTo(-normal[i].y);
    }
  });

  it('respects custom b/h/tf/tw', () => {
    const pts = computeIProfileOutline(30, 40, 6, 5);
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(30);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(40);
  });
});

// ─── ADR-363 Phase 8 — constants ───────────────────────────────────────────

describe('column-section-profile Phase 8 constants', () => {
  it('COL_POLYGON_D_PX is positive', () => {
    expect(COL_POLYGON_D_PX).toBeGreaterThan(0);
  });

  it('COL_SHEAR_WALL_LEN_PX > COL_SHEAR_WALL_THK_PX (μακρόστενο)', () => {
    expect(COL_SHEAR_WALL_LEN_PX).toBeGreaterThan(COL_SHEAR_WALL_THK_PX);
  });

  it('COL_I_FLANGE_W_PX > COL_I_WEB_W_PX (flange wider than web)', () => {
    expect(COL_I_FLANGE_W_PX).toBeGreaterThan(COL_I_WEB_W_PX);
  });

  it('COL_I_TOTAL_H_PX > 2 * COL_I_FLANGE_T_PX (web has room)', () => {
    expect(COL_I_TOTAL_H_PX).toBeGreaterThan(2 * COL_I_FLANGE_T_PX);
  });
});

// ─── ADR-363 Phase 2b — U-shape (Π) + polygon-backed outlines ───────────────

describe('computeUProfileOutline (Phase 2b)', () => {
  it('returns 8 vertices by default', () => {
    expect(computeUProfileOutline()).toHaveLength(8);
  });

  it('is bbox-centred (X/Y symmetric around 0)', () => {
    const o = computeUProfileOutline();
    const xs = o.map((p) => p.x);
    const ys = o.map((p) => p.y);
    expect(Math.min(...xs)).toBeCloseTo(-Math.max(...xs), 6);
    expect(Math.min(...ys)).toBeCloseTo(-Math.max(...ys), 6);
  });

  it('flipY negates every Y-coord', () => {
    const a = computeUProfileOutline();
    const b = computeUProfileOutline(undefined, undefined, undefined, undefined, true);
    a.forEach((p, i) => expect(b[i].y).toBeCloseTo(-p.y, 6));
  });
});

describe('computePolygonBackedOutline (Phase 2b)', () => {
  it('returns [] for degenerate polygon (<3 vertices)', () => {
    expect(computePolygonBackedOutline([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toEqual([]);
  });

  it('scales the polygon to fit the target box, preserving vertex count', () => {
    const poly = [
      { x: -400, y: -200 },
      { x: 400, y: -200 },
      { x: 400, y: 200 },
      { x: -400, y: 200 },
    ];
    const out = computePolygonBackedOutline(poly, 16);
    expect(out).toHaveLength(4);
    // span = max(800, 400) = 800 → scale = 16/800 = 0.02 → x extent ±8.
    const xs = out.map((p) => p.x);
    expect(Math.max(...xs)).toBeCloseTo(8, 6);
    expect(Math.min(...xs)).toBeCloseTo(-8, 6);
  });
});

describe('resolveColumnSectionOutline (Phase 2b)', () => {
  function col(params: Record<string, unknown>): ColumnEntity {
    return { id: 'c', type: 'column', kind: params.kind, params } as unknown as ColumnEntity;
  }

  it('composite with polygon → scaled polygon outline', () => {
    const poly = [
      { x: -100, y: -100 },
      { x: 100, y: -100 },
      { x: 0, y: 100 },
    ];
    const out = resolveColumnSectionOutline(col({ kind: 'composite', composite: { polygon: poly } }));
    expect(out).not.toBeNull();
    expect(out).toHaveLength(3);
  });

  it('U-shape without polygon → parametric Π outline (8 vertices)', () => {
    const out = resolveColumnSectionOutline(col({ kind: 'U-shape' }));
    expect(out).toHaveLength(8);
  });

  it('rectangular → null (no section glyph)', () => {
    expect(resolveColumnSectionOutline(col({ kind: 'rectangular' }))).toBeNull();
  });
});
