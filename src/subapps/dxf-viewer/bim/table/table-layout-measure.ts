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

import { measureTextAdvanceWorld } from '../../text-engine/fonts/text-advance';
import type { TableColumn, TableModel, TableRow } from '../../types/table';
import { resolveCellStyledSpans, styledSpansWidthMm } from './table-cell-styled-spans';
import { buildMergeIndex, cellKey, type MergeIndex } from './table-model-helpers';
import { cellDisplayText, resolveCellNumberFormat } from './table-cell-format';
import { resolveCellStyle, type TableStyle } from './table-style';
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
  return styledSpansWidthMm(spans) + marginsMm;
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

/** Ύψη γραμμών: ρητό `heightMm` της γραμμής, αλλιώς το προεπιλεγμένο του στυλ. */
function measureRows(model: TableModel, style: TableStyle): number[] {
  return model.rows.map((row) => Math.max(row.heightMm ?? style.defaultRowHeightMm, 0));
}

/** Το στάδιο μέτρησης — καθαρή συνάρτηση, χωρίς παρενέργειες. */
export function measureTable(
  model: TableModel,
  style: TableStyle,
  options?: { readonly availableWidthMm?: number; readonly measureText?: TableTextMeasurer },
): TableMeasurement {
  const merges = buildMergeIndex(model);
  const measure = resolveTableTextMeasurer(options);
  return {
    columnWidthsMm: measureColumns(model, style, merges, measure, options?.availableWidthMm),
    rowHeightsMm: measureRows(model, style),
    merges,
  };
}
