/**
 * ADR-941 Φ2β — σχεδιασμένα γραφικά διάστασης: ΤΕΣΤ1 (σκέτα κείμενα) και ΤΕΣΤ2 (ίδιο + γραμμές διάστασης + βέλη) δίνουν
 * **το ίδιο αποτέλεσμα**· τα γραφικά αναγνωρίζονται από τη βιβλιοθήκη μπλοκ και απορροφώνται· ό,τι δεν αποδεικνύεται μένει.
 *
 * Τα ΤΕΣΤ1/ΤΕΣΤ2 είναι οι **πραγματικές** γραμμές και τα κείμενα των PDF του Giorgio (ανάγνωση pdf.js, μονάδες σελίδας με
 * Y πάνω), μετατρεμμένα σε px με Y κάτω (`y → 800 − y`), όπως τα δίνει το `readVectorContent`.
 */

import type { PdfVectorContent, PdfVectorPolyline, PdfVectorText, PxPoint } from '../../../pdf-background/services/pdf-vector-content';
import { bindPdfDimensions, type PdfDimensionBinding } from '../pdf-vector-dimension-binding';

type Seg = readonly [number, number, number, number];

const px = (x: number, y: number): PxPoint => [x, 800 - y];
const line = ([x1, y1, x2, y2]: Seg): PdfVectorPolyline => ({ points: [px(x1, y1), px(x2, y2)], closed: false });
/** Κείμενο από τον πίνακα του pdf.js `[a, b, c, d, e, f]` και το πλάτος του (μονάδες σελίδας). */
function text(str: string, [a, b, c, d, e, f]: readonly number[], width: number): PdfVectorText {
  const n = Math.hypot(a, b);
  return {
    text: str, origin: px(e, f), along: px(e + a, f + b), up: px(e + c, f + d), end: px(e + (a / n) * width, f + (b / n) * width),
  };
}
const content = (polylines: PdfVectorPolyline[], texts: PdfVectorText[], fills: PdfVectorPolyline[] = []): PdfVectorContent =>
  ({ polylines, texts, skippedFills: fills.length, fills });

/** ΤΕΣΤ2: το ορθογώνιο (0–3) και 26 γραμμές διάστασης «Τέκτων Βέλος 2» (4–29). */
const TEST2_LINES: readonly Seg[] = [
  [331.56, 291.32, 215.52, 291.32], [331.56, 524.72, 331.56, 291.32], [215.52, 524.72, 331.56, 524.72], [215.52, 291.32, 215.52, 524.72],
  [222.36, 552.2, 222.36, 549.32], [222.36, 549.32, 215.52, 550.76], [215.52, 550.76, 222.36, 552.2], [232.56, 550.76, 215.52, 550.76],
  [215.52, 550.76, 215.52, 546.2], [215.52, 550.76, 215.52, 555.32], [331.56, 550.76, 324.72, 549.32], [324.72, 552.2, 331.56, 550.76],
  [324.72, 549.32, 324.72, 552.2], [331.56, 550.76, 331.56, 546.2], [331.56, 550.76, 331.56, 555.32], [324.72, 550.76, 314.52, 550.76],
  [314.52, 550.76, 331.56, 550.76], [378.12, 298.04, 380.88, 298.04], [380.88, 298.04, 379.44, 291.32], [379.44, 291.32, 378.12, 298.04],
  [379.44, 308.24, 379.44, 291.32], [379.44, 291.32, 384, 291.32], [379.44, 291.32, 375, 291.32], [379.44, 524.72, 380.88, 517.88],
  [378.12, 517.88, 379.44, 524.72], [380.88, 517.88, 378.12, 517.88], [379.44, 524.72, 384, 524.72], [379.44, 524.72, 375, 524.72],
  [379.44, 517.88, 379.44, 507.68], [379.44, 507.68, 379.44, 524.72],
];
const TEST2 = content(TEST2_LINES.map(line), [
  text('2.05', [8.92, 0, 0, 8.93, 264.6, 548.36], 17.32),
  text('4.12', [0, 8.92, -8.93, 0, 381.84, 399.08], 17.32),
]);

/** ΤΕΣΤ1: το ίδιο ορθογώνιο (μετατοπισμένο) με σκέτα κείμενα. */
const TEST1 = content([
  [320.04, 302.72, 204, 302.72], [320.04, 536.24, 320.04, 302.72], [204, 536.24, 320.04, 536.24], [204, 302.72, 204, 536.24],
].map((s) => line(s as Seg)), [
  text('2.05', [8.92, 0, 0, 8.93, 253.08, 559.88], 17.32),
  text('4.12', [0, 8.92, -8.93, 0, 370.44, 410.6], 17.32),
]);

/** Οι κορυφές που μετρά ένα δέσιμο, ως σύνολο «πολυγραμμή:κορυφή» (η σειρά των άκρων δεν αλλάζει τη διάσταση). */
const vertices = (b: PdfDimensionBinding | undefined): string[] =>
  (b?.measured ?? []).map((m) => (m.vertex ? `${m.vertex.polylineIndex}:${m.vertex.index}` : 'none')).sort();
const byRaw = (bindings: readonly PdfDimensionBinding[], raw: string) => bindings.find((b) => b.raw === raw);

describe('Φ2β — ΤΕΣΤ2 (Τέκτων: γραμμές διάστασης + «Βέλος 2»)', () => {
  const reading = bindPdfDimensions(TEST2);

  it('και οι δύο τιμές είναι διαστάσεις με τις απολήξεις του σχεδίου (`tektonArrow2`, όχι το σκέτο τρίγωνο)', () => {
    expect(reading.bindings.map((b) => [b.raw, b.arrowheads])).toEqual([
      ['2.05', ['tektonArrow2', 'tektonArrow2']],
      ['4.12', ['tektonArrow2', 'tektonArrow2']],
    ]);
    expect(reading.unbound).toBe(0);
  });

  it('μετρούν τις ΠΛΕΥΡΕΣ του ορθογωνίου (κορυφές της ίδιας ακμής), όχι τις μύτες', () => {
    expect(vertices(byRaw(reading.bindings, '2.05'))).toEqual(['2:0', '2:1']);
    expect(vertices(byRaw(reading.bindings, '4.12'))).toEqual(['1:0', '1:1']);
  });

  it('η γραμμή διάστασης περνά από τη ΣΧΕΔΙΑΣΜΕΝΗ γραμμή του PDF', () => {
    expect(byRaw(reading.bindings, '2.05')?.linePoint[1]).toBeCloseTo(800 - 550.76, 6);
    expect(byRaw(reading.bindings, '4.12')?.linePoint[0]).toBeCloseTo(379.44, 6);
  });

  it('Δ19: απορροφώνται ΚΑΙ οι 26 γραμμές διάστασης — καμία πλευρά του ορθογωνίου', () => {
    expect([...reading.absorbed].sort((a, b) => a - b)).toEqual(Array.from({ length: 26 }, (_, i) => i + 4));
  });

  it('η κλίμακα αποδεικνύεται όπως πριν (116,04 px = 2,05 m)', () => {
    expect(reading.pxPerMm).toBeCloseTo(116.04 / 2050, 4);
  });
});

describe('Φ2β — ΤΕΣΤ1 και ΤΕΣΤ2 δίνουν ΤΟ ΙΔΙΟ αποτέλεσμα', () => {
  it('ίδιες τιμές, στις ίδιες πλευρές· το ΤΕΣΤ1 (χωρίς γραφικά) μένει στη Φ2α, χωρίς απορρόφηση', () => {
    const t1 = bindPdfDimensions(TEST1);
    const t2 = bindPdfDimensions(TEST2);
    for (const raw of ['2.05', '4.12']) expect(vertices(byRaw(t1.bindings, raw))).toEqual(vertices(byRaw(t2.bindings, raw)));
    expect(t1.bindings.every((b) => b.arrowheads === null)).toBe(true);
    expect(t1.absorbed.size).toBe(0);
  });
});

/** Συνθετική διάσταση AutoCAD: ορθογώνια πλευρά y=500 (x 100–300), γραμμή διάστασης y=450, βοηθητικές με κενό. Px, Y κάτω. */
const EDGE: PdfVectorPolyline = { points: [[100, 500], [300, 500]], closed: false };
const seg = (x1: number, y1: number, x2: number, y2: number): PdfVectorPolyline => ({ points: [[x1, y1], [x2, y2]], closed: false });
const label = (str: string, x: number, baselineY: number): PdfVectorText =>
  ({ text: str, origin: [x, baselineY], along: [x + 10, baselineY], up: [x, baselineY - 10], end: [x + 20, baselineY] });
/** Γεμάτο βέλος (`closedFilled`, μήκος 10, μισό πλάτος 1,5) με μύτη στο `x` και σώμα προς `x + 10·sign`. */
const filledArrow = (x: number, sign: 1 | -1): PdfVectorPolyline =>
  ({ points: [[x, 450], [x + 10 * sign, 448.5], [x + 10 * sign, 451.5]], closed: true });

describe('Φ2β — συνθετικές διαστάσεις (AutoCAD)', () => {
  it('γεμάτα βέλη (γεμίσματα) + βοηθητικές με ελεύθερο άκρο ⇒ `closedFilled`, απορροφώνται γραμμή και βοηθητικές', () => {
    const reading = bindPdfDimensions(content(
      [EDGE, seg(100, 450, 300, 450), seg(100, 495, 100, 445), seg(300, 495, 300, 445)],
      [label('2.00', 190, 445)],
      [filledArrow(100, 1), filledArrow(300, -1)],
    ));
    expect(reading.bindings.map((b) => b.arrowheads)).toEqual([['closedFilled', 'closedFilled']]);
    expect(vertices(reading.bindings[0])).toEqual(['0:0', '0:1']);
    expect([...reading.absorbed].sort()).toEqual([1, 2, 3]);
  });

  it('πλάγιες παύλες με γραμμή που περνά πέρα από αυτές ⇒ `architecturalTick` (όχι το κατοπτρικό `oblique`)', () => {
    // «/» σε Y πάνω ⇒ σε px (Y κάτω): από (x−5, y+5) προς (x+5, y−5).
    const tick = (x: number) => seg(x - 5, 455, x + 5, 445);
    const reading = bindPdfDimensions(content([EDGE, seg(95, 450, 305, 450), tick(100), tick(300)], [label('2.00', 190, 445)]));
    expect(reading.bindings.map((b) => b.arrowheads)).toEqual([['architecturalTick', 'architecturalTick']]);
    expect([...reading.absorbed].sort()).toEqual([1, 2, 3]);
  });

  it('απόληξη μόνο στη ΜΙΑ πλευρά ⇒ ΔΕΝ είναι σχεδιασμένη διάσταση: τίποτα δεν απορροφάται (ποτέ μαντεψιά)', () => {
    const reading = bindPdfDimensions(content(
      [EDGE, seg(100, 450, 300, 450)], [label('2.00', 190, 445)], [filledArrow(100, 1)],
    ));
    expect(reading.absorbed.size).toBe(0);
    expect(reading.bindings.every((b) => b.arrowheads === null)).toBe(true);
  });

  it('γραμμή τοίχου που περνά ΑΠΟ τη μύτη αλλά καταλήγει σε άλλη γραμμή (γωνία) ΔΕΝ είναι βοηθητική — δεν απορροφάται', () => {
    // Ξεχωριστές γραμμές (όπως το ορθογώνιο του ΤΕΣΤ2): η κάθετη x=100 περνά από τη μύτη (450) και κλείνει γωνία στο 700.
    const reading = bindPdfDimensions(content(
      [EDGE, seg(100, 445, 100, 700), seg(100, 700, 300, 700), seg(100, 450, 300, 450), seg(300, 495, 300, 445)],
      [label('2.00', 190, 445)],
      [filledArrow(100, 1), filledArrow(300, -1)],
    ));
    expect(reading.bindings.map((b) => b.arrowheads)).toEqual([['closedFilled', 'closedFilled']]);
    expect([...reading.absorbed].sort()).toEqual([3, 4]);
  });
});
