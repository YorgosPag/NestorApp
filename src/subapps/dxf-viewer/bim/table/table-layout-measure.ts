/**
 * ADR-739 Φάση Α — **μέτρηση**: πλάτη στηλών + ύψη γραμμών, σε sheet-mm.
 *
 * Το πρώτο από τα τρία στάδια της μηχανής (`measure` → `place` → `borders`). Απαντά
 * μόνο σε ένα ερώτημα — «πόσο πλατιά είναι κάθε στήλη και πόσο ψηλή κάθε γραμμή» —
 * και δεν ξέρει τίποτα για θέσεις: αυτό είναι δουλειά του `place`.
 *
 * ## Το μοντέλο μεγέθους (Figma Auto Layout, §2.1 εύρημα 5)
 * Τρία περάσματα, με αυτή τη σειρά και για αυτόν τον λόγο:
 *  1. **`fixed`** — γνωστά αμέσως, δεν εξαρτώνται από τίποτα.
 *  2. **`hug`** — απαιτούν μέτρηση περιεχομένου· ανεξάρτητα μεταξύ τους.
 *  3. **`fill`** — απαιτούν να ξέρουμε τι **περίσσεψε**, άρα έρχονται τελευταία.
 * Η σειρά δεν είναι σύμβαση: το `fill` ορίζεται ως «ό,τι απέμεινε», και δεν υπάρχει
 * υπόλοιπο πριν κλείσουν τα άλλα δύο.
 *
 * ## Ο μετρητής κειμένου
 * Προεπιλογή είναι το `measureTextAdvanceWorld` (ADR-557) — **ο ίδιος** που ρωτά ο
 * renderer όταν ζωγραφίζει. Αν η μηχανή μετρούσε αλλιώς από ό,τι ζωγραφίζει, οι `hug`
 * στήλες θα ήταν συστηματικά λάθος (ακριβώς το σφάλμα που διόρθωσε ο ADR-557 στο
 * κουτί κειμένου: monospace προσέγγιση vs πραγματικό advance). **Ποτέ δεύτερος
 * measurer** (N.18) — η ένεση υπάρχει μόνο για ντετερμινιστικά tests.
 *
 * @module subapps/dxf-viewer/bim/table/table-layout-measure
 */

import { CHARACTER_METRICS } from '../../config/text-rendering-config';
import { measureTextAdvanceWorld } from '../../text-engine/fonts/text-advance';
import type { TableColumn, TableModel, TableRow } from '../../types/table';
import { resolveCellStyledSpans, styledSpansWidthMm } from './table-cell-styled-spans';
import { resolveCellOverflow } from './table-cell-overflow';
import { resolveVisibleCellContent } from './table-cell-visible-lines';
import { buildMergeIndex, cellKey, type MergeIndex } from './table-model-helpers';
import { cellDisplayText, resolveCellNumberFormat } from './table-cell-format';
import { resolveCellStyle, type TableCellStyle, type TableStyle } from './table-style';
// 🔴 ADR-739 §59 Δ2 — η εσοχή είναι ερώτηση **και** της μέτρησης: μπαίνει στο `hug` πλάτος και
// αφαιρείται από το ωφέλιμο πλάτος της αναδίπλωσης, με τον **ίδιο** κανόνα στοίχισης που θα
// εφαρμόσει η τοποθέτηση (`resolveCellHAlign`) — δύο κανόνες εδώ θα έδιναν στήλη μετρημένη με
// εσοχή που δεν ζωγραφίζεται, ή το αντίστροφο.
import { resolveCellHAlign } from './table-layout-align';
import { tableIndentOffsetMm } from './table-indent-ops';
import type { TableTextMeasurer } from './table-layout-types';

/** Ο προεπιλεγμένος μετρητής: το SSoT πλάτους κειμένου του renderer (ADR-557). */
export const defaultTableTextMeasurer: TableTextMeasurer = (text, heightMm, style) =>
  measureTextAdvanceWorld(text, heightMm, {
    fontFamily: style.fontFamily,
    bold: style.bold,
    italic: style.italic,
  });

/**
 * Ο μετρητής **αυτής** της κλήσης διάταξης — η μία ανάγνωση της επιλογής.
 *
 * ADR-739 Φ.Δ βήμα 5: το `measure` έπαψε να αφορά μόνο το στάδιο μέτρησης. Η **περικοπή**
 * (στάδιο `place`) οφείλει να ρωτήσει τον **ίδιο** μετρητή που αποφάσισε τα πλάτη στηλών —
 * αλλιώς «χωράει» και «κόβεται» απαντιούνται από δύο διαφορετικά όργανα και ένα κελί μπορεί
 * να κόβεται ενώ η στήλη είχε μετρηθεί αρκετά πλατιά (ή το αντίστροφο). Δύο σημεία που
 * έγραφαν `options?.measureText ?? defaultTableTextMeasurer` θα ήταν δύο σημεία που μπορούν
 * να αποκλίνουν· εδώ γράφεται **μία** φορά.
 */
export function resolveTableTextMeasurer(options?: {
  readonly measureText?: TableTextMeasurer;
}): TableTextMeasurer {
  return options?.measureText ?? defaultTableTextMeasurer;
}

/** Πλάτη στηλών και ύψη γραμμών — η έξοδος αυτού του σταδίου. */
export interface TableMeasurement {
  /** Πλάτος ανά στήλη, στη σειρά του `model.columns`. */
  readonly columnWidthsMm: readonly number[];
  /** Ύψος ανά γραμμή, στη σειρά του `model.rows`. */
  readonly rowHeightsMm: readonly number[];
  /** Το ευρετήριο συγχωνεύσεων — χτίζεται εδώ, το ξαναχρησιμοποιούν τα επόμενα στάδια. */
  readonly merges: MergeIndex;
}

/**
 * Το φυσικό πλάτος ενός κελιού: κείμενο + τα δύο οριζόντια περιθώρια. Κενό κελί δίνει
 * μόνο τα περιθώρια — μια κενή στήλη δεν πρέπει να «τραβάει» πλάτος από το πουθενά.
 */
function naturalCellWidthMm(
  model: TableModel,
  style: TableStyle,
  row: TableRow,
  column: TableColumn,
  measure: TableTextMeasurer,
): number {
  const cell = model.cells.get(cellKey(row.id, column.id));
  // 🔴 Οι ΙΔΙΕΣ τρεις παρακάμψεις με το `placeCells`. Αν εδώ έλειπε έστω μία, οι `hug` στήλες
  // θα μετριούνταν με άλλο μέγεθος/έντονα/γραμματοσειρά από αυτά που ζωγραφίζονται — και το
  // σύμπτωμα δεν θα ήταν «λάθος πλάτος», αλλά **κομμένο κείμενο** σε τυχαία κελιά.
  const overrides = {
    column: column.styleOverride,
    row: row.styleOverride,
    cell: cell?.styleOverride,
  };
  const cellStyle = resolveCellStyle(style.rowClasses[row.rowClass], overrides);
  // 🔴 ADR-760 — **μετριέται ό,τι ζωγραφίζεται.** Η μορφή αλλάζει το μήκος: το `46239` είναι 5
  // χαρακτήρες, το `05/08/2026` είναι 10. Μετρημένο πριν τη μορφοποίηση, μια `hug` στήλη
  // ημερομηνιών θα έβγαινε **στο μισό πλάτος** και το κείμενο θα κοβόταν. Είναι η **ίδια**
  // επίλυση (`resolveCellNumberFormat` με τις ίδιες `overrides`) που καλεί ο ζωγράφος — δύο
  // ξεχωριστές αποφάσεις θα αποκλίνανε ακριβώς όπως προειδοποιεί το σχόλιο από πάνω.
  const text = cellDisplayText(cell, resolveCellNumberFormat(overrides, column.valueType));
  const marginsMm = cellStyle.margins.hMm * 2;
  if (!text) return marginsMm;
  // 🔴 ADR-753 Φ2 — άθροισμα **ετερογενών** τμημάτων, όχι μία μέτρηση. Χωρίς `runs` παράγεται
  // ένα τμήμα και η πράξη είναι η ταυτόσημη σημερινή· με έντονα γράμματα στη μέση, μια ενιαία
  // μέτρηση θα έλεγε τη στήλη **στενότερη** απ' όσο χρειάζεται — και το σύμπτωμα δεν θα ήταν
  // «λάθος πλάτος» αλλά κομμένο κείμενο, ακριβώς όπως όταν έλειπε μία από τις παρακάμψεις.
  const spans = resolveCellStyledSpans({ text, runs: cell?.runs, style: cellStyle, measure });
  // 🏆 ADR-739 §59 Δ2 — **η εσοχή συμμετέχει στο `hug` πλάτος, και εδώ περνάμε το Excel.**
  // Εκεί το AutoFit Column Width **αγνοεί** την εσοχή: βάζοντας εσοχή σε στήλη που «χωρούσε»,
  // το κείμενο αρχίζει να κόβεται και η μόνη διέξοδος είναι χειροκίνητο πλάτος. Είναι
  // αποδεδειγμένα ασφαλές να τη μετρήσουμε: η εσοχή είναι **σταθερά του μοντέλου** (σκαλιά),
  // όχι μετρημένο μέγεθος, άρα δεν μπορεί να εξαρτηθεί από το πλάτος που η ίδια καθορίζει —
  // ο κύκλος που φοβόταν η προειδοποίηση των `margins` δεν σχηματίζεται (δες `table-style.ts`).
  const indentMm = tableIndentOffsetMm(cellStyle, resolveCellHAlign(overrides, column.align), measure);
  return styledSpansWidthMm(spans) + marginsMm + indentMm;
}

/**
 * Το πλάτος που «αγκαλιάζει» το περιεχόμενο μιας στήλης.
 *
 * Τα κελιά που **συμμετέχουν σε συγχώνευση** εξαιρούνται (άγκυρες και καλυμμένα):
 * ένα κελί που απλώνεται σε τρεις στήλες δεν λέει τίποτα για το πόσο πλατιά πρέπει να
 * είναι η καθεμία — αν το μετρούσαμε στην πρώτη, ο τίτλος ενός πίνακα θα φούσκωνε
 * μόνιμα τη στήλη Α. Ίδια επιλογή κάνουν οι browsers στον auto table layout.
 */
function hugWidthMm(
  model: TableModel,
  style: TableStyle,
  column: TableColumn,
  merges: MergeIndex,
  measure: TableTextMeasurer,
): number {
  let widest = 0;
  for (const row of model.rows) {
    const key = cellKey(row.id, column.id);
    if (merges.covered.has(key) || merges.anchors.has(key)) continue;
    const width = naturalCellWidthMm(model, style, row, column, measure);
    if (width > widest) widest = width;
  }
  return widest;
}

/**
 * Μοιράζει το υπόλοιπο πλάτος στις `fill` στήλες κατά βάρος. Μη θετικό υπόλοιπο (ο
 * πίνακας ήδη ξεχείλισε) ⇒ όλες παίρνουν το ελάχιστο: μια αρνητική στήλη θα
 * αναποδογύριζε τη γεωμετρία, ενώ το ξεχείλισμα είναι ορατό και διορθώσιμο.
 */
function distributeFillMm(
  weights: readonly number[],
  remainingMm: number,
  minWidthMm: number,
): number[] {
  const totalWeight = weights.reduce((sum, w) => sum + Math.max(w, 0), 0);
  if (remainingMm <= 0 || totalWeight <= 0) return weights.map(() => minWidthMm);
  return weights.map((w) => Math.max((remainingMm * Math.max(w, 0)) / totalWeight, minWidthMm));
}

/** Πλάτη στηλών: `fixed` → `hug` → `fill`, με το ελάχιστο του στυλ ως δάπεδο. */
function measureColumns(
  model: TableModel,
  style: TableStyle,
  merges: MergeIndex,
  measure: TableTextMeasurer,
  availableWidthMm: number | undefined,
): number[] {
  const widths: number[] = new Array(model.columns.length).fill(0);
  const fillIndices: number[] = [];
  const fillWeights: number[] = [];

  model.columns.forEach((column, i) => {
    if (column.sizing.kind === 'fixed') {
      widths[i] = Math.max(column.sizing.widthMm, style.minColumnWidthMm);
    } else if (column.sizing.kind === 'hug') {
      widths[i] = Math.max(hugWidthMm(model, style, column, merges, measure), style.minColumnWidthMm);
    } else {
      fillIndices.push(i);
      fillWeights.push(column.sizing.weight);
    }
  });

  if (fillIndices.length === 0) return widths;

  const used = widths.reduce((sum, w) => sum + w, 0);
  // Χωρίς δηλωμένο διαθέσιμο πλάτος δεν υπάρχει «υπόλοιπο» να μοιραστεί: οι `fill`
  // στήλες υποχωρούν στο ελάχιστο αντί να σιωπήσουν με 0 (μηδενική στήλη = αόρατο λάθος).
  const remaining = availableWidthMm === undefined ? 0 : availableWidthMm - used;
  const shares = distributeFillMm(fillWeights, remaining, style.minColumnWidthMm);
  fillIndices.forEach((columnIndex, k) => {
    widths[columnIndex] = shares[k];
  });
  return widths;
}

/**
 * 🔴 ADR-739 §58 Γ2 — **το ύψος μιας γραμμής, όταν κανείς δεν το κάρφωσε.**
 *
 * Ίδια αριθμητική με την τοποθέτηση, και **αυτό είναι το συμβόλαιο**: το `cellBaselineYMm`
 * βάζει την πρώτη γραμμή βάσης στο `y + περιθώριο + ύψος` και κάθε επόμενη ένα `βήμα`
 * χαμηλότερα, οπότε το κείμενο πιάνει ακριβώς `2×περιθώριο + ύψος + (n−1)×βήμα`. Δύο
 * διαφορετικοί τύποι εδώ και εκεί θα σήμαιναν κείμενο που ξεχειλίζει από τη γραμμή που
 * φτιάχτηκε **για αυτό** — και το σύμπτωμα θα φαινόταν μόνο σε αναδιπλωμένα κελιά.
 */
function wrappedCellHeightMm(lineCount: number, cellStyle: TableCellStyle): number {
  const stepMm = cellStyle.textHeightMm * CHARACTER_METRICS.LINE_HEIGHT_RATIO;
  return cellStyle.margins.vMm * 2 + cellStyle.textHeightMm + Math.max(lineCount - 1, 0) * stepMm;
}

/** Το ωφέλιμο πλάτος ενός κελιού που απλώνεται σε `colSpan` στήλες, μείον τα περιθώριά του. */
function cellContentWidthMm(
  widthsMm: readonly number[],
  colIndex: number,
  colSpan: number,
  cellStyle: TableCellStyle,
): number {
  let total = 0;
  for (let i = colIndex; i < Math.min(colIndex + colSpan, widthsMm.length); i++) total += widthsMm[i];
  return total - cellStyle.margins.hMm * 2;
}

/**
 * Το ύψος που **ζητά το περιεχόμενο** μιας γραμμής — `0` όταν κανένα κελί δεν αναδιπλώνεται.
 *
 * ## 🔴 Ποια κελιά μετρούν, και γιατί όχι όλα
 * - **Καλυμμένα** από συγχώνευση: δεν υπάρχουν ως γεωμετρία (ίδια εξαίρεση με το `hugWidthMm`).
 * - **`rowSpan > 1`**: ένα κελί που απλώνεται σε τρεις γραμμές δεν λέει τίποτα για το ύψος
 *   της **καθεμιάς** — δεν υπάρχει σωστή κατανομή, μόνο αυθαίρετη. Το Excel αποτυγχάνει εδώ
 *   ολοκληρωτικά (τεκμηριωμένο: το AutoFit **δεν λειτουργεί** σε συγχωνευμένα κελιά).
 * - **`colSpan > 1` με `rowSpan === 1`**: **μετρά κανονικά**, με το συνολικό πλάτος του
 *   εύρους. Ανήκει ακριβώς σε μία γραμμή, άρα η ερώτηση έχει σαφή απάντηση — και εδώ ο
 *   ΝΕΣΤΩΡ κάνει σωστά αυτό που το Excel δεν κάνει καθόλου.
 *
 * ## Γιατί επιστρέφει 0 όταν δεν υπάρχει αναδίπλωση — και γιατί αυτό είναι δομικό
 * Κανένας πίνακας στον δίσκο σήμερα δεν έχει `overflow: 'wrap'`. Ο βρόχος βγαίνει στο πρώτο
 * `resolveCellOverflow` και **καμία** αναδίπλωση δεν υπολογίζεται: μηδέν κόστος, και —
 * κυρίως — **byte-ταυτόσημα ύψη** με πριν το §58 για κάθε υπάρχον σχέδιο.
 */
function contentHeightMm(
  model: TableModel,
  style: TableStyle,
  row: TableRow,
  rowIndex: number,
  widthsMm: readonly number[],
  merges: MergeIndex,
  measure: TableTextMeasurer,
): number {
  let tallest = 0;
  model.columns.forEach((column, colIndex) => {
    const key = cellKey(row.id, column.id);
    if (merges.covered.has(key)) return;
    const span = merges.anchors.get(key);
    if ((span?.rowSpan ?? 1) > 1) return;

    const cell = model.cells.get(key);
    if (resolveCellOverflow(cell?.styleOverride?.overflow, column.overflow) !== 'wrap') return;

    const overrides = { column: column.styleOverride, row: row.styleOverride, cell: cell?.styleOverride };
    const cellStyle = resolveCellStyle(style.rowClasses[row.rowClass], overrides);
    const text = cellDisplayText(cell, resolveCellNumberFormat(overrides, column.valueType));
    if (!text) return;

    const lines = resolveVisibleCellContent({
      text,
      // 🔴 §59 Δ2 — **το ίδιο** ωφέλιμο πλάτος που θα δει η τοποθέτηση (`placeTexts`), εσοχή
      // συμπεριλαμβανομένη. Χωρίς αυτήν, η μέτρηση θα έλεγε «τρεις γραμμές» και η τοποθέτηση
      // θα έβγαζε τέσσερις — δηλαδή κείμενο που ξεχειλίζει από τη γραμμή που φτιάχτηκε γι' αυτό.
      availableWidthMm: cellContentWidthMm(widthsMm, colIndex, span?.colSpan ?? 1, cellStyle)
        - tableIndentOffsetMm(cellStyle, resolveCellHAlign(overrides, column.align), measure),
      style: cellStyle,
      overflow: 'wrap',
      numeric: false,
      runs: cell?.runs,
      measure,
    }).lines.length;

    tallest = Math.max(tallest, wrappedCellHeightMm(lines, cellStyle));
  });
  return tallest;
}

/**
 * Ύψη γραμμών: **ρητό `heightMm` ⇒ καρφωμένο**· απόν ⇒ **αυτόματο** (περιεχόμενο, με δάπεδο
 * το προεπιλεγμένο του στυλ).
 *
 * 🔴 Το δάπεδο δεν είναι λεπτομέρεια: χωρίς αυτό, μια γραμμή με **λίγο** κείμενο θα ζητούσε
 * ύψος μικρότερο από το `defaultRowHeightMm` και **κάθε πίνακας του έργου θα συρρικνωνόταν**
 * την ημέρα που μπήκε η αναδίπλωση — μεταβολή γεωμετρίας οντότητας σε σχέδια που κανείς δεν
 * άγγιξε. Το αυτόματο ύψος **μεγαλώνει** τη γραμμή· ποτέ δεν τη μικραίνει.
 */
function measureRows(
  model: TableModel,
  style: TableStyle,
  widthsMm: readonly number[],
  merges: MergeIndex,
  measure: TableTextMeasurer,
): number[] {
  return model.rows.map((row, rowIndex) => {
    if (row.heightMm !== undefined) return Math.max(row.heightMm, 0);
    const content = contentHeightMm(model, style, row, rowIndex, widthsMm, merges, measure);
    return Math.max(style.defaultRowHeightMm, content, 0);
  });
}

/** Το στάδιο μέτρησης — καθαρή συνάρτηση, χωρίς παρενέργειες. */
export function measureTable(
  model: TableModel,
  style: TableStyle,
  options?: { readonly availableWidthMm?: number; readonly measureText?: TableTextMeasurer },
): TableMeasurement {
  const merges = buildMergeIndex(model);
  const measure = resolveTableTextMeasurer(options);
  // 🔴 ADR-739 §58 Γ2 — **οι στήλες ΠΡΩΤΑ, και αυτό λύνει τον κύκλο.** Η αναδίπλωση χρειάζεται
  // πλάτος για να βρει πλήθος γραμμών, και το `hug` χρειάζεται περιεχόμενο για να βρει πλάτος:
  // αν το `hug` ρωτούσε το αναδιπλωμένο περιεχόμενο, οι δύο θα περίμεναν ο ένας τον άλλον.
  // Ο κύκλος σπάει με σειρά, όχι με επανάληψη: το `hug` μετρά το κείμενο **αδιάσπαστο**
  // (ίδια επιλογή με το `width: max-content` του CSS), οπότε μια `hug` στήλη βγαίνει αρκετά
  // πλατιά ώστε να μην αναδιπλώνει ποτέ. Δηλωμένο, όχι σιωπηλό.
  const columnWidthsMm = measureColumns(model, style, merges, measure, options?.availableWidthMm);
  return {
    columnWidthsMm,
    rowHeightsMm: measureRows(model, style, columnWidthsMm, merges, measure),
    merges,
  };
}
