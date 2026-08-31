/**
 * 🔴 ADR-833 §5.7 — **Η ΠΟΡΤΑ Β: ο πίνακας φεύγει ως `.xlsx`, με ΟΛΑ του τα φύλλα.**
 *
 * Μέχρι τη Φάση 6 ο πίνακας του DXF viewer **δεν είχε καμία εξαγωγή** — επαληθεύτηκε: οι μόνοι
 * καλούντες του `xlsx-exporter.ts` ήταν το schedule και ο φάκελος τοπογραφικού. Δεν υπήρχε
 * τίποτα να επεκταθεί· υπήρχε **μηχανή να δανειστεί** (`./xlsx-workbook.ts`, §5.7.1).
 *
 * ```
 *   TableWorksheet[]  →  ένα φύλλο εργασίας το καθένα, ΣΤΗ ΣΕΙΡΑ ΤΟΥΣ
 *        ├── όνομα     worksheetDisplayName  (ο ΕΝΑΣ επιλυτής) → μοναδικοποίηση στο σύνορο
 *        ├── πλάτη     layout.columns[i].widthMm  → χαρακτήρες Excel
 *        ├── ύψη       layout.rows[i].heightMm    → στιγμές
 *        ├── κελιά     forEachResolvedCellStyle   (ο ΕΝΑΣ βρόχος επίλυσης)
 *        └── συγχωνεύσεις  model.merges → δείκτες
 * ```
 *
 * ## 🔑 ΤΑ ΠΛΑΤΗ ΕΡΧΟΝΤΑΙ ΑΠΟ ΤΗ ΔΙΑΤΑΞΗ, ΟΧΙ ΑΠΟ ΤΟ ΜΟΝΤΕΛΟ — και αυτό είναι απαραίτητο
 * Το `TableColumnSizing` έχει **τρεις** μορφές: `fixed(widthMm)`, `hug` (όσο το πλατύτερο
 * περιεχόμενο) και `fill(weight)` (μοιρασιά του υπολοίπου). Οι **δύο τελευταίες δεν έχουν
 * αριθμό στο μοντέλο** — τον παράγει η διάταξη. Ένας εξαγωγέας που ρωτούσε το μοντέλο θα
 * έγραφε πλάτος **μόνο** για τις `fixed` και θα άφηνε τις υπόλοιπες στην προεπιλογή του Excel:
 * ο ίδιος πίνακας, άλλες αναλογίες. Η διάταξη είναι η **ίδια** αυθεντία που ζωγραφίζει τον
 * καμβά, άρα «ό,τι βλέπεις, αυτό φεύγει».
 *
 * ## ⚠️ Γιατί γράφονται ΟΛΑ τα κελιά του πλέγματος, και όχι μόνο τα γεμάτα
 * Ένα κενό κελί του πίνακα **δεν είναι κενό**: έχει περίγραμμα (το πλέγμα), και συχνά γέμισμα
 * (γραμμή τίτλου/κεφαλίδας). Γράφοντας μόνο τα γεμάτα, ένας πίνακας 8×20 με τρεις τιμές θα
 * έφτανε στο Excel ως **τρία** κελιά χωρίς πλέγμα — δηλαδή θα έχανε ακριβώς αυτό που τον κάνει
 * πίνακα. Είναι το κάτοπτρο του ευρήματος §5.7.4: εκεί ο **αναγνώστης** δεν έβλεπε τα κελιά
 * που έχουν μόνο μορφοποίηση· εδώ ο **γραφέας** οφείλει να τα γράψει.
 *
 * @module subapps/dxf-viewer/bim/table/export/table-to-xlsx
 * @see bim/schedule/exporters/xlsx-workbook.ts — η κοινή μηχανική
 * @see bim/table/table-worksheet-name.ts — ο ΕΝΑΣ επιλυτής ονόματος καρτέλας
 * @see docs/centralized-systems/reference/adrs/ADR-833-table-xlsx-import-and-worksheets.md §5.7
 */

import type ExcelJS from 'exceljs';
import { mmToExcelChars, mmToExcelPoints } from '@/lib/spreadsheet/excel-sheet-units';
import {
  createXlsxWorkbook,
  downloadXlsxBlob,
  xlsxWorkbookToBlob,
  xlsxWorksheetNames,
} from '../../schedule/exporters/xlsx-workbook';
import type { TableWorksheet } from '../../../types/table-worksheet';
import type { PersistedTableModel } from '../../../types/table';
import type { TableCellRef } from '../table-cell-range';
import { forEachResolvedCellStyle } from '../table-cell-style-scan';
import { indexById, resolveTableModel } from '../table-model-helpers';
import { layoutTable } from '../table-layout';
import type { TableStyle } from '../table-style';
import { worksheetDisplayName } from '../table-worksheet-name';
import { writeXlsxCell } from './table-cell-to-xlsx';

/** Ό,τι γράφει ο δημιουργός στα μεταδεδομένα του βιβλίου αυτής της πόρτας. */
const WORKBOOK_CREATOR = 'Nestor Pagonis · Πίνακας';

/** Κάθε κελί του πλέγματος, σε σειρά **γραμμή × στήλη** — δες την κεφαλίδα για το γιατί «κάθε». */
function everyCellRef(model: PersistedTableModel): TableCellRef[] {
  const refs: TableCellRef[] = [];
  for (const row of model.rows) {
    for (const column of model.columns) {
      refs.push({ rowId: row.id, colId: column.id });
    }
  }
  return refs;
}

/**
 * Πλάτη στηλών και ύψη γραμμών, από τη **διάταξη**.
 *
 * ⚠️ Το `exceljs` αριθμεί από το **1**· κάθε `+ 1` εδώ είναι αυτό και τίποτε άλλο.
 */
function writeGeometry(sheet: ExcelJS.Worksheet, model: PersistedTableModel, style: TableStyle): void {
  const layout = layoutTable(resolveTableModel(model), style);
  layout.columns.forEach((column, i) => {
    sheet.getColumn(i + 1).width = mmToExcelChars(column.widthMm);
  });
  layout.rows.forEach((row, i) => {
    sheet.getRow(i + 1).height = mmToExcelPoints(row.heightMm);
  });
}

/**
 * Οι συγχωνεύσεις, **μετά** από κάθε τιμή.
 *
 * 🔴 Η σειρά δεν είναι προτίμηση: ο `mergeCells` του `exceljs` μετατρέπει τα καλυμμένα κελιά σε
 * δορυφόρους του κυρίου, και **εγγραφή σε δορυφόρο πετά εξαίρεση**. Συγχώνευση πρώτα θα
 * σήμαινε ότι ο πρώτος συγχωνευμένος πίνακας ρίχνει ολόκληρη την εξαγωγή.
 *
 * Οι εκτός ορίων συγχωνεύσεις **προσπερνιούνται σιωπηρά** — ίδια σύμβαση ανοχής με το
 * `buildMergeIndex`: μια αναφορά σε σβησμένη γραμμή είναι φυσιολογικό ενδιάμεσο στάδιο
 * επεξεργασίας, όχι λόγος να χαθεί ολόκληρο το αρχείο.
 */
function writeMerges(sheet: ExcelJS.Worksheet, model: PersistedTableModel): void {
  const rowAt = indexById(model.rows);
  const colAt = indexById(model.columns);
  for (const span of model.merges) {
    const r0 = rowAt.get(span.anchorRowId);
    const c0 = colAt.get(span.anchorColId);
    if (r0 === undefined || c0 === undefined) continue;
    if (span.rowSpan < 1 || span.colSpan < 1) continue;
    if (span.rowSpan === 1 && span.colSpan === 1) continue;
    const rEnd = Math.min(r0 + span.rowSpan, model.rows.length);
    const cEnd = Math.min(c0 + span.colSpan, model.columns.length);
    sheet.mergeCells(r0 + 1, c0 + 1, rEnd, cEnd);
  }
}

/** Ένα φύλλο εργασίας του πίνακα → ένα φύλλο εργασίας του βιβλίου. */
function writeWorksheet(
  workbook: ExcelJS.Workbook,
  name: string,
  worksheet: TableWorksheet,
  style: TableStyle,
): void {
  const sheet = workbook.addWorksheet(name);
  const model = worksheet.model;
  if (model.rows.length === 0 || model.columns.length === 0) return;

  writeGeometry(sheet, model, style);

  // 🔑 Ο **ΕΝΑΣ** βρόχος επίλυσης στυλ (`table-cell-style-scan`) — ο ίδιος που τροφοδοτεί το
  // πινέλο μορφοποίησης και τη «συμφωνούν;» ερώτηση της κορδέλας. Δεύτερος βρόχος εδώ θα ήταν
  // structural clone (CHECK 3.28) και, χειρότερα, δεύτερη σειρά προτεραιότητας κληρονομιάς.
  const resolvedModel = resolveTableModel(model);
  forEachResolvedCellStyle(model, style, everyCellRef(model), (resolved) => {
    writeXlsxCell(
      sheet.getCell(resolved.rowIndex + 1, resolved.colIndex + 1),
      resolved,
      resolvedModel,
      style,
    );
  });

  writeMerges(sheet, model);
}

/**
 * **Όλα** τα φύλλα ενός πίνακα σε **ένα** βιβλίο — «ένα βιβλίο μέσα, ένα βιβλίο έξω» (§5.4.4),
 * τώρα και προς την άλλη κατεύθυνση.
 *
 * ⚠️ Τα ονόματα λύνονται με **ολόκληρο** το βιβλίο μπροστά: ο πίνακας επιτρέπει ρητά δύο φύλλα
 * με το ίδιο όνομα (§5.4 — εκεί η ταυτότητα είναι το `id`), το `.xlsx` **όχι**. Η σύμβαση
 * `(2)` του Excel μπαίνει στο σύνορο, όπου λύνει πραγματικό πρόβλημα.
 */
export async function tableWorksheetsToXlsxBlob(
  worksheets: readonly TableWorksheet[],
  style: TableStyle,
): Promise<Blob> {
  const workbook = await createXlsxWorkbook(WORKBOOK_CREATOR);
  const names = xlsxWorksheetNames(
    worksheets.map((worksheet, index) => worksheetDisplayName(worksheet, index)),
  );
  worksheets.forEach((worksheet, index) => {
    writeWorksheet(workbook, names[index], worksheet, style);
  });
  return xlsxWorkbookToBlob(workbook);
}

/** Το ίδιο, κατεβασμένο. Η κατάληξη μπαίνει από τη μηχανή, όχι εδώ. */
export async function downloadTableAsXlsx(
  worksheets: readonly TableWorksheet[],
  style: TableStyle,
  filenameWithoutExtension: string,
): Promise<void> {
  downloadXlsxBlob(await tableWorksheetsToXlsxBlob(worksheets, style), filenameWithoutExtension);
}
