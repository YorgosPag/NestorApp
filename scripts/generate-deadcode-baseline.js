#!/usr/bin/env node
/**
 * Generates .deadcode-baseline.json from current knip output.
 * Usage: node scripts/generate-deadcode-baseline.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASELINE_FILE = path.join(__dirname, '..', '.deadcode-baseline.json');
const ROOT = path.join(__dirname, '..');

console.log('🔍 Running knip (this takes ~30s)...');

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
  console.error('Raw output preview:', raw.slice(0, 200));
  process.exit(1);
}

// knip v6: { issues: [{ file, files: [{name}], exports: [...], ... }] }
const unusedFiles = (report.issues ?? [])
  .filter(issue => Array.isArray(issue.files) && issue.files.length > 0)
  .map(issue => issue.file)
  .sort();

const baseline = {
  generated: new Date().toISOString(),
  knipVersion: '6',
  files: unusedFiles,
  fileCount: unusedFiles.length,
};

fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2) + '\n');
console.log(`✅ Baseline → .deadcode-baseline.json (${baseline.fileCount} unused files)`);
