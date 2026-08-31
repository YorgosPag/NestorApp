/**
 * 🔴 ADR-833 §5.7 — **Η ΜΟΡΦΟΠΟΙΗΣΗ ΚΑΘΕΤΑΙ ΠΑΝΩ ΣΤΟ ΜΟΝΤΕΛΟ**: θέσεις → ταυτότητες.
 *
 * Ο τελευταίος κρίκος της εισαγωγής. Το φύλλο έδωσε **δύο** κανάλια — κείμενο (`TsvGrid`, από
 * τη Φάση 1) και μορφοποίηση ({@link ImportedWorksheetFormat}, από τη Φάση 6) — και το κείμενο
 * έχει ήδη μπει μέσω του `pasteTsvIntoTable`. Εδώ μπαίνει το δεύτερο, **χωρίς να αγγίξει ούτε
 * μία τιμή**.
 *
 * ## 🔴 ΓΙΑΤΙ ΤΑ ΚΑΝΑΛΙΑ ΕΙΝΑΙ ΔΥΟ ΚΑΙ ΟΧΙ ΕΝΑ
 * Ο πειρασμός ήταν ένας αναγνώστης που παράγει κατευθείαν `TableCell[]` με τιμή **και** στυλ.
 * Θα σήμαινε ότι η εισαγωγή παρακάμπτει το `pasteTsvIntoTable` — και μαζί του χάνει, όπως
 * γράφει η κεφαλίδα του, *«κόψιμο στα όρια, επίγνωση συγχωνεύσεων, αναγνώριση τύπων,
 * επανυπολογισμό, **ένα** βήμα undo»*. Δύο κανάλια σημαίνει ότι το ακριβό μονοπάτι μένει
 * **ένα**, και η μορφοποίηση είναι καθαρή προσθήκη πάνω του.
 *
 * ## 🔴 ΠΟΙΟΣ ΚΑΤΕΧΕΙ ΜΙΑ ΑΚΜΗ ΟΤΑΝ ΤΗΝ ΔΗΛΩΝΟΥΝ ΔΥΟ ΚΕΛΙΑ
 * Στο Excel κάθε κελί κρατά **τέσσερις** πλευρές, άρα η κάτω του `(r,c)` και η πάνω του
 * `(r+1,c)` είναι **δύο ονόματα για την ίδια γραμμή** — ακριβώς η διφορούμενη ιδιοκτησία που
 * το ADR-750 §3.3 ονομάζει γενεσιουργό αιτία *όλων* των παραπόνων του Excel («ποιο κελί κατέχει
 * τη γραμμή;», «το περίγραμμα δεν φεύγει»). Το μοντέλο μας έχει **ένα** όνομα ανά ακμή, οπότε
 * η εισαγωγή οφείλει να διαλέξει, και διαλέγει **ντετερμινιστικά**:
 *
 * ```
 *   πέρασμα 1:  top/left   → γράφουν ΠΑΝΤΑ (είναι τα ονόματα που κατέχει το μοντέλο)
 *   πέρασμα 2:  bottom/right → γράφουν ΜΟΝΟ σε ακμή που έμεινε κενή
 * ```
 *
 * Έτσι η κάτω πλευρά της τελευταίας γραμμής και η δεξιά της τελευταίας στήλης (τα `$end`
 * σύνορα, που **δεν** είναι πλευρά κανενός κελιού) σώζονται, ενώ μια διαφωνία στο εσωτερικό
 * λύνεται πάντα υπέρ του ίδιου κελιού — ποτέ «όποιο έτυχε τελευταίο».
 *
 * @module subapps/dxf-viewer/bim/table/import/worksheet-format-apply
 * @see ./xlsx-worksheet-format.ts — από πού έρχεται η μορφοποίηση
 * @see docs/centralized-systems/reference/adrs/ADR-750-table-cell-borders.md §3.3
 */

import type {
  CellSpan,
  PersistedTableModel,
  TableCellDiagonals,
  TableCellStyleOverride,
  TableColumn,
  TableRow,
} from '../../../types/table';
import type { TableBorderSpec, TableEdgeKey } from '../../../types/table-edges';
import { writePersistedCellStyles } from '../table-cell-content';
import { cellKey } from '../table-model-helpers';
import { setTableEdges, tableEdgeKey, TABLE_EDGE_END } from '../table-edge-model';
import type { ImportedCellFormat, ImportedWorksheetFormat } from './xlsx-worksheet-format';

/** Οι στήλες με τα πλάτη του φύλλου· όπου το Excel δεν δήλωσε, μένει ό,τι είχε ο πίνακας. */
function withColumnWidths(
  columns: readonly TableColumn[],
  widthsMm: readonly (number | undefined)[],
): readonly TableColumn[] {
  return columns.map((column, index) => {
    const widthMm = widthsMm[index];
    return widthMm === undefined || widthMm <= 0
      ? column
      : { ...column, sizing: { kind: 'fixed' as const, widthMm } };
  });
}

/**
 * Οι γραμμές με τα ύψη του φύλλου.
 *
 * ⚠️ Το `heightMm` του μοντέλου είναι **ελάχιστο ύψος**, όχι απόλυτο — μια γραμμή που το
 * περιεχόμενό της απαιτεί περισσότερο ψηλώνει. Άρα ένα εισαγόμενο ύψος δεν μπορεί να κόψει
 * κείμενο· είναι ακριβώς η σημασιολογία που έχει και στο Excel («ύψος γραμμής» + αυτόματη
 * προσαρμογή), οπότε δεν χρειάζεται καμία μετάφραση.
 */
function withRowHeights(
  rows: readonly TableRow[],
  heightsMm: readonly (number | undefined)[],
): readonly TableRow[] {
  return rows.map((row, index) => {
    const heightMm = heightsMm[index];
    return heightMm === undefined || heightMm <= 0 ? row : { ...row, heightMm };
  });
}

/** Οι συγχωνεύσεις του φύλλου, μεταφρασμένες σε ταυτότητες· ό,τι πέφτει εκτός παραλείπεται. */
function importedMerges(model: PersistedTableModel, format: ImportedWorksheetFormat): CellSpan[] {
  const spans: CellSpan[] = [];
  for (const merge of format.merges) {
    const anchorRow = model.rows[merge.top];
    const anchorCol = model.columns[merge.left];
    if (anchorRow === undefined || anchorCol === undefined) continue;
    const rowSpan = Math.min(merge.bottom, model.rows.length - 1) - merge.top + 1;
    const colSpan = Math.min(merge.right, model.columns.length - 1) - merge.left + 1;
    if (rowSpan < 1 || colSpan < 1 || (rowSpan === 1 && colSpan === 1)) continue;
    spans.push({ anchorRowId: anchorRow.id, anchorColId: anchorCol.id, rowSpan, colSpan });
  }
  return spans;
}

/** Οι ακμές, στα **δύο** περάσματα που περιγράφει η κεφαλίδα. */
function importedEdges(
  model: PersistedTableModel,
  cells: readonly ImportedCellFormat[],
): Map<TableEdgeKey, TableBorderSpec> {
  const owned = new Map<TableEdgeKey, TableBorderSpec>();
  const fallback = new Map<TableEdgeKey, TableBorderSpec>();

  const rowIdAt = (r: number): string | undefined => model.rows[r]?.id;
  const colIdAt = (c: number): string | undefined => model.columns[c]?.id;

  for (const cell of cells) {
    const rowId = rowIdAt(cell.row);
    const colId = colIdAt(cell.col);
    if (rowId === undefined || colId === undefined) continue;

    if (cell.borderTop) owned.set(tableEdgeKey('H', rowId, colId), cell.borderTop);
    if (cell.borderLeft) owned.set(tableEdgeKey('V', rowId, colId), cell.borderLeft);
    if (cell.borderBottom) {
      const below = rowIdAt(cell.row + 1) ?? TABLE_EDGE_END;
      fallback.set(tableEdgeKey('H', below, colId), cell.borderBottom);
    }
    if (cell.borderRight) {
      const right = colIdAt(cell.col + 1) ?? TABLE_EDGE_END;
      fallback.set(tableEdgeKey('V', rowId, right), cell.borderRight);
    }
  }

  for (const [key, spec] of fallback) {
    if (!owned.has(key)) owned.set(key, spec);
  }
  return owned;
}

/**
 * **Η μορφοποίηση ενός φύλλου, εφαρμοσμένη.** Καθαρή: ίδιο μοντέλο + ίδια μορφοποίηση ⇒ ίδιο
 * αποτέλεσμα, και **η ίδια αναφορά** όταν δεν υπάρχει τίποτα να αλλάξει.
 *
 * ⚠️ Οι τιμές των κελιών **δεν** αγγίζονται: ο γραφέας απλώνει `{...existing, styleOverride}`.
 * Ένα κελί που δεν υπάρχει αποκτά εγγραφή **μόνο** αν το Excel του έδωσε μορφοποίηση — και
 * αυτό είναι το σημείο όπου το εύρημα του §5.7.4 πληρώνεται: το κελί με **μόνο** περίγραμμα
 * είναι ακριβώς αυτό που ο παλιός αναγνώστης δεν έβλεπε.
 */
export function applyWorksheetFormat(
  model: PersistedTableModel,
  format: ImportedWorksheetFormat,
): PersistedTableModel {
  const byCell = new Map<string, ImportedCellFormat>();
  for (const cell of format.cells) {
    const rowId = model.rows[cell.row]?.id;
    const colId = model.columns[cell.col]?.id;
    if (rowId !== undefined && colId !== undefined) byCell.set(cellKey(rowId, colId), cell);
  }

  const overrideFor = (rowId: string, colId: string): TableCellStyleOverride | undefined => {
    const imported = byCell.get(cellKey(rowId, colId));
    if (imported === undefined) return undefined;
    const merged: TableCellStyleOverride = {
      ...imported.styleOverride,
      ...(imported.numberFormat !== undefined ? { numberFormat: imported.numberFormat } : {}),
    };
    return Object.keys(merged).length > 0 ? merged : undefined;
  };

  /**
   * 🔴 **Η ΕΡΩΤΗΣΗ «ΤΙ ΕΦΕΡΕ ΤΟ ΑΡΧΕΙΟ ΓΙΑ ΑΥΤΟ ΤΟ ΚΕΛΙ;», ΜΙΑ ΦΟΡΑ.**
   *
   * Οι δύο διαδρομές του {@link writePersistedCellStyles} — *ενημέρωση* υπάρχοντος κελιού και
   * *δημιουργία* νέου — ρωτούν **το ίδιο ακριβώς πράγμα** και διαφέρουν μόνο στο πώς το
   * γράφουν: η μία συγχωνεύει με ό,τι υπάρχει, η άλλη ξεκινά από κενό κελί κειμένου.
   *
   * Δύο σώματα εδώ είναι sibling clone (N.18 / CHECK 3.28) — και το ακριβό δεν είναι οι τρεις
   * γραμμές: είναι ο **φύλακας του `null`**. Ένα αντίγραφο που ξεχνά ότι «ούτε στυλ ούτε
   * διαγώνιος ⇒ **μην αγγίξεις το κελί**» γεννά κελιά-φαντάσματα σε κάθε θέση που το αρχείο
   * απλώς άγγιξε, δηλαδή φουσκώνει το έγγραφο με κενά που κανείς δεν ζήτησε.
   */
  const importedStyleAt = (
    rowId: string,
    colId: string,
  ): { readonly override?: TableCellStyleOverride; readonly diagonal?: TableCellDiagonals } | null => {
    const override = overrideFor(rowId, colId);
    const diagonal = byCell.get(cellKey(rowId, colId))?.diagonal;
    if (override === undefined && diagonal === undefined) return null;
    return {
      ...(override !== undefined ? { override } : {}),
      ...(diagonal !== undefined ? { diagonal } : {}),
    };
  };

  const targets = [...byCell.keys()].map((key) => {
    const imported = byCell.get(key) as ImportedCellFormat;
    return { rowId: model.rows[imported.row].id, colId: model.columns[imported.col].id };
  });

  const styled = writePersistedCellStyles(model, targets, {
    update: (existing, target) => {
      const imported = importedStyleAt(target.rowId, target.colId);
      if (imported === null) return null;
      const { override, diagonal } = imported;
      return {
        ...existing,
        ...(override !== undefined ? { styleOverride: { ...existing.styleOverride, ...override } } : {}),
        ...(diagonal !== undefined ? { diagonal } : {}),
      };
    },
    create: (target) => {
      const imported = importedStyleAt(target.rowId, target.colId);
      if (imported === null) return null;
      const { override, diagonal } = imported;
      return {
        kind: 'text',
        value: '',
        ...(override !== undefined ? { styleOverride: override } : {}),
        ...(diagonal !== undefined ? { diagonal } : {}),
      };
    },
  });

  const merges = importedMerges(styled, format);
  const geometry: PersistedTableModel = {
    ...styled,
    columns: withColumnWidths(styled.columns, format.columnWidthsMm),
    rows: withRowHeights(styled.rows, format.rowHeightsMm),
    ...(merges.length > 0 ? { merges: [...styled.merges, ...merges] } : {}),
  };

  return setTableEdges(geometry, importedEdges(geometry, format.cells));
}
