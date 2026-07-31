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
import type { TableCellAlign, TableModel } from '../../types/table';
import { cellKey, cellText } from './table-model-helpers';
import { resolveCellStyle, type TableCellStyle, type TableStyle } from './table-style';
import type { TableMeasurement } from './table-layout-measure';
import type {
  TableCellLayout,
  TableColumnLayout,
  TableRectMm,
  TableRowLayout,
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
 */
function baselineYMm(rect: TableRectMm, align: TableCellAlign, style: TableCellStyle): number {
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

/** Το κείμενο τοποθετημένο· `undefined` όταν το κελί είναι κενό. */
function placeText(
  text: string,
  rect: TableRectMm,
  align: TableCellAlign,
  hAlign: TextAlign,
  style: TableCellStyle,
): TableTextRun | undefined {
  if (!text) return undefined;
  return {
    position: {
      x: anchorXMm(rect, hAlign, style.margins.hMm),
      y: baselineYMm(rect, align, style),
    },
    text,
    heightMm: style.textHeightMm,
    colorHex: style.textColorHex,
    hAlign,
    bold: style.bold,
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
): TableCellLayout[] {
  const out: TableCellLayout[] = [];

  model.rows.forEach((row, rowIndex) => {
    const rowStyle = style.rowClasses[row.rowClass];
    model.columns.forEach((column, colIndex) => {
      const key = cellKey(row.id, column.id);
      if (measurement.merges.covered.has(key)) return;

      const span = measurement.merges.anchors.get(key);
      const cell = model.cells.get(key);
      const cellStyle = resolveCellStyle(rowStyle, cell?.styleOverride);
      const rect = cellRectMm(xEdges, yEdges, colIndex, rowIndex, span?.colSpan ?? 1, span?.rowSpan ?? 1);
      // Η στήλη κερδίζει την οριζόντια συνιστώσα ΜΟΝΟ όταν το κελί δεν έχει δική του άποψη.
      const hAlign = cell?.styleOverride?.align
        ? H_BY_CELL_ALIGN[cell.styleOverride.align]
        : H_BY_COLUMN_ALIGN[column.align];

      out.push({
        rowId: row.id,
        colId: column.id,
        rect,
        style: cellStyle,
        text: placeText(cellText(cell), rect, cellStyle.align, hAlign, cellStyle),
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
