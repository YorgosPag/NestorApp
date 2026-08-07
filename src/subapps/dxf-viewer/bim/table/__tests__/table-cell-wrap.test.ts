/**
 * ADR-739 §58 Γ2 — **η αναδίπλωση, από άκρη σε άκρη.**
 *
 * Ο μετρητής είναι ο **ίδιος ενεθειμένος** με το `table-layout.test.ts` (`0.6 × ύψος` ανά
 * χαρακτήρα): κάθε αριθμός εδώ είναι επαληθεύσιμος με το χέρι, και καμία άγκυρα δεν
 * εξαρτάται από μετρικά γραμματοσειράς. **Όχι** δεύτερη υλοποίηση μέτρησης (N.18).
 *
 * 🔴 Το κρίσιμο group είναι το **πρώτο**: ότι κανένας υπάρχων πίνακας δεν άλλαξε. Η Φάση Γ
 * αγγίζει τη ΜΕΤΡΗΣΗ των γραμμών — δηλαδή τη γεωμετρία κάθε οντότητας πίνακα του έργου —
 * και μια σιωπηλή μετατόπιση εκεί θα εμφανιζόταν σε σχέδια που κανείς δεν άνοιξε.
 */

import { layoutTable } from '../table-layout';
import { createTableModel } from '../table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS, BUILTIN_TABLE_STYLES } from '../table-style-presets';
import { CHARACTER_METRICS } from '../../../config/text-rendering-config';
import type { TableStyle } from '../table-style';
import type { TableLayout, TableTextMeasurer } from '../table-layout-types';
import type { TableCell, TableCellOverflow, TableColumn, TableRow } from '../../../types/table';

const measureText: TableTextMeasurer = (text, heightMm) => text.length * heightMm * 0.6;

const STANDARD: TableStyle = (() => {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD);
  if (!style) throw new Error('missing STANDARD preset');
  return style;
})();

const TEXT_MM = STANDARD.rowClasses.data.textHeightMm;
const MARGIN_V_MM = STANDARD.rowClasses.data.margins.vMm;
const STEP_MM = TEXT_MM * CHARACTER_METRICS.LINE_HEIGHT_RATIO;

function col(id: string, widthMm: number, overflow?: TableCellOverflow): TableColumn {
  return {
    id,
    sizing: { kind: 'fixed', widthMm },
    valueType: 'text',
    align: 'left',
    ...(overflow !== undefined && { overflow }),
  };
}

function cell(value: string): TableCell {
  return { kind: 'text', value };
}

/** Ένας πίνακας μιας στήλης / μιας γραμμής δεδομένων — το ελάχιστο δείγμα. */
function layoutOne(
  value: string,
  widthMm: number,
  options?: { readonly overflow?: TableCellOverflow; readonly rowHeightMm?: number },
): TableLayout {
  const model = createTableModel({
    columns: [col('a', widthMm, options?.overflow)],
    rows: [
      { id: 'r1', rowClass: 'data', ...(options?.rowHeightMm !== undefined && { heightMm: options.rowHeightMm }) },
    ] as TableRow[],
    cells: [['r1', 'a', cell(value)]],
  });
  return layoutTable(model, STANDARD, { measureText });
}

describe('🔴 ΜΗΔΕΝ ΟΠΙΣΘΟΔΡΟΜΗΣΗ — κανένας υπάρχων πίνακας δεν άλλαξε', () => {
  it('χωρίς αναδίπλωση, το ύψος μένει το προεπιλεγμένο του στυλ', () => {
    // Κάθε πίνακας στον δίσκο σήμερα είναι `clip`. Αν αυτό αλλάξει, άλλαξε η ΓΕΩΜΕΤΡΙΑ
    // κάθε οντότητας πίνακα του έργου — σε σχέδια που κανείς δεν άνοιξε.
    expect(layoutOne('ΠΟΛΥ ΜΑΚΡΥ ΚΕΙΜΕΝΟ ΠΟΥ ΔΕΝ ΧΩΡΑΕΙ', 20).rows[0].heightMm)
      .toBe(STANDARD.defaultRowHeightMm);
  });

  it('χωρίς αναδίπλωση, το κελί έχει ΑΚΡΙΒΩΣ μία γραμμή κειμένου', () => {
    expect(layoutOne('ΠΟΛΥ ΜΑΚΡΥ ΚΕΙΜΕΝΟ ΠΟΥ ΔΕΝ ΧΩΡΑΕΙ', 20).cells[0].texts).toHaveLength(1);
  });

  it('🔴 λίγο κείμενο ΔΕΝ μικραίνει τη γραμμή — το αυτόματο ύψος έχει δάπεδο', () => {
    // Χωρίς το δάπεδο, κάθε γραμμή του έργου θα συρρικνωνόταν την ημέρα που μπήκε η φάση.
    expect(layoutOne('Α', 60, { overflow: 'wrap' }).rows[0].heightMm)
      .toBe(STANDARD.defaultRowHeightMm);
  });

  it('κενό κελί δεν παράγει καμία γραμμή — ποτέ μία κενή', () => {
    expect(layoutOne('', 40, { overflow: 'wrap' }).cells[0].texts).toEqual([]);
  });
});

describe('wrap — το κείμενο σπάει και η γραμμή ψηλώνει', () => {
  /** Πλάτος 20mm − 2×1mm περιθώρια = 18mm ωφέλιμα ⇒ 12 χαρακτήρες των 1,5mm. */
  const LONG = 'ΕΝΑ ΔΥΟ ΤΡΙΑ ΤΕΣΣΕΡΑ ΠΕΝΤΕ ΕΞΙ';

  it('παράγει ΠΟΛΛΕΣ γραμμές, όχι μία περικομμένη', () => {
    const layout = layoutOne(LONG, 20, { overflow: 'wrap' });
    expect(layout.cells[0].texts.length).toBeGreaterThan(1);
    expect(layout.cells[0].texts.some((r) => r.clipped)).toBe(false);
  });

  it('🔴 το ύψος της γραμμής ακολουθεί το ΠΛΗΘΟΣ των γραμμών', () => {
    const layout = layoutOne(LONG, 20, { overflow: 'wrap' });
    const lines = layout.cells[0].texts.length;
    expect(layout.rows[0].heightMm).toBeCloseTo(
      MARGIN_V_MM * 2 + TEXT_MM + (lines - 1) * STEP_MM,
      9,
    );
  });

  it('🔴 στενότερη στήλη ⇒ ΠΕΡΙΣΣΟΤΕΡΕΣ γραμμές ⇒ ΨΗΛΟΤΕΡΗ γραμμή (ο βρόχος ανάδρασης)', () => {
    const wide = layoutOne(LONG, 40, { overflow: 'wrap' });
    const narrow = layoutOne(LONG, 18, { overflow: 'wrap' });
    expect(narrow.cells[0].texts.length).toBeGreaterThan(wide.cells[0].texts.length);
    expect(narrow.rows[0].heightMm).toBeGreaterThan(wide.rows[0].heightMm);
  });

  it('🔴 το ΣΥΝΟΛΙΚΟ ύψος του πίνακα ακολουθεί — άρα και η γεωμετρία της οντότητας', () => {
    // Το `computeTableEntityGeometry` χτίζει το bbox από αυτόν τον αριθμό: αν δεν κουνιόταν,
    // οι λαβές και το hit-test θα έδειχναν αλλού από τα γράμματα.
    expect(layoutOne(LONG, 18, { overflow: 'wrap' }).heightMm)
      .toBeGreaterThan(layoutOne(LONG, 40, { overflow: 'wrap' }).heightMm);
  });

  it('καμία γραμμή δεν ξεπερνά το ωφέλιμο πλάτος', () => {
    const layout = layoutOne(LONG, 20, { overflow: 'wrap' });
    const usableMm = 20 - STANDARD.rowClasses.data.margins.hMm * 2;
    for (const run of layout.cells[0].texts) {
      expect(run.text.length * TEXT_MM * 0.6).toBeLessThanOrEqual(usableMm + 1e-9);
    }
  });

  it('🔴 ΚΑΝΕΝΑΣ χαρακτήρας δεν χάνεται', () => {
    const joined = layoutOne(LONG, 20, { overflow: 'wrap' })
      .cells[0].texts.map((r) => r.text).join('');
    expect(joined.replace(/\s+/gu, '')).toBe(LONG.replace(/\s+/gu, ''));
  });
});

describe('🔴 κατακόρυφη στοίχιση πολλαπλών γραμμών (AutoCAD/Revit)', () => {
  const LONG = 'ΕΝΑ ΔΥΟ ΤΡΙΑ ΤΕΣΣΕΡΑ';

  /**
   * 🔴 Το ύψος είναι **καρφωμένο και άφθονο** επίτηδες. Με αυτόματο ύψος η γραμμή γίνεται
   * ακριβώς όσο το κείμενο, οπότε δεν μένει ελεύθερος χώρος και οι τρεις στοιχίσεις
   * **συμπίπτουν** — σωστό, αλλά τότε το test δεν διακρίνει τίποτα και θα ήταν πράσινο
   * ακόμα κι αν η κατανομή ήταν εντελώς λάθος.
   */
  function baselines(align: 'TL' | 'ML' | 'BL'): number[] {
    const model = createTableModel({
      columns: [col('a', 20, 'wrap')],
      rows: [{ id: 'r1', rowClass: 'data', heightMm: 40, styleOverride: { align } }] as TableRow[],
      cells: [['r1', 'a', cell(LONG)]],
    });
    return layoutTable(model, STANDARD, { measureText }).cells[0].texts.map((r) => r.position.y);
  }

  it('με ΑΥΤΟΜΑΤΟ ύψος οι τρεις στοιχίσεις συμπίπτουν — το κείμενο γεμίζει το κελί', () => {
    const auto = (align: 'TL' | 'ML' | 'BL'): number => {
      const model = createTableModel({
        columns: [col('a', 20, 'wrap')],
        rows: [{ id: 'r1', rowClass: 'data', styleOverride: { align } }] as TableRow[],
        cells: [['r1', 'a', cell(LONG)]],
      });
      return layoutTable(model, STANDARD, { measureText }).cells[0].texts[0].position.y;
    };
    expect(auto('TL')).toBeCloseTo(auto('ML'), 9);
    expect(auto('ML')).toBeCloseTo(auto('BL'), 9);
  });

  it('οι γραμμές απέχουν ΑΚΡΙΒΩΣ ένα διάστιχο, σε κάθε στοίχιση', () => {
    for (const align of ['TL', 'ML', 'BL'] as const) {
      const ys = baselines(align);
      expect(ys.length).toBeGreaterThan(1);
      for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeCloseTo(STEP_MM, 9);
    }
  });

  it('🔴 T μεγαλώνει ΚΑΤΩ, B μεγαλώνει ΠΑΝΩ, M συμμετρικά', () => {
    const top = baselines('TL');
    const middle = baselines('ML');
    const bottom = baselines('BL');
    // Η **πρώτη** γραμμή του T είναι η ψηλότερη απ' όλες· η **τελευταία** του B η χαμηλότερη.
    expect(top[0]).toBeLessThan(middle[0]);
    expect(middle[0]).toBeLessThan(bottom[0]);
    expect(bottom[bottom.length - 1]).toBeGreaterThan(middle[middle.length - 1]);
  });
});

describe('🔴 καρφωμένο ύψος — το φράγμα γραμμών και ο δείκτης', () => {
  const LONG = 'ΕΝΑ ΔΥΟ ΤΡΙΑ ΤΕΣΣΕΡΑ ΠΕΝΤΕ ΕΞΙ ΕΠΤΑ ΟΚΤΩ';

  it('ρητό `heightMm` κερδίζει το περιεχόμενο — ο χρήστης το κάρφωσε', () => {
    const layout = layoutOne(LONG, 20, { overflow: 'wrap', rowHeightMm: 8 });
    expect(layout.rows[0].heightMm).toBe(8);
  });

  it('🔴 όσες γραμμές ΔΕΝ χωρούν δεν ζωγραφίζονται — τίποτα πάνω στο περίγραμμα', () => {
    const layout = layoutOne(LONG, 20, { overflow: 'wrap', rowHeightMm: 8 });
    const maxLines = Math.floor((8 - MARGIN_V_MM * 2 - TEXT_MM) / STEP_MM) + 1;
    expect(layout.cells[0].texts.length).toBeLessThanOrEqual(maxLines);
  });

  it('🔴 η τελευταία ΟΡΑΤΗ γραμμή φέρει τον δείκτη «…» — αλλιώς κρύβονται δεδομένα σιωπηλά', () => {
    const texts = layoutOne(LONG, 20, { overflow: 'wrap', rowHeightMm: 8 }).cells[0].texts;
    expect(texts[texts.length - 1].clipped).toBe(true);
    expect(texts[texts.length - 1].text).toContain('…');
  });

  it('αυτόματο ύψος ⇒ ΚΑΜΙΑ περικοπή: το φράγμα δεν δεσμεύει ποτέ', () => {
    const texts = layoutOne(LONG, 20, { overflow: 'wrap' }).cells[0].texts;
    expect(texts.some((r) => r.clipped)).toBe(false);
  });
});

describe('🔴 συγχωνεύσεις — πού μετρά το περιεχόμενο και πού όχι', () => {
  const LONG = 'ΕΝΑ ΔΥΟ ΤΡΙΑ ΤΕΣΣΕΡΑ ΠΕΝΤΕ';

  it('colSpan>1 σε ΜΙΑ γραμμή μετρά κανονικά, με το ΣΥΝΟΛΙΚΟ πλάτος (το Excel δεν το κάνει)', () => {
    const merged = createTableModel({
      columns: [col('a', 20, 'wrap'), col('b', 20, 'wrap')],
      rows: [{ id: 'r1', rowClass: 'data' }] as TableRow[],
      cells: [['r1', 'a', cell(LONG)]],
      merges: [{ anchorRowId: 'r1', anchorColId: 'a', rowSpan: 1, colSpan: 2 }],
    });
    const alone = layoutOne(LONG, 20, { overflow: 'wrap' });
    // Διπλάσιο πλάτος ⇒ λιγότερες γραμμές ⇒ χαμηλότερη γραμμή από το μονό κελί.
    expect(layoutTable(merged, STANDARD, { measureText }).rows[0].heightMm)
      .toBeLessThan(alone.rows[0].heightMm);
  });

  it('🔴 rowSpan>1 ΕΞΑΙΡΕΙΤΑΙ — δεν υπάρχει σωστή κατανομή ύψους σε τρεις γραμμές', () => {
    const merged = createTableModel({
      columns: [col('a', 20, 'wrap')],
      rows: [{ id: 'r1', rowClass: 'data' }, { id: 'r2', rowClass: 'data' }] as TableRow[],
      cells: [['r1', 'a', cell(LONG)]],
      merges: [{ anchorRowId: 'r1', anchorColId: 'a', rowSpan: 2, colSpan: 1 }],
    });
    const layout = layoutTable(merged, STANDARD, { measureText });
    expect(layout.rows[0].heightMm).toBe(STANDARD.defaultRowHeightMm);
    expect(layout.rows[1].heightMm).toBe(STANDARD.defaultRowHeightMm);
  });
});

describe('🏆 ισορροπία — η ορφανή λέξη δεν φτάνει στη διάταξη', () => {
  it('οι γραμμές δεν είναι «γεμάτη + μία λέξη»', () => {
    // greedy: «ΣΚΥΡΟΔΕΜΑ C20/» + «25 ΑΝΩ» ... balanced: πιο ισομερή μήκη.
    const texts = layoutOne('ΣΚΥΡΟΔΕΜΑ C20/25 ΑΝΩ ΠΕΔΙΛΟΥ', 26, { overflow: 'wrap' })
      .cells[0].texts.map((r) => r.text);
    expect(texts.length).toBeGreaterThan(1);
    const lengths = texts.map((t) => t.length);
    const spread = Math.max(...lengths) - Math.min(...lengths);
    // Η ισορρόπηση δεν υπόσχεται ίσα μήκη· υπόσχεται ότι δεν μένει **μία λέξη** μόνη της.
    expect(spread).toBeLessThan(Math.max(...lengths));
  });
});
