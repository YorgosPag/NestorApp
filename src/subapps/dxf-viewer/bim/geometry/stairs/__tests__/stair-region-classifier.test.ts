/**
 * ADR-619 — tests για τον ταξινομητή «Σκάλα από περιοχή» + τον builder params.
 */

import type { Point2D } from '../../../../rendering/types/Types';
import {
  classifyStairRegion,
  type StairRegionClassification,
} from '../stair-region-classifier';
import { buildStairParamsFromRegion } from '../stair-params-from-region';

/** Κανονικό n-γωνο ακτίνας r γύρω από (cx,cy) — προσέγγιση κύκλου. */
function regularPolygon(cx: number, cy: number, r: number, n: number): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

describe('classifyStairRegion — shape → kind', () => {
  it('γεμάτο ορθογώνιο (μακρύ στον X) → straight με direction κατά τον μακρύ άξονα', () => {
    const rect: Point2D[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 4 },
      { x: 0, y: 4 },
    ];
    const c = classifyStairRegion(rect);
    expect(c.kind).toBe('straight');
    expect(c.warning).toBeUndefined();
    // Μακρύς άξονας = X → direction (1,0), width = short (4), run = long (10).
    expect(c.direction.x).toBeCloseTo(1, 6);
    expect(c.direction.y).toBeCloseTo(0, 6);
    expect(c.width).toBeCloseTo(4, 6);
    expect(c.run).toBeCloseTo(10, 6);
    // basePoint = μέσο της κοντής (αριστερής) ακμής.
    expect(c.basePoint.x).toBeCloseTo(0, 6);
    expect(c.basePoint.y).toBeCloseTo(2, 6);
    expect(c.cornerCount).toBe(4);
  });

  it('ψηλό ορθογώνιο (μακρύ στον Y) → straight με direction (0,1)', () => {
    const rect: Point2D[] = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 12 },
      { x: 0, y: 12 },
    ];
    const c = classifyStairRegion(rect);
    expect(c.kind).toBe('straight');
    expect(c.direction.x).toBeCloseTo(0, 6);
    expect(c.direction.y).toBeCloseTo(1, 6);
    expect(c.run).toBeCloseTo(12, 6);
    expect(c.width).toBeCloseTo(4, 6);
  });

  it('L-εξάγωνο → lWithWinders', () => {
    const l: Point2D[] = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 6 },
      { x: 0, y: 6 },
    ];
    const c = classifyStairRegion(l);
    expect(c.cornerCount).toBe(6);
    expect(c.kind).toBe('lWithWinders');
    expect(c.warning).toBeUndefined();
    expect(c.fillRatio).toBeGreaterThan(0.45);
    expect(c.fillRatio).toBeLessThan(0.85);
  });

  it('U-οκτάγωνο → switchback', () => {
    const u: Point2D[] = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 6 },
      { x: 4, y: 6 },
      { x: 4, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 6 },
      { x: 0, y: 6 },
    ];
    const c = classifyStairRegion(u);
    expect(c.cornerCount).toBe(8);
    expect(c.kind).toBe('switchback');
    expect(c.warning).toBeUndefined();
  });

  it('~κύκλος (32-γωνο) → spiral, κέντρο ≈ centroid, width = ακτίνα', () => {
    const circle = regularPolygon(5, 5, 5, 32);
    const c = classifyStairRegion(circle);
    expect(c.kind).toBe('spiral');
    expect(c.circularity).toBeGreaterThan(0.7);
    // κέντρο ≈ (5,5)
    expect(c.basePoint.x).toBeCloseTo(5, 1);
    expect(c.basePoint.y).toBeCloseTo(5, 1);
    // width = short/2 ≈ 5
    expect(c.width).toBeGreaterThan(4);
    expect(c.width).toBeLessThan(5.1);
  });

  it('τετράγωνο ΔΕΝ γίνεται spiral (circularity ~0.785 αλλά 4 ορθές γωνίες)', () => {
    const square: Point2D[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
      { x: 0, y: 5 },
    ];
    const c = classifyStairRegion(square);
    expect(c.kind).toBe('straight');
  });
});

describe('classifyStairRegion — degenerate fallback (ΠΟΤΕ throw)', () => {
  it('< 3 κορυφές → straight fallback με warning', () => {
    const two: Point2D[] = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ];
    const c = classifyStairRegion(two);
    expect(c.kind).toBe('straight');
    expect(c.warning).toBeDefined();
    expect(c.confidence).toBeLessThan(0.5);
  });

  it('κενή είσοδος → straight fallback με warning (χωρίς crash)', () => {
    const c = classifyStairRegion([]);
    expect(c.kind).toBe('straight');
    expect(c.warning).toBeDefined();
  });

  it('μηδενικό εμβαδόν (συγγραμμικά σημεία) → straight fallback με warning', () => {
    const collinear: Point2D[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ];
    const c = classifyStairRegion(collinear);
    expect(c.kind).toBe('straight');
    expect(c.warning).toBeDefined();
  });
});

describe('buildStairParamsFromRegion — έγκυρα StairParams ανά kind', () => {
  const classify = (verts: Point2D[]): StairRegionClassification =>
    classifyStairRegion(verts, 'mm');

  it('straight → variant straight, stepCount ≥ 3, width από την περιοχή', () => {
    // 2800mm μήκος → ~10 σκαλοπάτια (default tread 280mm).
    const rect: Point2D[] = [
      { x: 0, y: 0 },
      { x: 2800, y: 0 },
      { x: 2800, y: 1000 },
      { x: 0, y: 1000 },
    ];
    const params = buildStairParamsFromRegion(classify(rect), 'mm');
    expect(params.variant.kind).toBe('straight');
    expect(params.stepCount).toBeGreaterThanOrEqual(3);
    expect(params.width).toBeCloseTo(1000, 3);
    expect(Number.isFinite(params.direction)).toBe(true);
    expect(params.totalRise).toBeGreaterThan(0);
  });

  it('lWithWinders → variant l-shape/winders με άθροισμα flightSplit + winders = stepCount', () => {
    const l: Point2D[] = [
      { x: 0, y: 0 },
      { x: 6000, y: 0 },
      { x: 6000, y: 2000 },
      { x: 2000, y: 2000 },
      { x: 2000, y: 6000 },
      { x: 0, y: 6000 },
    ];
    const params = buildStairParamsFromRegion(classify(l), 'mm');
    expect(params.variant.kind).toBe('l-shape');
    if (params.variant.kind === 'l-shape' && params.variant.cornerStyle === 'winders') {
      const [n1, n2] = params.variant.flightSplit;
      expect(n1).toBeGreaterThanOrEqual(1);
      expect(n2).toBeGreaterThanOrEqual(1);
      expect(n1 + params.variant.winderCount + n2).toBe(params.stepCount);
    }
  });

  it('switchback → variant u-shape με n1 + n2 = stepCount', () => {
    const u: Point2D[] = [
      { x: 0, y: 0 },
      { x: 6000, y: 0 },
      { x: 6000, y: 6000 },
      { x: 4000, y: 6000 },
      { x: 4000, y: 2000 },
      { x: 2000, y: 2000 },
      { x: 2000, y: 6000 },
      { x: 0, y: 6000 },
    ];
    const params = buildStairParamsFromRegion(classify(u), 'mm');
    expect(params.variant.kind).toBe('u-shape');
    if (params.variant.kind === 'u-shape') {
      const [n1, n2] = params.variant.flightSplit;
      expect(n1 + n2).toBe(params.stepCount);
    }
  });

  it('spiral → variant spiral με centerPoint + innerRadius 0, width > 0', () => {
    const circle = regularPolygon(3000, 3000, 1500, 32);
    const params = buildStairParamsFromRegion(classify(circle), 'mm');
    expect(params.variant.kind).toBe('spiral');
    if (params.variant.kind === 'spiral') {
      expect(params.variant.innerRadius).toBe(0);
      expect(params.variant.centerPoint.x).toBeCloseTo(3000, 0);
      expect(params.variant.centerPoint.y).toBeCloseTo(3000, 0);
    }
    expect(params.width).toBeGreaterThan(0);
  });

  it('εκφυλισμένη περιοχή → έγκυρα straight params (χωρίς crash)', () => {
    const params = buildStairParamsFromRegion(classify([]), 'mm');
    expect(params.variant.kind).toBe('straight');
    expect(params.stepCount).toBeGreaterThanOrEqual(3);
  });
});
