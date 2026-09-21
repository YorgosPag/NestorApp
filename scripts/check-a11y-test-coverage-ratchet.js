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
 * "Covered" = some test file under src/** that (a) runs an axe check (jest-axe /
 * the @/test-utils/a11y helper) AND (b) imports the component FILE. The import is
 * resolved to a path, never matched by basename:
 *   · relative  `from '../X'`                 → that file
 *   · alias     `from '@/components/ui/X'`    → that file (tsconfig `@/*` = src/*)
 *   · barrel    `import { A } from '..'`      → the file the barrel re-exports `A`
 *     from (named `export { A } from './A'` only — `export *` names nothing, so it
 *     proves nothing and counts nothing).
 * Cheap string scan — no TS parse → safe for pre-commit.
 *
 * Why paths and not basenames (2026-09-21): the basename match was blind both ways.
 * It MISSED every alias import (`@/…`, the codebase's canonical spelling), and it
 * OVER-COUNTED — a test importing `./Button` in folder A "covered" every
 * `Button.tsx` in the tree. Tests were also only scanned inside the component
 * roots, so an axe test anywhere else under src/ could never count.
 *
 * CLI:
 *   node scripts/check-a11y-test-coverage-ratchet.js                  # check
 *   node scripts/check-a11y-test-coverage-ratchet.js --write-baseline # (re)seed
 *
 * Env:
 *   A11Y_COVERAGE_BASELINE_FILE=... — redirect baseline (Jest suite).
 *   A11Y_COMPONENT_ROOTS=a,b        — override scan roots (comma-sep, Jest suite).
 *   A11Y_TEST_ROOTS=a,b             — where axe tests are looked for (default: src).
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
const DEFAULT_TEST_ROOTS = ['src'];
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

function getTestRoots() {
  return process.env.A11Y_TEST_ROOTS !== undefined
    ? process.env.A11Y_TEST_ROOTS.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_TEST_ROOTS;
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

const RESOLVE_SUFFIXES = ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts'];
// `import { A, B as C } from 'spec'` / `import D, { A } from 'spec'` / `import 'spec'`.
// The clause stops at `;` so one statement can never borrow the specifier of the next.
const IMPORT_RE = /import\s+(?:type\s+)?([^;'"]*?)\s*from\s*['"]([^'"]+)['"]/g;
const REEXPORT_RE = /export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;

function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
}

// Resolve a module specifier to an existing file, or null. Only relative and `@/`
// specifiers are ours; a bare package name can never be a component under test.
function resolveSpecifier(spec, fromFile, aliasRoot) {
  let base;
  if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  else if (spec.startsWith('@/')) base = path.join(aliasRoot, spec.slice(2));
  else return null;
  for (const suffix of RESOLVE_SUFFIXES) {
    const candidate = base + suffix;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return path.resolve(candidate);
  }
  return null;
}

// The names a `{ … }` clause binds, as the EXPORTED name (`A as B` → `A`).
function namedBindings(clause) {
  const braces = clause.match(/\{([^}]*)\}/);
  if (!braces) return [];
  return braces[1]
    .split(',')
    .map((part) => part.replace(/^\s*type\s+/, '').trim().split(/\s+as\s+/)[0].trim())
    .filter(Boolean);
}

function isBarrel(file) {
  return /[\\/]index\.[jt]sx?$/.test(file);
}

// Follow ONE level of named re-exports: which file does the barrel take `name` from?
function resolveThroughBarrel(barrel, names, aliasRoot) {
  const text = readText(barrel);
  if (text === null) return [];
  const wanted = new Set(names);
  const out = [];
  for (const [, clause, spec] of text.matchAll(REEXPORT_RE)) {
    const exported = clause
      .split(',')
      .map((part) => part.replace(/^\s*type\s+/, '').trim().split(/\s+as\s+/).pop().trim());
    if (!exported.some((name) => wanted.has(name))) continue;
    const target = resolveSpecifier(spec, barrel, aliasRoot);
    if (target) out.push(target);
  }
  return out;
}

// Build the covered-file set: for every test file that runs an axe check, the
// absolute paths of the modules it imports (see the header for the three forms).
// Pure over a provided file list for testability; `aliasRoot` is what `@/` means.
function collectCoveredFiles(files, aliasRoot = path.join(PROJECT_ROOT, 'src')) {
  const covered = new Set();
  for (const file of files) {
    if (!TEST_FILE_RE.test(file)) continue;
    const content = readText(file);
    if (content === null || !AXE_MARKERS.some((m) => content.includes(m))) continue;
    for (const [, clause, spec] of content.matchAll(IMPORT_RE)) {
      const target = resolveSpecifier(spec, file, aliasRoot);
      if (!target) continue;
      if (!isBarrel(target)) { covered.add(target); continue; }
      for (const member of resolveThroughBarrel(target, namedBindings(clause), aliasRoot)) {
        covered.add(member);
      }
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
  // Tests are scanned from the component roots AND the test roots (default: all of
  // src/), so an axe test that imports a component from anywhere counts.
  const testScanRoots = new Set([...roots, ...getTestRoots()].map((r) => path.join(PROJECT_ROOT, r)));
  const allFiles = [];
  for (const r of testScanRoots) walk(r, allFiles);
  const covered = collectCoveredFiles([...new Set(allFiles)]);
  return componentFiles
    .filter((f) => !covered.has(path.resolve(f)))
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
  collectCoveredFiles,
  resolveSpecifier,
  namedBindings,
  getTestRoots,
  collectComponentFiles,
  computeUncovered,
  buildPayload,
  parseArgs,
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
