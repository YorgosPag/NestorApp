#!/usr/bin/env node
/**
 * ADR-598 G6 — Bundle-Size Ratchet (Layer-2 CI, CLAUDE.md N.17).
 *
 * Guards the shipped client bundle (static JS + CSS bytes) against silent
 * growth. The existing scripts/bundle-analyzer.js already walks `.next/static`
 * and returns `{ totalSize, chunks[], css[], ... }` against FIXED thresholds;
 * this gate REUSES that `analyzeNextBuild()` export as its single measurement
 * source (N.18 — no size-walk clone) and turns the fixed threshold into a moving
 * ratchet.
 *
 * Ratchet direction: DOWN. `totalSize` may only shrink; a rise above
 * baseline*(1 + tolerancePct/100) blocks the PR. The tolerance (default 2%)
 * absorbs the sub-percent jitter of dependency bumps / hashed-chunk churn so the
 * gate does not flap — budget-with-slack, as Vercel/Lighthouse do, not
 * byte-exact. The tolerance is stored IN the baseline (SSoT), not hardcoded at
 * two places.
 *
 * Needs a real `.next` production build → heavy → CI only (N.17). The workflow
 * runs `pnpm run build` first, then this script (a pure consumer of `.next`;
 * it never triggers a build itself). Baseline seeded via CI seed dispatch.
 *
 * CLI:
 *   node scripts/check-bundle-size-ratchet.js                  # check vs baseline
 *   node scripts/check-bundle-size-ratchet.js --write-baseline # (re)seed (CI)
 *
 * Env:
 *   BUNDLE_SIZE_BASELINE_FILE=... — redirect baseline (Jest suite).
 *
 * Exit codes: 0 = within budget · 1 = baseline missing/invalid, no `.next`
 * build, or totalSize rose beyond tolerance.
 */

'use strict';

const path = require('node:path');
const ratchet = require('./lib/ratchet-baseline');
const { analyzeNextBuild } = require('./bundle-analyzer');

const PROJECT_ROOT = ratchet.PROJECT_ROOT;
const DEFAULT_BASELINE_FILE = path.join(PROJECT_ROOT, '.bundle-size-baseline.json');
const DEFAULT_TOLERANCE_PCT = 2;

function getBaselineFile() {
  return process.env.BUNDLE_SIZE_BASELINE_FILE
    ? path.resolve(process.env.BUNDLE_SIZE_BASELINE_FILE)
    : DEFAULT_BASELINE_FILE;
}

// Collapse the analyzer's rich report into the ratchet's numeric surface. Pure
// (no I/O) so the Jest suite can drive it with a synthetic analysis object.
function summarizeAnalysis(analysis) {
  const cssSize = (analysis.css || []).reduce((sum, f) => sum + (f.size || 0), 0);
  return {
    totalSize: analysis.totalSize || 0,
    chunksCount: (analysis.chunks || []).length,
    cssSize,
  };
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

// Heavy — reads the `.next` build (throws if absent). CI only (N.17).
function measure() {
  return summarizeAnalysis(analyzeNextBuild());
}

function buildPayload(m) {
  return {
    description:
      'ADR-598 G6 — bundle-size ratchet baseline. totalSize = static JS+CSS bytes ' +
      'under .next/static (via scripts/bundle-analyzer.js analyzeNextBuild()). ' +
      'Ratchet DOWN only: a rise above totalSize*(1+tolerancePct/100) blocks the PR. ' +
      'Reseed via CI seed dispatch after a legitimate build-size change.',
    generatedBy: 'scripts/check-bundle-size-ratchet.js --write-baseline',
    adr: 'ADR-598 G6',
    totalSize: m.totalSize,
    chunksCount: m.chunksCount,
    cssSize: m.cssSize,
    tolerancePct: DEFAULT_TOLERANCE_PCT,
  };
}

function describe({ measured, baseline, tolerancePct }) {
  const cur = `${formatBytes(measured.totalSize)} (${measured.chunksCount} chunks, css ${formatBytes(measured.cssSize)})`;
  if (!baseline) return `bundle ${cur}`;
  const ceiling = Math.round(baseline.totalSize * (1 + tolerancePct / 100));
  const delta = measured.totalSize - baseline.totalSize;
  const sign = delta >= 0 ? '+' : '−';
  return `bundle ${cur} vs baseline ${formatBytes(baseline.totalSize)} ` +
    `(${sign}${formatBytes(Math.abs(delta))}, budget ${formatBytes(ceiling)} @ ${tolerancePct}%)`;
}

const DESCRIPTOR = {
  adr: 'ADR-598 G6',
  scriptName: 'scripts/check-bundle-size-ratchet.js',
  get baselineFile() { return getBaselineFile(); },
  requiredKeys: ['totalSize'],
  metricKey: 'totalSize',
  direction: 'down',
  resolveTolerancePct: (baseline) =>
    typeof baseline.tolerancePct === 'number' ? baseline.tolerancePct : DEFAULT_TOLERANCE_PCT,
  measure,
  buildPayload,
  describe,
  remediation:
    'The client bundle grew beyond its budget.\n' +
    '  1) Inspect what grew: pnpm run analyze:bundle (static/ chunk report).\n' +
    '  2) Prefer dynamic import()/code-splitting for the new heavy path.\n' +
    '  3) If the growth is intentional and vetted, reseed the baseline via CI dispatch.',
};

// Exported for the Jest suite.
module.exports = {
  summarizeAnalysis,
  buildPayload,
  describe,
  formatBytes,
  measure,
  getBaselineFile,
  DEFAULT_TOLERANCE_PCT,
  DESCRIPTOR,
};

if (require.main === module) {
  try {
    ratchet.runRatchetCli({ ...DESCRIPTOR, baselineFile: getBaselineFile() });
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }
}
