#!/usr/bin/env node
/**
 * CHECK 3.19 — Dead Code Ratchet (ADR-TBD)
 * Blocks commit if new unused files appear beyond baseline.
 * Usage: node scripts/check-deadcode-ratchet.js
 */
const fs = require('fs');
const path = require('path');
const { compareSets } = require('./lib/ratchet-baseline');
const { readUnusedFiles, readUntrackedFiles, partitionByIndex } = require('./lib/knip/file-scope');

const BASELINE_FILE = path.join(__dirname, '..', '.deadcode-baseline.json');
const ROOT = path.join(__dirname, '..');

if (!fs.existsSync(BASELINE_FILE)) {
  console.log('ℹ️  No .deadcode-baseline.json — run: npm run deadcode:baseline');
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
const baselineSet = new Set(baseline.files ?? []);

let currentFilesArr;
let outsideIndex;
try {
  // Κρίνεται ό,τι θα περιέχει το commit — untracked WIP εκτός index δεν μπλοκάρει.
  ({ committed: currentFilesArr, outsideIndex } = partitionByIndex(
    readUnusedFiles(ROOT, { cache: true }),
    readUntrackedFiles(ROOT),
  ));
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}

if (outsideIndex.length > 0) {
  console.log(`ℹ️  ${outsideIndex.length} untracked αρχείο(α) χωρίς καταναλωτή, εκτός commit — δεν κρίνονται (git add τα κάνει ορατά).`);
}

const currentFiles = new Set(currentFilesArr);

// Set-diff lives in scripts/lib/ratchet-baseline.js so the dead-code family
// (CHECK 3.22 here, CHECK 3.30 barrel-aware) shares ONE comparison (N.18).
const { added: newDeadFiles, removed } = compareSets([...currentFiles], [...baselineSet]);
const cleaned = removed.length;

if (newDeadFiles.length === 0) {
  const msg = cleaned > 0
    ? `✅ Dead-code OK — ${cleaned} cleaned vs baseline (${baseline.fileCount}). Run deadcode:baseline to lock progress.`
    : `✅ Dead-code OK — no new unused files (baseline: ${baseline.fileCount})`;
  console.log(msg);
  process.exit(0);
}

console.error(`\n❌ CHECK 3.19 FAIL — ${newDeadFiles.length} new unused file(s):\n`);
newDeadFiles.forEach(f => console.error(`  ${f}`));
console.error(`\nFix: import or delete these files, then: npm run deadcode:baseline\n`);
process.exit(1);
