/**
 * ADR-650 Milestone 2 — Excel (.xlsx) survey file → `RawTable`.
 *
 * Same contract as `topo-delimited-reader` (both emit a `RawTable`), so the column mapper
 * downstream never learns whether the points came from a CSV or a spreadsheet.
 *
 * ⚠️ `exceljs` (MIT) is ALREADY a repo dependency — no new package (license gate N.5 moot).
 * It is loaded through a **dynamic import** exactly like every other consumer in the repo
 * (`bim/schedule/exporters/xlsx-exporter`, `report-excel-exporter`, …): the ~600 KB library
 * must stay out of the DXF viewer's main bundle (ADR-040) and is only paid for by the
 * surveyor who actually picks an .xlsx file.
 *
 * Every cell is stringified — typing is the mapper's job, not the reader's.
 */

import type ExcelJS from 'exceljs';
import { readDelimitedText } from './topo-delimited-reader';
import type { RawTable } from './topo-import-types';

/** Excel gives us dates/formulas/rich text — collapse each to the plain text the mapper expects. */
function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'result' in value) return String(value.result ?? ''); // formula
  if (typeof value === 'object' && 'text' in value) return String(value.text ?? '');     // rich text/hyperlink
  return String(value);
}

/**
 * Read the FIRST worksheet of an .xlsx into a `RawTable`.
 *
 * Header detection is delegated to the delimited reader (single rule for both formats —
 * no twin heuristic): the sheet is re-emitted as tab-separated text and parsed with an
 * explicit `\t` delimiter. Cells are quoted so a description containing a tab cannot
 * shift the columns.
 */
export async function readExcelToTable(buffer: ArrayBuffer): Promise<RawTable> {
  const ExcelJSLib = (await import('exceljs')).default;
  const workbook = new ExcelJSLib.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const lines: string[] = [];
  sheet.eachRow((row) => {
    // `row.values` is 1-based (index 0 is always empty) — drop it.
    const cells = (row.values as ExcelJS.CellValue[]).slice(1).map(cellToString);
    if (cells.some((c) => c.trim().length > 0)) {
      lines.push(cells.map((c) => `"${c.replace(/"/g, '')}"`).join('\t'));
    }
  });

  return readDelimitedText(lines.join('\n'), { delimiter: '\t' });
}
