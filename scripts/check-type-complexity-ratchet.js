#!/usr/bin/env node
/**
 * ADR-598 G14 — Type-Complexity Ratchet (Layer-2 CI, CLAUDE.md N.17).
 *
 * Tracks how hard the codebase is for `tsc` to check, via the `Instantiations`
 * and `Types` counters from `tsc --extendedDiagnostics --noEmit`. A runaway
 * generic (deeply-recursive conditional types, unbounded mapped types) can 10x
 * `Instantiations` and quietly turn a fast build into a slow one; this gate
 * makes that visible as a regression. No new core dependency — it uses the tsc
 * already in the repo. (The optional @typescript/analyze-trace hotspot report is
 * deferred to ΦΑΣΗ 3; the ratchet does not need it.)
 *
 * Ratchet direction: DOWN. `instantiations` may only fall; a rise above
 * baseline*(1 + tolerancePct/100) blocks the PR. These numbers jitter naturally
 * with unrelated edits, so the tolerance (default 3%) comes from the governance
 * SSoT config/quality-gates/type-complexity-budget.json — mirroring how ADR-027
 * governs the ts-error budget — never hardcoded here.
 *
 * A full type-check is heavy → CI only (N.17). Baseline seeded via CI seed
 * dispatch. Baseline/compare/CLI machinery shared with G5/G6 (N.18 — no clone).
 *
 * CLI:
 *   node scripts/check-type-complexity-ratchet.js                  # check vs baseline
 *   node scripts/check-type-complexity-ratchet.js --write-baseline # (re)seed (CI)
 *
 * Env:
 *   TYPE_COMPLEXITY_BASELINE_FILE=... — redirect baseline (Jest suite).
 *   TYPE_COMPLEXITY_BUDGET_FILE=...   — redirect budget policy (Jest suite).
 *
 * Exit codes: 0 = within budget · 1 = baseline/budget missing/invalid, tsc
 * failed, or instantiations rose beyond tolerance.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ratchet = require('./lib/ratchet-baseline');

const PROJECT_ROOT = ratchet.PROJECT_ROOT;
const DEFAULT_BASELINE_FILE = path.join(PROJECT_ROOT, '.type-complexity-baseline.json');
const DEFAULT_BUDGET_FILE = path.join(PROJECT_ROOT, 'config', 'quality-gates', 'type-complexity-budget.json');
const FALLBACK_TOLERANCE_PCT = 3;

function getBaselineFile() {
  return process.env.TYPE_COMPLEXITY_BASELINE_FILE
    ? path.resolve(process.env.TYPE_COMPLEXITY_BASELINE_FILE)
    : DEFAULT_BASELINE_FILE;
}

function getBudgetFile() {
  return process.env.TYPE_COMPLEXITY_BUDGET_FILE
    ? path.resolve(process.env.TYPE_COMPLEXITY_BUDGET_FILE)
    : DEFAULT_BUDGET_FILE;
}

// Read the tolerance from the governance budget (SSoT). Falls back to the
// documented default if the file is absent/malformed so the gate still runs.
function resolveTolerancePct() {
  try {
    const budget = JSON.parse(fs.readFileSync(getBudgetFile(), 'utf8'));
    const tol = budget && budget.policy && budget.policy.tolerancePct;
    return typeof tol === 'number' ? tol : FALLBACK_TOLERANCE_PCT;
  } catch {
    return FALLBACK_TOLERANCE_PCT;
  }
}

// Parse the two counters out of `tsc --extendedDiagnostics` output. The relevant
// lines look like "Instantiations: 123456" and "Types: 78901". Throws if
// Instantiations is missing (a broken/failed tsc run must fail closed, never be
// read as 0 complexity).
function parseExtendedDiagnostics(output) {
  const text = String(output || '');
  const inst = text.match(/^\s*Instantiations:\s+(\d+)\s*$/m);
  const types = text.match(/^\s*Types:\s+(\d+)\s*$/m);
  if (!inst) {
    throw new Error(`tsc --extendedDiagnostics had no "Instantiations:" line (build failed?).`);
  }
  return {
    instantiations: Number(inst[1]),
    types: types ? Number(types[1]) : 0,
  };
}

// Heavy — full type-check. CI only (N.17). --extendedDiagnostics writes the
// counters to stdout; errors do not suppress them, so we parse regardless of
// exit code and let the parser fail closed if the counters are absent.
function measure() {
  const result = spawnSync('npx', ['tsc', '--extendedDiagnostics', '--noEmit'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
  const combined = `${result.stdout || ''}\n${result.stderr || ''}`;
  return parseExtendedDiagnostics(combined);
}

function buildPayload(m) {
  return {
    description:
      'ADR-598 G14 — type-complexity ratchet baseline. instantiations/types from ' +
      'tsc --extendedDiagnostics --noEmit. Ratchet DOWN only: instantiations rising above ' +
      'baseline*(1+tolerancePct/100) (tolerance from config/quality-gates/type-complexity-budget.json) ' +
      'blocks the PR. Reseed via CI seed dispatch.',
    generatedBy: 'scripts/check-type-complexity-ratchet.js --write-baseline',
    adr: 'ADR-598 G14',
    instantiations: m.instantiations,
    types: m.types,
  };
}

function describe({ measured, baseline, tolerancePct }) {
  const cur = `${measured.instantiations.toLocaleString('en-US')} instantiations (${measured.types.toLocaleString('en-US')} types)`;
  if (!baseline) return cur;
  const ceiling = Math.round(baseline.instantiations * (1 + tolerancePct / 100));
  const delta = measured.instantiations - baseline.instantiations;
  const sign = delta >= 0 ? '+' : '−';
  return `${cur} vs baseline ${baseline.instantiations.toLocaleString('en-US')} ` +
    `(${sign}${Math.abs(delta).toLocaleString('en-US')}, budget ${ceiling.toLocaleString('en-US')} @ ${tolerancePct}%)`;
}

const DESCRIPTOR = {
  adr: 'ADR-598 G14',
  scriptName: 'scripts/check-type-complexity-ratchet.js',
  get baselineFile() { return getBaselineFile(); },
  requiredKeys: ['instantiations'],
  metricKey: 'instantiations',
  direction: 'down',
  resolveTolerancePct,
  measure,
  buildPayload,
  describe,
  remediation:
    'Type instantiations rose beyond budget — usually one runaway generic.\n' +
    '  1) Inspect locally: npx tsc --extendedDiagnostics --noEmit (compare Instantiations).\n' +
    '  2) Simplify the offending conditional/mapped/recursive type; add explicit bounds.\n' +
    '  3) If the growth is intentional, adjust tolerance in\n' +
    '     config/quality-gates/type-complexity-budget.json and reseed the baseline via CI.',
};

// Exported for the Jest suite.
module.exports = {
  parseExtendedDiagnostics,
  buildPayload,
  describe,
  measure,
  resolveTolerancePct,
  getBaselineFile,
  getBudgetFile,
  FALLBACK_TOLERANCE_PCT,
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
