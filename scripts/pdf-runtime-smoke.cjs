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

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const ts = require('typescript');
const { PDFDocument, StandardFonts } = require('pdf-lib');

const REPO = path.resolve(__dirname, '..');
const SERVICE_FILE = path.join(REPO, 'src/services/pdf/pdf-rasterize.service.ts');
const PROBE_FILE = '.pdf-runtime-smoke.mjs';
const PROBE_TEXT = 'NESTOR';
const PNG_SIGNATURE = '89504e47';
const TIMEOUT_MS = 60_000;

/** Ο κώδικας από την πηγή του — μία αλήθεια, κανένα αντίγραφο. Το `server-only` είναι φράχτης του bundler, όχι εξάρτηση. */
function serviceModule() {
  const source = fs.readFileSync(SERVICE_FILE, 'utf8').replace(/^import 'server-only';$/m, '');
  return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
}

async function probePdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([200, 100]).drawText(PROBE_TEXT, { x: 20, y: 40, size: 18, font });
  return Buffer.from(await doc.save());
}

async function exercise(service) {
  const pdf = await probePdf();
  const pages = await service.countPdfPages(pdf);
  if (pages !== 1) throw new Error(`expected 1 page, got ${pages}`);
  const reading = await service.readPdfPage(pdf, 1, { dpi: 72 });
  if (!reading.items.some((item) => item.text.includes(PROBE_TEXT))) throw new Error('page text not read');
  if (reading.png.subarray(0, 4).toString('hex') !== PNG_SIGNATURE) throw new Error('page not rendered to PNG');
}

async function main() {
  const target = path.resolve(process.argv[2] || REPO);
  const probe = path.join(target, PROBE_FILE);
  const timer = setTimeout(() => { console.error('❌ timeout'); process.exit(1); }, TIMEOUT_MS);
  fs.writeFileSync(probe, serviceModule());
  try {
    await exercise(await import(pathToFileURL(probe).href));
  } finally {
    fs.rmSync(probe, { force: true });
    clearTimeout(timer);
  }
  console.log(`✅ PDF runtime works from ${target}`);
}

main().catch((error) => {
  console.error(`❌ PDF runtime smoke failed: ${error && error.message}`);
  process.exit(1);
});
