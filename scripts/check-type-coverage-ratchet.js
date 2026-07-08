#!/usr/bin/env node
/**
 * ADR-598 G5 — Type-Coverage Ratchet (Layer-2 CI, CLAUDE.md N.17).
 *
 * Measures the share of the codebase whose identifiers carry a real (non-`any`)
 * type, via `type-coverage` (MIT). This is the % complement to the grep counts
 * in the ADR (`as any` 73 / `: any` 43): those count explicit escapes, this
 * counts the *whole* surface — implicit anys, untyped 3rd-party returns, etc.
 *
 * Ratchet direction: UP. The typed percentage may only rise; a drop below the
 * committed baseline blocks the PR. (No tolerance — the number is deterministic
 * for a given source + tsconfig, unlike bundle bytes / type instantiations.)
 *
 * type-coverage drives the TS compiler API under the hood → heavy → CI only
 * (N.17). The baseline is seeded via the workflow's seed dispatch, never by the
 * agent locally. All baseline/compare/CLI machinery is shared with G6/G14 via
 * scripts/lib/ratchet-baseline.js (N.18 — no clone).
 *
 * CLI:
 *   node scripts/check-type-coverage-ratchet.js                  # check vs baseline
 *   node scripts/check-type-coverage-ratchet.js --write-baseline # (re)seed (CI)
 *
 * Env:
 *   TYPE_COVERAGE_BASELINE_FILE=... — redirect baseline (Jest suite).
 *
 * Exit codes: 0 = typed % held or rose · 1 = baseline missing/invalid, tool
 * failed, or typed % fell below baseline.
 */

'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ratchet = require('./lib/ratchet-baseline');

const PROJECT_ROOT = ratchet.PROJECT_ROOT;
const DEFAULT_BASELINE_FILE = path.join(PROJECT_ROOT, '.type-coverage-baseline.json');

function getBaselineFile() {
  return process.env.TYPE_COVERAGE_BASELINE_FILE
    ? path.resolve(process.env.TYPE_COVERAGE_BASELINE_FILE)
    : DEFAULT_BASELINE_FILE;
}

// Parse type-coverage's summary line. Depending on the version it prints
// either "9500 / 9600 98.96%" or "(9500 / 9600) 98.96%" (the fraction may be
// wrapped in parentheses), optionally followed by "type-coverage success.".
// The `\(?…\)?` make the parens optional so both formats parse.
// Scan bottom-up for the last matching line so per-file `--detail` output (if
// ever enabled) can't shadow the summary. Throws if no summary line is present
// (a broken run must fail closed, never read as 100%).
function parseTypeCoverageOutput(stdout) {
  const lines = String(stdout || '').trim().split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/\(?(\d+)\s*\/\s*(\d+)\)?\s+([\d.]+)%/);
    if (m) {
      return {
        typedCount: Number(m[1]),
        totalCount: Number(m[2]),
        percent: Number(m[3]),
      };
    }
  }
  throw new Error(`type-coverage produced no summary line ("N / M P%"). Raw tail: ${lines.slice(-3).join(' | ')}`);
}

// Heavy — runs the TS compiler API. CI only (N.17). --strict counts function
// arguments/generics strictly; --ignore-catch excludes unavoidable `catch (e)`
// bindings from the denominator.
function measure() {
  const result = spawnSync('npx', ['type-coverage', '--strict', '--ignore-catch'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
  const stdout = (result.stdout || '').trim();
  if (!stdout) {
    const detail = (result.stderr || '').toString().slice(0, 600);
    throw new Error(`type-coverage produced no output. Is it installed (pnpm install)? ${detail}`);
  }
  return parseTypeCoverageOutput(stdout);
}

function buildPayload(m) {
  return {
    description:
      'ADR-598 G5 — type-coverage ratchet baseline. percent = share of identifiers ' +
      'with a real (non-any) type over the whole tree (type-coverage --strict --ignore-catch). ' +
      'Ratchet UP only: a drop below `percent` blocks the PR. Reseed via CI seed dispatch.',
    generatedBy: 'scripts/check-type-coverage-ratchet.js --write-baseline',
    adr: 'ADR-598 G5',
    percent: m.percent,
    typedCount: m.typedCount,
    totalCount: m.totalCount,
  };
}

function describe({ measured, baseline }) {
  const cur = `${measured.percent}% (${measured.typedCount}/${measured.totalCount} typed)`;
  if (!baseline) return `typed ${cur}`;
  const delta = (measured.percent - baseline.percent).toFixed(2);
  const sign = Number(delta) >= 0 ? '+' : '';
  return `typed ${cur} vs baseline ${baseline.percent}% (${sign}${delta}pp)`;
}

const DESCRIPTOR = {
  adr: 'ADR-598 G5',
  scriptName: 'scripts/check-type-coverage-ratchet.js',
  get baselineFile() { return getBaselineFile(); },
  requiredKeys: ['percent'],
  metricKey: 'percent',
  direction: 'up',
  resolveTolerancePct: () => 0,
  measure,
  buildPayload,
  describe,
  remediation:
    'A newly-added `any` / untyped surface lowered the typed percentage.\n' +
    '  1) Type the new code (no `any` / `as any` — CLAUDE.md N.2).\n' +
    '  2) Inspect locally: npx type-coverage --strict --ignore-catch --detail\n' +
    '  3) If this is an accepted, vetted regression, reseed the baseline via CI dispatch.',
};

// Exported for the Jest suite (scripts/__tests__/check-type-ratchets.test.js).
module.exports = {
  parseTypeCoverageOutput,
  buildPayload,
  describe,
  measure,
  getBaselineFile,
  DESCRIPTOR,
};

if (require.main === module) {
  try {
    // Re-read baselineFile at run time (env may point elsewhere in tests).
    ratchet.runRatchetCli({ ...DESCRIPTOR, baselineFile: getBaselineFile() });
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }
}
