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
const ratchet = require('./lib/ratchet-baseline');
const tsc = require('./lib/tsc-runner');

const PROJECT_ROOT = ratchet.PROJECT_ROOT;
const DEFAULT_BASELINE_FILE = path.join(PROJECT_ROOT, '.type-complexity-baseline.json');
const DEFAULT_BUDGET_FILE = path.join(PROJECT_ROOT, 'config', 'quality-gates', 'type-complexity-budget.json');
const FALLBACK_TOLERANCE_PCT = 3;
/** Warn when tsc's own memory use approaches the heap ceiling (see below). */
const FALLBACK_HEAP_WARN_PCT = 80;

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

// Read a numeric policy knob from the governance budget (SSoT). Falls back to
// the documented default if the file is absent/malformed so the gate still runs.
function readPolicyNumber(key, fallback) {
  try {
    const budget = JSON.parse(fs.readFileSync(getBudgetFile(), 'utf8'));
    const value = budget && budget.policy && budget.policy[key];
    return typeof value === 'number' ? value : fallback;
  } catch {
    return fallback;
  }
}

function resolveTolerancePct() {
  return readPolicyNumber('tolerancePct', FALLBACK_TOLERANCE_PCT);
}

function resolveHeapWarnPct() {
  return readPolicyNumber('heapWarnPct', FALLBACK_HEAP_WARN_PCT);
}

// Parse the counters out of `tsc --extendedDiagnostics` output. The relevant
// lines look like "Instantiations: 123456", "Types: 78901" and
// "Memory used: 6624656K". Throws if Instantiations is missing (a broken/failed
// tsc run must fail closed, never be read as 0 complexity).
//
// `memoryUsedKB` is free — tsc already prints it — and it is what turns the OOM
// cliff into a slope: without it the gate can only discover the ceiling by
// dying at it, which is precisely how it lost 9 days (ADR-757 ΦΑΣΗ Β).
function parseExtendedDiagnostics(output) {
  const text = String(output || '');
  const inst = text.match(/^\s*Instantiations:\s+(\d+)\s*$/m);
  const types = text.match(/^\s*Types:\s+(\d+)\s*$/m);
  const memory = text.match(/^\s*Memory used:\s+(\d+)K\s*$/m);
  if (!inst) {
    throw new Error(`tsc --extendedDiagnostics had no "Instantiations:" line (build failed?).`);
  }
  return {
    instantiations: Number(inst[1]),
    types: types ? Number(types[1]) : 0,
    memoryUsedKB: memory ? Number(memory[1]) : 0,
  };
}

// Heavy — full type-check. CI only (N.17).
//
// Every way this can go wrong is now NAMED and printed with tsc's own output
// (scripts/lib/tsc-runner.js). The previous version threw a bare "no
// Instantiations line" and discarded stdout+stderr, so 13 consecutive red runs
// could not be told apart: OOM? killed? compiler not found? counters renamed?
// A gate is allowed to fail; it is not allowed to be unreadable.
function measure() {
  const run = tsc.runTsc({ args: ['--extendedDiagnostics', '--noEmit'] });
  if (run.outcome !== tsc.TSC_OUTCOME.RAN) {
    throw new Error('\n' + tsc.formatTscFailure(run));
  }
  try {
    return { ...parseExtendedDiagnostics(run.combined), heapMb: run.heapMb };
  } catch (e) {
    // tsc ran to completion but the counters we need are absent — a different
    // state from "tsc died", and one that would mean the output format moved.
    throw new Error('\n' + tsc.formatTscFailure({
      ...run,
      outcome: tsc.TSC_OUTCOME.NO_DIAGNOSTICS,
      detail: `${e.message} tsc exited cleanly, so this is a format/flag problem, not a crash.`,
    }));
  }
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
    memoryUsedKB: m.memoryUsedKB || 0,
  };
}

// The early-warning the gate lacked. tsc reports its own peak memory; compare it
// to the ceiling actually in force and say so BEFORE the run that dies at it.
// Deliberately a warning, not a block: heap pressure is an environment fact, not
// a code regression, and blocking on it would be a second policy smuggled into
// a gate that measures type complexity.
function heapHeadroomNote(measured) {
  if (!measured.heapMb || !measured.memoryUsedKB) return '';
  const usedMb = Math.round(measured.memoryUsedKB / 1024);
  const pct = Math.round((usedMb / measured.heapMb) * 100);
  const line = `   heap: ${usedMb.toLocaleString('en-US')} MB used of ${measured.heapMb.toLocaleString('en-US')} MB ceiling (${pct}%)`;
  if (pct < resolveHeapWarnPct()) return `\n${line}`;
  return `\n⚠️  APPROACHING THE OOM CLIFF —${line.slice(3)}\n` +
    `   At 100% tsc dies before printing any counter and this gate reports UNKNOWN,\n` +
    `   not a regression. Raise the ceiling (scripts/lib/tsc-runner.js) or cut type work.`;
}

function describe({ measured, baseline, tolerancePct }) {
  const cur = `${measured.instantiations.toLocaleString('en-US')} instantiations (${measured.types.toLocaleString('en-US')} types)`;
  if (!baseline) return cur + heapHeadroomNote(measured);
  const ceiling = Math.round(baseline.instantiations * (1 + tolerancePct / 100));
  const delta = measured.instantiations - baseline.instantiations;
  const sign = delta >= 0 ? '+' : '−';
  return `${cur} vs baseline ${baseline.instantiations.toLocaleString('en-US')} ` +
    `(${sign}${Math.abs(delta).toLocaleString('en-US')}, budget ${ceiling.toLocaleString('en-US')} @ ${tolerancePct}%)` +
    heapHeadroomNote(measured);
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
  heapHeadroomNote,
  measure,
  resolveTolerancePct,
  resolveHeapWarnPct,
  getBaselineFile,
  getBudgetFile,
  FALLBACK_TOLERANCE_PCT,
  FALLBACK_HEAP_WARN_PCT,
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
