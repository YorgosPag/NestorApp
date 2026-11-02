/**
 * ADR-923 §5.6.1 — **ο τρίτος μετρά το PDF**: χωριστή διεργασία Node με το πραγματικό pdf.js (ES module, που το jest δεν φορτώνει),
 * ίδια τεχνική με το `handover-protocol-pdf.test.ts`. Δίνει τα ίδια στοιχεία με το `readPdfTextLayout` της παραγωγής.
 *
 * 🔑 Η ίδια χωριστή διεργασία μετρά και τη **μνήμη** του βήματος μέσα στον web server: σε φορτωμένο jest το `maxRSS` θα ήταν του jest.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { JudgedPage } from '@/subapps/catalog/publishing/publication-layout-judge';

const READ_PAGES = String.raw`async function readPages(data) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await getDocument({ data, isEvalSupported: false, verbosity: 0 }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const { width: widthPt, height: heightPt } = page.getViewport({ scale: 1 });
    const { items } = await page.getTextContent();
    const runs = items.filter((item) => item.str && item.str.trim() !== '').map((item) => ({ text: item.str, transform: item.transform, width: item.width }));
    pages.push({ widthPt, heightPt, runs });
    page.cleanup();
  }
  await doc.destroy();
  return pages;
}`;

const ORACLE = String.raw`${READ_PAGES}
(async () => {
  const pages = await readPages(new Uint8Array(require('fs').readFileSync(process.argv[1])));
  process.stdout.write(JSON.stringify(pages));
})()`;

/**
 * Η αλληλουχία του `publication-run.server.ts` πάνω στο **ήδη** αποδομένο αρχείο: `pdf-lib` (φόρτωμα, και αποθήκευση στο `print`),
 * μετά `pdf.js`. Οι σελίδες μένουν ζωντανές ως το τέλος, όπως στον κριτή διάταξης.
 */
const PEAK_PROBE = String.raw`${READ_PAGES}
(async () => {
  const { PDFDocument } = require('pdf-lib');
  await import('pdfjs-dist/legacy/build/pdf.mjs');
  const baselineRssKb = Math.round(process.memoryUsage().rss / 1024);
  const bytes = new Uint8Array(require('fs').readFileSync(process.argv[1]));
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  const finished = process.argv[2] === 'print' ? await pdf.save({ updateFieldAppearances: false }) : bytes;
  const pages = await readPages(new Uint8Array(finished));
  const runs = pages.reduce((sum, page) => sum + page.runs.length, 0);
  process.stdout.write(JSON.stringify({ baselineRssKb, peakRssKb: process.resourceUsage().maxRSS, pages: pages.length, runs }));
})()`;

export interface PdfCheckPeak {
  /** Η διεργασία με τις βιβλιοθήκες φορτωμένες, πριν ανοίξει το αρχείο. */
  readonly baselineRssKb: number;
  readonly peakRssKb: number;
  readonly pages: number;
  readonly runs: number;
}

function runOnPdf(script: string, bytes: Uint8Array, ...args: readonly string[]): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'nestor-layout-'));
  try {
    const file = path.join(directory, 'input.pdf');
    writeFileSync(file, bytes);
    return execFileSync(process.execPath, ['-e', script, file, ...args], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function readLayoutInChildProcess(bytes: Uint8Array): JudgedPage[] {
  return JSON.parse(runOnPdf(ORACLE, bytes)) as JudgedPage[];
}

export function measurePdfCheckPeakInChildProcess(bytes: Uint8Array, profile: 'print' | 'screen'): PdfCheckPeak {
  return JSON.parse(runOnPdf(PEAK_PROBE, bytes, profile)) as PdfCheckPeak;
}
