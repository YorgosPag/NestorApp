/**
 * ADR-375 — Line Weight Resolver pipeline tests.
 * ADR-377 — Phase B: resolveSubcategoryStyle tests.
 */
import { describe, it, expect } from '@jest/globals';
import {
  resolveLineWeightPx,
  resolveSubcategoryStyle,
  closestScaleColumn,
} from '../bim-line-weight-resolver';
import type { ObjectStyle } from '../bim-object-styles';
import type { BimCategory } from '../bim-object-styles';
import type { PenIndex } from '../bim-pen-table';

describe('closestScaleColumn', () => {
  it('exact match 1:100 → index 3', () => {
    expect(closestScaleColumn(100)).toBe(3);
  });

  it('exact match 1:50 → index 2', () => {
    expect(closestScaleColumn(50)).toBe(2);
  });

  it('exact match 1:10 → index 0', () => {
    expect(closestScaleColumn(10)).toBe(0);
  });

  it('exact match 1:500 → index 5', () => {
    expect(closestScaleColumn(500)).toBe(5);
  });

  it('75 snaps to 1:50 (index 2) — closest', () => {
    expect(closestScaleColumn(75)).toBe(2);
  });

  it('150 snaps to 1:100 (index 3) — equidistant, first-match wins', () => {
    expect(closestScaleColumn(150)).toBe(3);
  });
});

describe('resolveLineWeightPx', () => {
  it('returns 0 for hidden state', () => {
    expect(resolveLineWeightPx({
      category: 'wall',
      cutState: 'hidden',
      scaleDenominator: 100,
    })).toBe(0);
  });

  it('cut wall at 1:100 is heavier than projection wall', () => {
    const cut = resolveLineWeightPx({ category: 'wall', cutState: 'cut', scaleDenominator: 100 });
    const proj = resolveLineWeightPx({ category: 'wall', cutState: 'projection', scaleDenominator: 100 });
    expect(cut).toBeGreaterThan(proj);
  });

  it('cut column > cut wall (structural hierarchy)', () => {
    const col = resolveLineWeightPx({ category: 'column', cutState: 'cut', scaleDenominator: 100 });
    const wall = resolveLineWeightPx({ category: 'wall', cutState: 'cut', scaleDenominator: 100 });
    expect(col).toBeGreaterThan(wall);
  });

  it('beyond returns thinner than projection', () => {
    const beyond = resolveLineWeightPx({ category: 'wall', cutState: 'beyond', scaleDenominator: 100 });
    const proj = resolveLineWeightPx({ category: 'wall', cutState: 'projection', scaleDenominator: 100 });
    expect(beyond).toBeLessThanOrEqual(proj);
  });

  it('larger scale (1:10) produces thicker px than smaller scale (1:500)', () => {
    const large = resolveLineWeightPx({ category: 'wall', cutState: 'cut', scaleDenominator: 10 });
    const small = resolveLineWeightPx({ category: 'wall', cutState: 'cut', scaleDenominator: 500 });
    expect(large).toBeGreaterThan(small);
  });

  it('returns positive px for wall cut at 1:100', () => {
    const px = resolveLineWeightPx({ category: 'wall', cutState: 'cut', scaleDenominator: 100, dpi: 96 });
    expect(px).toBeGreaterThan(0);
  });

  it('dpi 144 produces 1.5x more px than dpi 96', () => {
    const px96 = resolveLineWeightPx({ category: 'column', cutState: 'cut', scaleDenominator: 100, dpi: 96 });
    const px144 = resolveLineWeightPx({ category: 'column', cutState: 'cut', scaleDenominator: 100, dpi: 144 });
    expect(px144).toBeCloseTo(px96 * 1.5, 5);
  });
});

// ── ADR-377 Phase B: resolveSubcategoryStyle ──────────────────────────────────

function makeStyles(
  category: BimCategory,
  base: { cutPen: PenIndex; projectionPen: PenIndex },
  subcategories?: Partial<Record<string, Partial<ObjectStyle & { cutPen?: PenIndex; projectionPen?: PenIndex; linePattern?: string; cutColor?: string | null; projectionColor?: string | null }>>>,
): Partial<Record<BimCategory, ObjectStyle>> {
  return { [category]: { ...base, subcategories } } as Partial<Record<BimCategory, ObjectStyle>>;
}

describe('resolveSubcategoryStyle — parent fallback (no subcategory key)', () => {
  it('hidden → lineWidthPx 0, solid pattern, null color', () => {
    const r = resolveSubcategoryStyle({ category: 'wall', cutState: 'hidden', scaleDenominator: 100 });
    expect(r.lineWidthPx).toBe(0);
    expect(r.linePattern).toBe('solid');
    expect(r.color).toBeNull();
  });

  it('cut without subcategoryKey → same width as resolveLineWeightPx', () => {
    const r = resolveSubcategoryStyle({ category: 'wall', cutState: 'cut', scaleDenominator: 100 });
    expect(r.lineWidthPx).toBe(resolveLineWeightPx({ category: 'wall', cutState: 'cut', scaleDenominator: 100 }));
  });

  it('projection without subcategoryKey → same width as resolveLineWeightPx', () => {
    const r = resolveSubcategoryStyle({ category: 'wall', cutState: 'projection', scaleDenominator: 100 });
    expect(r.lineWidthPx).toBe(resolveLineWeightPx({ category: 'wall', cutState: 'projection', scaleDenominator: 100 }));
  });

  it('default linePattern is solid when no subcategory provided', () => {
    expect(resolveSubcategoryStyle({ category: 'slab', cutState: 'cut', scaleDenominator: 100 }).linePattern).toBe('solid');
  });

  it('default color is null for a category without a C.9 line color', () => {
    // ADR-375 C.9: wall/column/slab/opening πλέον έχουν parent χρώμα· το `beam`
    // (όπως annotation categories) μένει άχρωμο → πέφτει σε canvas token (null).
    expect(resolveSubcategoryStyle({ category: 'beam', cutState: 'projection', scaleDenominator: 100 }).color).toBeNull();
  });
});

describe('resolveSubcategoryStyle — cutPen override via subcategories', () => {
  it('heavier subcategory cutPen → larger lineWidthPx than parent', () => {
    const os = makeStyles('wall', { cutPen: 5, projectionPen: 5 }, { 'common-edges': { cutPen: 9 as PenIndex } });
    const withSub = resolveSubcategoryStyle({ category: 'wall', cutState: 'cut', scaleDenominator: 100, subcategoryKey: 'common-edges', objectStyles: os });
    const noSub   = resolveSubcategoryStyle({ category: 'wall', cutState: 'cut', scaleDenominator: 100, objectStyles: os });
    expect(withSub.lineWidthPx).toBeGreaterThan(noSub.lineWidthPx);
  });

  it('subcategory cutPen does NOT affect projection state', () => {
    const os = makeStyles('wall', { cutPen: 7, projectionPen: 5 }, { 'common-edges': { cutPen: 9 as PenIndex } });
    const withSub = resolveSubcategoryStyle({ category: 'wall', cutState: 'projection', scaleDenominator: 100, subcategoryKey: 'common-edges', objectStyles: os });
    const noSub   = resolveSubcategoryStyle({ category: 'wall', cutState: 'projection', scaleDenominator: 100, objectStyles: os });
    expect(withSub.lineWidthPx).toBe(noSub.lineWidthPx);
  });

  it('lighter subcategory cutPen → thinner line than parent', () => {
    const os = makeStyles('wall', { cutPen: 7, projectionPen: 5 }, { 'cut-pattern': { cutPen: 3 as PenIndex } });
    const withSub = resolveSubcategoryStyle({ category: 'wall', cutState: 'cut', scaleDenominator: 100, subcategoryKey: 'cut-pattern', objectStyles: os });
    const noSub   = resolveSubcategoryStyle({ category: 'wall', cutState: 'cut', scaleDenominator: 100, objectStyles: os });
    expect(withSub.lineWidthPx).toBeLessThan(noSub.lineWidthPx);
  });
});

describe('resolveSubcategoryStyle — projectionPen override', () => {
  it('heavier subcategory projectionPen → larger lineWidthPx for projection', () => {
    const os = makeStyles('beam', { cutPen: 6, projectionPen: 4 }, { 'section-profile': { projectionPen: 7 as PenIndex } });
    const withSub = resolveSubcategoryStyle({ category: 'beam', cutState: 'projection', scaleDenominator: 100, subcategoryKey: 'section-profile', objectStyles: os });
    const noSub   = resolveSubcategoryStyle({ category: 'beam', cutState: 'projection', scaleDenominator: 100, objectStyles: os });
    expect(withSub.lineWidthPx).toBeGreaterThan(noSub.lineWidthPx);
  });

  it('subcategory projectionPen does NOT affect cut state', () => {
    const os = makeStyles('beam', { cutPen: 6, projectionPen: 4 }, { 'section-profile': { projectionPen: 7 as PenIndex } });
    const withSub = resolveSubcategoryStyle({ category: 'beam', cutState: 'cut', scaleDenominator: 100, subcategoryKey: 'section-profile', objectStyles: os });
    const noSub   = resolveSubcategoryStyle({ category: 'beam', cutState: 'cut', scaleDenominator: 100, objectStyles: os });
    expect(withSub.lineWidthPx).toBe(noSub.lineWidthPx);
  });
});

describe('resolveSubcategoryStyle — linePattern override', () => {
  it('subcategory linePattern returned correctly', () => {
    const os = makeStyles('beam', { cutPen: 6, projectionPen: 4 }, { 'hidden-lines': { linePattern: 'dashed' } });
    const r = resolveSubcategoryStyle({ category: 'beam', cutState: 'projection', scaleDenominator: 100, subcategoryKey: 'hidden-lines', objectStyles: os });
    expect(r.linePattern).toBe('dashed');
  });

  it('linePattern override does not change lineWidthPx', () => {
    const base = resolveSubcategoryStyle({ category: 'beam', cutState: 'projection', scaleDenominator: 100 });
    const os = makeStyles('beam', { cutPen: 6, projectionPen: 4 }, { 'hidden-lines': { linePattern: 'center' } });
    const r = resolveSubcategoryStyle({ category: 'beam', cutState: 'projection', scaleDenominator: 100, subcategoryKey: 'hidden-lines', objectStyles: os });
    expect(r.lineWidthPx).toBe(base.lineWidthPx);
    expect(r.linePattern).toBe('center');
  });

  it('different built-in patterns (phantom, divide) are returned as-is', () => {
    const os1 = makeStyles('wall', { cutPen: 7, projectionPen: 5 }, { 'common-edges': { linePattern: 'phantom' } });
    const os2 = makeStyles('wall', { cutPen: 7, projectionPen: 5 }, { 'common-edges': { linePattern: 'divide' } });
    expect(resolveSubcategoryStyle({ category: 'wall', cutState: 'cut', scaleDenominator: 100, subcategoryKey: 'common-edges', objectStyles: os1 }).linePattern).toBe('phantom');
    expect(resolveSubcategoryStyle({ category: 'wall', cutState: 'cut', scaleDenominator: 100, subcategoryKey: 'common-edges', objectStyles: os2 }).linePattern).toBe('divide');
  });
});

describe('resolveSubcategoryStyle — color overrides', () => {
  it('cutColor override returned for cut state', () => {
    const os = makeStyles('wall', { cutPen: 7, projectionPen: 5 }, { 'common-edges': { cutColor: '#FF0000' } });
    const r = resolveSubcategoryStyle({ category: 'wall', cutState: 'cut', scaleDenominator: 100, subcategoryKey: 'common-edges', objectStyles: os });
    expect(r.color).toBe('#FF0000');
  });

  it('projectionColor override returned for projection state', () => {
    const os = makeStyles('wall', { cutPen: 7, projectionPen: 5 }, { 'common-edges': { projectionColor: '#0000FF' } });
    const r = resolveSubcategoryStyle({ category: 'wall', cutState: 'projection', scaleDenominator: 100, subcategoryKey: 'common-edges', objectStyles: os });
    expect(r.color).toBe('#0000FF');
  });

  it('cutColor NOT used for projection state (projectionColor wins)', () => {
    const os = makeStyles('wall', { cutPen: 7, projectionPen: 5 }, { 'common-edges': { cutColor: '#FF0000', projectionColor: null } });
    const r = resolveSubcategoryStyle({ category: 'wall', cutState: 'projection', scaleDenominator: 100, subcategoryKey: 'common-edges', objectStyles: os });
    expect(r.color).toBeNull();
  });

  it('explicit null cutColor returns null for cut state', () => {
    const os = makeStyles('wall', { cutPen: 7, projectionPen: 5 }, { 'cut-pattern': { cutColor: null } });
    const r = resolveSubcategoryStyle({ category: 'wall', cutState: 'cut', scaleDenominator: 100, subcategoryKey: 'cut-pattern', objectStyles: os });
    expect(r.color).toBeNull();
  });
});

describe('resolveSubcategoryStyle — beyond state', () => {
  it('beyond uses BEYOND_PEN regardless of subcategory pen override', () => {
    const os = makeStyles('wall', { cutPen: 7, projectionPen: 5 }, { 'common-edges': { cutPen: 9 as PenIndex, projectionPen: 9 as PenIndex } });
    const beyond    = resolveSubcategoryStyle({ category: 'wall', cutState: 'beyond', scaleDenominator: 100, subcategoryKey: 'common-edges', objectStyles: os });
    const beyondRef = resolveSubcategoryStyle({ category: 'wall', cutState: 'beyond', scaleDenominator: 100 });
    expect(beyond.lineWidthPx).toBe(beyondRef.lineWidthPx);
  });

  it('beyond state returns solid linePattern', () => {
    expect(resolveSubcategoryStyle({ category: 'column', cutState: 'beyond', scaleDenominator: 100 }).linePattern).toBe('solid');
  });

  it('beyond state returns null color for a category without a C.9 line color', () => {
    expect(resolveSubcategoryStyle({ category: 'beam', cutState: 'beyond', scaleDenominator: 100 }).color).toBeNull();
  });
});

describe('resolveSubcategoryStyle — missing / unknown subcategoryKey', () => {
  it('undefined subcategoryKey → no crash', () => {
    expect(() => resolveSubcategoryStyle({ category: 'wall', cutState: 'cut', scaleDenominator: 100, subcategoryKey: undefined })).not.toThrow();
  });

  it('unknown subcategoryKey → falls back to parent pen', () => {
    const withUnknown = resolveSubcategoryStyle({ category: 'wall', cutState: 'cut', scaleDenominator: 100, subcategoryKey: 'nonexistent-key' });
    const noKey       = resolveSubcategoryStyle({ category: 'wall', cutState: 'cut', scaleDenominator: 100 });
    expect(withUnknown.lineWidthPx).toBe(noKey.lineWidthPx);
  });

  it('unknown subcategoryKey → linePattern solid', () => {
    expect(resolveSubcategoryStyle({ category: 'stair', cutState: 'projection', scaleDenominator: 100, subcategoryKey: 'nonexistent' }).linePattern).toBe('solid');
  });

  it('unknown subcategoryKey → color null (category without a C.9 line color)', () => {
    expect(resolveSubcategoryStyle({ category: 'beam', cutState: 'cut', scaleDenominator: 100, subcategoryKey: 'nonexistent' }).color).toBeNull();
  });

  it('parent has no subcategories map → falls back to parent pen (no crash)', () => {
    const withSub = resolveSubcategoryStyle({ category: 'column', cutState: 'cut', scaleDenominator: 100, subcategoryKey: 'section-profile' });
    const noSub   = resolveSubcategoryStyle({ category: 'column', cutState: 'cut', scaleDenominator: 100 });
    expect(withSub.lineWidthPx).toBe(noSub.lineWidthPx);
  });
});

describe('resolveLineWeightPx wrapper — regression (ADR-377 Phase B)', () => {
  it('hidden state still returns 0', () => {
    expect(resolveLineWeightPx({ category: 'wall', cutState: 'hidden', scaleDenominator: 100 })).toBe(0);
  });

  it('cut wall returns positive px', () => {
    expect(resolveLineWeightPx({ category: 'wall', cutState: 'cut', scaleDenominator: 100 })).toBeGreaterThan(0);
  });

  it('cut > projection for wall (hierarchy maintained)', () => {
    const cut  = resolveLineWeightPx({ category: 'wall', cutState: 'cut', scaleDenominator: 100 });
    const proj = resolveLineWeightPx({ category: 'wall', cutState: 'projection', scaleDenominator: 100 });
    expect(cut).toBeGreaterThan(proj);
  });

  it('cut column > cut wall (structural hierarchy maintained)', () => {
    const col  = resolveLineWeightPx({ category: 'column', cutState: 'cut', scaleDenominator: 100 });
    const wall = resolveLineWeightPx({ category: 'wall', cutState: 'cut', scaleDenominator: 100 });
    expect(col).toBeGreaterThan(wall);
  });

  it('dpi 144 still produces 1.5x more px than dpi 96', () => {
    const px96  = resolveLineWeightPx({ category: 'column', cutState: 'cut', scaleDenominator: 100, dpi: 96 });
    const px144 = resolveLineWeightPx({ category: 'column', cutState: 'cut', scaleDenominator: 100, dpi: 144 });
    expect(px144).toBeCloseTo(px96 * 1.5, 5);
  });
});

describe('ADR-375 C.9 — defaults χρώματος μέσω resolveSubcategoryStyle (μηδέν override)', () => {
  const base = { scaleDenominator: 100, dpi: 96 } as const;

  it('εξωτ. τοίχος (common-edges) → parent χρώμα #2b2f36', () => {
    const s = resolveSubcategoryStyle({ category: 'wall', subcategoryKey: 'common-edges', cutState: 'cut', ...base });
    expect(s.color).toBe('#2b2f36');
  });

  it('εσωτ. τοίχος (interior) → #6b7280 (subcategory wins)', () => {
    const s = resolveSubcategoryStyle({ category: 'wall', subcategoryKey: 'interior', cutState: 'cut', ...base });
    expect(s.color).toBe('#6b7280');
  });

  it('κανονική κολώνα (common-edges) → parent #5b6478', () => {
    const s = resolveSubcategoryStyle({ category: 'column', subcategoryKey: 'common-edges', cutState: 'cut', ...base });
    expect(s.color).toBe('#5b6478');
  });

  it('τοιχίο (shear-wall) → #2f3a4a', () => {
    const s = resolveSubcategoryStyle({ category: 'column', subcategoryKey: 'shear-wall', cutState: 'cut', ...base });
    expect(s.color).toBe('#2f3a4a');
  });

  it('πλάκα (common-edges) → parent #6e6358', () => {
    const s = resolveSubcategoryStyle({ category: 'slab', subcategoryKey: 'common-edges', cutState: 'cut', ...base });
    expect(s.color).toBe('#6e6358');
  });

  it('πόρτα (door-opening) → #c97c2f · παράθυρο (window-opening) → #2d72b8', () => {
    const door = resolveSubcategoryStyle({ category: 'opening', subcategoryKey: 'door-opening', cutState: 'cut', ...base });
    const win = resolveSubcategoryStyle({ category: 'opening', subcategoryKey: 'window-opening', cutState: 'cut', ...base });
    expect(door.color).toBe('#c97c2f');
    expect(win.color).toBe('#2d72b8');
  });

  it('projection cutState δίνει το ίδιο χρώμα με cut (κοινό line color)', () => {
    const proj = resolveSubcategoryStyle({ category: 'wall', subcategoryKey: 'interior', cutState: 'projection', ...base });
    expect(proj.color).toBe('#6b7280');
  });
});
