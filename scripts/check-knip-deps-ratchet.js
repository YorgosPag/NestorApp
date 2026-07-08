#!/usr/bin/env node
/**
 * ADR-598 G15 — knip Dependency-Hygiene Ratchet (Layer-2 CI, N.17).
 *
 * knip.json runs all its rules at `warn` (never blocks). This gate promotes ONLY
 * the *dependency* findings (unused dependencies / devDependencies, unlisted,
 * binaries, unresolved) into a ratchet: it counts them via `knip --dependencies
 * --reporter json` and blocks when the total rises above the committed baseline
 * (.knip-deps-baseline.json). Ratchet DOWN only — package.json hygiene may only
 * improve.
 *
 * SCOPE NOTE (why not the ADR's "include dxf-viewer" idea): knip.json
 * deliberately ignores src/subapps/dxf-viewer/** because that subapp resolves
 * modules through dynamic registries knip cannot see, so including it would flood
 * the dead-code ratchet (CHECK 3.22) with false positives and break Giorgio's
 * commit flow (verified 2026-06-21, ADR-357). This gate therefore ratchets
 * DEPENDENCY hygiene only and leaves the file-level project scope untouched. See
 * the ADR-598 G15 note.
 *
 * A full knip crawl is heavy → CI only (N.17). Baseline seeded via CI seed
 * dispatch. Baseline/compare/CLI reuse scripts/lib/ratchet-baseline.js (N.18).
 *
 * CLI:
 *   node scripts/check-knip-deps-ratchet.js                  # check vs baseline
 *   node scripts/check-knip-deps-ratchet.js --write-baseline # (re)seed (CI)
 *
 * Env:
 *   KNIP_DEPS_BASELINE_FILE=... — redirect baseline (Jest suite).
 *
 * Exit codes: 0 = held or fell · 1 = baseline missing/invalid, knip failed, or
 * the dependency-issue count rose above baseline.
 */

'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ratchet = require('./lib/ratchet-baseline');

const PROJECT_ROOT = ratchet.PROJECT_ROOT;
const DEFAULT_BASELINE_FILE = path.join(PROJECT_ROOT, '.knip-deps-baseline.json');
const DEP_CATEGORIES = ['dependencies', 'devDependencies', 'optionalPeerDependencies', 'unlisted', 'binaries', 'unresolved'];

function getBaselineFile() {
  return process.env.KNIP_DEPS_BASELINE_FILE
    ? path.resolve(process.env.KNIP_DEPS_BASELINE_FILE)
    : DEFAULT_BASELINE_FILE;
}

// Count dependency-category issues from knip's JSON report. Version-tolerant:
// knip's json reporter has shipped both a grouped object ({ issues: { deps:[] } })
// and a per-file array ({ issues: [ { dependencies:[], unlisted:[] } ] }); this
// reads either. Pure — the Jest suite drives it with synthetic reports.
function summarize(report) {
  const perCat = {};
  const add = (cat, n) => { if (n) perCat[cat] = (perCat[cat] || 0) + n; };
  const eat = (rec) => {
    if (!rec || typeof rec !== 'object') return;
    for (const cat of DEP_CATEGORIES) {
      const v = rec[cat];
      if (Array.isArray(v)) add(cat, v.length);
      else if (v && typeof v === 'object') add(cat, Object.keys(v).length);
    }
  };
  const issues = report && report.issues !== undefined ? report.issues : report;
  if (Array.isArray(issues)) issues.forEach(eat);
  else eat(issues);
  const total = Object.values(perCat).reduce((a, b) => a + b, 0);
  return { total, perCat };
}

// Heavy — full knip crawl. CI only (N.17). --dependencies scopes knip to the
// dependency issue types; --reporter json gives a machine-readable report. knip
// exits non-zero when it finds issues, so we parse stdout regardless of exit code.
function measure() {
  const result = spawnSync('npx', ['knip', '--dependencies', '--reporter', 'json'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
  const stdout = (result.stdout || '').trim();
  if (!stdout) {
    const detail = (result.stderr || '').toString().slice(0, 800);
    throw new Error(`knip produced no JSON output. Is it installed (pnpm install)? ${detail}`);
  }
  let report;
  try {
    report = JSON.parse(stdout);
  } catch (e) {
    throw new Error(`Could not parse knip JSON: ${e.message}`);
  }
  return summarize(report);
}

function buildPayload(m) {
  return {
    description:
      'ADR-598 G15 — knip dependency-hygiene ratchet baseline. total = unused ' +
      'dependencies/devDependencies + unlisted + binaries + unresolved (knip ' +
      '--dependencies --reporter json). Ratchet DOWN only: a rise blocks the PR. ' +
      'File-level dead-code scope is unchanged (dxf-viewer stays knip-ignored — see G15 note). Reseed via CI dispatch.',
    generatedBy: 'scripts/check-knip-deps-ratchet.js --write-baseline',
    adr: 'ADR-598 G15',
    total: m.total,
    perCat: m.perCat,
  };
}

function describe({ measured, baseline }) {
  const cats = Object.entries(measured.perCat).map(([c, n]) => `${c}:${n}`).join(' ') || 'none';
  if (!baseline) return `${measured.total} dep issue(s) — ${cats}`;
  const delta = measured.total - baseline.total;
  const sign = delta >= 0 ? '+' : '−';
  return `dep issues:${measured.total}/${baseline.total} (${sign}${Math.abs(delta)}) — ${cats}`;
}

const DESCRIPTOR = {
  adr: 'ADR-598 G15',
  scriptName: 'scripts/check-knip-deps-ratchet.js',
  get baselineFile() { return getBaselineFile(); },
  requiredKeys: ['total'],
  metricKey: 'total',
  direction: 'down',
  resolveTolerancePct: () => 0,
  measure,
  buildPayload,
  describe,
  remediation:
    'Unused/unlisted dependencies rose.\n' +
    '  1) Inspect: npx knip --dependencies (remove unused, add unlisted to package.json).\n' +
    '  2) Dependency hygiene is DOWN-only — you cannot raise the ceiling by editing the baseline.\n' +
    '  3) After cleanup, reseed the baseline via CI dispatch.',
};

// Exported for the Jest suite.
module.exports = {
  summarize,
  buildPayload,
  describe,
  measure,
  getBaselineFile,
  DEP_CATEGORIES,
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
