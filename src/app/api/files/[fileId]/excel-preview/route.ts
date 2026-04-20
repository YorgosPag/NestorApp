/**
 * GET /api/files/[fileId]/excel-preview
 *
 * Downloads XLSX from Firebase Storage via Admin SDK, converts with exceljs
 * to a self-contained HTML table, returns as text/html.
 * Used by ExcelPreview component — avoids Microsoft Office Online Viewer
 * which cannot access Firebase Storage URLs.
 *
 * @module api/files/[fileId]/excel-preview
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getAdminFirestore, getAdminBucket } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getErrorMessage } from '@/lib/error-utils';
import ExcelJS from 'exceljs';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XLS_MIME = 'application/vnd.ms-excel';
const MAX_ROWS = 500;
const MAX_COLS = 50;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'object' && 'richText' in (value as object)) {
    return (value as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join('');
  }
  if (typeof value === 'object' && 'formula' in (value as object)) {
    const fv = (value as ExcelJS.CellFormulaValue).result;
    return fv != null ? String(fv) : '';
  }
  if (typeof value === 'object' && 'error' in (value as object)) return '';
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
}

function buildHtml(workbook: ExcelJS.Workbook): string {
  const sheets: string[] = [];

  workbook.eachSheet((sheet) => {
    const rows: string[] = [];
    let rowCount = 0;

    sheet.eachRow((row, rowNumber) => {
      if (rowCount >= MAX_ROWS) return;
      rowCount++;

      const tag = rowNumber === 1 ? 'th' : 'td';
      const cells = (row.values as ExcelJS.CellValue[])
        .slice(1, MAX_COLS + 1)
        .map((v) => `<${tag}>${escapeHtml(cellToString(v))}</${tag}>`)
        .join('');
      rows.push(`<tr>${cells}</tr>`);
    });

    const truncated = rowCount >= MAX_ROWS
      ? `<p class="trunc">Εμφανίζονται οι πρώτες ${MAX_ROWS} γραμμές.</p>`
      : '';

    sheets.push(`
      <section>
        <h2>${escapeHtml(sheet.name)}</h2>
        <div class="tbl-wrap">
          <table><tbody>${rows.join('')}</tbody></table>
        </div>
        ${truncated}
      </section>`);
  });

  return `<!DOCTYPE html><html lang="el"><head><meta charset="utf-8">
<style>
  body{font-family:system-ui,sans-serif;font-size:12px;margin:0;padding:8px;background:#fff;color:#111}
  h2{font-size:13px;font-weight:600;margin:12px 0 4px;padding:4px 8px;background:#f0f4f8;border-radius:4px}
  .tbl-wrap{overflow-x:auto}
  table{border-collapse:collapse;min-width:100%}
  th,td{border:1px solid #d1d5db;padding:4px 8px;white-space:nowrap;text-align:left}
  th{background:#e5e7eb;font-weight:600}
  tr:nth-child(even) td{background:#f9fafb}
  .trunc{color:#6b7280;font-size:11px;margin:4px 0}
</style></head><body>${sheets.join('')}</body></html>`;
}

async function handleGet(
  _request: NextRequest,
  _ctx: AuthContext,
  _cache: PermissionCache,
  { params }: { params: Promise<{ fileId: string }> },
): Promise<NextResponse> {
  try {
    const { fileId } = await params;

    const fileDoc = await getAdminFirestore().collection(COLLECTIONS.FILES).doc(fileId).get();
    if (!fileDoc.exists) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const data = fileDoc.data();
    const contentType = data?.contentType as string | undefined;
    const storagePath = data?.storagePath as string | undefined;

    if (!storagePath) {
      return NextResponse.json({ error: 'Missing storagePath' }, { status: 400 });
    }
    if (contentType !== XLSX_MIME && contentType !== XLS_MIME) {
      return NextResponse.json({ error: 'Not an Excel file' }, { status: 400 });
    }

    const [fileBuffer] = await getAdminBucket().file(storagePath).download();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);

    const html = buildHtml(workbook);

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (err) {
    const message = getErrorMessage(err, 'Excel preview failed');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const authedHandler = withAuth(handleGet);
export const GET = authedHandler;
