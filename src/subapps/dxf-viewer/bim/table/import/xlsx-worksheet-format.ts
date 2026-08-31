/**
 * 🔴 ADR-833 §5.7 — **Η ΜΟΡΦΟΠΟΙΗΣΗ ΕΝΟΣ ΦΥΛΛΟΥ EXCEL**, στο λεξιλόγιο του πίνακα.
 *
 * Ο αναγνώστης της Φάσης 1 (`xlsx-to-worksheets.ts`) παρέδιδε **σκέτο κείμενο** — και το
 * δήλωνε. Η Φάση 6 προσθέτει το **δεύτερο κανάλι**: πλάτη, ύψη, συγχωνεύσεις, μορφές αριθμού,
 * τυπογραφία, γεμίσματα, στοιχίσεις και περιγράμματα. Το κανάλι του **περιεχομένου** δεν
 * αγγίζεται ούτε κατά γραμμή: το `TsvGrid` εξακολουθεί να πηγαίνει στο `pasteTsvIntoTable`,
 * που κληρονομεί δωρεάν κόψιμο, επίγνωση συγχωνεύσεων και **ένα** βήμα undo.
 *
 * ## 🔴 ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΕΠΙΒΑΛΛΕ ΤΟ {@link worksheetGeometry} — μετρημένο, όχι υποτεθειμένο
 *
 * Το `sheet.columnCount` του `exceljs` **λέει ψέματα** για κάθε φύλλο του οποίου η μορφοποίηση
 * εκτείνεται πέρα από τις τιμές του, επειδή υλοποιείται **με `eachRow`** — που παραλείπει τις
 * γραμμές χωρίς τιμή. Εκτελέστηκε:
 *
 * ```
 *   A1 = 'x' · C3 = μόνο περίγραμμα · E5 = μόνο γέμισμα · στήλη 7 = μόνο πλάτος
 *   ── γράφεται σωστά:  <dimension ref="A1:E5"/>  <c r="C3" s="1"/>  <c r="E5" s="2"/>
 *   ── ξαναδιαβάζεται:
 *        sheet.columnCount = 1     ← ΨΕΥΔΕΣ      getRow(3).cellCount = 3   ← ΑΛΗΘΕΣ
 *        sheet.dimensions  = A1:A1 ← ΨΕΥΔΕΣ      getRow(5).cellCount = 5   ← ΑΛΗΘΕΣ
 *                                                sheet.columns.length = 7  ← ΑΛΗΘΕΣ
 * ```
 *
 * Ένα φύλλο-φόρμα με πλαισιωμένα **κενά** κελιά — από τα συνηθέστερα ελληνικά παραδοτέα
 * μηχανικού — έμπαινε με **μία** στήλη. Μέχρι τη Φ6 δεν κόστιζε (τα κελιά εκείνα δεν έχουν
 * κείμενο να χαθεί)· από τη Φ6 και μετά είναι **απώλεια δεδομένων**.
 *
 * @module subapps/dxf-viewer/bim/table/import/xlsx-worksheet-format
 * @see ./xlsx-border-to-spec.ts — στυλ περιγράμματος → μολύβι
 * @see ./numfmt-to-table-format.ts — μοτίβο → πρόθεση, όσο είναι βέβαιο
 * @see docs/centralized-systems/reference/adrs/ADR-833-table-xlsx-import-and-worksheets.md §5.7.4
 */

import type ExcelJS from 'exceljs';
import { columnIndexFromLetter } from '@/lib/spreadsheet/column-letter';
import { excelCharsToMm, excelPointsToMm } from '@/lib/spreadsheet/excel-sheet-units';
import type { TableCellFormat } from '../../../types/table-cell-format';
import type { TableBorderSpec } from '../../../types/table-edges';
import type { TableCellAlign, TableCellDiagonals, TableCellStyleOverride } from '../../../types/table';
import { tableBorderFromXlsx } from './xlsx-border-to-spec';
import { tableCellFormatForNumFmt } from './numfmt-to-table-format';

/** Ένα ορθογώνιο συγχώνευσης, **μηδενικής βάσης και κλειστό** στα δύο άκρα. */
export interface ImportedMerge {
  readonly top: number;
  readonly left: number;
  readonly bottom: number;
  readonly right: number;
}

/** Ό,τι κουβαλά ένα κελί πέρα από το κείμενό του. Θέση **μηδενικής βάσης**. */
export interface ImportedCellFormat {
  readonly row: number;
  readonly col: number;
  readonly numberFormat?: TableCellFormat;
  readonly styleOverride?: TableCellStyleOverride;
  readonly borderTop?: TableBorderSpec;
  readonly borderLeft?: TableBorderSpec;
  readonly borderBottom?: TableBorderSpec;
  readonly borderRight?: TableBorderSpec;
  readonly diagonal?: TableCellDiagonals;
}

/** Η **αληθινή** έκταση ενός φύλλου — δες την κεφαλίδα. */
export interface WorksheetGeometry {
  readonly rows: number;
  readonly columns: number;
}

/** Η μορφοποίηση ενός φύλλου, μαζί με ό,τι ΔΕΝ κρατήθηκε (για την απαρίθμηση §5.7.5). */
export interface ImportedWorksheetFormat {
  readonly columnWidthsMm: readonly (number | undefined)[];
  readonly rowHeightsMm: readonly (number | undefined)[];
  readonly merges: readonly ImportedMerge[];
  readonly cells: readonly ImportedCellFormat[];
  /** Κελιά με μορφή αριθμού που ο αναγνωριστής **αρνήθηκε** να μαντέψει. */
  readonly unrecognizedNumberFormats: number;
  /** Κελιά με τύπο — μπαίνουν ως **τιμές** (τεκμηριωμένη απόφαση, §1.5 του αναγνώστη). */
  readonly formulaCells: number;
}

/**
 * Η έκταση του φύλλου, από **τρεις** πηγές — κρατιέται η **μέγιστη**:
 * - οι γραμμές ξέρουν τα κελιά τους (**και** όσα έχουν μόνο στυλ),
 * - οι στήλες ξέρουν όποια δήλωσε **μόνο πλάτος**,
 * - οι συγχωνεύσεις δηλώνουν έκταση ακόμη κι όταν **κανένα** κελί τους δεν έχει τιμή ή στυλ.
 *
 * ## ⚠️ ΠΟΣΕΣ ΑΠΟ ΤΙΣ ΤΡΕΙΣ ΕΙΝΑΙ ΑΓΚΥΡΩΜΕΝΕΣ — μετρημένο, δηλωμένο, όχι υπονοούμενο
 * Οι μεταλλάξεις (M52 · M54) έμειναν **πράσινες**, και η αιτία δεν είναι αδύναμη άγκυρα: είναι
 * ότι **ο δικός μας γραφέας δεν μπορεί να φτιάξει το αρχείο που θα τις ξεχώριζε**. Μετρήθηκε:
 *
 * ```
 *   A1 + D3 μόνο περίγραμμα   → columnCount 1 (ΨΕΥΔΕΣ) · maxRowCellCount 4 · columns.length 4
 *   A1 + πλάτος στη στήλη 6   → columnCount 1            · maxRowCellCount 1 · columns.length 6  ← ΜΟΝΗ ΤΗΣ
 *   A1 + συγχώνευση A9:A12    → rowCount 12 (ήδη σωστό)  · η συγχώνευση δεν πρόσθεσε τίποτα
 * ```
 *
 * Ο `exceljs` **υλοποιεί** γραμμές και στήλες για ό,τι γράφει, οπότε σε αρχείο δικής του
 * παραγωγής οι δύο από τις τρεις πηγές συμφωνούν πάντα με μια τρίτη. Η δικαιολόγησή τους είναι
 * τα αρχεία που γράφει **το ίδιο το Excel** — τα οποία αυτή η σουίτα **δεν μπορεί να
 * κατασκευάσει**. Άρα:
 *
 * - `columns.length` → **αγκυρωμένη** (η δεύτερη γραμμή του πίνακα, δικό της test)·
 * - `getRow(r).cellCount` → αγκυρωμένη **έμμεσα** (η πρώτη γραμμή: αποδεικνύει ότι το
 *   `columnCount` ψεύδεται και ότι η ένωση απαντά σωστά)·
 * - οι **συγχωνεύσεις** → **ΜΗ αγκυρωμένες**, καταγραμμένες ως τέτοιες.
 *
 * 🔑 Μένουν και οι τρεις, και **δεν** είναι νεκροί φρουροί: ο `columnCount` ήταν κι εκείνος
 * «προφανώς σωστός» μέχρι που μετρήθηκε. Μια αφαίρεση εδώ θα στηριζόταν σε **μη τεκμηριωμένη**
 * αναλλοίωτη ξένης βιβλιοθήκης — ακριβώς το λάθος που αυτή η συνάρτηση υπάρχει για να διορθώσει.
 * Ίδια στάση με τον βρόχο επαλήθευσης του `table-next-id` (§5.4.8): **δήλωση μετασυνθήκης**,
 * γραμμένη ως μη αγκυρωμένη αντί να παριστάνει τον αποδεδειγμένο.
 */
export function worksheetGeometry(sheet: ExcelJS.Worksheet): WorksheetGeometry {
  let rows = sheet.rowCount;
  let columns = sheet.columns?.length ?? 0;
  for (let r = 1; r <= sheet.rowCount; r++) {
    columns = Math.max(columns, sheet.getRow(r).cellCount);
  }
  for (const merge of readMerges(sheet)) {
    rows = Math.max(rows, merge.bottom + 1);
    columns = Math.max(columns, merge.right + 1);
  }
  return { rows, columns };
}

/** `'A5:C6'` → `{top:4,left:0,bottom:5,right:2}`· ό,τι δεν αναλύεται προσπερνιέται σιωπηρά. */
function parseMergeRange(range: string): ImportedMerge | undefined {
  const [from, to] = range.split(':');
  const start = parseAddress(from);
  const end = parseAddress(to ?? from);
  if (start === undefined || end === undefined) return undefined;
  return {
    top: Math.min(start.row, end.row),
    left: Math.min(start.col, end.col),
    bottom: Math.max(start.row, end.row),
    right: Math.max(start.col, end.col),
  };
}

/** `'C6'` → `{row:5, col:2}` — τα γράμματα λύνονται από τον SSoT, όχι με δεύτερη αριθμητική. */
function parseAddress(address: string): { row: number; col: number } | undefined {
  const match = /^\$?([A-Za-z]+)\$?(\d+)$/.exec(address.trim());
  if (!match) return undefined;
  const col = columnIndexFromLetter(match[1]);
  if (col === null) return undefined;
  return { row: Number(match[2]) - 1, col };
}

function readMerges(sheet: ExcelJS.Worksheet): readonly ImportedMerge[] {
  const raw: unknown = (sheet.model as { merges?: readonly string[] } | undefined)?.merges;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((range) => (typeof range === 'string' ? parseMergeRange(range) : undefined))
    .filter((merge): merge is ImportedMerge => merge !== undefined);
}

/** `AARRGGBB` → `#RRGGBB`· απών ⇒ απών (κληρονομιά). */
function hexFromArgb(argb: string | undefined): string | undefined {
  return argb !== undefined && argb.length >= 6 ? `#${argb.slice(-6).toUpperCase()}` : undefined;
}

const VERTICAL_LETTER: Readonly<Record<string, string>> = { top: 'T', middle: 'M', bottom: 'B' };
const HORIZONTAL_LETTER: Readonly<Record<string, string>> = { left: 'L', center: 'C', right: 'R' };

/**
 * Στοίχιση — **μόνο όταν το Excel δήλωσε τον οριζόντιο άξονα**.
 *
 * 🔴 Η προεπιλογή του Excel στον οριζόντιο άξονα είναι το «Γενικά»: **αριθμοί δεξιά, κείμενο
 * αριστερά**, δηλαδή εξαρτάται από το περιεχόμενο και **δεν είναι εκφράσιμη** ως μία από τις 9
 * σταθερές τιμές του {@link TableCellAlign}. Καρφώνοντας `'L'` όπου το Excel δεν είπε τίποτα,
 * **κάθε αριθμός** κάθε εισαγόμενου φύλλου θα στοιχιζόταν αριστερά — ορατή ζημιά σε κάθε
 * πίνακα ποσοτήτων. Άρα: δεν είπε ⇒ **κληρονομιά**.
 *
 * Όταν όμως ο οριζόντιος δηλώθηκε, ο κατακόρυφος που λείπει είναι **γνωστός**: η προεπιλογή
 * του Excel εκεί είναι σταθερά «κάτω».
 */
function alignFrom(alignment: Partial<ExcelJS.Alignment> | undefined): TableCellAlign | undefined {
  const horizontal = alignment?.horizontal ? HORIZONTAL_LETTER[alignment.horizontal] : undefined;
  if (horizontal === undefined) return undefined;
  const vertical = (alignment?.vertical ? VERTICAL_LETTER[alignment.vertical] : undefined) ?? 'B';
  return `${vertical}${horizontal}` as TableCellAlign;
}

/**
 * Γωνία κειμένου. Το Excel κωδικοποιεί την **αντιωρολογιακή** στο `1..90` και την
 * **ωρολογιακή** στο `91..180` (ως `value − 90` μοίρες προς τα κάτω)· το `255` είναι
 * *στοιβαγμένο* κείμενο, που δεν είναι γωνία και δεν προσποιούμαστε ότι είναι.
 */
function rotationFrom(textRotation: number | 'vertical' | undefined): number | undefined {
  if (typeof textRotation !== 'number') return undefined;
  if (textRotation === 255) return undefined;
  return textRotation <= 90 ? textRotation : -(textRotation - 90);
}

/** Το `overflow` του κελιού — η ένωση είναι 1:1 με τα δύο αμοιβαία αποκλειόμενα κουτάκια. */
function overflowFrom(alignment: Partial<ExcelJS.Alignment> | undefined): 'wrap' | 'shrink' | undefined {
  if (alignment?.wrapText === true) return 'wrap';
  if (alignment?.shrinkToFit === true) return 'shrink';
  return undefined;
}

/** Η τυπογραφία + το γέμισμα + η στοίχιση ενός κελιού, ως παράκαμψη στυλ. */
function styleOverrideFrom(cell: ExcelJS.Cell): TableCellStyleOverride | undefined {
  const font = cell.font;
  const alignment = cell.alignment;
  const fill = cell.fill;
  const fillHex =
    fill?.type === 'pattern' && fill.pattern === 'solid'
      ? hexFromArgb((fill as ExcelJS.FillPattern).fgColor?.argb)
      : undefined;
  const override: TableCellStyleOverride = {
    ...(font?.size !== undefined ? { textHeightMm: excelPointsToMm(font.size) } : {}),
    ...(hexFromArgb(font?.color?.argb) !== undefined
      ? { textColorHex: hexFromArgb(font?.color?.argb) as string }
      : {}),
    ...(fillHex !== undefined ? { fillColorHex: fillHex } : {}),
    ...(font?.bold !== undefined ? { bold: font.bold } : {}),
    ...(font?.italic !== undefined ? { italic: font.italic } : {}),
    ...(font?.underline !== undefined ? { underline: font.underline !== false } : {}),
    ...(font?.name !== undefined ? { fontFamily: font.name } : {}),
    ...(alignFrom(alignment) !== undefined ? { align: alignFrom(alignment) as TableCellAlign } : {}),
    ...(typeof alignment?.indent === 'number' && alignment.indent > 0
      ? { indentLevel: alignment.indent }
      : {}),
    ...(rotationFrom(alignment?.textRotation) !== undefined
      ? { textRotationDeg: rotationFrom(alignment?.textRotation) as number }
      : {}),
    ...(overflowFrom(alignment) !== undefined
      ? { overflow: overflowFrom(alignment) as 'wrap' | 'shrink' }
      : {}),
  };
  return Object.keys(override).length > 0 ? override : undefined;
}

/** Οι διαγώνιοι, όταν το Excel δηλώνει έστω μία φορά. */
function diagonalFrom(border: Partial<ExcelJS.Borders> | undefined): TableCellDiagonals | undefined {
  const diagonal = border?.diagonal;
  if (diagonal === undefined) return undefined;
  const spec = tableBorderFromXlsx(diagonal);
  if (spec === undefined) return undefined;
  const up = diagonal.up === true ? { up: spec } : {};
  const down = diagonal.down === true ? { down: spec } : {};
  const result = { ...up, ...down };
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * **Η μορφοποίηση όλου του φύλλου**, σαρωμένη πάνω στην **αληθινή** γεωμετρία.
 *
 * ⚠️ Η σάρωση των κελιών γίνεται με `getRow(r).getCell(c)` και όχι με `eachCell`, για τον ίδιο
 * λόγο που το {@link worksheetGeometry} υπάρχει: το `eachCell` παραλείπει ό,τι έχει **μόνο**
 * στυλ, δηλαδή ακριβώς αυτά που ψάχνουμε.
 */
export function readWorksheetFormat(
  sheet: ExcelJS.Worksheet,
  geometry: WorksheetGeometry,
): ImportedWorksheetFormat {
  const columnWidthsMm: (number | undefined)[] = [];
  for (let c = 1; c <= geometry.columns; c++) {
    const width = sheet.getColumn(c).width;
    columnWidthsMm.push(width === undefined ? undefined : excelCharsToMm(width));
  }

  const rowHeightsMm: (number | undefined)[] = [];
  const cells: ImportedCellFormat[] = [];
  let unrecognizedNumberFormats = 0;
  let formulaCells = 0;

  for (let r = 1; r <= geometry.rows; r++) {
    const row = sheet.getRow(r);
    rowHeightsMm.push(row.height === undefined ? undefined : excelPointsToMm(row.height));
    for (let c = 1; c <= geometry.columns; c++) {
      const cell = row.getCell(c);
      const value: unknown = cell.value;
      if (value !== null && typeof value === 'object' && 'formula' in value) formulaCells += 1;

      let numberFormat: TableCellFormat | undefined;
      if (cell.numFmt !== undefined) {
        numberFormat = tableCellFormatForNumFmt(cell.numFmt);
        if (numberFormat === undefined) unrecognizedNumberFormats += 1;
      }

      const entry: ImportedCellFormat = {
        row: r - 1,
        col: c - 1,
        ...(numberFormat !== undefined ? { numberFormat } : {}),
        ...(styleOverrideFrom(cell) !== undefined
          ? { styleOverride: styleOverrideFrom(cell) as TableCellStyleOverride }
          : {}),
        ...borderEntries(cell),
        ...(diagonalFrom(cell.border) !== undefined
          ? { diagonal: diagonalFrom(cell.border) as TableCellDiagonals }
          : {}),
      };
      if (Object.keys(entry).length > 2) cells.push(entry);
    }
  }

  return {
    columnWidthsMm,
    rowHeightsMm,
    merges: readMerges(sheet),
    cells,
    unrecognizedNumberFormats,
    formulaCells,
  };
}

/** Οι τέσσερις πλευρές, μόνο όσες το Excel δήλωσε. */
function borderEntries(cell: ExcelJS.Cell): Partial<ImportedCellFormat> {
  const border = cell.border;
  const top = tableBorderFromXlsx(border?.top);
  const left = tableBorderFromXlsx(border?.left);
  const bottom = tableBorderFromXlsx(border?.bottom);
  const right = tableBorderFromXlsx(border?.right);
  return {
    ...(top !== undefined ? { borderTop: top } : {}),
    ...(left !== undefined ? { borderLeft: left } : {}),
    ...(bottom !== undefined ? { borderBottom: bottom } : {}),
    ...(right !== undefined ? { borderRight: right } : {}),
  };
}
