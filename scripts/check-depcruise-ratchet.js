#!/usr/bin/env node
/**
 * ADR-598 G9 + G10 — Dependency-Cruiser Ratchet (generic engine, Layer-2 CI, N.17).
 *
 * ONE parameterised engine for BOTH graph gates (mirrors the ΦΑΣΗ 1 ESLint
 * engine — three separate scripts would be structural clones and trip CHECK 3.28
 * / N.18):
 *   • --gate cycles      (G9)  → counts `no-circular` violations
 *   • --gate boundaries  (G10) → counts the architectural `not-*` violations
 *
 * Both run `depcruise src --output-type json` against the shared
 * .dependency-cruiser.cjs, then count the violations whose rule name belongs to
 * the selected gate. Rules are `warn`; the gate blocks on a RISE vs the committed
 * baseline (.depcruise-<gate>-baseline.json) — a ratchet, seeded from the current
 * (non-zero) counts, never zero-tolerance-from-day-1. Graph analysis over the
 * whole tree is heavy → CI only (N.17). Baseline seeded via CI seed dispatch.
 * Baseline I/O + compare reuse scripts/lib/ratchet-baseline.js (N.18).
 *
 * CLI:
 *   node scripts/check-depcruise-ratchet.js --gate cycles                # check
 *   node scripts/check-depcruise-ratchet.js --gate boundaries --check    # explicit
 *   node scripts/check-depcruise-ratchet.js --gate cycles --write-baseline
 *
 * Env:
 *   DEPCRUISE_BASELINE_FILE=... — redirect baseline (Jest suite).
 *   DEPCRUISE_SCAN_ROOT=...     — override scan root (default: src).
 *
 * Exit codes: 0 = count held or fell · 1 = unknown/missing gate, baseline
 * missing/invalid, depcruise failed, or the violation count rose above baseline.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ratchet = require('./lib/ratchet-baseline');

const PROJECT_ROOT = ratchet.PROJECT_ROOT;

// The ONLY per-gate knowledge: which rule names count toward each gate + where
// its baseline lives. Adding a gate = one entry + rules in .dependency-cruiser.cjs.
const GATES = {
  cycles: {
    adr: 'ADR-598 G9',
    ruleNames: ['no-circular'],
    baseline: '.depcruise-cycles-baseline.json',
  },
  boundaries: {
    adr: 'ADR-598 G10',
    ruleNames: ['services-not-to-components', 'not-to-dxf-internals', 'no-test-utils-in-prod'],
    baseline: '.depcruise-boundaries-baseline.json',
  },
};

function getGate(name) {
  const gate = GATES[name];
  if (!gate) throw new Error(`Unknown --gate "${name}". Known gates: ${Object.keys(GATES).join(', ')}`);
  return gate;
}

function getBaselineFile(gate) {
  return process.env.DEPCRUISE_BASELINE_FILE
    ? path.resolve(process.env.DEPCRUISE_BASELINE_FILE)
    : path.join(PROJECT_ROOT, gate.baseline);
}

function getScanRoot() {
  return process.env.DEPCRUISE_SCAN_ROOT || 'src';
}

function parseArgs(argv) {
  const out = { gate: null, check: false, writeBaseline: false, help: false };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--gate') out.gate = rest[++i];
    else if (a === '--check' || a === '--full') out.check = true;
    else if (a === '--write-baseline') out.writeBaseline = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

// Count the violations of a depcruise JSON report that belong to this gate's
// rules. Pure — the Jest suite drives it with a synthetic report. `summary.error`
// (a depcruise self-error, e.g. tsconfig not found) is surfaced so a broken run
// can never read as "0 violations".
function summarize(gate, report) {
  const summary = (report && report.summary) || {};
  const violations = summary.violations || [];
  const perRule = {};
  let total = 0;
  for (const v of violations) {
    const name = v.rule && v.rule.name;
    if (!gate.ruleNames.includes(name)) continue;
    perRule[name] = (perRule[name] || 0) + 1;
    total++;
  }
  return { total, perRule };
}

// Heavy — full graph crawl. CI only (N.17). depcruise exits non-zero when it
// finds `error`-severity violations; our rules are all `warn`, so a non-zero
// exit here means depcruise itself failed → trust the JSON, fail closed if unparseable.
function runDepcruise(scanRoot) {
  const args = [
    'depcruise', scanRoot,
    '--config', '.dependency-cruiser.cjs',
    '--output-type', 'json',
  ];
  const result = spawnSync('npx', args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
  const stdout = (result.stdout || '').trim();
  if (!stdout) {
    const detail = (result.stderr || '').toString().slice(0, 800);
    throw new Error(`dependency-cruiser produced no JSON. Is it installed (pnpm install)? ${detail}`);
  }
  let report;
  try {
    report = JSON.parse(stdout);
  } catch (e) {
    const detail = (result.stderr || '').toString().slice(0, 800);
    throw new Error(`Could not parse dependency-cruiser JSON: ${e.message}. ${detail}`);
  }
  if (report.summary && report.summary.error) {
    throw new Error(`dependency-cruiser self-error: ${report.summary.error}`);
  }
  return report;
}

function measure(gate) {
  return summarize(gate, runDepcruise(getScanRoot()));
}

function buildPayload(gateName, gate, counts) {
  return {
    description:
      `ADR-598 ${gate.adr.split(' ')[1]} — dependency-cruiser ratchet baseline for gate "${gateName}". ` +
      `Counts violations of rules [${gate.ruleNames.join(', ')}] over ${getScanRoot()}/ ` +
      `(config: .dependency-cruiser.cjs). Ratchet DOWN only: a rise blocks the PR. ` +
      `Reseed via CI seed dispatch after a legitimate reduction.`,
    generatedBy: `scripts/check-depcruise-ratchet.js --gate ${gateName} --write-baseline`,
    adr: gate.adr,
    gate: gateName,
    total: counts.total,
    perRule: counts.perRule,
  };
}

function printHelp() {
  console.log(`ADR-598 G9/G10 — dependency-cruiser ratchet (generic)

Usage:
  node scripts/check-depcruise-ratchet.js --gate <name>                  # check
  node scripts/check-depcruise-ratchet.js --gate <name> --write-baseline # (re)seed (CI)

Gates: ${Object.keys(GATES).join(', ')}
Scan root: ${getScanRoot()}
`);
}

function runWriteBaseline(gateName, gate) {
  let counts;
  try {
    counts = measure(gate);
  } catch (e) {
    console.error(`❌ ${gate.adr} baseline — ${e.message}`);
    process.exit(1);
  }
  const file = getBaselineFile(gate);
  ratchet.writeBaselineFile(file, buildPayload(gateName, gate, counts));
  console.log(`✅ Wrote baseline: ${ratchet.rel(file)}`);
  console.log(`   gate: ${gateName} (${gate.adr}) — ${counts.total} violation(s)`);
  for (const [r, n] of Object.entries(counts.perRule)) console.log(`     ${r}: ${n}`);
  process.exit(0);
}

function runCheck(gateName, gate) {
  const file = getBaselineFile(gate);
  const baseline = ratchet.loadBaseline(file, ['total']);
  if (!baseline || baseline.__invalid) {
    console.error(`❌ ${gate.adr} — baseline ${baseline ? baseline.__invalid : 'missing'}: ${ratchet.rel(file)}`);
    console.error(`   Seed it via CI: run the workflow with seed=true and commit the baseline JSON.`);
    console.error(`   (local, heavy — N.17): node scripts/check-depcruise-ratchet.js --gate ${gateName} --write-baseline`);
    process.exit(1);
  }

  let counts;
  try {
    counts = measure(gate);
  } catch (e) {
    console.error(`❌ ${gate.adr} — ${e.message}`);
    process.exit(1);
  }

  if (!ratchet.isRegression({ current: counts.total, baseline: baseline.total, direction: 'down' })) {
    const cleaned = baseline.total - counts.total;
    const trend = cleaned > 0 ? ` (−${cleaned} vs baseline — reseed to lock)` : '';
    console.log(`✅ ${gate.adr} OK — ${gateName} violations:${counts.total}/${baseline.total}${trend}`);
    process.exit(0);
  }

  console.error(`❌ ${gate.adr} FAIL — "${gateName}" violations rose above baseline: ${baseline.total} → ${counts.total} (+${counts.total - baseline.total})`);
  console.error(`\nPer-rule now vs baseline:`);
  const rules = new Set([...Object.keys(counts.perRule), ...Object.keys(baseline.perRule || {})]);
  for (const r of rules) {
    const c = counts.perRule[r] || 0;
    const b = (baseline.perRule || {})[r] || 0;
    console.error(`   ${r}: ${b} → ${c}${c > b ? '  ⬆' : ''}`);
  }
  console.error(`\nFix the new violation(s) (inspect: npx depcruise ${getScanRoot()} --config .dependency-cruiser.cjs),`);
  console.error(`or, if accepted debt, reseed the baseline via CI dispatch.`);
  process.exit(1);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.gate) { printHelp(); process.exit(args.gate || args.help ? 0 : 1); }
  const gate = getGate(args.gate);
  if (args.writeBaseline) { runWriteBaseline(args.gate, gate); return; }
  runCheck(args.gate, gate);
}

// Exported for the Jest suite.
module.exports = {
  GATES,
  getGate,
  parseArgs,
  summarize,
  buildPayload,
  measure,
  getBaselineFile,
  getScanRoot,
  runDepcruise,
  runCheck,
  runWriteBaseline,
  printHelp,
  main,
};

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }
}
