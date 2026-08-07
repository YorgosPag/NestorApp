/**
 * ADR-739 Φ.Δ βήμα 6 — 🔴 **ΤΟ ΚΟΣΤΟΣ ΤΟΥ ΚΟΥΤΙΟΥ ΑΝΑ ΚΑΡΕ.**
 *
 * ## Το ρίσκο, ονομαστικά
 * Το `projectBox()` ξαναϋπολογίζει το κουτί **σε κάθε καρέ** (γι' αυτό ο επεξεργαστής ζουμάρει
 * μαζί με τον καμβά). Το βήμα 6 έβαλε μέσα εκεί μια ερώτηση πλάτους κειμένου. Ένα αφελές
 * `ctx.measureText(draft, font)` θα ήταν **μία μέτρηση ανά καρέ** — δουλειά ανάλογη του
 * χρόνου, ακριβώς το σχήμα που τιμώρησε ο **ADR-735** (18,8 ms → 0,0 ms p50).
 *
 * Η άμυνα δεν είναι απομνημόνευση που ελπίζουμε να πετύχει: το κλειδί του cache είναι
 * **κανονικοποιημένο ως προς το μέγεθος**, οπότε το zoom δεν μπορεί καν να το αστοχήσει.
 * Αυτό το αρχείο το μετατρέπει σε **αριθμό**: ένας ισχυρισμός χωρίς μέτρηση δεν είναι απόδειξη.
 *
 * ## Τα μετρημένα νούμερα (πρόχειρο 90 χαρακτήρων, 60 καρέ zoom, 2026-08-01)
 * | Σενάριο                       | `ctx.measureText` ανά καρέ |
 * |-------------------------------|---------------------------|
 * | πρώτο (ψυχρό) καρέ             | 23 — **μία** φορά          |
 * | χωρίς αναδίπλωση, ζωντανό zoom | **0,00**                   |
 * | με αναδίπλωση, ζωντανό zoom    | **0,85**                   |
 * | ανά πάτημα πλήκτρου            | **1**                      |
 *
 * Το «0,85» δεν είναι στρογγυλοποίηση του μηδενός: με ταβάνι σε px τα σημεία κοπής όντως
 * μετακινούνται καθώς μεγαλώνει η γραμματοσειρά. Είναι όμως **51 μετρήσεις σε 60 καρέ** αντί
 * για τις ~1.380 που θα έκανε ένας μη κανονικοποιημένος cache (23 × 60).
 *
 * ## Γιατί ψεύτικος καμβάς και όχι ο πραγματικός
 * Σε jsdom δεν υπάρχει 2D context, άρα ο μετρητής θα έπεφτε στον **ονομαστικό** δρόμο και
 * καμία `measureText` δεν θα γινόταν ποτέ — ένα test που θα ήταν πράσινο ακόμη κι αν ο cache
 * είχε αφαιρεθεί ολόκληρος. Ο ψεύτικος καμβάς είναι αυτό που κάνει τον έλεγχο να **μπορεί**
 * να αποτύχει.
 */

import type { TableCellEditTarget } from '../../../bim/table/table-cell-edit-session';
import type { TableCellStyle } from '../../../bim/table/table-style';
import type { TableCellAlign, TableColumnId, TableRowId } from '../../../types/table';

// ── Ο ψεύτικος καμβάς: μετρά κάθε ερώτημα ────────────────────────────────────

let realCreateElement: typeof document.createElement;

function installCountingCanvas(): void {
  realCreateElement = document.createElement.bind(document);
  const ctx = {
    font: '',
    measureText(text: string) {
      const size = Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? 0);
      return {
        width: text.length * size * 0.5,
        fontBoundingBoxAscent: size * 0.9,
        fontBoundingBoxDescent: size * 0.25,
      };
    },
  };
  jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag !== 'canvas') return realCreateElement(tag);
    return { getContext: () => ctx } as unknown as HTMLCanvasElement;
  });
}

// Τα modules φορτώνονται ΜΕΤΑ το στήσιμο του ψεύτικου καμβά — ο μετρητής κρατά το context
// του σε module-level μεταβλητή, οπότε ένα import νωρίτερα θα κλείδωνε το `null` του jsdom.
installCountingCanvas();

/* eslint-disable @typescript-eslint/no-var-requires */
const {
  cellFontBandPx,
  cellTextWidthPx,
  __resetTableCellTextMetricsForTests,
  __tableCellMeasureCallsForTests,
} = require('../table-cell-text-metrics') as typeof import('../table-cell-text-metrics');
const { computeTableCellEditorFrame } =
  require('../table-cell-editor-frame') as typeof import('../table-cell-editor-frame');
/* eslint-enable @typescript-eslint/no-var-requires */

// ── Το σενάριο ───────────────────────────────────────────────────────────────

const DRAFT = 'ΠΕΡΙΓΡΑΦΗ ΕΡΓΑΣΙΑΣ ΠΟΛΥ ΜΑΚΡΙΑ ΓΙΑ ΤΟ ΚΕΛΙ ΤΗΣ, ΜΕ ΑΡΚΕΤΕΣ ΛΕΞΕΙΣ ΩΣΤΕ ΝΑ ΑΝΑΔΙΠΛΩΘΕΙ';

const style: TableCellStyle = {
  textHeightMm: 4,
  textColorHex: '#eeeeee',
  bold: false,
  italic: false,
  underline: false,
  align: 'ML' as TableCellAlign,
  indentLevel: 0,
  margins: { hMm: 2, vMm: 1 },
};

const target: TableCellEditTarget = {
  rowId: 'r1' as TableRowId,
  colId: 'c1' as TableColumnId,
  text: '',
  anchorWorldPoint: { x: 0, y: 0 },
  rectMm: { x: 0, y: 0, w: 40, h: 10 },
  style,
  hAlign: 'left',
  indentMm: 0,
  baselineFromTopMm: 7,
};

/** Ένα «καρέ»: ακριβώς ό,τι κάνει το `projectBox()`, με το zoom του καρέ. */
function frameAt(pxPerMm: number, maxWidthPx: number): void {
  computeTableCellEditorFrame({
    target,
    pxPerMm,
    angleRad: 0,
    resolveBand: cellFontBandPx,
    backgroundHex: '#101010',
    draft: DRAFT,
    maxWidthPx,
    resolveWidth: cellTextWidthPx,
  });
}

const FRAMES = 60;

beforeEach(() => __resetTableCellTextMetricsForTests());

describe('🔴 το κόστος του κουτιού σε 60 καρέ ζωντανού zoom', () => {
  it('ο ψεύτικος καμβάς είναι ΟΝΤΩΣ ενεργός — αλλιώς ο έλεγχος δεν μπορεί να αποτύχει', () => {
    cellTextWidthPx('ΑΒΓ', '20px arial');
    expect(__tableCellMeasureCallsForTests()).toBeGreaterThan(0);
  });

  it('ΧΩΡΙΣ αναδίπλωση: ΜΗΔΕΝ μετρήσεις μετά το πρώτο καρέ, όσο κι αν αλλάξει το zoom', () => {
    // Άφθονος χώρος ⇒ το κουτί απλώνεται οριζόντια και δεν αναδιπλώνει ποτέ.
    frameAt(4, 100_000);
    const afterFirst = __tableCellMeasureCallsForTests();

    for (let i = 1; i <= FRAMES; i++) frameAt(4 + i * 0.13, 100_000);

    expect(__tableCellMeasureCallsForTests()).toBe(afterFirst);
  });

  it('ΜΕ αναδίπλωση: το κόστος μένει O(log n) ανά γραμμή — ποτέ O(χαρακτήρες)', () => {
    // Με ταβάνι σε px, τα σημεία κοπής αλλάζουν με το zoom, άρα κάποιες μετρήσεις είναι
    // αναπόφευκτες. Αυτό που **δεν** επιτρέπεται είναι σάρωση χαρακτήρα-χαρακτήρα: με 90
    // χαρακτήρες αυτή θα έδινε δεκάδες μετρήσεις **ανά γραμμή ανά καρέ**.
    frameAt(4, 300);
    const afterFirst = __tableCellMeasureCallsForTests();

    for (let i = 1; i <= FRAMES; i++) frameAt(4 + i * 0.13, 300);

    const perFrame = (__tableCellMeasureCallsForTests() - afterFirst) / FRAMES;
    expect(perFrame).toBeLessThan(DRAFT.length / 2);
  });

  it('η ΠΛΗΚΤΡΟΛΟΓΗΣΗ κοστίζει, το ΚΑΡΕ όχι: ένας νέος χαρακτήρας ⇒ λίγες μετρήσεις', () => {
    frameAt(4, 100_000);
    const before = __tableCellMeasureCallsForTests();
    computeTableCellEditorFrame({
      target,
      pxPerMm: 4,
      angleRad: 0,
      resolveBand: cellFontBandPx,
      backgroundHex: '#101010',
      draft: `${DRAFT}Χ`,
      maxWidthPx: 100_000,
      resolveWidth: cellTextWidthPx,
    });
    // Το νέο πρόχειρο + η αναζήτηση του σημείου κοπής. Γραμμικό στο μήκος θα ήταν σφάλμα.
    expect(__tableCellMeasureCallsForTests() - before).toBeLessThan(20);
  });
});
