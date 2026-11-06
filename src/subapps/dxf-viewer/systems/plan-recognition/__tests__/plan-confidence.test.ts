/**
 * ADR-929 Φ5 — επίπεδα βεβαιότητας και γεωμετρία της επικάλυψης: ένας αναγνώστης κατωφλίων, ένα σημάδι ανά
 * επίπεδο (χρώμα ΚΑΙ μοτίβο), και τα τμήματα στη σκηνή ΜΟΝΟ μέσω του `rasterPixelToScene`.
 */

import { PLAN_CONFIDENCE_MARKS } from '../../../config/color-config';
import { rasterPixelToScene } from '../../../floorplan-background/geometry/raster-scene-mapping';
import type { RasterSegment } from '../../../bim/plan-recognition/plan-recognition-types';
import {
  countByConfidenceTier,
  meetsConfidenceTier,
  PLAN_CONFIDENCE_ORDER,
  planConfidenceMark,
  planConfidenceTier,
} from '../plan-confidence';
import { sceneSegmentsByTier } from '../plan-overlay-geometry';

describe('ADR-929 Φ5 — επίπεδα βεβαιότητας', () => {
  it.each([
    [0.95, 'high'], [0.8, 'high'], [0.79, 'medium'], [0.6, 'medium'], [0.59, 'low'], [0, 'low'],
  ] as const)('βαθμός %p ⇒ %s (τα κατώφλια του config, όχι δεύτερη σταθερά)', (score, tier) => {
    expect(planConfidenceTier(score)).toBe(tier);
  });

  it('χωρίς βαθμό ⇒ χαμηλή: ποτέ σιωπηλή εμπιστοσύνη', () => {
    expect([null, undefined, Number.NaN].map(planConfidenceTier)).toEqual(['low', 'low', 'low']);
  });

  it('κάθε επίπεδο έχει ΔΙΚΟ του μοτίβο γραμμής και ΔΙΚΟ του χρώμα (WCAG 1.4.1)', () => {
    const marks = PLAN_CONFIDENCE_ORDER.map(planConfidenceMark);
    expect(new Set(marks.map((m) => m.dash)).size).toBe(PLAN_CONFIDENCE_ORDER.length);
    expect(new Set(marks.map((m) => m.stroke)).size).toBe(PLAN_CONFIDENCE_ORDER.length);
    expect(marks.every((m) => m.strokeWidth === PLAN_CONFIDENCE_MARKS.strokeWidthPx)).toBe(true);
  });

  it('πλήθη ανά επίπεδο', () => {
    expect(countByConfidenceTier([0.9, 0.85, 0.7, 0.1, null])).toEqual({ high: 2, medium: 1, low: 2 });
  });

  it('Φ5.2ε — «φτάνει το επίπεδο»: ίδια κατώφλια με την κατάταξη, χωρίς βαθμό ⇒ ποτέ', () => {
    expect([0.9, 0.6, 0.59, null].map((s) => meetsConfidenceTier(s, 'medium'))).toEqual([true, true, false, false]);
    expect([0.9, 0.79].map((s) => meetsConfidenceTier(s, 'high'))).toEqual([true, false]);
    expect([0, null].map((s) => meetsConfidenceTier(s, 'low'))).toEqual([true, true]);
  });
});

describe('ADR-929 Φ5 — η γεωμετρία της επικάλυψης', () => {
  const placement = {
    transform: { translateX: 100, translateY: 50, scaleX: 20, scaleY: 20, rotation: 0 },
    naturalBounds: { width: 400, height: 300 },
  };
  const seg = (id: string, x0: number, y0: number, x1: number, y1: number): RasterSegment => ({
    id, start: { x: x0, y: y0 }, end: { x: x1, y: y1 }, style: 'stroke', strokeWidthPx: 2, confidence: { score: 0.5, factors: {} },
  });

  it('κάθε τμήμα πάει στο επίπεδο της ΣΥΝΤΗΞΗΣ (όχι της Φ2), στη σκηνή μέσω του SSoT', () => {
    const segments = [seg('a', 0, 0, 10, 0), seg('b', 5, 5, 5, 25)];
    const confidence = new Map([['a', { score: 0.9, factors: {} }], ['b', { score: 0.65, factors: {} }]]);
    const out = sceneSegmentsByTier(segments, confidence, placement);
    expect(out.high).toEqual([[rasterPixelToScene(segments[0].start, placement), rasterPixelToScene(segments[0].end, placement)]]);
    expect(out.medium).toHaveLength(1);
    expect(out.low).toHaveLength(0);
  });

  it('τμήμα που η σύντηξη δεν βαθμολόγησε ⇒ χαμηλή', () => {
    expect(sceneSegmentsByTier([seg('x', 0, 0, 1, 1)], new Map(), placement).low).toHaveLength(1);
  });
});
