#!/usr/bin/env node
/**
 * Generates .deadcode-baseline.json from current knip output.
 * Usage: node scripts/generate-deadcode-baseline.js
 *
 * ⚠️ Η ΜΕΤΡΗΣΗ ΔΕΝ ΖΕΙ ΕΔΩ. Τα ορίσματα του knip και η ανάγνωση της εξόδου είναι
 * ΜΙΑ μηχανή (`scripts/lib/knip/file-scope.js`), κοινή με την πύλη CHECK 3.22 —
 * αλλιώς το ratchet συγκρίνει `τρέχον(Α)` με `baseline(Β)`. Μέχρι 2026-08-25 ήταν
 * όντως δύο: μόνο η πύλη έκοβε το `npm info …` πρόθεμα του `.npmrc`.
 */
const fs = require('fs');
const path = require('path');
const { readUnusedFiles } = require('./lib/knip/file-scope');

const BASELINE_FILE = path.join(__dirname, '..', '.deadcode-baseline.json');
const ROOT = path.join(__dirname, '..');

console.log('🔍 Running knip (this takes ~30s)...');

let unusedFiles;
try {
  // Χωρίς `--cache`: ο γεννήτορας γράφει τη μέτρηση με την οποία θα κριθούν όλοι,
  // άρα δεν επιτρέπεται να απαντήσει από κρυφή μνήμη προηγούμενης διαμόρφωσης.
  unusedFiles = readUnusedFiles(ROOT);
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}

const baseline = {
  generated: new Date().toISOString(),
  knipVersion: '6',
  files: unusedFiles,
  fileCount: unusedFiles.length,
};

fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2) + '\n');
console.log(`✅ Baseline → .deadcode-baseline.json (${baseline.fileCount} unused files)`);
