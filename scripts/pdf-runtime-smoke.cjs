#!/usr/bin/env node
/**
 * @fileoverview **Smoke του PDF στον διακομιστή** (ADR-923 §5.5.1 · ADR-327 §6.7) — εκτελεί τον **ΙΔΙΟ** κώδικα της παραγωγής
 * (`pdf-rasterize.service.ts`) με τα πακέτα του φακέλου που δίνεται: μέτρημα σελίδων, κείμενο, ζωγραφική σε PNG.
 *
 * Χρήση:  node scripts/pdf-runtime-smoke.cjs [φάκελος]        (προεπιλογή: η ρίζα του repo)
 * CI:     node scripts/pdf-runtime-smoke.cjs .next/standalone — αποδεικνύει ότι το standalone **ανοίγει** PDF πριν φτιαχτεί το image.
 *
 * Γιατί υπάρχει: το jest τρέχει πάνω στο πλήρες `node_modules`, όπου ο worker πάντα υπάρχει, άρα δομικά δεν βλέπει αυτή τη
 * βλάβη. Ο κώδικας περνά από transpile σε προσωρινό `.mjs` **μέσα** στον φάκελο, ώστε τα `import()` να λύνονται από εκεί.
 */
'use strict';

const path = require('node:path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { REPO, withPdfService } = require('./lib/pdf-service-probe.cjs');

const PROBE_TEXT = 'NESTOR';
const PNG_SIGNATURE = '89504e47';
const TIMEOUT_MS = 60_000;

async function probePdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([200, 100]);
  page.drawText(PROBE_TEXT, { x: 20, y: 40, size: 18, font });
  page.drawLine({ start: { x: 10, y: 20 }, end: { x: 190, y: 20 }, thickness: 1, color: rgb(0, 0, 0) });
  return Buffer.from(await doc.save());
}

async function exercise(service) {
  const pdf = await probePdf();
  const pages = await service.countPdfPages(pdf);
  if (pages !== 1) throw new Error(`expected 1 page, got ${pages}`);
  const reading = await service.readPdfPage(pdf, 1, { dpi: 72 });
  if (!reading.items.some((item) => item.text.includes(PROBE_TEXT))) throw new Error('page text not read');
  if (reading.png.subarray(0, 4).toString('hex') !== PNG_SIGNATURE) throw new Error('page not rendered to PNG');
  if (!reading.rules.some((rule) => rule.axis === 'h')) throw new Error('page rules not read');
}

async function main() {
  const target = path.resolve(process.argv[2] || REPO);
  const timer = setTimeout(() => { console.error('❌ timeout'); process.exit(1); }, TIMEOUT_MS);
  try {
    await withPdfService(target, exercise);
  } finally {
    clearTimeout(timer);
  }
  console.log(`✅ PDF runtime works from ${target}`);
}

main().catch((error) => {
  console.error(`❌ PDF runtime smoke failed: ${error && error.message}`);
  process.exit(1);
});
