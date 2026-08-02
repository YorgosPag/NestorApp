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
import type { TableCellAlign, TableCellOverflow, TableModel } from '../../types/table';
import { cellKey, cellText } from './table-model-helpers';
import { resolveCellOverflow, resolveVisibleCellText } from './table-cell-overflow';
import { resolveCellStyle, type TableCellStyle, type TableStyle } from './table-style';
import type { TableMeasurement } from './table-layout-measure';
import type {
  TableCellLayout,
  TableColumnLayout,
  TableRectMm,
  TableRowLayout,
  TableTextMeasurer,
  TableTextRun,
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
    measure: input.measure,
  });
  if (!visible.text) return undefined;

  return {
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
    underline: style.underline,
    // Απόν όταν το στυλ δεν δηλώνει οικογένεια — ο μετρητής και ο ζωγράφος πέφτουν τότε στην
    // ΙΔΙΑ προεπιλογή, που είναι ακριβώς το ζητούμενο (ένα `undefined`, όχι δύο defaults).
    ...(style.fontFamily !== undefined && { fontFamily: style.fontFamily }),
    // Παρόν μόνο όταν αληθεύει — δες τη σημείωση σχήματος στο `TableTextRun.clipped`.
    ...(visible.clipped && { clipped: true as const }),
    // ADR-739 Φ.Ε/Φ2 βήμα 4 — το πλάτος μετριέται **μόνο** για υπογραμμισμένο κείμενο: είναι
    // ο μόνος καταναλωτής του, και μια μέτρηση ανά κελί σε κάθε διάταξη θα ήταν κόστος που
    // πληρώνει ο 99% των πινάκων για το 1%. Ο μετρητής είναι ο ΙΔΙΟΣ που μόλις αποφάσισε την
    // περικοπή, και μετρά το **ορατό** κείμενο — άρα σε κομμένο κελί η γραμμή σταματά εκεί
    // που σταματούν και τα γράμματα, όχι εκεί που θα σταματούσε το ακέραιο κείμενο.
    ...(style.underline && {
      advanceMm: input.measure(visible.text, style.textHeightMm, style),
    }),
  };
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
      const cellStyle = resolveCellStyle(rowStyle, overrides);
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
          measure,
        }),
        rowSpan: span?.rowSpan ?? 1,
        colSpan: span?.colSpan ?? 1,
      });
    });
  });

  return out;
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
