/**
 * ADR-375 Phase C.6 — Layer-driven lineweight/color override tests.
 *
 * Priority stack (highest → lowest):
 *   cutState=hidden → zero
 *   parent.visible=false (C.4) → zero
 *   elementOverride.visible=false (C.5) → zero
 *   elementOverride.cutPen/projectionPen (C.5) → wins over layerOverride
 *   layerOverride.lineweightMm (C.6) → concrete mm → px (bypasses pen table)
 *   subcategory pen → objectStyles pen → DEFAULT_OBJECT_STYLES
 */
import { describe, it, expect } from '@jest/globals';
import { resolveSubcategoryStyle } from '../bim-line-weight-resolver';
import { lineweightToPx } from '../lineweight-iso-catalog';

const BASE_CTX = {
  category: 'wall' as const,
  cutState: 'cut' as const,
  scaleDenominator: 100,
  dpi: 96,
};

describe('ADR-375 C.6 — layer lineweight override', () => {
  describe('layer lineweightMm override', () => {
    it('layerOverride.lineweightMm → overrides pen-table lineWidthPx', () => {
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        layerOverride: { lineweightMm: 0.5 as any },
      });
      expect(result.lineWidthPx).toBeCloseTo(lineweightToPx(0.5 as any, 96), 5);
    });

    it('layerOverride.lineweightMm wins over subcategory pen', () => {
      const withSubcat = resolveSubcategoryStyle({
        ...BASE_CTX,
        subcategoryKey: 'common-edges',
        layerOverride: { lineweightMm: 0.25 as any },
      });
      const withoutSubcat = resolveSubcategoryStyle({
        ...BASE_CTX,
        layerOverride: { lineweightMm: 0.25 as any },
      });
      expect(withSubcat.lineWidthPx).toBeCloseTo(lineweightToPx(0.25 as any, 96), 5);
      expect(withoutSubcat.lineWidthPx).toBeCloseTo(lineweightToPx(0.25 as any, 96), 5);
    });

    it('ADR-375 v2.8 (Revit V/G semantics) — objectStyles V/G pen wins over layerOverride.lineweightMm', () => {
      // Industry parity (Revit V/G + ArchiCAD Graphic Override + AutoCAD Layer State):
      // explicit per-view category override (V/G) wins over Layer Object Style defaults.
      // Pre-v2.8 had Layer > V/G which silently nullified the V/G panel on entities with
      // assigned layers (Giorgio runtime report 2026-05-26).
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        objectStyles: { wall: { projectionPen: 5, cutPen: 7, visible: true } },
        layerOverride: { lineweightMm: 0.7 as any },
      });
      // V/G cutPen=7 ⇒ pen table lookup (NOT the layer 0.7mm bypass).
      const expectedFromPenTable = lineweightToPx(0.35 as any, 96); // PEN_TABLE_MM pen 7 @ 1:100 = 0.35mm
      expect(result.lineWidthPx).toBeCloseTo(expectedFromPenTable, 5);
      // Sanity: result must NOT equal the layer 0.7mm bypass value.
      expect(result.lineWidthPx).not.toBeCloseTo(lineweightToPx(0.7 as any, 96), 5);
    });

    it('layerOverride converted via lineweightToPx (not pen table)', () => {
      const mm = 0.3;
      const expected = lineweightToPx(mm as any, 96);
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        layerOverride: { lineweightMm: mm as any },
      });
      expect(result.lineWidthPx).toBeCloseTo(expected, 5);
    });
  });

  describe('elementOverride beats layerOverride (C.5 > C.6)', () => {
    it('elementOverride.cutPen wins over layerOverride.lineweightMm', () => {
      const resultWithLayer = resolveSubcategoryStyle({
        ...BASE_CTX,
        layerOverride: { lineweightMm: 2.0 as any },
      });
      const resultWithElem = resolveSubcategoryStyle({
        ...BASE_CTX,
        elementOverride: { cutPen: 1 },
        layerOverride: { lineweightMm: 2.0 as any },
      });
      expect(resultWithElem.lineWidthPx).not.toBeCloseTo(resultWithLayer.lineWidthPx, 1);
      expect(resultWithElem.lineWidthPx).toBeGreaterThan(0);
      expect(resultWithElem.lineWidthPx).toBeLessThan(lineweightToPx(2.0 as any, 96));
    });

    it('elementOverride.color wins over layerOverride.color', () => {
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        layerOverride: { color: '#aabbcc' },
        elementOverride: { color: '#112233' },
      });
      expect(result.color).toBe('#112233');
    });
  });

  describe('ADR-375 v2.8 — V/G category color wins over Layer color (Revit-faithful)', () => {
    it('objectStyles.wall.cutColor (V/G user) wins over layerOverride.color — Giorgio runtime bug 2026-05-26', () => {
      // Pre-v2.8: Layer > V/G silently nullified the V/G eye-icon color picker for entities
      // with assigned layers. Per Revit V/G semantics, explicit per-view category color must
      // win over Material/Layer color (Revit "Override Graphics in View" → projection/cut color).
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        cutState: 'cut',
        objectStyles: { wall: { projectionPen: 5, cutPen: 7, cutColor: '#ff0000' } },
        layerOverride: { color: '#0000ff' },
      });
      expect(result.color).toBe('#ff0000');
    });

    it('objectStyles.wall.projectionColor wins over layerOverride.color in projection state', () => {
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        cutState: 'projection',
        objectStyles: { wall: { projectionPen: 5, cutPen: 7, projectionColor: '#00ff00' } },
        layerOverride: { color: '#0000ff' },
      });
      expect(result.color).toBe('#00ff00');
    });

    it('explicit null V/G cutColor wins over layerOverride.color (user reset to canvas token)', () => {
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        cutState: 'cut',
        objectStyles: { wall: { projectionPen: 5, cutPen: 7, cutColor: null } },
        layerOverride: { color: '#0000ff' },
      });
      expect(result.color).toBeNull();
    });

    it('without V/G color override, layerOverride.color applies (existing behavior preserved)', () => {
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        cutState: 'cut',
        objectStyles: { wall: { projectionPen: 5, cutPen: 7 } },
        layerOverride: { color: '#0000ff' },
      });
      expect(result.color).toBe('#0000ff');
    });
  });

  describe('layerOverride.color', () => {
    it('layerOverride.color overrides subcategory/parent color (below elementOverride)', () => {
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        layerOverride: { lineweightMm: 0.5 as any, color: '#aabbcc' },
      });
      expect(result.color).toBe('#aabbcc');
    });

    it('layerOverride.color applies even without lineweightMm', () => {
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        layerOverride: { color: '#001122' },
      });
      expect(result.color).toBe('#001122');
    });

    it('layerOverride.color=null → null propagated', () => {
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        layerOverride: { lineweightMm: 0.3 as any, color: null },
      });
      expect(result.color).toBeNull();
    });
  });

  describe('pattern unaffected by layerOverride', () => {
    it('pattern comes from subcategory/parent, not from layerOverride', () => {
      const withLayer = resolveSubcategoryStyle({
        ...BASE_CTX,
        layerOverride: { lineweightMm: 0.5 as any },
      });
      const withoutLayer = resolveSubcategoryStyle({ ...BASE_CTX });
      expect(withLayer.linePattern).toBe(withoutLayer.linePattern);
    });
  });

  describe('higher-priority guards beat layerOverride', () => {
    it('cutState=hidden beats layerOverride', () => {
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        cutState: 'hidden',
        layerOverride: { lineweightMm: 1.0 as any },
      });
      expect(result.lineWidthPx).toBe(0);
    });

    it('parent.visible=false (C.4) beats layerOverride', () => {
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        objectStyles: { wall: { projectionPen: 5, cutPen: 7, visible: false } },
        layerOverride: { lineweightMm: 1.0 as any },
      });
      expect(result.lineWidthPx).toBe(0);
    });

    it('elementOverride.visible=false (C.5) beats layerOverride', () => {
      const result = resolveSubcategoryStyle({
        ...BASE_CTX,
        elementOverride: { visible: false },
        layerOverride: { lineweightMm: 1.0 as any },
      });
      expect(result.lineWidthPx).toBe(0);
    });
  });

  describe('sentinel values skipped', () => {
    it('layerOverride undefined → normal resolution (regression)', () => {
      const result = resolveSubcategoryStyle({ ...BASE_CTX });
      expect(result.lineWidthPx).toBeGreaterThan(0);
    });

    it('layerOverride={} → normal resolution (regression)', () => {
      const result = resolveSubcategoryStyle({ ...BASE_CTX, layerOverride: {} });
      expect(result.lineWidthPx).toBeGreaterThan(0);
    });

    it('layerOverride with undefined lineweightMm → falls through to pen table', () => {
      const withLayer = resolveSubcategoryStyle({
        ...BASE_CTX,
        layerOverride: { lineweightMm: undefined, color: undefined },
      });
      const withoutLayer = resolveSubcategoryStyle({ ...BASE_CTX });
      expect(withLayer.lineWidthPx).toBeCloseTo(withoutLayer.lineWidthPx, 5);
    });
  });
});
