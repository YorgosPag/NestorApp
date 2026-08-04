/**
 * 🔴 ADR-754 **Β1** — τα χρωματιστά διακεκομμένα περιγράμματα, στον καμβά.
 *
 * Ελέγχεται **τι ζωγραφίστηκε πραγματικά** (ο κοινός καταγραφέας), όχι τι επιστράφηκε: ο
 * stamper δεν επιστρέφει τίποτα, οπότε η μόνη έγκυρη μαρτυρία είναι οι κλήσεις πάνω στο
 * context — μαζί με το **μοτίβο διακεκομμένης**, που ο καταγραφέας κρατά επίτηδες (ADR-750:
 * ένα stub που το κατάπινε ήταν πράσινο και για συμπαγή γραμμή).
 *
 * @see rendering/entities/table/__tests__/table-paint-recorder.ts — ο ΕΝΑΣ καταγραφέας
 */

import { stampTableFormulaReferences } from '../stamp-table-formula-references';
import { TABLE_FORMULA_REFERENCE } from '../../../../config/color-config';
import { createPaintLog, createRc, type PaintLog } from './table-paint-recorder';
import type { TableFormulaReferenceSpan } from '../../../../bim/table/formula/table-formula-reference-spans';
import type { TableLayout } from '../../../../bim/table/table-layout-types';

/** Πλέγμα 5×5, στήλες 20 mm × γραμμές 8 mm — ίδιο σχήμα με τη σουίτα της γραμματικής. */
const LAYOUT = {
  columns: [0, 1, 2, 3, 4].map((i) => ({
    id: `c${i + 1}`,
    xMm: i * 20,
    widthMm: 20,
  })),
  rows: [0, 1, 2, 3, 4].map((i) => ({
    id: `r${i + 1}`,
    yMm: i * 8,
    heightMm: 8,
  })),
  cells: [],
  widthMm: 100,
  heightMm: 40,
} as unknown as TableLayout;

function span(
  firstRow: number,
  firstCol: number,
  lastRow: number,
  lastCol: number,
  colorIndex: number,
): TableFormulaReferenceSpan {
  return {
    bounds: { firstRow, firstCol, lastRow, lastCol },
    colorIndex,
    start: 1,
    end: 3,
  };
}

/** Ταυτοτική προβολή επί 1 px/mm — οι αριθμοί οθόνης διαβάζονται ως χιλιοστά. */
function context(): { rc: ReturnType<typeof createRc>; log: PaintLog } {
  const log = createPaintLog();
  return { log, rc: createRc(log, { pxPerMm: 1, toScreen: (u, v) => ({ x: u, y: v }) }) };
}

describe('stampTableFormulaReferences', () => {
  it('σιωπά χωρίς αναφορές — η ΣΥΝΗΘΗΣ κατάσταση κάθε καρέ', () => {
    const { rc, log } = context();
    stampTableFormulaReferences(rc, LAYOUT, []);
    expect(log.strokes).toEqual([]);
  });

  it('ένα περίγραμμα ανά αναφορά, με το χρώμα της θέσης παλέτας', () => {
    const { rc, log } = context();
    stampTableFormulaReferences(rc, LAYOUT, [span(0, 0, 0, 0, 0), span(1, 1, 1, 1, 1)]);

    expect(log.strokes.map((s) => s.color)).toEqual([
      TABLE_FORMULA_REFERENCE.paletteHex[0],
      TABLE_FORMULA_REFERENCE.paletteHex[1],
    ]);
  });

  /**
   * 🔴 Δύο εμφανίσεις της **ίδιας** περιοχής (`=A1+A1`) δίνουν ίδιο δείκτη παλέτας, και το
   * δεύτερο πέρασμα θα ζωγράφιζε τα ίδια pixel. Σε **διακεκομμένη** γραμμή αυτό φαίνεται: το
   * δεύτερο πέρασμα γεμίζει τα κενά του μοτίβου ⇒ το περίγραμμα γίνεται **συμπαγές**, που σε
   * αυτόν τον πίνακα σημαίνει ήδη κάτι άλλο («εδώ πάει το πλήκτρο»).
   */
  it('🔴 ίδια περιοχή δύο φορές ⇒ ΕΝΑ πέρασμα, όχι δύο', () => {
    const { rc, log } = context();
    stampTableFormulaReferences(rc, LAYOUT, [span(0, 0, 0, 0, 0), span(0, 0, 0, 0, 0)]);
    expect(log.strokes).toHaveLength(1);
  });

  it('η παλέτα κυκλώνει — ο 6ος δείκτης ξαναπιάνει το πρώτο χρώμα', () => {
    const { rc, log } = context();
    const count = TABLE_FORMULA_REFERENCE.paletteHex.length;
    stampTableFormulaReferences(rc, LAYOUT, [span(0, 0, 0, 0, count), span(1, 0, 1, 0, count + 1)]);

    expect(log.strokes.map((s) => s.color)).toEqual([
      TABLE_FORMULA_REFERENCE.paletteHex[0],
      TABLE_FORMULA_REFERENCE.paletteHex[1],
    ]);
  });

  it('🔴 ΔΙΑΚΕΚΟΜΜΕΝΟ και στο πάχος του δρομέα — η μορφή κουβαλά το νόημα', () => {
    const { rc, log } = context();
    stampTableFormulaReferences(rc, LAYOUT, [span(0, 0, 0, 0, 0)]);

    expect(log.strokes[0].dashPx).toEqual([...TABLE_FORMULA_REFERENCE.dashPx]);
    expect(log.strokes[0].lineWidth).toBe(TABLE_FORMULA_REFERENCE.lineWidthPx);
  });

  it('το ορθογώνιο καλύπτει ΟΛΟΚΛΗΡΟ το εύρος — A1:C2 ⇒ 60 × 16 mm', () => {
    const { rc, log } = context();
    stampTableFormulaReferences(rc, LAYOUT, [span(0, 0, 1, 2, 0)]);

    const xs = log.strokes[0].points.map((p) => p.x);
    const ys = log.strokes[0].points.map((p) => p.y);
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([0, 60]);
    expect([Math.min(...ys), Math.max(...ys)]).toEqual([0, 16]);
  });

  /**
   * Μπαγιάτικη αναφορά σε γραμμή που μόλις σβήστηκε: η διάταξη δεν την έχει. Παράλειψη, ποτέ
   * μαντεψιά — και **χωρίς** να χαθούν οι υπόλοιπες, που είναι ακόμη σωστές.
   */
  it('αναφορά εκτός διάταξης παραλείπεται, οι υπόλοιπες ζωγραφίζονται', () => {
    const { rc, log } = context();
    const stale = {
      bounds: { firstRow: 40, firstCol: 40, lastRow: 41, lastCol: 41 },
      colorIndex: 0,
      start: 1,
      end: 3,
    };
    stampTableFormulaReferences(rc, LAYOUT, [stale, span(2, 2, 2, 2, 1)]);

    expect(log.strokes.map((s) => s.color)).toEqual([TABLE_FORMULA_REFERENCE.paletteHex[1]]);
  });
});
