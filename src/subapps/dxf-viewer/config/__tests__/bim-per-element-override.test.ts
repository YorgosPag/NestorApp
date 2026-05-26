/**
 * ADR-375 Phase C.5 — Per-element style override tests.
 *
 * Priority stack (highest → lowest):
 *   cutState=hidden → zero
 *   elementOverride.visible=false → zero
 *   parent.visible=false (C.4) → zero
 *   elementOverride.cutPen / projectionPen → override pen
 *   subcategory override pen
 *   parent objectStyle pen
 *   color/pattern: elementOverride > subcategory > parent V/G > null/'solid'
 */
import { describe, it, expect } from '@jest/globals';
import { resolveSubcategoryStyle } from '../bim-line-weight-resolver';
import type { BimElementStyleOverride, ObjectStyle } from '../bim-object-styles';

const BASE_CTX = {
  category: 'wall' as const,
  cutState: 'cut' as const,
  scaleDenominator: 100,
  dpi: 96,
};

describe('ADR-375 C.5 — per-element override', () => {
  describe('visibility', () => {
    it('elementOverride.visible=false → zero lineWidthPx', () => {
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        elementOverride: { visible: false },
      });
      expect(result.lineWidthPx).toBe(0);
      expect(result.linePattern).toBe('solid');
      expect(result.color).toBeNull();
    });

    it('elementOverride.visible=false beats category visible (no override)', () => {
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        objectStyles: { wall: { projectionPen: 5, cutPen: 7, visible: true } },
        elementOverride: { visible: false },
      });
      expect(result.lineWidthPx).toBe(0);
    });

    it('elementOverride undefined → normal resolution (regression)', () => {
      const result = resolveSubcategoryStyle({ ...BASE_CTX });
      expect(result.lineWidthPx).toBeGreaterThan(0);
    });

    it('elementOverride={} → normal resolution (regression)', () => {
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        elementOverride: {},
      });
      expect(result.lineWidthPx).toBeGreaterThan(0);
    });
  });

  describe('pen override', () => {
    it('elementOverride.cutPen wins over objectStyles cutPen (cut state)', () => {
      const basePx = resolveSubcategoryStyle({ ...BASE_CTX }).lineWidthPx;
      // Pen #9 is heavier than default wall cut pen #7
      const overridePx = resolveSubcategoryStyle({
        ...BASE_CTX,
        elementOverride: { cutPen: 9 },
      }).lineWidthPx;
      expect(overridePx).toBeGreaterThan(basePx);
    });

    it('elementOverride.projectionPen wins for projection state', () => {
      const baseCtxProj = { ...BASE_CTX, cutState: 'projection' as const };
      const basePx = resolveSubcategoryStyle(baseCtxProj).lineWidthPx;
      // Pen #9 > default wall projection pen #5
      const overridePx = resolveSubcategoryStyle({
        ...baseCtxProj,
        elementOverride: { projectionPen: 9 },
      }).lineWidthPx;
      expect(overridePx).toBeGreaterThan(basePx);
    });

    it('elementOverride.cutPen ignored in projection state (uses projectionPen)', () => {
      const baseCtxProj = { ...BASE_CTX, cutState: 'projection' as const };
      const basePx = resolveSubcategoryStyle(baseCtxProj).lineWidthPx;
      // cutPen should not affect projection
      const result = resolveSubcategoryStyle({
        ...baseCtxProj,
        elementOverride: { cutPen: 9 },
      });
      expect(result.lineWidthPx).toBe(basePx);
    });

    it('priority: elementOverride > subcategory pen > parent pen', () => {
      // subcategory sets cutPen=6, elementOverride sets cutPen=9 (heavier)
      const objectStyles: Partial<Record<'wall', ObjectStyle>> = {
        wall: { projectionPen: 5, cutPen: 7, subcategories: { 'edges': { cutPen: 6 } } },
      };
      const withSubcat = resolveSubcategoryStyle({
        ...BASE_CTX, subcategoryKey: 'edges', objectStyles,
      });
      const withOverride = resolveSubcategoryStyle({
        ...BASE_CTX, subcategoryKey: 'edges', objectStyles,
        elementOverride: { cutPen: 9 },
      });
      expect(withOverride.lineWidthPx).toBeGreaterThan(withSubcat.lineWidthPx);
    });
  });

  describe('color override', () => {
    it('elementOverride.color wins over subcategory + parent color', () => {
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        objectStyles: { wall: { projectionPen: 5, cutPen: 7, cutColor: '#aabbcc' } },
        elementOverride: { color: '#ff0000' },
      });
      expect(result.color).toBe('#ff0000');
    });

    it('elementOverride.color=null wins (canvas token)', () => {
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        objectStyles: { wall: { projectionPen: 5, cutPen: 7, cutColor: '#aabbcc' } },
        elementOverride: { color: null },
      });
      expect(result.color).toBeNull();
    });

    it('elementOverride.color=undefined → falls through to parent color', () => {
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        objectStyles: { wall: { projectionPen: 5, cutPen: 7, cutColor: '#aabbcc' } },
        elementOverride: { cutPen: 9 },
      });
      expect(result.color).toBe('#aabbcc');
    });
  });

  describe('linePattern override', () => {
    it('elementOverride.linePattern wins over subcategory + parent pattern', () => {
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        objectStyles: { wall: { projectionPen: 5, cutPen: 7, cutPattern: 'dashed' } },
        elementOverride: { linePattern: 'dashed2' },
      });
      expect(result.linePattern).toBe('dashed2');
    });

    it('elementOverride.linePattern=undefined → falls through to parent pattern', () => {
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        objectStyles: { wall: { projectionPen: 5, cutPen: 7, cutPattern: 'dashed' } },
        elementOverride: {},
      });
      expect(result.linePattern).toBe('dashed');
    });
  });

  describe('combined overrides', () => {
    it('cutPen + color + linePattern all together', () => {
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        elementOverride: { cutPen: 9, color: '#123456', linePattern: 'dashed2' },
      });
      expect(result.lineWidthPx).toBeGreaterThan(0);
      expect(result.color).toBe('#123456');
      expect(result.linePattern).toBe('dashed2');
    });

    it('partial override — only color, no pen → pen from objectStyles', () => {
      const basePx = resolveSubcategoryStyle({ ...BASE_CTX }).lineWidthPx;
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        elementOverride: { color: '#ff0000' },
      });
      expect(result.lineWidthPx).toBe(basePx);
      expect(result.color).toBe('#ff0000');
    });

    it('partial override — only linePattern, no pen → pen from objectStyles', () => {
      const basePx = resolveSubcategoryStyle({ ...BASE_CTX }).lineWidthPx;
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        elementOverride: { linePattern: 'dashed' },
      });
      expect(result.lineWidthPx).toBe(basePx);
      expect(result.linePattern).toBe('dashed');
    });
  });

  describe('cutState=hidden still wins over elementOverride', () => {
    it('hidden beats elementOverride pen', () => {
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        cutState: 'hidden',
        elementOverride: { cutPen: 9, visible: true, color: '#ff0000' },
      });
      expect(result.lineWidthPx).toBe(0);
    });
  });
});
