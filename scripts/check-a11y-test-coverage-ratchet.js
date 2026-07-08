#!/usr/bin/env node
/**
 * ADR-598 G11 — A11y Test-Coverage Ratchet (fast, AST-free — pre-commit/CI).
 *
 * Enforces that reusable UI components carry an accessibility test. It is a
 * SET-DIFF ratchet (mirrors the dead-code baseline, not a numeric one): the
 * baseline (.a11y-coverage-baseline.json) grandfathers every CURRENT component
 * under src/components/ui/** and src/components/generic/** that lacks an a11y
 * test. The gate then blocks only when a NEW uncovered component appears — a
 * component not in the baseline that has no test importing it and running axe.
 * Zero-tolerance-on-touch for new components; the grandfathered debt is paid down
 * over time (reseed to shrink). Canvas/DXF renderers are out of scope (not in the
 * two component roots).
 *
 * "Covered" = some test file under src/components/** that (a) runs an axe check
 * (jest-axe / the @/test-utils/a11y helper) AND (b) imports the component by its
 * module basename. Cheap string scan — no TS parse → safe for pre-commit.
 *
 * CLI:
 *   node scripts/check-a11y-test-coverage-ratchet.js                  # check
 *   node scripts/check-a11y-test-coverage-ratchet.js --write-baseline # (re)seed
 *
 * Env:
 *   A11Y_COVERAGE_BASELINE_FILE=... — redirect baseline (Jest suite).
 *   A11Y_COMPONENT_ROOTS=a,b        — override scan roots (comma-sep, Jest suite).
 *
 * Exit codes: 0 = no new uncovered component · 1 = baseline missing/invalid or a
 * new uncovered component appeared.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ratchet = require('./lib/ratchet-baseline');

const PROJECT_ROOT = ratchet.PROJECT_ROOT;
const DEFAULT_BASELINE_FILE = path.join(PROJECT_ROOT, '.a11y-coverage-baseline.json');
const DEFAULT_ROOTS = ['src/components/ui', 'src/components/generic'];
const AXE_MARKERS = ['toHaveNoViolations', 'expectNoA11yViolations', 'jest-axe', 'test-utils/a11y'];
const EXCLUDE_RE = /(\.(test|spec|stories)\.[jt]sx?$|[\\/]__tests__[\\/]|\.d\.ts$|[\\/]index\.tsx?$)/;
const TEST_FILE_RE = /\.(test|spec)\.[jt]sx?$/;

function getBaselineFile() {
  return process.env.A11Y_COVERAGE_BASELINE_FILE
    ? path.resolve(process.env.A11Y_COVERAGE_BASELINE_FILE)
    : DEFAULT_BASELINE_FILE;
}

function getRoots() {
  return process.env.A11Y_COMPONENT_ROOTS
    ? process.env.A11Y_COMPONENT_ROOTS.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_ROOTS;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function toPosixRel(absPath) {
  return path.relative(PROJECT_ROOT, absPath).split(path.sep).join('/');
}

function basenameNoExt(file) {
  return path.basename(file).replace(/\.[jt]sx?$/, '');
}

// Build the covered-basename set: for every test file that runs an axe check,
// collect the basenames of its relative imports. A component whose basename is in
// this set is considered covered. Pure over a provided file list for testability.
function collectCoveredBasenames(files) {
  const covered = new Set();
  for (const file of files) {
    if (!TEST_FILE_RE.test(file)) continue;
    let content;
    try { content = fs.readFileSync(file, 'utf8'); } catch { continue; }
    if (!AXE_MARKERS.some((m) => content.includes(m))) continue;
    for (const match of content.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      covered.add(basenameNoExt(match[1]));
    }
  }
  return covered;
}

// Enumerate component files under the roots (excluding tests/stories/barrels/types).
function collectComponentFiles(roots) {
  const files = [];
  for (const root of roots) {
    for (const abs of walk(path.join(PROJECT_ROOT, root))) {
      if (!abs.endsWith('.tsx')) continue;
      if (EXCLUDE_RE.test(abs)) continue;
      files.push(abs);
    }
  }
  return files;
}

// Compute the sorted list of uncovered component files (posix-relative).
function computeUncovered(roots) {
  const componentFiles = collectComponentFiles(roots);
  // Scan tests from the shared parent of all roots so a test co-located anywhere
  // under src/components can provide coverage.
  const testScanRoots = new Set(roots.map((r) => path.join(PROJECT_ROOT, r)));
  const allFiles = [];
  for (const r of testScanRoots) walk(r, allFiles);
  const covered = collectCoveredBasenames(allFiles);
  return componentFiles
    .filter((f) => !covered.has(basenameNoExt(f)))
    .map(toPosixRel)
    .sort();
}

function buildPayload(uncovered) {
  return {
    description:
      'ADR-598 G11 — a11y test-coverage ratchet baseline. `uncovered` grandfathers ' +
      'every current component under the scan roots lacking an a11y test. The gate ' +
      'blocks when a NEW uncovered component appears (not in this list). Pay down by ' +
      'adding a test that imports the component and runs axe (@/test-utils/a11y), then reseed.',
    generatedBy: 'scripts/check-a11y-test-coverage-ratchet.js --write-baseline',
    adr: 'ADR-598 G11',
    roots: getRoots(),
    count: uncovered.length,
    uncovered,
  };
}

function runWriteBaseline() {
  const uncovered = computeUncovered(getRoots());
  const file = getBaselineFile();
  ratchet.writeBaselineFile(file, buildPayload(uncovered));
  console.log(`✅ Wrote baseline: ${ratchet.rel(file)}`);
  console.log(`   ${uncovered.length} grandfathered uncovered component(s) across ${getRoots().join(', ')}`);
  process.exit(0);
}

function runCheck() {
  const file = getBaselineFile();
  const baseline = ratchet.loadBaseline(file, ['count']);
  if (!baseline || baseline.__invalid) {
    console.error(`❌ ADR-598 G11 — baseline ${baseline ? baseline.__invalid : 'missing'}: ${ratchet.rel(file)}`);
    console.error(`   Seed it: node scripts/check-a11y-test-coverage-ratchet.js --write-baseline`);
    process.exit(1);
  }

  const grandfathered = new Set(baseline.uncovered || []);
  const uncovered = computeUncovered(getRoots());
  const newlyUncovered = uncovered.filter((f) => !grandfathered.has(f));

  if (newlyUncovered.length === 0) {
    const fixed = (baseline.uncovered || []).filter((f) => !uncovered.includes(f)).length;
    const trend = fixed > 0 ? ` (−${fixed} paid down — reseed to lock)` : '';
    console.log(`✅ ADR-598 G11 OK — no new uncovered component (grandfathered:${uncovered.length}/${baseline.count})${trend}`);
    process.exit(0);
  }

  console.error(`❌ ADR-598 G11 FAIL — ${newlyUncovered.length} new component(s) without an a11y test:`);
  for (const f of newlyUncovered.slice(0, 30)) console.error(`   • ${f}`);
  if (newlyUncovered.length > 30) console.error(`   … and ${newlyUncovered.length - 30} more.`);
  console.error(``);
  console.error(`Add an a11y test that imports the component and runs axe:`);
  console.error(`   import { expectNoA11yViolations } from '@/test-utils/a11y';`);
  console.error(`   it('has no a11y violations', async () => { await expectNoA11yViolations(<X />); });`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { writeBaseline: false, check: false, help: false };
  for (const a of argv.slice(2)) {
    if (a === '--write-baseline') out.writeBaseline = true;
    else if (a === '--check') out.check = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`ADR-598 G11 — a11y test-coverage ratchet\n\n` +
      `  node scripts/check-a11y-test-coverage-ratchet.js                  # check\n` +
      `  node scripts/check-a11y-test-coverage-ratchet.js --write-baseline # (re)seed\n\n` +
      `Roots: ${getRoots().join(', ')}`);
    process.exit(0);
  }
  if (args.writeBaseline) { runWriteBaseline(); return; }
  runCheck();
}

// Exported for the Jest suite.
module.exports = {
  collectCoveredBasenames,
  collectComponentFiles,
  computeUncovered,
  buildPayload,
  parseArgs,
  basenameNoExt,
  getBaselineFile,
  getRoots,
  AXE_MARKERS,
  EXCLUDE_RE,
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
