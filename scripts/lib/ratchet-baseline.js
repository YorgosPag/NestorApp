#!/usr/bin/env node
/**
 * ADR-598 ΦΑΣΗ 2 — Shared ratchet-baseline primitives (SSoT, CLAUDE.md N.18).
 *
 * G5 (type-coverage), G6 (bundle-size) and G14 (type-complexity) are all
 * "measure one number → compare to a committed baseline → block on regression"
 * gates. Written as three standalone scripts they would be structural clones
 * (same parse-args → load-baseline → measure → compare → write-baseline shape)
 * and would trip our OWN token-based clone gate (CHECK 3.28 / N.18) — exactly
 * as the three ESLint gates were unified into ONE engine in ΦΑΣΗ 1.
 *
 * So the identical machinery lives here ONCE:
 *   - parseArgs        : --check / --write-baseline / --help
 *   - loadBaseline     : fail-closed JSON read (missing → null, bad → __invalid)
 *   - writeBaselineFile: pretty JSON + trailing newline
 *   - isRegression     : direction-aware compare with tolerance
 *   - runRatchetCli    : the whole check/write/help control-flow, driven by a
 *                        small per-gate descriptor
 *
 * Each gate script keeps ONLY its gate-specific bits: how to `measure()` (spawn
 * the heavy tool + parse its output) and how to describe the result. The heavy
 * measurement (tsc / next build / type-coverage) runs in CI only (N.17); this
 * module never spawns anything — it is pure control-flow + I/O and is unit-safe.
 *
 * Exit codes (via runRatchetCli):
 *   0 — no regression, baseline written, or --help.
 *   1 — baseline missing/invalid, measurement failed, or a regression appeared.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

function rel(filePath) {
  return path.relative(PROJECT_ROOT, filePath);
}

// Shared CLI surface for every ratchet: default runs the check; --write-baseline
// (re)seeds; --help prints usage. Unknown args fail loud (mirrors the license /
// eslint ratchets).
function parseArgs(argv) {
  const out = { check: false, writeBaseline: false, help: false };
  for (const a of argv.slice(2)) {
    if (a === '--check' || a === '--full') out.check = true;
    else if (a === '--write-baseline') out.writeBaseline = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

// Fail-closed baseline read. Missing file → null (caller prints "seed it").
// Present-but-broken → { __invalid } so a corrupt baseline can never be mistaken
// for "0 regressions". `requiredNumericKeys` are the metric fields the gate needs.
function loadBaseline(filePath, requiredNumericKeys = []) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const key of requiredNumericKeys) {
      if (typeof parsed[key] !== 'number') {
        return { __invalid: `missing numeric field "${key}"` };
      }
    }
    return parsed;
  } catch (e) {
    return { __invalid: `invalid JSON: ${e.message}` };
  }
}

function writeBaselineFile(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n');
}

// Direction-aware regression test.
//   direction 'up'   — higher is better (typed %). Regression if current drops
//                      below baseline*(1 - tol).
//   direction 'down' — lower is better (bytes, instantiations). Regression if
//                      current rises above baseline*(1 + tol).
// tolerancePct absorbs the natural jitter of build/type numbers so the gate does
// not flap on sub-percent noise (big-players budget-with-slack, not byte-exact).
function isRegression({ current, baseline, direction, tolerancePct = 0 }) {
  const tol = Math.max(0, tolerancePct) / 100;
  if (direction === 'up') return current < baseline * (1 - tol);
  if (direction === 'down') return current > baseline * (1 + tol);
  throw new Error(`Unknown ratchet direction "${direction}" (expected 'up' or 'down')`);
}

// The whole check/write/help control-flow, parameterised by a per-gate descriptor
// so the three gate scripts stay clone-free (N.18). Descriptor:
//   adr           — e.g. 'ADR-598 G5'
//   scriptName    — for the "seed it" hint, e.g. 'scripts/check-type-coverage-ratchet.js'
//   baselineFile  — absolute path to the gate's baseline JSON
//   requiredKeys  — numeric baseline fields the compare needs
//   metricKey     — the primary field compared against baseline
//   direction     — 'up' | 'down'
//   resolveTolerancePct(baseline) — tolerance to apply (may read baseline/config)
//   measure()     — spawn the heavy tool, return an object incl. metricKey (throws on failure)
//   buildPayload(measured) — the JSON object to persist on --write-baseline
//   describe({ measured, baseline, tolerancePct, regressed }) — one-line human summary
//   remediation   — multi-line string printed on FAIL
function runRatchetCli(descriptor, argv = process.argv) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp(descriptor);
    process.exit(0);
  }

  if (args.writeBaseline) {
    let measured;
    try {
      measured = descriptor.measure();
    } catch (e) {
      console.error(`❌ ${descriptor.adr} baseline — ${e.message}`);
      process.exit(1);
    }
    writeBaselineFile(descriptor.baselineFile, descriptor.buildPayload(measured));
    console.log(`✅ Wrote baseline: ${rel(descriptor.baselineFile)}`);
    console.log(`   ${descriptor.describe({ measured, baseline: null, tolerancePct: 0, regressed: false })}`);
    process.exit(0);
  }

  // Default / --check
  const baseline = loadBaseline(descriptor.baselineFile, descriptor.requiredKeys);
  if (!baseline || baseline.__invalid) {
    console.error(`❌ ${descriptor.adr} — baseline ${baseline ? baseline.__invalid : 'missing'}: ${rel(descriptor.baselineFile)}`);
    console.error(`   Seed it via CI: run the gate's workflow with seed=true, download the`);
    console.error(`   artifact (or copy from the job summary) and commit the baseline JSON.`);
    console.error(`   (local, heavy — N.17): node ${descriptor.scriptName} --write-baseline`);
    process.exit(1);
  }

  let measured;
  try {
    measured = descriptor.measure();
  } catch (e) {
    console.error(`❌ ${descriptor.adr} — ${e.message}`);
    process.exit(1);
  }

  const tolerancePct = descriptor.resolveTolerancePct(baseline);
  const regressed = isRegression({
    current: measured[descriptor.metricKey],
    baseline: baseline[descriptor.metricKey],
    direction: descriptor.direction,
    tolerancePct,
  });
  const summary = descriptor.describe({ measured, baseline, tolerancePct, regressed });

  if (!regressed) {
    console.log(`✅ ${descriptor.adr} OK — ${summary}`);
    process.exit(0);
  }

  console.error(`❌ ${descriptor.adr} FAIL — ${summary}`);
  if (descriptor.remediation) console.error(`\n${descriptor.remediation}`);
  process.exit(1);
}

function printHelp(descriptor) {
  console.log(`${descriptor.adr} — ratchet baseline gate

Usage:
  node ${descriptor.scriptName}                  # check current vs baseline
  node ${descriptor.scriptName} --check          # same (explicit)
  node ${descriptor.scriptName} --write-baseline # (re)seed the baseline (heavy — CI/N.17)

Baseline file: ${rel(descriptor.baselineFile)}
Direction: ${descriptor.direction === 'up' ? 'higher is better (block on drop)' : 'lower is better (block on rise + tolerance)'}
`);
}

module.exports = {
  PROJECT_ROOT,
  rel,
  parseArgs,
  loadBaseline,
  writeBaselineFile,
  isRegression,
  runRatchetCli,
  printHelp,
};
