#!/usr/bin/env node
/**
 * CHECK 3.19 — Dead Code Ratchet (ADR-TBD)
 * Blocks commit if new unused files appear beyond baseline.
 * Usage: node scripts/check-deadcode-ratchet.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASELINE_FILE = path.join(__dirname, '..', '.deadcode-baseline.json');
const ROOT = path.join(__dirname, '..');

if (!fs.existsSync(BASELINE_FILE)) {
  console.log('ℹ️  No .deadcode-baseline.json — run: npm run deadcode:baseline');
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
const baselineSet = new Set(baseline.files ?? []);

const result = spawnSync('npx', ['knip', '--reporter', 'json'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'ignore'],
  shell: true,
});

const raw = result.stdout ?? '';

let report;
try {
  report = JSON.parse(raw);
} catch {
  console.error('❌ Could not parse knip JSON output.');
  process.exit(1);
}

// knip v6: { issues: [{ file, files: [{name}], ... }] }
const currentFiles = new Set(
  (report.issues ?? [])
    .filter(issue => Array.isArray(issue.files) && issue.files.length > 0)
    .map(issue => issue.file)
);

const newDeadFiles = [...currentFiles].filter(f => !baselineSet.has(f));
const cleaned = [...baselineSet].filter(f => !currentFiles.has(f)).length;

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
