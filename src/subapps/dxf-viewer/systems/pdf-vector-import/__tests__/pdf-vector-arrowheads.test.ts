/**
 * ADR-941 Φ2β (Δ17 · Δ20) — `arrowheadAt`: ανάλυση μέσω σύνθεσης με τη βιβλιοθήκη μπλοκ, με τον ΙΔΙΟ κανόνα κατεύθυνσης
 * με τον renderer (μπλοκ με οδηγό ⇒ προς τα μέσα). Η αριστερή απόληξη του «2.05» του ΤΕΣΤ2, σε px (Y κάτω).
 */

import type { PdfVectorPolyline, PxPoint } from '../../../pdf-background/services/pdf-vector-content';
import { arrowheadAt, type ArrowheadScene } from '../pdf-vector-arrowheads';
import { polylineSegments, segmentGrid } from '../pdf-vector-segments';

const px = (x: number, y: number): PxPoint => [x, 800 - y];
const seg = (x1: number, y1: number, x2: number, y2: number): PdfVectorPolyline =>
  ({ points: [px(x1, y1), px(x2, y2)], closed: false });

/** Τρίγωνο περιγράμματος · κάθετη παύλα στη μύτη · οδηγός προς τα μέσα — το «Τέκτων Βέλος 2» όπως το έγραψε το PDF. */
const LEFT_ARROW: PdfVectorPolyline[] = [
  seg(222.36, 552.2, 222.36, 549.32), seg(222.36, 549.32, 215.52, 550.76), seg(215.52, 550.76, 222.36, 552.2),
  seg(232.56, 550.76, 215.52, 550.76), seg(215.52, 550.76, 215.52, 546.2), seg(215.52, 550.76, 215.52, 555.32),
];
const APEX = px(215.52, 550.76);
const EM = 8.93;

const sceneOf = (polylines: PdfVectorPolyline[], fills: PdfVectorPolyline[] = []): ArrowheadScene => {
  const segments = polylineSegments(polylines);
  return { grid: segmentGrid(segments, 4 * EM), fills, polylines };
};

describe('arrowheadAt', () => {
  it('ΤΕΣΤ2: με κατεύθυνση ΕΞΩ (σύμβαση του builder) ⇒ `tektonArrow2`, μέγεθος ≈ 6,84 px, και τα 6 κομμάτια του', () => {
    const hit = arrowheadAt(APEX, [-1, 0], sceneOf(LEFT_ARROW), EM);
    expect(hit?.blockName).toBe('tektonArrow2');
    expect(hit?.sizePx).toBeCloseTo(6.84, 1);
    expect([...(hit?.segmentIds ?? [])].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('ο κανόνας του renderer: το μπλοκ με οδηγό ΔΕΝ ταιριάζει με την ανάποδη κατεύθυνση (ένας κανόνας, όχι δύο)', () => {
    expect(arrowheadAt(APEX, [1, 0], sceneOf(LEFT_ARROW), EM)).toBeNull();
  });

  it('μερική ομοιότητα δεν είναι απόληξη: χωρίς τον οδηγό ⇒ όχι `tektonArrow2`', () => {
    const hit = arrowheadAt(APEX, [-1, 0], sceneOf(LEFT_ARROW.filter((_, i) => i !== 3)), EM);
    expect(hit?.blockName).not.toBe('tektonArrow2');
  });

  it('γεμάτο τρίγωνο (γέμισμα, καμία γραμμή) ⇒ `closedFilled`', () => {
    const fill: PdfVectorPolyline = { points: [[100, 450], [110, 448.5], [110, 451.5]], closed: true };
    expect(arrowheadAt([100, 450], [-1, 0], sceneOf([], [fill]), 10)?.blockName).toBe('closedFilled');
  });

  it('τίποτα κοντά στη μύτη ⇒ `null`', () => {
    expect(arrowheadAt([0, 0], [1, 0], sceneOf([seg(500, 500, 600, 500)]), 10)).toBeNull();
  });
});
