/**
 * Excel (.xlsx) → `RawTable` (ADR-923 §5.5 · ADR-650 M2).
 *
 * Ίδιο συμβόλαιο με τον `delimited-reader`, ώστε ο αντιστοιχιστής να μη μαθαίνει ποτέ από ποια μορφή ήρθαν τα κελιά.
 *
 * ⚠️ Το `exceljs` (MIT) είναι **ήδη** εξάρτηση — κανένα νέο πακέτο (N.5). Φορτώνεται με **δυναμικό import**, όπως σε
 * κάθε άλλο καταναλωτή: η βιβλιοθήκη των ~600 KB μένει έξω από το κύριο bundle (ADR-040).
 *
 * Κάθε κελί γίνεται κείμενο — η τυποποίηση είναι δουλειά του αντιστοιχιστή, όχι του αναγνώστη.
 * @module lib/tabular-import/excel-reader
 */

import type ExcelJS from 'exceljs';
import { readDelimitedText } from './delimited-reader';
import type { RawTable } from './tabular-types';

export interface ReadExcelOptions {
  /** Θέση φύλλου με βάση το 0· προεπιλογή το πρώτο. */
  readonly sheetIndex?: number;
  /** Πόσες γραμμές στην κορυφή παραλείπονται (τίτλοι προμηθευτή πάνω από την επικεφαλίδα). */
  readonly skipRows?: number;
}

/** Το Excel δίνει ημερομηνίες/τύπους/εμπλουτισμένο κείμενο — κάθε ένα συμπτύσσεται στο απλό κείμενο που περιμένει ο αντιστοιχιστής. */
function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'result' in value) return String(value.result ?? ''); // τύπος
  if (typeof value === 'object' && 'text' in value) return String(value.text ?? '');     // εμπλουτισμένο/σύνδεσμος
  return String(value);
}

/**
 * Διαβάζει ένα φύλλο σε `RawTable`. Η ανίχνευση επικεφαλίδας ανατίθεται στον `delimited-reader` (ένας κανόνας και
 * για τις δύο μορφές, κανένας δίδυμος): το φύλλο ξαναγράφεται ως κείμενο με tab και διαβάζεται με ρητό `\t`. Τα
 * κελιά μπαίνουν σε εισαγωγικά, ώστε περιγραφή με tab να μη μετατοπίζει τις στήλες.
 */
export async function readExcelToTable(buffer: ArrayBuffer, options: ReadExcelOptions = {}): Promise<RawTable> {
  const ExcelJSLib = (await import('exceljs')).default;
  const workbook = new ExcelJSLib.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[options.sheetIndex ?? 0];
  if (!sheet) return { headers: [], rows: [] };

  const lines: string[] = [];
  sheet.eachRow((row) => {
    // Το `row.values` έχει βάση το 1 (ο δείκτης 0 είναι πάντα κενός) — αφαιρείται.
    const cells = (row.values as ExcelJS.CellValue[]).slice(1).map(cellToString);
    if (cells.some((c) => c.trim().length > 0)) {
      lines.push(cells.map((c) => `"${c.replace(/"/g, '')}"`).join('\t'));
    }
  });

  return readDelimitedText(lines.join('\n'), { delimiter: '\t', skipRows: options.skipRows });
}
