/**
 * ADR-739 Φάση Α — **τοποθέτηση**: από πλάτη/ύψη σε ορθογώνια κελιών + θέσεις κειμένου.
 *
 * Το δεύτερο στάδιο (`measure` → **`place`** → `borders`). Παίρνει τα μεγέθη και
 * παράγει γεωμετρία: αθροιστικές ακμές, ορθογώνιο ανά ορατό κελί (διευρυμένο όταν το
 * κελί είναι άγκυρα συγχώνευσης) και το σημείο αγκύρωσης κάθε κειμένου.
 *
 * ## Ποιος αποφασίζει τη στοίχιση — τρία επίπεδα, ρητή σειρά
 *  1. **Παράκαμψη κελιού** (9 θέσεις) — νικά τα πάντα· ο χρήστης το ζήτησε ρητά.
 *  2. **Στήλη** (`ScheduleColumnAlign`) — καθορίζει την **οριζόντια** συνιστώσα, γιατί
 *     εκεί ζει και το `valueType`: οι αριθμοί στοιχίζονται δεξιά επειδή είναι αριθμοί,
 *     ιδιότητα της στήλης, όχι της γραμμής.
 *  3. **Κλάση γραμμής** (9 θέσεις) — δίνει την **κατακόρυφη** συνιστώσα και το
 *     οριζόντιο default όταν η στήλη δεν έχει άποψη.
 *
 * @module subapps/dxf-viewer/bim/table/table-layout-place
 */

import type { TextAlign } from '../structural/detail-sheet/detail-sheet-types';
import type {
  TableCell,
  TableCellAlign,
  TableCellOverflow,
  TableCellTextRun,
  TableModel,
} from '../../types/table';
import {
  anchorXMm,
  fittingLineCount,
  multilineBaselineYMm,
  resolveCellHAlign,
} from './table-layout-align';
// 🔴 ADR-739 §59 Δ2 — πόσο είναι ένα σκαλί εσοχής, και πότε δεν ισχύει καθόλου. Το **ίδιο**
// module που ρωτά ο μετρητής: η εσοχή μπαίνει στο `hug` πλάτος και αφαιρείται από το ωφέλιμο,
// οπότε δύο απαντήσεις θα έδιναν κομμένο κείμενο σε στήλη που είχε μετρηθεί αρκετά πλατιά.
import { tableIndentOffsetMm } from './table-indent-ops';
import { cellKey } from './table-model-helpers';
import { cellDisplayText, resolveCellNumberFormat } from './table-cell-format';
import { resolveCellOverflow } from './table-cell-overflow';
import {
  resolveVisibleCellContent,
  type VisibleCellContent,
  type VisibleCellLine,
} from './table-cell-visible-lines';
import { resolveCellLinkSpans } from './table-cell-link-spans';
import {
  hasStyledSpans,
  styledPrefixWidthMm,
  styledSpansWidthMm,
} from './table-cell-styled-spans';
import { tableDiagonalCorners } from './table-cell-diagonal-ops';
import { resolveCellStyle, type TableCellStyle, type TableStyle } from './table-style';
import { resolveTableCellStyleInk } from './table-ink';
import type { TableMeasurement } from './table-layout-measure';
import type {
  TableBorderSegment,
  TableCellLayout,
  TableColumnLayout,
  TableRectMm,
  TableRowLayout,
  TableTextMeasurer,
  TableTextRun,
  TableTextRunBase,
} from './table-layout-types';

// ──────────────────────────────────────────────────────────────────────────────
// Αθροιστικές ακμές
// ──────────────────────────────────────────────────────────────────────────────

/** Αριστερές ακμές στηλών (αύξουσες)· το τελευταίο στοιχείο είναι το συνολικό πλάτος. */
export function columnEdgesMm(widthsMm: readonly number[]): number[] {
  const edges: number[] = [0];
  for (const w of widthsMm) edges.push(edges[edges.length - 1] + w);
  return edges;
}

/** Πάνω ακμές γραμμών (αύξουσες)· το τελευταίο στοιχείο είναι το συνολικό ύψος. */
export function rowEdgesMm(heightsMm: readonly number[]): number[] {
  return columnEdgesMm(heightsMm);
}


// ──────────────────────────────────────────────────────────────────────────────
// Κελιά
// ──────────────────────────────────────────────────────────────────────────────

/** Το ορθογώνιο μιας θέσης, διευρυμένο κατά το εύρος της συγχώνευσης (αν υπάρχει). */
function cellRectMm(
  xEdges: readonly number[],
  yEdges: readonly number[],
  colIndex: number,
  rowIndex: number,
  colSpan: number,
  rowSpan: number,
): TableRectMm {
  const xEnd = xEdges[Math.min(colIndex + colSpan, xEdges.length - 1)];
  const yEnd = yEdges[Math.min(rowIndex + rowSpan, yEdges.length - 1)];
  return {
    x: xEdges[colIndex],
    y: yEdges[rowIndex],
    w: xEnd - xEdges[colIndex],
    h: yEnd - yEdges[rowIndex],
  };
}

/** Ό,τι χρειάζεται το {@link placeText} για ΕΝΑ κελί — μαζεμένο, ώστε η υπογραφή να διαβάζεται. */
interface PlaceTextInput {
  /** Το **ακέραιο** κείμενο του μοντέλου· η περικοπή γίνεται εδώ και μόνο για την απόδοση. */
  readonly text: string;
  readonly rect: TableRectMm;
  readonly align: TableCellAlign;
  readonly hAlign: TextAlign;
  readonly style: TableCellStyle;
  /**
   * 🔴 ADR-739 §59 Δ2 — η **εσοχή σε mm**, ήδη κριμένη ως προς τη στοίχιση
   * ({@link tableIndentOffsetMm} επιστρέφει `0` σε κεντραρισμένο κελί).
   *
   * Περνά έτοιμη και δεν ξαναϋπολογίζεται εδώ, γιατί ο **μετρητής** τη χρειάζεται κι εκείνος
   * (`naturalCellWidthMm`, `contentHeightMm`) και μια δεύτερη κλήση θα ήταν δεύτερη ευκαιρία
   * να ξεχαστεί ο κανόνας του κέντρου — δηλαδή στήλη μετρημένη με εσοχή που δεν ζωγραφίζεται.
   */
  readonly indentMm: number;
  readonly overflow: TableCellOverflow;
  /** `typeof cell.value === 'number'` — βλ. `CellTextFitInput.numeric` για το γιατί. */
  readonly numeric: boolean;
  /** 🔴 ADR-753 — η μορφοποίηση ανά χαρακτήρα του κελιού· απούσα στα σχεδόν όλα. */
  readonly runs?: readonly TableCellTextRun[];
  readonly measure: TableTextMeasurer;
  /**
   * 🔴 ADR-739 §58 Γ2 — πόσες οπτικές γραμμές **χωρούν** στο ορθογώνιο. Απόν ⇒ χωρίς όριο.
   *
   * Υπάρχει επειδή το ύψος μιας γραμμής μπορεί να είναι **καρφωμένο** ενώ το κελί
   * αναδιπλώνεται: τότε η μέτρηση ζήτησε τρεις γραμμές αλλά ο χρήστης έδωσε χώρο για δύο.
   * Χωρίς το φράγμα, η τρίτη γραμμή θα ζωγραφιζόταν **πάνω στο περίγραμμα και μέσα στο
   * επόμενο κελί** — ακριβώς το ελάττωμα που το βήμα 5 (περικοπή) υπάρχει για να μην υπάρχει,
   * στον άλλο άξονα.
   */
  readonly maxLines?: number;
}

/**
 * Το κείμενο τοποθετημένο· `undefined` όταν το κελί είναι κενό **ή** όταν δεν χώρεσε ούτε
 * ένας χαρακτήρας (μηδενικό ωφέλιμο πλάτος): ένα run με κενό κείμενο θα ήταν `fillText('')`
 * σε κάθε καρέ και μια κενή οντότητα TEXT σε κάθε εξαγωγή.
 *
 * 🔴 ADR-739 Φ.Δ βήμα 5 — **ΕΔΩ γεννιέται το ορατό κείμενο, και μόνο εδώ.** Και τα τέσσερα
 * backends διαβάζουν αυτό το `TableTextRun`, οπότε η περικοπή δεν χρειάζεται να επαναληφθεί
 * (ούτε να θυμηθεί κανείς να την καλέσει) πουθενά αλλού — βλ. `table-cell-overflow.ts`.
 *
 * Το ωφέλιμο πλάτος είναι το ορθογώνιο **μείον τα δύο** οριζόντια περιθώρια: το ίδιο ζεύγος
 * που πρόσθεσε το `naturalCellWidthMm` όταν μετρούσε τη στήλη, και η ίδια απόσταση από την
 * ακμή που κρατά το `anchorXMm` — άρα το κείμενο σταματά ακριβώς εκεί που θα σταματούσε ένα
 * κείμενο που «μόλις χωρούσε», σε κάθε στοίχιση.
 */
function placeTexts(input: PlaceTextInput): TableTextRun[] {
  const { rect, style } = input;
  if (!input.text) return [];

  const content = resolveVisibleCellContent({
    text: input.text,
    // 🔴 §59 Δ2 — η εσοχή **αφαιρείται από το ωφέλιμο πλάτος**, όχι μόνο από την άγκυρα: κείμενο
    // σπρωγμένο μέσα χωρίς αντίστοιχη συρρίκνωση του διαθέσιμου χώρου θα ξεχείλιζε από την
    // απέναντι ακμή — και η περικοπή (βήμα 5) δεν θα το έβλεπε, γιατί εκείνη ρωτά **αυτό** το
    // νούμερο. Είναι το ίδιο ζεύγος «άγκυρα + ωφέλιμο πλάτος» που κρατά ήδη τα περιθώρια συνεπή.
    availableWidthMm: rect.w - style.margins.hMm * 2 - input.indentMm,
    style,
    overflow: input.overflow,
    numeric: input.numeric,
    runs: input.runs,
    measure: input.measure,
    ...(input.maxLines !== undefined && { maxLines: input.maxLines }),
  });

  const out: TableTextRun[] = [];
  content.lines.forEach((line, index) => {
    const run = placeLine(input, content, line, index);
    if (run) out.push(run);
  });
  return out;
}

/**
 * 🔴 ADR-739 §58 Γ2 — **πού κάθεται η γραμμή `index` ενός αναδιπλωμένου κελιού.**
 *
 * ## Η κατακόρυφη κατανομή ΔΕΝ ξαναγράφεται εδώ
 * Το ερώτημα «σε πολυγραμμικό μπλοκ, προς τα πού μεγαλώνει;» το έχει ήδη απαντήσει το
 * `resolveMultilineExtents` (`bim/text/text-lines.ts`) για το MTEXT, με τον κανόνα των
 * AutoCAD/Revit: **T** μεγαλώνει προς τα κάτω, **B** προς τα πάνω, **M** συμμετρικά. Ένας
 * δεύτερος υπολογισμός εδώ θα ήταν δεύτερη απάντηση στην ίδια ερώτηση — και θα απέκλινε
 * ακριβώς στην περίπτωση που κανείς δεν δοκιμάζει (κάτω στοίχιση με τρεις γραμμές).
 *
 * ```
 *   πρώτη γραμμή βάσης = cellBaselineYMm(μονής γραμμής) − topAdd × ύψος
 *   γραμμή i           = πρώτη + i × βήμα
 * ```
 * Με **μία** γραμμή το `topAdd` είναι 0 και η έκφραση εκφυλίζεται στη σημερινή: κάθε πίνακας
 * που υπάρχει παράγει **ταυτόσημη** θέση κειμένου, χωρίς εξαίρεση στον κώδικα.
 */
function placeLine(
  input: PlaceTextInput,
  content: VisibleCellContent,
  visible: VisibleCellLine,
  index: number,
): TableTextRun | undefined {
  const { rect, align, hAlign, style } = input;
  if (!visible.text) return undefined;

  // 🔴 ADR-739 §58 Γ1 — **το ύψος που ΖΩΓΡΑΦΙΖΕΤΑΙ**, μετά τη σμίκρυνση. Ταυτότητα (`style`)
  // όταν δεν σμικρύνθηκε, ώστε κάθε πίνακας που υπάρχει σήμερα να παράγει byte-ταυτόσημη
  // διάταξη — η ίδια αρχή με τα προαιρετικά πεδία του `TableTextRunBase`.
  //
  // Το `cellBaselineYMm` το χρειάζεται **εξίσου** με το `heightMm`: η γραμμή βάσης ορίζεται
  // ως προς το ύψος του κειμένου, οπότε ένα σμικρυμένο κείμενο τοποθετημένο στη βάση του
  // αρχικού μεγέθους θα κρεμόταν έξω από τη ζώνη του — ορατό σε κάθε `top`/`middle` κελί.
  const drawnStyle: TableCellStyle =
    visible.heightScale === 1
      ? style
      : { ...style, textHeightMm: style.textHeightMm * visible.heightScale };

  // 🔴 ADR-753 Φ2 — η **μία** απάντηση στο «πόσο πλατιοί είναι οι πρώτοι k χαρακτήρες», για
  // όποιον τη χρειαστεί. Με ένα τμήμα εκφυλίζεται στο σημερινό `measure(text.slice(0, k))`.
  const prefixWidthMm = (charIndex: number): number =>
    styledPrefixWidthMm(visible.spans, charIndex, input.measure);

  // 🔴 ADR-751 — οι διευθύνσεις εντοπίζονται **εδώ**, στο ίδιο σημείο που γεννιέται το ορατό
  // κείμενο, και με τον **ίδιο** μετρητή που μόλις αποφάσισε την περικοπή. Αν τις έβρισκε ο
  // ζωγράφος, τα άλλα τρία backends (PDF, DXF, ΤΕΚ) δεν θα τις είχαν καθόλου — το ίδιο σχήμα
  // «ο καμβάς ξέρει κάτι που το αρχείο αγνοεί» που η Φ.Ε πλήρωσε με το `advanceMm`.
  const links = resolveCellLinkSpans({
    fullText: input.text,
    visibleText: visible.text,
    clipped: visible.clipped,
    numeric: input.numeric,
    hAlign,
    prefixWidthMm,
  });

  const base: TableTextRunBase = {
    position: {
      x: anchorXMm(rect, hAlign, style.margins.hMm, input.indentMm),
      y: multilineBaselineYMm(rect, align, drawnStyle, content.lines.length, index),
    },
    text: visible.text,
    heightMm: drawnStyle.textHeightMm,
    colorHex: style.textColorHex,
    hAlign,
    bold: style.bold,
    italic: style.italic,
    // Απόν όταν το στυλ δεν δηλώνει οικογένεια — ο μετρητής και ο ζωγράφος πέφτουν τότε στην
    // ΙΔΙΑ προεπιλογή, που είναι ακριβώς το ζητούμενο (ένα `undefined`, όχι δύο defaults).
    ...(style.fontFamily !== undefined && { fontFamily: style.fontFamily }),
    // Παρόν μόνο όταν αληθεύει — δες τη σημείωση σχήματος στο `TableTextRun.clipped`.
    ...(visible.clipped && { clipped: true as const }),
    // Ίδια σύμβαση: απόν στα κελιά χωρίς διεύθυνση, δηλαδή στα σχεδόν όλα.
    ...(links.length > 0 && { links }),
    // 🔴 ADR-753 Φ2 — ίδια σύμβαση, τρίτη φορά: ένα μόνο τμήμα δεν λέει τίποτα που το ίδιο το
    // run δεν λέει ήδη (`bold`/`italic`/`heightMm`/`colorHex`/`fontFamily`), οπότε το πεδίο
    // **λείπει** και κάθε πίνακας που υπάρχει σήμερα παράγει byte-ταυτόσημη διάταξη.
    // ADR-739 §58 Γ1 — η σύγκριση γίνεται με το **ζωγραφισμένο** στυλ, όχι με το ονομαστικό:
    // σε σμικρυμένο κελί χωρίς μορφοποίηση ανά χαρακτήρα, το μοναδικό τμήμα έχει ακριβώς το
    // κλιμακωμένο ύψος του run, άρα δεν λέει τίποτα που το run δεν λέει ήδη — και το πεδίο
    // σωστά λείπει. Με το ονομαστικό `style` θα φαινόταν πάντα «διαφορετικό» και κάθε
    // σμικρυμένο κελί θα κουβαλούσε περιττά τμήματα σε κάθε εξαγωγή.
    ...(hasStyledSpans(visible.spans, drawnStyle) && { spans: visible.spans }),
  };

  // ADR-739 Φ.Ε/Φ2 βήμα 4 — το πλάτος μετριέται **μόνο** για υπογραμμισμένο κείμενο: είναι ο
  // μόνος καταναλωτής του, και μια μέτρηση ανά κελί σε κάθε διάταξη θα ήταν κόστος που πληρώνει
  // το 99% των πινάκων για το 1%. Ο μετρητής είναι ο ΙΔΙΟΣ που μόλις αποφάσισε την περικοπή,
  // και μετρά το **ορατό** κείμενο — άρα σε κομμένο κελί η γραμμή σταματά εκεί που σταματούν
  // και τα γράμματα, όχι εκεί που θα σταματούσε το ακέραιο κείμενο.
  //
  // ADR-753 Φ2 — το πλάτος έρχεται από τα ίδια τμήματα που μόλις τοποθετήθηκαν: με ένα τμήμα
  // είναι η ταυτόσημη σημερινή μέτρηση, με πολλά είναι το **μόνο** σωστό άθροισμα.
  return style.underline
    ? { ...base, underline: true, advanceMm: styledSpansWidthMm(visible.spans) }
    : { ...base, underline: false };
}

/**
 * Όλα τα **ορατά** κελιά. Τα καλυμμένα από συγχώνευση παραλείπονται εντελώς — δεν
 * υπάρχουν ως γεωμετρία, άρα κανένα backend δεν μπορεί να τα ζωγραφίσει κατά λάθος.
 */
export function placeCells(
  model: TableModel,
  style: TableStyle,
  measurement: TableMeasurement,
  xEdges: readonly number[],
  yEdges: readonly number[],
  measure: TableTextMeasurer,
  /**
   * 🔴 ADR-739 §38 — η επιφάνεια κάτω από τον πίνακα (φόντο καμβά ή χαρτί). **Υποχρεωτική**,
   * χωρίς προεπιλογή: η μοναδική προεπιλογή ζει στο `layoutTable`, ώστε να μην υπάρχουν δύο
   * απαντήσεις στο «τι εννοούμε όταν δεν το λέει κανείς».
   */
  surfaceHex: string,
): TableCellLayout[] {
  const out: TableCellLayout[] = [];

  model.rows.forEach((row, rowIndex) => {
    const rowStyle = style.rowClasses[row.rowClass];
    model.columns.forEach((column, colIndex) => {
      const key = cellKey(row.id, column.id);
      if (measurement.merges.covered.has(key)) return;

      const span = measurement.merges.anchors.get(key);
      const cell = model.cells.get(key);
      const overrides = {
        column: column.styleOverride,
        row: row.styleOverride,
        cell: cell?.styleOverride,
      };
      // 🔴 ADR-739 §38 — **εδώ πεθαίνει το σεντινέλι.** Το `AUTOMATIC_TABLE_INK` επιτρέπεται να
      // ζει μόνο στο στυλ· από αυτή τη γραμμή και κάτω το `textColorHex` είναι εγγυημένα
      // πραγματικό hex, για **όλα** τα backends. Δες `table-ink.ts` για το γιατί ο εγκλωβισμός
      // εδώ κάνει τις πέντε σιωπηλές διαρροές (καμβάς, CSS, DXF, PDF, δίσκος) **μη εκφράσιμες**
      // αντί για «φυλαγμένες».
      const cellStyle = resolveTableCellStyleInk(resolveCellStyle(rowStyle, overrides), surfaceHex);
      const rect = cellRectMm(xEdges, yEdges, colIndex, rowIndex, span?.colSpan ?? 1, span?.rowSpan ?? 1);
      // Η **σημασιολογική** `TableColumn.align` (επίπεδο 4) κερδίζει μόνο όταν καμία ρητή
      // παράκαμψη δεν έχει άποψη — γι' αυτό δεν μπορεί να μπει στο `resolveCellStyle`: εκεί
      // θα ήταν βάση, ενώ εδώ είναι το **προτελευταίο** σκαλί, κάτω από κελί/γραμμή/στήλη.
      //
      // 🔴 §59 Δ2 — ο κανόνας **μετακόμισε** στο `table-layout-align.ts`: η μέτρηση τον χρειάζεται
      // κι εκείνη (η εσοχή δεν ισχύει σε κεντραρισμένο κελί), και δύο γραφές του θα απέκλιναν
      // ακριβώς στο επίπεδο 4. Δες `resolveCellHAlign`.
      const hAlign = resolveCellHAlign(overrides, column.align);
      const indentMm = tableIndentOffsetMm(cellStyle, hAlign, measure);

      out.push({
        rowId: row.id,
        colId: column.id,
        rect,
        style: cellStyle,
        // Η ΙΔΙΑ τιμή ταξιδεύει και στο κελί και στο run του: το κελί τη χρειάζεται για
        // τον in-cell επεξεργαστή (που ανοίγει και σε **κενό** κελί, όπου run δεν υπάρχει).
        hAlign,
        // §59 Δ2 — ίδιο ακριβώς σκεπτικό: στα `texts` η εσοχή είναι ψημένη μέσα στο `position`,
        // αλλά ένα κενό κελί δεν έχει `texts` και ο κέρσορας πρέπει να ξέρει πού να καθίσει.
        indentMm,
        texts: placeTexts({
          // 🔴 ADR-760 — η **ίδια** επίλυση μορφής με τον μετρητή πλάτους
          // (`naturalCellWidthMm`), πάνω στις **ίδιες** `overrides`. Δύο ξεχωριστές
          // αποφάσεις εδώ δεν θα έδιναν «λάθος πλάτος» αλλά **κομμένο κείμενο** — ίδιο
          // σύμπτωμα, ίδια αιτία με τις τρεις παρακάμψεις στυλ από πάνω.
          text: cellDisplayText(cell, resolveCellNumberFormat(overrides, column.valueType)),
          rect,
          align: cellStyle.align,
          hAlign,
          style: cellStyle,
          indentMm,
          // Ίδια σειρά προτεραιότητας με τη στοίχιση: κελί → στήλη → προεπιλογή.
          overflow: resolveCellOverflow(cell?.styleOverride?.overflow, column.overflow),
          numeric: typeof cell?.value === 'number',
          runs: cell?.runs,
          measure,
          maxLines: fittingLineCount(rect, cellStyle),
        }),
        rowSpan: span?.rowSpan ?? 1,
        colSpan: span?.colSpan ?? 1,
        ...diagonalsOf(cell, rect),
      });
    });
  });

  return out;
}

/**
 * ADR-750 Φ5 (Α2) — οι **διαγώνιες** του κελιού ως έτοιμα τμήματα, στο ορθογώνιο που
 * πραγματικά καταλαμβάνει.
 *
 * ## 🔑 Το `rect` καλύπτει ΟΛΗ τη συγχώνευση — και γι' αυτό η διαγώνιος μπαίνει εδώ
 * Το `cellRectMm` έχει ήδη πολλαπλασιάσει τα spans, άρα μια διαγώνιος σε συγχωνευμένο κελί
 * 3×2 διασχίζει ολόκληρη τη συγχώνευση, όπως στο Excel. Υπολογισμένη οπουδήποτε αλλού θα
 * χρειαζόταν δεύτερη ανάγνωση του ευρετηρίου συγχωνεύσεων — δηλαδή δεύτερη απάντηση στο «πόσο
 * μεγάλο είναι αυτό το κελί».
 *
 * Τα **καλυμμένα** κελιά δεν φτάνουν καν εδώ (κόβονται στην αρχή του `placeCells`), οπότε η
 * απόφαση «γράφονται όλα, η δομή αποφασίζει τι φαίνεται» (Α16) εκτελείται χωρίς κανέναν
 * έλεγχο: η διαγώνιος ενός καλυμμένου κελιού απλώς δεν παράγει τμήμα.
 *
 * Οι δύο διευθύνσεις έχουν τα ονόματα του OOXML: `down` = ↘ (πάνω-αριστερά → κάτω-δεξιά),
 * `up` = ↗ (κάτω-αριστερά → πάνω-δεξιά). Ο άξονας `y` του πλαισίου δείχνει **προς τα κάτω**
 * (`table-layout-types.ts`), άρα το «up» τελειώνει στο **μικρότερο** `y` — γραμμένο ρητά,
 * γιατί είναι ακριβώς το σημείο όπου μια εικασία δίνει καθρεφτισμένο σχέδιο.
 */
function diagonalsOf(
  cell: TableCell | undefined,
  rect: TableRectMm,
): { readonly diagonals?: readonly TableBorderSegment[] } {
  const diagonal = cell?.diagonal;
  if (!diagonal) return {};

  const segments: TableBorderSegment[] = [];
  for (const direction of ['down', 'up'] as const) {
    const spec = diagonal[direction];
    if (spec) segments.push({ ...tableDiagonalCorners(direction, rect), spec });
  }
  // Το πεδίο **λείπει** όταν δεν υπάρχει τμήμα, ποτέ κενός πίνακας: ένα ρητό `[]` θα άλλαζε το
  // σχήμα κάθε κελιού του έργου (και κάθε χαρακτηρισμένο στιγμιότυπο) για μηδέν διαφορά —
  // η ίδια αρχή με το `clipped` και το `dashMm`.
  return segments.length > 0 ? { diagonals: segments } : {};
}

// ──────────────────────────────────────────────────────────────────────────────
// Γραμμές / στήλες ως γεωμετρία
// ──────────────────────────────────────────────────────────────────────────────

export function placeColumns(
  model: TableModel,
  widthsMm: readonly number[],
  xEdges: readonly number[],
): TableColumnLayout[] {
  return model.columns.map((column, i) => ({ id: column.id, xMm: xEdges[i], widthMm: widthsMm[i] }));
}

export function placeRows(
  model: TableModel,
  heightsMm: readonly number[],
  yEdges: readonly number[],
): TableRowLayout[] {
  return model.rows.map((row, i) => ({ id: row.id, yMm: yEdges[i], heightMm: heightsMm[i] }));
}
