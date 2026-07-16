/**
 * ADR-667 Φ2 — native PDF tiling patterns.
 *
 * ⚠️ **Γιατί ΑΛΗΘΙΝΟΣ jsPDF και όχι mock:** ό,τι επικυρώνεται εδώ είναι ακριβώς η συμπεριφορά που
 * **ένα mock θα την επινοούσε**: η ακύρωση του unit-buggy `F` flip (Απόφαση 2 — αν ξεχαστεί, το
 * μοτίβο πέφτει ~74mm εκτός θέσης **χωρίς κανένα σφάλμα**), ο ντετερμινιστικός clone key
 * (Απόφαση 3) και ο κύκλος ζωής του render-target stack (Απόφαση 10). Ένα mock θα περνούσε
 * πράσινο με **λάθος** μαθηματικά.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-667-pdf-native-tiling-patterns.md
 */

import { jsPDF, type Matrix } from 'jspdf';
import {
  createPdfPatternRegistry, patternMatrixFor, MAX_PDF_PATTERNS_PER_PAGE,
  type PdfPatternCell,
} from '../pdf-tiling-pattern';

/** 1×1 PNG — αρκεί: εδώ ελέγχεται η ΤΟΠΟΘΕΤΗΣΗ, όχι το περιεχόμενο του κελιού. */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAf'
  + 'FcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** ⚠️ ΑΣΥΜΜΕΤΡΟ κελί: τετράγωνο στις 45° είναι συμμετρικό ⇒ **δεν** πιάνει το mirror. */
const CELL: PdfPatternCell = { materialKey: 'mat-a', dataUrl: PNG, cellWMm: 8, cellHMm: 2 };

function newPdf(): jsPDF {
  return new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: false });
}

/**
 * Το ΑΚΡΙΒΩΣ ίδιο που κάνει το `fillWithPattern` (`jspdf.node.js:5152`) πριν ψήσει το `/Matrix`:
 * ξανα-εφαρμόζει το `F`. Άρα αυτό ΕΙΝΑΙ το `M_final` που καταλήγει στο PDF.
 */
function bakedMatrix(pdf: jsPDF, angleDeg: number, ax = 0, ay = 0): Matrix {
  const h = pdf.internal.pageSize.getHeight();
  const f = pdf.Matrix(1, 0, 0, -1, 0, h);
  return f.multiply(patternMatrixFor(pdf, h, { anchorMm: { x: ax, y: ay }, angleDeg }));
}

/** Σημείο του κελιού (u,v) → **paper mm, Y-down** (ό,τι βλέπει ο χρήστης) μέσω του ψημένου matrix. */
function cellPointToPaperMm(pdf: jsPDF, m: Matrix, u: number, v: number) {
  const k = pdf.internal.scaleFactor;
  const xPt = u * m.a + v * m.c + m.e; // row-vector: p' = p · M
  const yPt = u * m.b + v * m.d + m.f;
  return { x: xPt / k, y: pdf.internal.pageSize.getHeight() - yPt / k };
}

describe('patternMatrixFor — ακύρωση του F + σύμβαση γωνίας (Αποφάσεις 2 & 12)', () => {
  it('γωνία 0 → το κελί προσγειώνεται ΑΚΡΙΒΩΣ στο anchor, σε paper mm', () => {
    const pdf = newPdf();
    const m = bakedMatrix(pdf, 0, 40, 60);
    // 🔴 Αν λείψει η ακύρωση του F, αυτό αστοχεί κατά ~74mm — και στην παραγωγή ΣΙΩΠΗΛΑ.
    const origin = cellPointToPaperMm(pdf, m, 0, 0);
    expect(origin.x).toBeCloseTo(40, 6);
    expect(origin.y).toBeCloseTo(60, 6);
  });

  it('γωνία 0 → οι άξονες του κελιού μένουν ομοιόμορφοι (u→+x, v→+y κάτω)', () => {
    const pdf = newPdf();
    const m = bakedMatrix(pdf, 0);
    expect(cellPointToPaperMm(pdf, m, 8, 0)).toMatchObject({ x: expect.closeTo(8, 6) });
    expect(cellPointToPaperMm(pdf, m, 8, 0).y).toBeCloseTo(0, 6);
    expect(cellPointToPaperMm(pdf, m, 0, 2).y).toBeCloseTo(2, 6); // Y-down: +v = προς τα κάτω
  });

  it('45° με ΑΣΥΜΜΕΤΡΟ κελί → θετική γωνία = visual CLOCKWISE (η οθόνη είναι η αλήθεια)', () => {
    const pdf = newPdf();
    const m = bakedMatrix(pdf, 45);
    const d = Math.SQRT1_2;
    // u-άξονας (8,0) → κάτω-δεξιά: x=+8·cos45, y=+8·sin45 (Y-down ⇒ θετικό y = ΚΑΤΩ = δεξιόστροφα).
    const u = cellPointToPaperMm(pdf, m, 8, 0);
    expect(u.x).toBeCloseTo(8 * d, 6);
    expect(u.y).toBeCloseTo(8 * d, 6);
    // v-άξονας (0,2) → κάτω-αριστερά. Καθρεφτισμένη σύμβαση θα έδινε x=+1.414 ⇒ ΑΣΤΟΧΙΑ.
    const v = cellPointToPaperMm(pdf, m, 0, 2);
    expect(v.x).toBeCloseTo(-2 * d, 6);
    expect(v.y).toBeCloseTo(2 * d, 6);
  });

  it('ΔΕΝ hardcode-άρει 210 — χρησιμοποιεί το πραγματικό pageHeight (210.0015…)', () => {
    const pdf = newPdf();
    // Το A4 landscape δίνει 210.0015555… (floating slop του pt↔mm round-trip). Η ακύρωση είναι
    // ακριβής ΜΟΝΟ αν χτίσιμο και ακύρωση μοιράζονται την ΙΔΙΑ τιμή.
    expect(pdf.internal.pageSize.getHeight()).not.toBe(210);
    expect(cellPointToPaperMm(pdf, bakedMatrix(pdf, 0, 10, 20), 0, 0).y).toBeCloseTo(20, 6);
  });
});

describe('PdfPatternRegistry — ορισμός, dedup, memoise (Αποφάσεις 3, 4, 10)', () => {
  it('defineAll → ισοζυγισμένο render-target stack (η σελίδα γράφεται ΚΑΝΟΝΙΚΑ μετά)', () => {
    const pdf = newPdf();
    const registry = createPdfPatternRegistry(pdf);
    registry.register(CELL);
    registry.defineAll();
    // Ξετύλιχτο stack ⇒ ό,τι ακολουθεί θα γραφόταν ΜΕΣΑ στο pattern ⇒ λευκή σελίδα, μηδέν σφάλμα.
    expect(pdf.isAdvancedAPI()).toBe(false);
    pdf.text('ΟΡΑΤΟ', 10, 10);
    expect(Buffer.from(pdf.output('arraybuffer')).toString('latin1')).toContain('/PatternType 1');
  });

  it('ίδιο κελί + ίδια τοποθέτηση σε 16 fills → ΕΝΑ clone (memoise, Απόφαση 3)', () => {
    const pdf = newPdf();
    const registry = createPdfPatternRegistry(pdf);
    registry.register(CELL);
    registry.defineAll();
    const placement = { anchorMm: { x: 10, y: 10 }, angleDeg: 30 };
    for (let i = 0; i < 16; i += 1) {
      pdf.lines([[5, 0], [0, 5], [-5, 0]], 20, 20, [1, 1], null, true);
      expect(registry.fillCurrentPath(CELL, placement)).toBe(true);
    }
    const raw = Buffer.from(pdf.output('arraybuffer')).toString('latin1');
    expect(raw.match(/\/Pattern cs/g)).toHaveLength(16);      // και τα 16 βάφτηκαν…
    expect(raw.match(/\/PatternType 1/g)).toHaveLength(2);    // …από base + ΕΝΑ clone
  });

  it('διαφορετική τοποθέτηση → διαφορετικό pattern (ΟΧΙ σιωπηλή επαναχρησιμοποίηση)', () => {
    const pdf = newPdf();
    const registry = createPdfPatternRegistry(pdf);
    registry.register(CELL);
    registry.defineAll();
    for (const angleDeg of [0, 30]) {
      pdf.lines([[5, 0], [0, 5], [-5, 0]], 20, 20, [1, 1], null, true);
      registry.fillCurrentPath(CELL, { anchorMm: { x: 10, y: 10 }, angleDeg });
    }
    const raw = Buffer.from(pdf.output('arraybuffer')).toString('latin1');
    expect(raw.match(/\/PatternType 1/g)).toHaveLength(3); // base + 2 clones
  });

  it('το raster ΔΕΝ διπλασιάζεται ανά fill — σταθερό alias ⇒ ένα embed', () => {
    const counts = [1, 16].map((n) => {
      const pdf = newPdf();
      const registry = createPdfPatternRegistry(pdf);
      registry.register(CELL);
      registry.defineAll();
      for (let i = 0; i < n; i += 1) {
        pdf.lines([[5, 0], [0, 5], [-5, 0]], 20, 20, [1, 1], null, true);
        registry.fillCurrentPath(CELL, { anchorMm: { x: 10, y: 10 }, angleDeg: 0 });
      }
      const raw = Buffer.from(pdf.output('arraybuffer')).toString('latin1');
      return (raw.match(/\/Subtype \/Image/g) ?? []).length;
    });
    expect(counts[0]).toBe(counts[1]); // 1 fill και 16 fills → ΙΔΙΟ πλήθος XObjects
  });

  it('ΜΗ καταχωρημένο κελί → false (το fillWithPattern θα έκανε ΣΙΩΠΗΛΟ no-op)', () => {
    const pdf = newPdf();
    const registry = createPdfPatternRegistry(pdf);
    registry.defineAll(); // τίποτα δεν δηλώθηκε
    pdf.lines([[5, 0], [0, 5], [-5, 0]], 20, 20, [1, 1], null, true);
    expect(registry.fillCurrentPath(CELL, { anchorMm: { x: 0, y: 0 }, angleDeg: 0 })).toBe(false);
  });

  it('εκφυλισμένο κελί/τοποθέτηση → false, ο caller πέφτει σε fallback (Απόφαση 8)', () => {
    const pdf = newPdf();
    const registry = createPdfPatternRegistry(pdf);
    registry.register({ ...CELL, cellWMm: 0 });
    registry.defineAll();
    expect(registry.fillCurrentPath({ ...CELL, cellWMm: 0 }, { anchorMm: { x: 0, y: 0 }, angleDeg: 0 })).toBe(false);
    registry.register(CELL);
    registry.defineAll(); // idempotent — δεν ξαναορίζει
    expect(registry.fillCurrentPath(CELL, { anchorMm: { x: NaN, y: 0 }, angleDeg: 0 })).toBe(false);
  });

  // 🔴 KILLER — `runPrintSet`: N φύλλα, ΕΝΑ jsPDF, ΔΙΑΦΟΡΕΤΙΚΟ `toPaper` ανά φύλλο. Registry ανά
  // document ⇒ το φύλλο 2 θα έπαιρνε το pattern του φύλλου 1 ⇒ λάθος κλίμακα ΚΑΙ φάση, σιωπηλά.
  it('δύο draw() κλήσεις (σετ φύλλων) → μηδέν διαρροή patterns μεταξύ φύλλων', () => {
    const pdf = newPdf();
    const sheet = (anchorMm: { x: number; y: number }) => {
      const registry = createPdfPatternRegistry(pdf); // ΑΝΑ draw, όχι ανά document
      registry.register(CELL);
      registry.defineAll();
      pdf.lines([[5, 0], [0, 5], [-5, 0]], 20, 20, [1, 1], null, true);
      expect(registry.fillCurrentPath(CELL, { anchorMm, angleDeg: 0 })).toBe(true);
    };
    sheet({ x: 10, y: 10 });
    pdf.addPage();
    sheet({ x: 90, y: 40 }); // άλλη τοποθέτηση → ΠΡΕΠΕΙ να πάρει δικό της pattern
    const matrices = [...Buffer.from(pdf.output('arraybuffer')).toString('latin1')
      .matchAll(/\/Matrix \[([^\]]+)\]/g)].map((m) => m[1]);
    expect(new Set(matrices).size).toBe(2); // δύο ΔΙΑΦΟΡΕΤΙΚΑ ψημένα matrices, μηδέν reuse
  });

  it('MAX_PDF_PATTERNS_PER_PAGE = 800 (μετρημένο: ~4.8MB / <1s)', () => {
    expect(MAX_PDF_PATTERNS_PER_PAGE).toBe(800);
  });
});
