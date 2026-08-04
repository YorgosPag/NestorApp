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

import type { ScheduleColumnAlign } from '../schedule/types';
import type { TextAlign } from '../structural/detail-sheet/detail-sheet-types';
import type {
  TableCell,
  TableCellAlign,
  TableCellOverflow,
  TableCellTextRun,
  TableModel,
} from '../../types/table';
import { cellKey, cellText } from './table-model-helpers';
import { resolveCellOverflow, resolveVisibleCellText } from './table-cell-overflow';
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
// Στοίχιση
// ──────────────────────────────────────────────────────────────────────────────

const H_BY_CELL_ALIGN: Readonly<Record<TableCellAlign, TextAlign>> = {
  TL: 'left', ML: 'left', BL: 'left',
  TC: 'center', MC: 'center', BC: 'center',
  TR: 'right', MR: 'right', BR: 'right',
};

const H_BY_COLUMN_ALIGN: Readonly<Record<ScheduleColumnAlign, TextAlign>> = {
  left: 'left',
  center: 'center',
  right: 'right',
};

/** Κατακόρυφη ζώνη της 9-θέσης στοίχισης. */
function verticalBand(align: TableCellAlign): 'top' | 'middle' | 'bottom' {
  const first = align.charAt(0);
  if (first === 'T') return 'top';
  if (first === 'B') return 'bottom';
  return 'middle';
}

/** Το x του σημείου αγκύρωσης, σύμφωνα με την οριζόντια στοίχιση και τα περιθώρια. */
function anchorXMm(rect: TableRectMm, hAlign: TextAlign, marginHMm: number): number {
  if (hAlign === 'left') return rect.x + marginHMm;
  if (hAlign === 'right') return rect.x + rect.w - marginHMm;
  return rect.x + rect.w / 2;
}

/**
 * Το y της **γραμμής βάσης**.
 *
 * `top` δίνει `rect.y + margin + textHeight`, δηλαδή ακριβώς τη σύμβαση που ήδη
 * χρησιμοποιεί ο ADR-622 (`rowTop + TEXT_MM`) — το κείμενο κρέμεται από την κορυφή της
 * γραμμής. `middle` κεντράρει το κεφαλαίο γράμμα γύρω από τον άξονα του κελιού.
 *
 * 🔴 **Εξαγόμενη** (ADR-739 Φ.Δ βήμα 3): ο in-cell επεξεργαστής πρέπει να τοποθετήσει τη
 * γραμμή βάσης του `<input>` **ακριβώς** εκεί που τη ζωγραφίζει ο καμβάς. Μια δεύτερη
 * διατύπωση του κανόνα θα σήμαινε ότι το κείμενο **αναπηδά** τη στιγμή που μπαίνεις στο
 * κελί — δηλαδή το ίδιο ελάττωμα που λύνει το βήμα, σε πιο ύπουλη μορφή.
 */
export function cellBaselineYMm(
  rect: TableRectMm,
  align: TableCellAlign,
  style: TableCellStyle,
): number {
  const band = verticalBand(align);
  if (band === 'top') return rect.y + style.margins.vMm + style.textHeightMm;
  if (band === 'bottom') return rect.y + rect.h - style.margins.vMm;
  return rect.y + rect.h / 2 + style.textHeightMm / 2;
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
  readonly overflow: TableCellOverflow;
  /** `typeof cell.value === 'number'` — βλ. `CellTextFitInput.numeric` για το γιατί. */
  readonly numeric: boolean;
  /** 🔴 ADR-753 — η μορφοποίηση ανά χαρακτήρα του κελιού· απούσα στα σχεδόν όλα. */
  readonly runs?: readonly TableCellTextRun[];
  readonly measure: TableTextMeasurer;
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
function placeText(input: PlaceTextInput): TableTextRun | undefined {
  const { rect, align, hAlign, style } = input;
  if (!input.text) return undefined;

  const visible = resolveVisibleCellText({
    text: input.text,
    availableWidthMm: rect.w - style.margins.hMm * 2,
    style,
    overflow: input.overflow,
    numeric: input.numeric,
    runs: input.runs,
    measure: input.measure,
  });
  if (!visible.text) return undefined;

  // 🔴 ADR-753 Φ2 — η **μία** απάντηση στο «πόσο πλατιοί είναι οι πρώτοι k χαρακτήρες», για
  // όποιον τη χρειαστεί. Με ένα τμήμα εκφυλίζεται στο σημερινό `measure(text.slice(0, k))`.
  const prefixWidthMm = (index: number): number =>
    styledPrefixWidthMm(visible.spans, index, input.measure);

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
      x: anchorXMm(rect, hAlign, style.margins.hMm),
      y: cellBaselineYMm(rect, align, style),
    },
    text: visible.text,
    heightMm: style.textHeightMm,
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
    ...(hasStyledSpans(visible.spans) && { spans: visible.spans }),
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
      const explicitAlign = overrides.cell?.align ?? overrides.row?.align ?? overrides.column?.align;
      const hAlign = explicitAlign
        ? H_BY_CELL_ALIGN[explicitAlign]
        : H_BY_COLUMN_ALIGN[column.align];

      out.push({
        rowId: row.id,
        colId: column.id,
        rect,
        style: cellStyle,
        // Η ΙΔΙΑ τιμή ταξιδεύει και στο κελί και στο run του: το κελί τη χρειάζεται για
        // τον in-cell επεξεργαστή (που ανοίγει και σε **κενό** κελί, όπου run δεν υπάρχει).
        hAlign,
        text: placeText({
          text: cellText(cell),
          rect,
          align: cellStyle.align,
          hAlign,
          style: cellStyle,
          // Ίδια σειρά προτεραιότητας με τη στοίχιση: κελί → στήλη → προεπιλογή.
          overflow: resolveCellOverflow(cell?.styleOverride?.overflow, column.overflow),
          numeric: typeof cell?.value === 'number',
          runs: cell?.runs,
          measure,
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
