#!/usr/bin/env node
/**
 * CHECK 3.18 — SSoT Discover Ratchet (Ratchet Mode, CI-primary + hook smoke)
 *
 * Wraps scripts/ssot-discover.sh (read-only 4-phase codebase scanner) with
 * a baseline comparator. Blocks commits/PRs that raise any of the three
 * tracked structural-duplicate metrics:
 *
 *   - duplicateExports  : exports redeclared outside their SSoT module
 *   - antiPatterns      : scattered patterns with >=N files (per scanner thresholds)
 *   - unprotected       : centralized SSoT files not yet listed in .ssot-registry.json
 *
 * Why this exists (ADR-314):
 *   CHECK 3.7 (.ssot-registry.json ratchet) only blocks new violations of
 *   patterns already *registered* (62+ modules). `npm run ssot:discover`
 *   discovers *new* duplicate patterns and registry gaps — but used to run
 *   only manually/offline. A duplicate born today passes CI until someone
 *   remembers to run the scanner → retroactive cleanup work (Phases
 *   C.5.1 → C.5.21, ~43h estimated). This check closes that gap by turning
 *   the discover script into a presubmit-grade ratchet.
 *
 * Runtime caveat:
 *   The bash scanner takes ~30-60s on Linux CI but ~4 minutes on Windows
 *   Git Bash (process-spawn overhead). So:
 *     - CI (Linux runner) runs the full check on every PR — authoritative
 *       gate, blocks merge via branch protection (Layer 2).
 *     - Pre-commit hook runs a fast *smoke* mode by default (verifies the
 *       baseline file exists + is valid JSON) to keep local hook wall-clock
 *       under 200ms (Layer 1).
 *   Developers who want to run the full scan locally before commit:
 *     SSOT_DISCOVER_FULL=1 node scripts/check-ssot-discover-ratchet.js
 *
 * CLI:
 *   node scripts/check-ssot-discover-ratchet.js                # smoke (hook default)
 *   node scripts/check-ssot-discover-ratchet.js --full         # full scan + compare
 *   node scripts/check-ssot-discover-ratchet.js --write-baseline
 *
 * Env:
 *   SSOT_DISCOVER_FULL=1  — force --full behavior even without the flag.
 *
 * Exit codes:
 *   0 — no blocking violations (or smoke-mode OK)
 *   1 — baseline missing / invalid, or any tracked metric rose above baseline
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BASELINE_FILE = path.join(PROJECT_ROOT, '.ssot-discover-baseline.json');
const SCANNER = path.join(PROJECT_ROOT, 'scripts', 'ssot-discover.sh');

const TRACKED_METRICS = ['duplicateExports', 'antiPatterns', 'unprotected'];

function parseArgs(argv) {
  const out = { full: false, writeBaseline: false, help: false };
  for (const a of argv.slice(2)) {
    if (a === '--full') out.full = true;
    else if (a === '--write-baseline') out.writeBaseline = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (process.env.SSOT_DISCOVER_FULL === '1') out.full = true;
  return out;
}

function printHelp() {
  console.log(`CHECK 3.18 — SSoT Discover Ratchet

Usage:
  node scripts/check-ssot-discover-ratchet.js                 # smoke (baseline presence)
  node scripts/check-ssot-discover-ratchet.js --full          # full scan + compare
  node scripts/check-ssot-discover-ratchet.js --write-baseline
  SSOT_DISCOVER_FULL=1 node scripts/check-ssot-discover-ratchet.js

Baseline file: ${path.relative(PROJECT_ROOT, BASELINE_FILE)}
Scanner:       ${path.relative(PROJECT_ROOT, SCANNER)}
`);
}

function runScanner() {
  if (!fs.existsSync(SCANNER)) {
    console.error(`ERROR: scanner missing at ${SCANNER}`);
    process.exit(1);
  }
  const result = spawnSync('bash', [SCANNER], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) {
    console.error(`ERROR: failed to spawn scanner: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`ERROR: scanner exited with status ${result.status}`);
    if (result.stderr) console.error(result.stderr);
    process.exit(1);
  }
  return stripAnsi(result.stdout || '');
}

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

function parseSummary(output) {
  const extract = (label) => {
    const re = new RegExp(`${label}:\\s+(\\d+)`);
    const m = output.match(re);
    if (!m) {
      throw new Error(`Could not parse "${label}" from scanner output`);
    }
    return Number(m[1]);
  };
  return {
    centralizedFiles: extract('Centralized files'),
    protected: extract('Protected'),
    unprotected: extract('Unprotected'),
    duplicateExports: extract('Duplicate exports'),
    antiPatterns: extract('Anti-patterns'),
  };
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(BASELINE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    for (const m of TRACKED_METRICS) {
      if (typeof parsed[m] !== 'number') {
        return { __invalid: `missing numeric field "${m}"` };
      }
    }
    return parsed;
  } catch (e) {
    return { __invalid: `invalid JSON: ${e.message}` };
  }
}

function writeBaseline(counts) {
  const payload = {
    description:
      'CHECK 3.18 — SSoT Discover Ratchet baseline (ADR-314). Tracks totals for duplicateExports, antiPatterns, unprotected. Ratchet down only: a raise blocks the commit/PR. Refresh via `npm run ssot:discover:baseline` after legitimate cleanup.',
    generatedAt: new Date().toISOString(),
    generatedBy: 'scripts/check-ssot-discover-ratchet.js --write-baseline',
    adr: 'ADR-314',
    check: 'CHECK 3.18',
    centralizedFiles: counts.centralizedFiles,
    protected: counts.protected,
    unprotected: counts.unprotected,
    duplicateExports: counts.duplicateExports,
    antiPatterns: counts.antiPatterns,
  };
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(payload, null, 2) + '\n');
  console.log(`✅ Wrote baseline: ${path.relative(PROJECT_ROOT, BASELINE_FILE)}`);
  console.log(`   duplicateExports: ${counts.duplicateExports}`);
  console.log(`   antiPatterns:     ${counts.antiPatterns}`);
  console.log(`   unprotected:      ${counts.unprotected}`);
  console.log(`   (informational) centralizedFiles=${counts.centralizedFiles} protected=${counts.protected}`);
}

function compare(baseline, current) {
  const raises = [];
  for (const m of TRACKED_METRICS) {
    if (current[m] > baseline[m]) {
      raises.push({ metric: m, baseline: baseline[m], current: current[m], delta: current[m] - baseline[m] });
    }
  }
  return raises;
}

function runFull() {
  const baseline = loadBaseline();
  if (!baseline) {
    console.error(`❌ CHECK 3.18 — baseline missing: ${path.relative(PROJECT_ROOT, BASELINE_FILE)}`);
    console.error(`   Run: npm run ssot:discover:baseline`);
    process.exit(1);
  }
  if (baseline.__invalid) {
    console.error(`❌ CHECK 3.18 — baseline invalid: ${baseline.__invalid}`);
    console.error(`   Run: npm run ssot:discover:baseline`);
    process.exit(1);
  }

  const t0 = Date.now();
  const output = runScanner();
  const current = parseSummary(output);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const raises = compare(baseline, current);
  if (raises.length === 0) {
    console.log(
      `✅ CHECK 3.18 OK — duplicates:${current.duplicateExports} antiPatterns:${current.antiPatterns} unprotected:${current.unprotected} (${elapsed}s)`
    );
    process.exit(0);
  }

  console.error(`❌ CHECK 3.18 FAIL — new SSoT structural violations detected:`);
  for (const r of raises) {
    console.error(`   ${r.metric}: ${r.baseline} → ${r.current} (+${r.delta})`);
  }
  console.error(``);
  console.error(`Remediation:`);
  console.error(`  1) Centralize the new pattern into an existing SSoT module.`);
  console.error(`  2) Add a new module to .ssot-registry.json (Tier X), then ssot:baseline.`);
  console.error(`  3) If the raise is intentional cleanup debt, refresh the baseline:`);
  console.error(`        npm run ssot:discover:baseline`);
  console.error(``);
  console.error(`Diagnostic: npm run ssot:discover    (full 4-phase report)`);
  process.exit(1);
}

function runSmoke() {
  const baseline = loadBaseline();
  if (!baseline) {
    console.error(`❌ CHECK 3.18 — baseline missing: ${path.relative(PROJECT_ROOT, BASELINE_FILE)}`);
    console.error(`   Run: npm run ssot:discover:baseline`);
    process.exit(1);
  }
  if (baseline.__invalid) {
    console.error(`❌ CHECK 3.18 — baseline invalid: ${baseline.__invalid}`);
    console.error(`   Run: npm run ssot:discover:baseline`);
    process.exit(1);
  }
  console.log(
    `✅ CHECK 3.18 smoke — baseline OK (duplicates:${baseline.duplicateExports} antiPatterns:${baseline.antiPatterns} unprotected:${baseline.unprotected}). Full scan runs in CI.`
  );
  process.exit(0);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  if (args.writeBaseline) {
    const output = runScanner();
    const counts = parseSummary(output);
    writeBaseline(counts);
    process.exit(0);
  }
  if (args.full) {
    runFull();
    return;
  }
  runSmoke();
}

main();
