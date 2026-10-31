#!/usr/bin/env node
/**
 * @fileoverview **Ο worker του pdf.js μέσα στο standalone του Next** (ADR-923 §5.5.1 · ADR-327 §6.7).
 *
 * Χρήση:  node scripts/vendor-pdf-worker.cjs .next/standalone
 *
 * Στον Node το pdf.js τρέχει με «ψεύτικο» worker: το `pdf.mjs` κάνει `import('./pdf.worker.mjs')` με `webpackIgnore` και
 * διαδρομή υπολογισμένη την ώρα της εκτέλεσης, άρα ο ιχνηλάτης του Next δεν το βλέπει. Το standalone είχε το `pdf.mjs` χωρίς
 * τον worker, και **κάθε** άνοιγμα PDF στον διακομιστή έπεφτε (μετρημένο στην παραγωγή 2026-10-31, `df2adc6f`). Ο αναλυτής
 * προσφορών το έκρυβε, γιατί η αποτυχία του πέφτει σιωπηλά στο εγγενές `input_file`.
 *
 * Αντιγράφεται **δίπλα στο `pdf.mjs` που ιχνηλατήθηκε**, από εκεί που τον ψάχνει το ίδιο το pdf.js. Το
 * `outputFileTracingIncludes` δεν είναι επιλογή: με pnpm isolated μετρήθηκε ότι δεν φέρνει τα αρχεία (βλ.
 * `vendor-face-detector-runtime.cjs`).
 *
 * Επαλήθευση αμέσως μετά: `node scripts/pdf-runtime-smoke.cjs .next/standalone`.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { packageRoot } = require('./lib/standalone-package-root.cjs');

const REPO = path.resolve(__dirname, '..');
const PACKAGE = 'pdfjs-dist';
const LOADED_ENTRY = `${PACKAGE}/legacy/build/pdf.mjs`;
const WORKER = 'legacy/build/pdf.worker.mjs';

const versionOf = (root) => JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;

function main() {
  const target = path.resolve(process.argv[2] || '.next/standalone');
  if (!fs.existsSync(target)) throw new Error(`target not found: ${target}`);
  const source = packageRoot(PACKAGE, REPO, LOADED_ENTRY);
  const destination = packageRoot(PACKAGE, target, LOADED_ENTRY);
  if (versionOf(source) !== versionOf(destination)) throw new Error(`version mismatch: ${versionOf(source)} vs ${versionOf(destination)}`);
  fs.copyFileSync(path.join(source, WORKER), path.join(destination, WORKER));
  console.log(`✅ ${PACKAGE}@${versionOf(destination)} worker → ${path.relative(target, path.join(destination, WORKER))}`);
}

try {
  main();
} catch (error) {
  console.error(`❌ vendor pdf worker failed: ${error && error.message}`);
  process.exit(1);
}
