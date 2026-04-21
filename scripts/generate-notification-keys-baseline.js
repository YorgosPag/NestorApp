#!/usr/bin/env node
/**
 * Generate the ratchet baseline for `check-notification-keys-ratchet.js`.
 *
 * Scans `src/` for every `notifications.success|error|info|warning('key')` call
 * outside the allowlist, counts them per-file, and writes the snapshot to
 * `.notification-keys-baseline.json`. The pre-commit ratchet then enforces
 * "counts can only decrease".
 *
 * Run this after legitimate cleanup (e.g. each Boy Scout wave of domain-hook
 * migrations) to ratchet the baseline down. The check itself never increases
 * the baseline — that is always a manual, auditable step.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..');
const CHECK_SCRIPT = path.join(__dirname, 'check-notification-keys-ratchet.js');
const BASELINE_FILE = path.join(REPO_ROOT, '.notification-keys-baseline.json');

const RAW_KEY_REGEX =
  /\bnotifications\.(success|error|info|warning)\(\s*['"]([a-z][a-zA-Z0-9_:-]*(?:[.:][a-zA-Z0-9_:-]+)+)['"]/g;

const ALLOWLIST_PREFIXES = [
  'src/config/notification-keys.ts',
  'src/hooks/notifications/',
  'src/providers/NotificationProvider.tsx',
];

function isAllowlisted(rel) {
  return ALLOWLIST_PREFIXES.some((p) => rel.startsWith(p));
}

function isInScope(rel) {
  if (!/\.(ts|tsx)$/.test(rel)) return false;
  if (/(__tests__|\.test\.|\.spec\.|\.d\.ts$)/.test(rel)) return false;
  if (rel.startsWith('scripts/')) return false;
  if (isAllowlisted(rel)) return false;
  return true;
}

function walk(dir, out = []) {
  const abs = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '__tests__'].includes(entry.name)) continue;
      walk(rel, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && isInScope(rel)) {
      out.push(rel);
    }
  }
  return out;
}

const files = walk('src');
if (files.length === 0) {
  console.error('No files found under src/ — aborting.');
  process.exit(1);
}

const perFile = {};
for (const file of files) {
  const abs = path.join(REPO_ROOT, file);
  const content = fs.readFileSync(abs, 'utf8');
  let count = 0;
  for (const _m of content.matchAll(RAW_KEY_REGEX)) count += 1;
  if (count > 0) perFile[file] = count;
}

const totalViolations = Object.values(perFile).reduce((a, b) => a + b, 0);
const totalFiles = Object.keys(perFile).length;

const baseline = {
  generated: new Date().toISOString(),
  description:
    'Raw i18n keys passed to notifications.success|error|info|warning() outside the allowlist — ratchet baseline',
  source: 'scripts/check-notification-keys-ratchet.js',
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
