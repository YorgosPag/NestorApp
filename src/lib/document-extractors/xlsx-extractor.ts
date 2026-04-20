import ExcelJS from 'exceljs';

/**
 * Extracts plain text from an XLSX buffer using exceljs.
 * Each sheet is serialized as tab-separated rows, sheets separated by newlines.
 * Returns empty string on failure (classification falls back to filename-only).
 */
export async function extractTextFromXlsx(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const lines: string[] = [];

  workbook.eachSheet((sheet) => {
    lines.push(`[Sheet: ${sheet.name}]`);
    sheet.eachRow((row) => {
      const cells = (row.values as ExcelJS.CellValue[])
        .slice(1)
        .map((v) => (v == null ? '' : String(v)))
        .join('\t');
      if (cells.trim()) lines.push(cells);
    });
  });

  return lines.join('\n').trim();
}
