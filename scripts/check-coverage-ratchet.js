#!/usr/bin/env node
/**
 * ADR-598 G3 — Test-Coverage Floor Ratchet (Layer-2 CI, CLAUDE.md N.17).
 *
 * jest.config.js ships `coverageThreshold.global = {0,0,0,0}` (Phase-1 "don't
 * block yet") — a static floor that never rises, so coverage can silently rot.
 * This gate replaces the frozen zero with a MOVING floor: it reads the real
 * `coverage/coverage-summary.json` produced by `jest --coverage` and blocks when
 * line coverage falls below the committed baseline. Ratchet UP only — coverage
 * may only improve. (The jest threshold stays 0 as a belt-and-suspenders hard
 * floor; THIS is the ratchet that actually moves.)
 *
 * Gated metric: `lines` pct — the industry-default headline coverage number
 * (Codecov/Coveralls gate on it too). statements/functions/branches are recorded
 * in the baseline for visibility but do not independently block; line coverage
 * tracks them closely and a single, legible gate beats four noisy ones.
 *
 * A full `jest --coverage` over the suite is heavy → CI only (N.17). The workflow
 * runs the suite first; this script is a pure consumer of the summary JSON (it
 * never spawns jest), so it is unit-safe. Baseline seeded via CI seed dispatch.
 * Baseline/compare/CLI machinery shared with G5/G6/G14 (scripts/lib/ratchet-baseline.js).
 *
 * CLI:
 *   node scripts/check-coverage-ratchet.js                  # check vs baseline
 *   node scripts/check-coverage-ratchet.js --write-baseline # (re)seed (CI)
 *
 * Env:
 *   COVERAGE_BASELINE_FILE=...  — redirect baseline (Jest suite).
 *   COVERAGE_SUMMARY_FILE=...   — redirect the coverage-summary.json to read.
 *
 * Exit codes: 0 = line coverage held or rose · 1 = baseline/summary missing/
 * invalid or line coverage fell below baseline.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ratchet = require('./lib/ratchet-baseline');

const PROJECT_ROOT = ratchet.PROJECT_ROOT;
const DEFAULT_BASELINE_FILE = path.join(PROJECT_ROOT, '.coverage-baseline.json');
const DEFAULT_SUMMARY_FILE = path.join(PROJECT_ROOT, 'coverage', 'coverage-summary.json');
const METRICS = ['lines', 'statements', 'functions', 'branches'];

function getBaselineFile() {
  return process.env.COVERAGE_BASELINE_FILE
    ? path.resolve(process.env.COVERAGE_BASELINE_FILE)
    : DEFAULT_BASELINE_FILE;
}

function getSummaryFile() {
  return process.env.COVERAGE_SUMMARY_FILE
    ? path.resolve(process.env.COVERAGE_SUMMARY_FILE)
    : DEFAULT_SUMMARY_FILE;
}

// Pull the four global percentages out of Istanbul's coverage-summary.json
// (the shape jest's `json-summary` reporter emits: { total: { lines: { pct } } }).
// Pure — the Jest suite drives it with a synthetic summary object. Throws if the
// shape is wrong (a broken/empty summary must fail closed, never read as 100%).
function extractCoverage(summary) {
  if (!summary || typeof summary.total !== 'object') {
    throw new Error('coverage-summary.json has no "total" object (was jest run with --coverage + json-summary reporter?).');
  }
  const out = {};
  for (const m of METRICS) {
    const pct = summary.total[m] && summary.total[m].pct;
    if (typeof pct !== 'number') {
      throw new Error(`coverage-summary.json total.${m}.pct is missing/non-numeric.`);
    }
    out[m] = pct;
  }
  return out;
}

// Reads the summary file (does NOT run jest). CI runs the suite first.
function measure() {
  const summaryFile = getSummaryFile();
  if (!fs.existsSync(summaryFile)) {
    throw new Error(`coverage summary not found: ${ratchet.rel(summaryFile)}. Run \`jest --coverage\` (json-summary reporter) first.`);
  }
  let summary;
  try {
    summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
  } catch (e) {
    throw new Error(`could not parse ${ratchet.rel(summaryFile)}: ${e.message}`);
  }
  return extractCoverage(summary);
}

function buildPayload(m) {
  return {
    description:
      'ADR-598 G3 — test-coverage floor ratchet baseline. Percentages from ' +
      'coverage/coverage-summary.json (jest --coverage, json-summary reporter). ' +
      'Ratchet UP only: `lines` dropping below baseline blocks the PR ' +
      '(statements/functions/branches recorded for visibility). Reseed via CI dispatch.',
    generatedBy: 'scripts/check-coverage-ratchet.js --write-baseline',
    adr: 'ADR-598 G3',
    lines: m.lines,
    statements: m.statements,
    functions: m.functions,
    branches: m.branches,
  };
}

function describe({ measured, baseline }) {
  const cur = METRICS.map((m) => `${m}:${measured[m]}%`).join(' ');
  if (!baseline) return cur;
  const delta = (measured.lines - baseline.lines).toFixed(2);
  const sign = Number(delta) >= 0 ? '+' : '';
  return `${cur} — lines ${baseline.lines}% (${sign}${delta}pp)`;
}

const DESCRIPTOR = {
  adr: 'ADR-598 G3',
  scriptName: 'scripts/check-coverage-ratchet.js',
  get baselineFile() { return getBaselineFile(); },
  requiredKeys: ['lines'],
  metricKey: 'lines',
  direction: 'up',
  resolveTolerancePct: () => 0,
  measure,
  buildPayload,
  describe,
  remediation:
    'Line coverage fell below the committed floor.\n' +
    '  1) Add/restore tests for the changed code (inspect: pnpm run test:coverage).\n' +
    '  2) Coverage is UP-only — you cannot lower the floor by editing the baseline.\n' +
    '  3) After coverage rises, reseed the baseline via CI dispatch to lock the gain.',
};

// Exported for the Jest suite.
module.exports = {
  extractCoverage,
  buildPayload,
  describe,
  measure,
  getBaselineFile,
  getSummaryFile,
  METRICS,
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
