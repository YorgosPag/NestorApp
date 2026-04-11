#!/usr/bin/env node
/**
 * Generate the ratchet baseline for `check-option-i18n-keys.js`.
 *
 * Walks the same set of configuration directories that the pre-commit check
 * scans, counts orphan option/label i18n keys per file, and writes the result
 * to `.option-i18n-keys-baseline.json`.
 *
 * Run after a legitimate cleanup to ratchet counts down. The check itself
 * never increases the baseline — that is always a manual, auditable step.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..');
const CHECK_SCRIPT = path.join(__dirname, 'check-option-i18n-keys.js');
const BASELINE_FILE = path.join(REPO_ROOT, '.option-i18n-keys-baseline.json');

const SCAN_ROOTS = [
  'src/config',
  'src/subapps/dxf-viewer/config/modal-select',
  'src/constants/domains',
];

function walk(dir, out = []) {
  const abs = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      walk(rel, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(rel.replace(/\\/g, '/'));
    }
  }
  return out;
}

const files = SCAN_ROOTS.flatMap((root) => walk(root));
if (files.length === 0) {
  console.error('No files found under scan roots — aborting.');
  process.exit(1);
}

// Temporarily clear the existing baseline so the check reports raw counts.
const hadBaseline = fs.existsSync(BASELINE_FILE);
const backup = hadBaseline ? fs.readFileSync(BASELINE_FILE, 'utf8') : null;
if (hadBaseline) fs.unlinkSync(BASELINE_FILE);

let report;
try {
  report = execFileSync('node', [CHECK_SCRIPT, ...files], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (err) {
  // Non-zero exit is expected when violations exist — we still want the stdout.
  report = (err.stdout ?? '') + (err.stderr ?? '');
} finally {
  if (hadBaseline && backup !== null) fs.writeFileSync(BASELINE_FILE, backup);
}

const perFile = {};
const violationLineRegex = /🚫 ([^:]+): (\d+) new orphan/g;
let match;
while ((match = violationLineRegex.exec(report)) !== null) {
  perFile[match[1]] = parseInt(match[2], 10);
}

const totalViolations = Object.values(perFile).reduce((a, b) => a + b, 0);
const totalFiles = Object.keys(perFile).length;

const baseline = {
  generated: new Date().toISOString(),
  description: 'Orphan i18n keys in option/label configuration files — ratchet baseline',
  source: 'scripts/check-option-i18n-keys.js',
  totalViolations,
  totalFiles,
  files: Object.fromEntries(
    Object.entries(perFile).sort(([a], [b]) => a.localeCompare(b)),
  ),
};

fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2) + '\n');
console.log(
  `✅ Baseline written: ${totalViolations} violations across ${totalFiles} files`,
);
console.log(`   → ${path.relative(REPO_ROOT, BASELINE_FILE)}`);
