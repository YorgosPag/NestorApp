/**
 * ADR-941 Φ2α — `bindPdfDimensions`: γραμμένη τιμή → ακμή (Δ10–Δ12) όταν το σχέδιο ΔΕΝ έχει γραφικά διάστασης (Φ2β: ξεχωριστή σουίτα), σε px της σελίδας (Y κάτω).
 *
 * Το σχήμα του ΤΕΣΤ1: ορθογώνιο, «2.05» οριζόντιο πάνω από την πάνω πλευρά, «4.12» κάθετο (διαβάζεται από κάτω προς τα πάνω)
 * δεξιά από τη δεξιά πλευρά. Μήκη σε px = mm / 10 ⇒ κλίμακα 0,1 px/mm.
 */

import type { PdfVectorContent, PdfVectorText } from '../../../pdf-background/services/pdf-vector-content';
import { bindPdfDimensions, type PdfDimensionBinding } from '../pdf-vector-dimension-binding';

const RECT = { points: [[100, 100], [305, 100], [305, 512], [100, 512]] as [number, number][], closed: true };

/** Οριζόντιο κείμενο με em 10 px που ξεκινά στο `(x, y)` και έχει πλάτος `w`. */
const horizontal = (text: string, x: number, y: number, w = 30): PdfVectorText =>
  ({ text, origin: [x, y], along: [x + 10, y], up: [x, y - 10], end: [x + w, y] });
/** Κάθετο κείμενο (περιστροφή +90° στη σελίδα) με em 10 px: κατά μήκος = πάνω, «πάνω» = αριστερά. */
const vertical = (text: string, x: number, y: number, w = 30): PdfVectorText =>
  ({ text, origin: [x, y], along: [x, y - 10], up: [x - 10, y], end: [x, y - w] });

/** Η ακμή που μετρά ένα δέσιμο της Φ2α: πολυγραμμή + κορυφές αρχής/τέλους. */
const edgeOf = (b: PdfDimensionBinding | undefined) => b && {
  polylineIndex: b.measured[0].vertex?.polylineIndex, from: b.measured[0].vertex?.index, to: b.measured[1].vertex?.index,
};

const content = (patch: Partial<PdfVectorContent>): PdfVectorContent => ({ polylines: [], texts: [], skippedFills: 0, fills: [], ...patch });

describe('bindPdfDimensions', () => {
  it('ΤΕΣΤ1: κάθε τιμή δένεται στην πλευρά της, με τις κορυφές της· η κλίμακα αποδεικνύεται', () => {
    const reading = bindPdfDimensions(content({
      polylines: [RECT],
      texts: [horizontal('2.05', 185, 80), vertical('4.12', 350, 321)],
    }));
    expect(reading.bindings.map((b) => [b.raw, b.valueMm, edgeOf(b)])).toEqual([
      ['2.05', 2050, { polylineIndex: 0, from: 0, to: 1 }],
      ['4.12', 4120, { polylineIndex: 0, from: 1, to: 2 }],
    ]);
    expect(reading.pxPerMm).toBeCloseTo(0.1, 6);
    expect(reading.unbound).toBe(0);
  });

  it('η γραμμή διάστασης περνά από το μέσο της γραμμής βάσης του κειμένου', () => {
    const [binding] = bindPdfDimensions(content({ polylines: [RECT], texts: [horizontal('2.05', 185, 80, 30)] })).bindings;
    expect(binding.linePoint).toEqual([200, 80]);
    expect(binding.arrowheads).toBeNull(); // Φ2α: χωρίς σχεδιασμένα γραφικά
  });

  it('κείμενο που δεν είναι μήκος αγνοείται — ούτε δένεται ούτε μετρά ως αδέσμευτο', () => {
    const reading = bindPdfDimensions(content({ polylines: [RECT], texts: [horizontal('ΚΟΥΖΙΝΑ', 150, 90)] }));
    expect(reading).toEqual({ bindings: [], pxPerMm: null, unbound: 0, absorbed: new Set() });
  });

  it('μακριά από κάθε ακμή, ή κάθετο στη μόνη κοντινή ⇒ αδέσμευτο, μετρημένο', () => {
    const reading = bindPdfDimensions(content({
      polylines: [RECT],
      texts: [horizontal('2.05', 185, -200), vertical('3.00', 200, 95)],
    }));
    expect(reading.bindings).toEqual([]);
    expect(reading.unbound).toBe(2);
  });

  it('δύο παράλληλες ακμές κοντά στο κείμενο: διαλέγει η κλίμακα που στηρίζουν οι άλλες διαστάσεις', () => {
    // Διπλή γραμμή (σαν παρειές τοίχου): η πάνω μήκους 300 px, η κάτω 205 px. Το «2.05» κάθεται ανάμεσα.
    const outer = { points: [[100, 60], [400, 60]] as [number, number][], closed: false };
    const inner = { points: [[100, 100], [305, 100]] as [number, number][], closed: false };
    const reading = bindPdfDimensions(content({
      polylines: [outer, inner, RECT],
      texts: [horizontal('2.05', 185, 85), vertical('4.12', 350, 321)],
    }));
    const binding = reading.bindings.find((b) => b.raw === '2.05');
    // Η κάτω (205 px) και η πάνω πλευρά του ορθογωνίου ισοψηφούν· νικά η πρώτη — ΠΟΤΕ η ακμή των 300 px.
    expect(edgeOf(binding)).toEqual({ polylineIndex: 1, from: 0, to: 1 });
    expect(reading.pxPerMm).toBeCloseTo(0.1, 6);
  });

  it('αμφίσημο χωρίς συναίνεση (μία μόνη τιμή, δύο υποψήφιες) ⇒ αδέσμευτο, ποτέ μαντεψιά', () => {
    const a = { points: [[100, 60], [400, 60]] as [number, number][], closed: false };
    const b = { points: [[100, 100], [305, 100]] as [number, number][], closed: false };
    const reading = bindPdfDimensions(content({ polylines: [a, b], texts: [horizontal('2.05', 185, 85)] }));
    expect(reading.bindings).toEqual([]);
    expect(reading.unbound).toBe(1);
  });
});
