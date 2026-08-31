/**
 * 🔴 ADR-833 §5.7 — **ΕΝΑ ΚΕΛΙ ΤΟΥ ΠΙΝΑΚΑ, ΓΡΑΜΜΕΝΟ ΣΤΟ `.xlsx`**: τιμή, μορφή, τυπογραφία,
 * γέμισμα, στοίχιση, περιγράμματα.
 *
 * ## Η αρχή που δεν σπάει: **ΓΡΑΦΕΤΑΙ Η ΤΙΜΗ, ΟΧΙ ΤΟ ΚΕΙΜΕΝΟ**
 * Το κελί που φεύγει κρατά τον **ωμό αριθμό** και δίπλα του τη **μορφή** (`numFmt`) — ποτέ το
 * αποτέλεσμα του `cellDisplayText`. Η διαφορά δεν είναι αισθητική:
 *
 * ```
 *   value: 1234.5678 + numFmt '0.00'   →  το Excel ΔΕΙΧΝΕΙ 1234,57 και ΑΘΡΟΙΖΕΙ 1234,5678  ✅
 *   value: '1.234,57'                  →  το Excel δείχνει κείμενο και ΔΕΝ αθροίζει τίποτα  ❌
 * ```
 *
 * Είναι ο κανόνας «τιμή ≠ εμφάνιση» του ADR-760, εφαρμοσμένος στην έξοδο. Ο ίδιος κανόνας που
 * κρατά τον `xlsx-exporter.ts` του ADR-363 να γράφει `number` και όχι `string`, με το ίδιο
 * σκεπτικό γραμμένο στην κεφαλίδα του από το 2026.
 *
 * ## 🔑 ΟΙ ΤΥΠΟΙ ΦΕΥΓΟΥΝ ΩΣ ΤΥΠΟΙ — και η γραμματική είναι ΗΔΗ διαλεγμένη
 * Το `TableCell.formula` είναι **δέντρο δεμένο σε ταυτότητες**, όχι κείμενο. Ο εκτυπωτής
 * ({@link printTableFormula}) το γυρίζει σε `A1` κατ' απαίτηση, και η γραμματική που ζητά το
 * αρχείο είναι δηλωμένη ονομαστικά στο `types/table-formula-grammar.ts`:
 *
 * > *«{@link CANONICAL_FORMULA_GRAMMAR} — Είναι αυτή που έχει το **αρχείο**: `.xlsx`,
 * > `ACAD_TABLE`, και κάθε φύλλο υπολογισμού στον δίσκο του.»*
 *
 * Άρα **δεν επιλέγεται εδώ τίποτα**: ο εξαγωγέας ρωτά την υπάρχουσα αυθεντία. Ο πειρασμός να
 * γραφτεί η γραμματική **του χρήστη** (ελληνικό `;`) θα ήταν σφάλμα που το ίδιο το ADR-761
 * περιγράφει: το αρχείο κρατά **πάντα** αγγλικά ονόματα και `,`, και το Excel εντοπίζει τη
 * γλώσσα **στην οθόνη**.
 *
 * ⚠️ Τα ονόματα των συναρτήσεών μας είναι **ήδη** του Excel (`SUM`, `AVERAGE`, `IF`) —
 * κανονικοποιημένα σε κεφαλαία από τον αναλυτή. Καμία μετάφραση ονομάτων δεν χρειάζεται, και
 * καμία δεν γίνεται: μια συνάρτηση που δεν την ξέρει το Excel φεύγει με το όνομά της και
 * γίνεται `#NAME?` **εκεί**, ορατά — αντί να μεταφραστεί σε κάτι που *μοιάζει* σωστό.
 *
 * @module subapps/dxf-viewer/bim/table/export/table-cell-to-xlsx
 * @see bim/table/table-cell-style-scan.ts — ο ΕΝΑΣ βρόχος επίλυσης στυλ, που τροφοδοτεί εδώ
 * @see ./table-format-to-numfmt.ts — πρόθεση → μοτίβο
 * @see docs/centralized-systems/reference/adrs/ADR-833-table-xlsx-import-and-worksheets.md §5.7
 */

import type ExcelJS from 'exceljs';
import { mmToExcelPoints } from '@/lib/spreadsheet/excel-sheet-units';
import type { TableModel } from '../../../types/table';
import { CANONICAL_FORMULA_GRAMMAR } from '../../../types/table-formula-grammar';
import type { TableResolvedCell } from '../table-cell-style-scan';
import { resolveCellNumberFormat } from '../table-cell-format';
import { resolveCellOverflow } from '../table-cell-overflow';
import { resolveTableEdgeSpec } from '../table-edge-resolve';
import { isFormulaError } from '../formula/table-formula-value';
import { printTableFormula } from '../formula/table-formula-print';
import type { TableFormulaWorkbook } from '../formula/table-formula-workbook';
import type { TableStyle } from '../table-style';
import { xlsxBorderFor } from './table-border-to-xlsx';
import { xlsxNumFmtForCellFormat } from './table-format-to-numfmt';
import { hexToArgb } from './table-xlsx-color';

/** Ο εκτυπωτής βάζει το `=` μπροστά· ο `exceljs` το θέλει **χωρίς**. */
const FORMULA_PREFIX_LENGTH = 1;

/** Στοίχιση: το πρώτο γράμμα του `TableCellAlign` είναι ο κατακόρυφος άξονας. */
const VERTICAL_BY_LETTER: Readonly<Record<string, ExcelJS.Alignment['vertical']>> = {
  T: 'top',
  M: 'middle',
  B: 'bottom',
};

/** …και το δεύτερο ο οριζόντιος. */
const HORIZONTAL_BY_LETTER: Readonly<Record<string, ExcelJS.Alignment['horizontal']>> = {
  L: 'left',
  C: 'center',
  R: 'right',
};

/**
 * Η τιμή του κελιού όπως τη θέλει ο `exceljs`.
 *
 * Τρεις περιπτώσεις, και η σειρά τους έχει σημασία: ο **τύπος** πρώτα (γιατί το `value` του
 * κρατά μόνο το αποτέλεσμα), μετά ο **κωδικός σφάλματος** (γιατί είναι `string` και θα
 * περνούσε για κείμενο), και τέλος η σκέτη τιμή.
 */
function cellValueFor(resolved: TableResolvedCell, book: TableFormulaWorkbook): ExcelJS.CellValue {
  const cell = resolved.cell;
  if (cell === undefined) return null;

  if (cell.kind === 'formula' && cell.formula !== undefined) {
    const printed = printTableFormula(book, cell.formula, CANONICAL_FORMULA_GRAMMAR);
    return {
      formula: printed.slice(FORMULA_PREFIX_LENGTH),
      result: resultValueFor(cell.value),
    };
  }
  if (typeof cell.value === 'string' && isFormulaError(cell.value)) {
    return { error: cell.value as ExcelJS.CellErrorValue['error'] };
  }
  return cell.value;
}

/**
 * Το **αποτέλεσμα** ενός τύπου, ώστε το Excel να δείχνει νούμερο πριν καν επαναϋπολογίσει.
 *
 * 🔑 Χωρίς αυτό, κάθε κελί με τύπο δείχνει `0` μέχρι το πρώτο άνοιγμα με ενεργό υπολογισμό —
 * και σε προεπισκόπηση (Explorer, Google Drive, email) **ποτέ**. Το αποθηκευμένο αποτέλεσμα
 * είναι ακριβώς αυτό που κάνει και το ίδιο το Excel (`<v>` δίπλα στο `<f>`).
 */
function resultValueFor(value: string | number | null): ExcelJS.CellFormulaValue['result'] {
  if (typeof value === 'string' && isFormulaError(value)) {
    return { error: value as ExcelJS.CellErrorValue['error'] };
  }
  return value ?? undefined;
}

/**
 * 🔴 **ΤΟ ΜΕΓΕΘΟΣ ΣΤΡΟΓΓΥΛΟΠΟΙΕΙΤΑΙ, ΚΑΙ ΤΟ ΦΤΑΙΞΙΜΟ ΕΙΝΑΙ ΤΗΣ ΒΙΒΛΙΟΘΗΚΗΣ — μετρημένο.**
 *
 * Το OOXML δηλώνει το `<sz val="…"/>` ως **δεκαδικό** (`ST_FontSize` = double). Ο `exceljs`
 * όμως το περνά από `IntegerXform` (`lib/xlsx/xform/style/font-xform.js:33`), δηλαδή
 * **αποκόπτει** το δεκαδικό μέρος στη σειριοποίηση. Εκτελέστηκε:
 *
 * ```
 *   γράφτηκαν  7,94 · 7,5 · 11,34 · 8,5 · 9,07
 *   διαβάστηκαν   7 ·   7 ·    11 ·   8 ·    9        ← αποκοπή, όχι στρογγυλοποίηση
 * ```
 *
 * Ένα κείμενο 2,8 mm είναι **7,94 pt**: αφημένο στην αποκοπή γίνεται **7 pt**, δηλαδή **−12%**
 * σιωπηλά. Στρογγυλοποιημένο γίνεται 8 pt, δηλαδή **+0,75%**. Δεν κρύβουμε τίποτα —
 * **διαλέγουμε την πλησιέστερη τιμή που η μορφή μπορεί να κρατήσει**, όπως κάθε φορά που ο
 * στόχος έχει χονδρότερη ανάλυση από την πηγή.
 *
 * ⚠️ Δεν ισχύει για τα υπόλοιπα: πλάτη στηλών, ύψη γραμμών, εσοχή και γωνία επιβιώνουν με
 * **πλήρη** ακρίβεια (μετρημένο στο ίδιο πέρασμα) — γι' αυτό η στρογγυλοποίηση μένει **εδώ**
 * και δεν μολύνει το `excel-sheet-units`, που είναι σωστό ως έχει.
 *
 * ⚠️ Το `fontFamily` γράφεται **μόνο όταν υπάρχει**: ένα `name: undefined` θα ανάγκαζε το
 * `exceljs` να γράψει άδειο `<name/>`, που το Excel διαβάζει ως γραμματοσειρά χωρίς όνομα.
 * Απόν πεδίο ⇒ η προεπιλογή του βιβλίου (Calibri 11) — ίδια σύμβαση «απόν ⇒ προεπιλογή» με
 * ολόκληρο το μοντέλο.
 */
function fontFor(resolved: TableResolvedCell): Partial<ExcelJS.Font> {
  const { style } = resolved;
  const font: Partial<ExcelJS.Font> = {
    size: Math.max(1, Math.round(mmToExcelPoints(style.textHeightMm))),
    bold: style.bold,
    italic: style.italic,
    underline: style.underline,
    color: { argb: hexToArgb(style.textColorHex) },
  };
  return style.fontFamily ? { ...font, name: style.fontFamily } : font;
}

/**
 * Στοίχιση, εσοχή, γωνία **και** η απάντηση στο «τι γίνεται όταν δεν χωρά».
 *
 * Το `TableCellOverflow` είναι **ένωση** ακριβώς επειδή στο Excel τα δύο κουτάκια είναι
 * αμοιβαία αποκλειόμενα (`types/table.ts`) — άρα η μετάφραση είναι 1:1 και δεν χρειάζεται
 * καμία σειρά προτεραιότητας εδώ. Το `'clip'` δεν έχει αντίστοιχο διακόπτη: είναι η
 * **απουσία** και των δύο, δηλαδή η προεπιλογή του Excel.
 */
function alignmentFor(resolved: TableResolvedCell): Partial<ExcelJS.Alignment> {
  const { style, column, cell } = resolved;
  const overflow = resolveCellOverflow(cell?.styleOverride?.overflow, column.overflow);
  return {
    vertical: VERTICAL_BY_LETTER[style.align[0]],
    horizontal: HORIZONTAL_BY_LETTER[style.align[1]],
    indent: style.indentLevel,
    textRotation: style.textRotationDeg,
    wrapText: overflow === 'wrap',
    shrinkToFit: overflow === 'shrink',
  };
}

/**
 * Τα τέσσερα περιγράμματα **και οι δύο διαγώνιοι**.
 *
 * 🔴 Οι πλευρές ρωτιούνται από το **πλέγμα**, όχι από το κελί: η ακμή ζει ανάμεσα σε δύο
 * κελιά (ADR-750 §6) και ο επιλυτής της δέχεται **δείκτες**. Η κάτω πλευρά του κελιού `(r,c)`
 * είναι η **πάνω** του `(r+1,c)`, και η δεξιά η **αριστερή** του `(r,c+1)` — η ίδια σύμβαση
 * «ΜΙΑ ακμή, ΕΝΑ όνομα» που κάνει τη διφορούμενη ιδιοκτησία **μη εκφράσιμη**. Ο επιλυτής
 * χειρίζεται μόνος του τα sentinel άκρα (`$end`).
 */
function borderFor(
  resolved: TableResolvedCell,
  model: TableModel,
  style: TableStyle,
): Partial<ExcelJS.Borders> {
  const { rowIndex: r, colIndex: c } = resolved;
  const diagonal = resolved.cell?.diagonal;
  const diagonalSpec = diagonal?.up ?? diagonal?.down;
  return {
    top: xlsxBorderFor(resolveTableEdgeSpec(model, style, 'H', r, c)),
    bottom: xlsxBorderFor(resolveTableEdgeSpec(model, style, 'H', r + 1, c)),
    left: xlsxBorderFor(resolveTableEdgeSpec(model, style, 'V', r, c)),
    right: xlsxBorderFor(resolveTableEdgeSpec(model, style, 'V', r, c + 1)),
    diagonal: diagonalSpec
      ? { ...xlsxBorderFor(diagonalSpec), up: diagonal?.up !== undefined, down: diagonal?.down !== undefined }
      : undefined,
  };
}

/**
 * **Ένα κελί, ολόκληρο.** Ο μόνος γραφέας κελιού της πόρτας Β.
 *
 * ⚠️ Το γέμισμα γράφεται **μόνο όταν υπάρχει**: το `fillColorHex` είναι `clearable`
 * (`null` ⇒ ρητά χωρίς γέμισμα, `undefined` ⇒ κληρονόμησε), και ένα `pattern: 'none'` στο
 * OOXML **δεν** είναι το ίδιο με «καμία δήλωση» — το πρώτο σβήνει το γέμισμα που θα έβαζε
 * ένα στυλ πίνακα του Excel, το δεύτερο το αφήνει.
 */
export function writeXlsxCell(
  target: ExcelJS.Cell,
  resolved: TableResolvedCell,
  book: TableFormulaWorkbook,
  model: TableModel,
  style: TableStyle,
): void {
  // 🔴 ADR-833 Φάση 7 — **ο εκτυπωτής ρωτά το σύνορο ΤΟΥ ΑΡΧΕΙΟΥ για τα ονόματα φύλλων**, όχι
  // την οθόνη: το `.xlsx` δείχνει φύλλα **κατά όνομα** και τα ονόματά του είναι εξυγιασμένα και
  // μοναδικοποιημένα (`xlsxWorksheetNames`). Ένας τύπος που έγραφε το ορατό όνομα θα παρήγαγε
  // βιβλίο που **δεν ανοίγει** — ή, χειρότερα, που δείχνει σε λάθος ομώνυμο φύλλο.
  target.value = cellValueFor(resolved, book);

  const numFmt = xlsxNumFmtForCellFormat(
    resolveCellNumberFormat(resolved.overrides, resolved.column.valueType),
  );
  if (numFmt !== undefined) target.numFmt = numFmt;

  target.font = fontFor(resolved);
  target.alignment = alignmentFor(resolved);
  target.border = borderFor(resolved, model, style);

  const fillHex = resolved.style.fillColorHex;
  if (fillHex) {
    target.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(fillHex) } };
  }
}
