/**
 * ADR-408 Φ15 — vertical drain stack (riser / κατακόρυφη στήλη).
 *
 * A riser is a `mep-segment` with coincident-XY endpoints and a real Δz. Verifies
 * the geometry-driven detection, the plan glyph, and (crucially) that the segment
 * engine no longer rejects a vertical run as "too short" nor emits a NaN footprint.
 */

import {
  isSegmentVertical,
  riserDirection,
  RISER_MAX_PLAN_MM,
  type MepSegmentParams,
} from '../../types/mep-segment-types';
import { buildRiserSymbol, RISER_SYMBOL_RADIUS_PX } from '../mep-riser-symbol';
import { validateMepSegmentParams, computeMepSegmentGeometry } from '../../geometry/mep-segment-geometry';
import { buildDefaultMepSegmentParams } from '../../../hooks/drawing/mep-segment-completion';

/** A vertical drain riser: same XY, base z=0 → top z=3000 (1 storey). */
function riserParams(): MepSegmentParams {
  return buildDefaultMepSegmentParams(
    { x: 5, y: 5 },
    { x: 5, y: 5 },
    'pipe',
    { classification: 'sanitary-drainage', diameter: 100 },
    'mm',
    0,
    3000,
  );
}

describe('ADR-408 Φ15 — vertical riser', () => {
  describe('isSegmentVertical (geometry-driven detection)', () => {
    it('is TRUE for a coincident-XY run with a real rise', () => {
      expect(isSegmentVertical(riserParams())).toBe(true);
    });

    it('is FALSE for a horizontal run (long plan, no rise)', () => {
      const horiz = buildDefaultMepSegmentParams(
        { x: 0, y: 0 }, { x: 2000, y: 0 }, 'pipe', {}, 'mm',
      );
      expect(isSegmentVertical(horiz)).toBe(false);
    });

    it('is FALSE for a sloped branch (real plan run, even with a drop)', () => {
      const sloped = buildDefaultMepSegmentParams(
        { x: 0, y: 0 }, { x: 3000, y: 0 }, 'pipe', { classification: 'sanitary-drainage', slopePercent: 2 }, 'mm',
      );
      expect(isSegmentVertical(sloped)).toBe(false);
    });

    it('is FALSE for a coincident-XY pair with a negligible rise (degenerate stub)', () => {
      const stub = buildDefaultMepSegmentParams(
        { x: 1, y: 1 }, { x: 1, y: 1 }, 'pipe', { diameter: 100 }, 'mm', 1000, 1050, // 50mm < RISER_MIN_RISE
      );
      expect(isSegmentVertical(stub)).toBe(false);
    });
  });

  describe('riserDirection', () => {
    it("is 'up' when the top is higher than the base", () => {
      expect(riserDirection(riserParams())).toBe('up');
    });

    it("is 'down' when the run descends (e.g. into a basement)", () => {
      const down = buildDefaultMepSegmentParams(
        { x: 0, y: 0 }, { x: 0, y: 0 }, 'pipe', { diameter: 100 }, 'mm', 0, -3000,
      );
      expect(riserDirection(down)).toBe('down');
    });
  });

  describe('buildRiserSymbol (plan glyph)', () => {
    it('emits a circle + inner cross (2) + directional arrow (3 strokes)', () => {
      const sym = buildRiserSymbol({ x: 100, y: 80 }, RISER_SYMBOL_RADIUS_PX, 'up');
      expect(sym.cx).toBe(100);
      expect(sym.cy).toBe(80);
      expect(sym.r).toBe(RISER_SYMBOL_RADIUS_PX);
      expect(sym.strokes).toHaveLength(5); // 2 cross + 1 stem + 2 barbs
      expect(sym.strokes.every((s) => s.length === 2)).toBe(true);
    });

    it('points the arrow up for up and down for down (screen y grows downward)', () => {
      const up = buildRiserSymbol({ x: 0, y: 0 }, 10, 'up');
      const down = buildRiserSymbol({ x: 0, y: 0 }, 10, 'down');
      // stem is strokes[2]: [edge, tip]. up tip.y < edge.y; down tip.y > edge.y.
      expect(up.strokes[2][1].y).toBeLessThan(up.strokes[2][0].y);
      expect(down.strokes[2][1].y).toBeGreaterThan(down.strokes[2][0].y);
    });
  });

  describe('segment engine accepts a vertical riser (no false "too short", no NaN)', () => {
    it('validateMepSegmentParams passes (3D length, not plan length)', () => {
      const result = validateMepSegmentParams(riserParams());
      expect(result.errors).not.toContain('mepSegment.tooShort');
      expect(result.errors).toHaveLength(0);
    });

    it('computeMepSegmentGeometry yields a finite footprint + bbox (no NaN)', () => {
      const geo = computeMepSegmentGeometry(riserParams());
      for (const v of geo.outline.vertices) {
        expect(Number.isFinite(v.x)).toBe(true);
        expect(Number.isFinite(v.y)).toBe(true);
      }
      for (const corner of [geo.bbox.min, geo.bbox.max]) {
        expect(Number.isFinite(corner.x)).toBe(true);
        expect(Number.isFinite(corner.y)).toBe(true);
        expect(Number.isFinite(corner.z)).toBe(true);
      }
      // 3D length ≈ the rise (plan run is ~0).
      expect(geo.length).toBeCloseTo(3, 5); // 3000mm → 3m
    });

    it('RISER_MAX_PLAN_MM guards the detection threshold', () => {
      expect(RISER_MAX_PLAN_MM).toBeGreaterThan(0);
    });
  });
});
