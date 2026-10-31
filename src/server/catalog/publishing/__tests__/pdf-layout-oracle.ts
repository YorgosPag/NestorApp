/**
 * ADR-923 §5.6.1 — **ο τρίτος μετρά το PDF**: χωριστή διεργασία Node με το πραγματικό pdf.js (ES module, που το jest δεν φορτώνει),
 * ίδια τεχνική με το `handover-protocol-pdf.test.ts`. Δίνει τα ίδια στοιχεία με το `readPdfTextLayout` της παραγωγής.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { JudgedPage } from '@/subapps/catalog/publishing/publication-layout-judge';

const ORACLE = String.raw`(async () => {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(require('fs').readFileSync(process.argv[1]));
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
  process.stdout.write(JSON.stringify(pages));
})()`;

export function readLayoutInChildProcess(bytes: Uint8Array): JudgedPage[] {
  const directory = mkdtempSync(path.join(tmpdir(), 'nestor-layout-'));
  try {
    const file = path.join(directory, 'input.pdf');
    writeFileSync(file, bytes);
    const output = execFileSync(process.execPath, ['-e', ORACLE, file], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
    return JSON.parse(output) as JudgedPage[];
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
