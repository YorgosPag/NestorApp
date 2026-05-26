/**
 * ADR-375 Phase C.7 — BIM 3D Edge Resolver tests.
 *
 * Mirror του 2D bim-layer-override.test.ts pattern. The 3D resolver is a thin
 * wrapper, so most tests focus on:
 *   - {visible} signal derives from lineWidthPx > 0 (zero → invisible).
 *   - thresholdAngle: default 30° + override.
 *   - Inheriting 2D priority stack (we only spot-check, the 2D suite owns
 *     the exhaustive priority validation).
 */
import {
  resolve3DEdgeStyle,
  DEFAULT_EDGE_THRESHOLD_DEG,
} from '../bim-3d-edge-resolver';
import { lineweightToPx } from '../../../config/lineweight-iso-catalog';

const BASE_CTX = {
  category: 'wall' as const,
  cutState: 'projection' as const,
  scaleDenominator: 100,
  dpi: 96,
};

describe('ADR-375 C.7 — resolve3DEdgeStyle', () => {
  describe('default thresholdAngle', () => {
    it('uses 30° (Revit/ArchiCAD silhouette default) when no opts passed', () => {
      const result = resolve3DEdgeStyle(BASE_CTX);
      expect(result.thresholdAngle).toBe(DEFAULT_EDGE_THRESHOLD_DEG);
      expect(result.thresholdAngle).toBe(30);
    });

    it('opts.thresholdAngleDeg overrides default', () => {
      const result = resolve3DEdgeStyle(BASE_CTX, { thresholdAngleDeg: 45 });
      expect(result.thresholdAngle).toBe(45);
    });
  });

  describe('visible flag from lineWidthPx', () => {
    it('cutState=projection with default styles → visible=true', () => {
      const result = resolve3DEdgeStyle(BASE_CTX);
      expect(result.visible).toBe(true);
      expect(result.lineWidthPx).toBeGreaterThan(0);
    });

    it('cutState=hidden → visible=false (lineWidthPx=0)', () => {
      const result = resolve3DEdgeStyle({ ...BASE_CTX, cutState: 'hidden' });
      expect(result.visible).toBe(false);
      expect(result.lineWidthPx).toBe(0);
    });

    it('parent.visible=false (C.4) → visible=false', () => {
      const result = resolve3DEdgeStyle({
        ...BASE_CTX,
        objectStyles: { wall: { projectionPen: 5, cutPen: 7, visible: false } },
      });
      expect(result.visible).toBe(false);
      expect(result.lineWidthPx).toBe(0);
    });

    it('elementOverride.visible=false (C.5) → visible=false', () => {
      const result = resolve3DEdgeStyle({
        ...BASE_CTX,
        elementOverride: { visible: false },
      });
      expect(result.visible).toBe(false);
      expect(result.lineWidthPx).toBe(0);
    });
  });

  describe('priority stack pass-through (spot checks)', () => {
    it('layerOverride.lineweightMm (C.6) → bypasses pen table', () => {
      const result = resolve3DEdgeStyle({
        ...BASE_CTX,
        cutState: 'cut',
        layerOverride: { lineweightMm: 0.5 as any },
      });
      expect(result.lineWidthPx).toBeCloseTo(lineweightToPx(0.5 as any, 96), 5);
    });

    it('elementOverride.cutPen (C.5) wins over layerOverride.lineweightMm', () => {
      const withElem = resolve3DEdgeStyle({
        ...BASE_CTX,
        cutState: 'cut',
        elementOverride: { cutPen: 1 },
        layerOverride: { lineweightMm: 2.0 as any },
      });
      expect(withElem.lineWidthPx).toBeLessThan(lineweightToPx(2.0 as any, 96));
      expect(withElem.lineWidthPx).toBeGreaterThan(0);
    });

    it('layerOverride.color → propagated to result.color', () => {
      const result = resolve3DEdgeStyle({
        ...BASE_CTX,
        cutState: 'cut',
        layerOverride: { lineweightMm: 0.3 as any, color: '#ff0000' },
      });
      expect(result.color).toBe('#ff0000');
    });

    it('elementOverride.color (C.5) wins over layerOverride.color', () => {
      const result = resolve3DEdgeStyle({
        ...BASE_CTX,
        cutState: 'cut',
        layerOverride: { color: '#aabbcc' },
        elementOverride: { color: '#112233' },
      });
      expect(result.color).toBe('#112233');
    });

    it('layerOverride.color=null → null propagated (caller uses token)', () => {
      const result = resolve3DEdgeStyle({
        ...BASE_CTX,
        cutState: 'cut',
        layerOverride: { lineweightMm: 0.3 as any, color: null },
      });
      expect(result.color).toBeNull();
    });
  });

  describe('regression — undefined layer/element overrides', () => {
    it('layerOverride={} → falls through to pen table', () => {
      const withEmpty = resolve3DEdgeStyle({ ...BASE_CTX, layerOverride: {} });
      const baseline = resolve3DEdgeStyle(BASE_CTX);
      expect(withEmpty.lineWidthPx).toBeCloseTo(baseline.lineWidthPx, 5);
    });

    it('elementOverride={} → falls through (no override)', () => {
      const withEmpty = resolve3DEdgeStyle({ ...BASE_CTX, elementOverride: {} });
      const baseline = resolve3DEdgeStyle(BASE_CTX);
      expect(withEmpty.lineWidthPx).toBeCloseTo(baseline.lineWidthPx, 5);
    });
  });

  describe('all BIM categories produce a non-zero edge width by default', () => {
    const categories = ['wall', 'column', 'beam', 'slab', 'stair'] as const;
    for (const category of categories) {
      it(`${category} default projection → lineWidthPx > 0`, () => {
        const result = resolve3DEdgeStyle({ ...BASE_CTX, category });
        expect(result.lineWidthPx).toBeGreaterThan(0);
        expect(result.visible).toBe(true);
      });
    }
  });

  describe('stair subcategory pen wiring (ADR-377)', () => {
    it('stair tread subcategory → resolved (projection cutState)', () => {
      const result = resolve3DEdgeStyle({
        ...BASE_CTX,
        category: 'stair',
        subcategoryKey: 'treads',
      });
      expect(result.lineWidthPx).toBeGreaterThan(0);
    });

    it('stair handrails subcategory pattern dashed2 (sanity)', () => {
      const result = resolve3DEdgeStyle({
        ...BASE_CTX,
        category: 'stair',
        subcategoryKey: 'handrails',
      });
      expect(result.lineWidthPx).toBeGreaterThan(0);
    });
  });
});
