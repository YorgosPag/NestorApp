#!/usr/bin/env node
/**
 * CHECK 3.29 — DXF Viewer TypeScript Error Ratchet — ADR-663
 *
 * Closes a structural blind spot: the root `tsconfig.json` EXCLUDES
 * `src/subapps/dxf-viewer/**`, so neither `npm run typecheck` nor any pre-commit
 * check ever type-checks the subapp. Type errors there are invisible to every
 * automated gate — they accumulate silently until someone runs the subapp's own
 * project by hand. This ratchet makes that count visible and monotonically
 * decreasing.
 *
 * Two layers, mirroring CHECK 3.28 (jscpd) / CHECK 3.22 (deadcode):
 *
 *   --full   (CI + opt-in local, Layer 2)  Run `tsc --noEmit` over the subapp's
 *            OWN project (src/subapps/dxf-viewer/tsconfig.json), count errors
 *            per file, compare against .dxf-tsc-baseline.json. A file that rose
 *            above its baseline — or a file with errors that is not in the
 *            baseline at all — BLOCKS. Authoritative gate.
 *
 *   (smoke)  Default with no flag. Verifies the baseline file exists + is valid
 *            JSON. This is what the pre-commit hook runs.
 *
 * WHY THE HOOK DOES NOT RUN --full: a full type-check of this project takes
 * 60-90s on Giorgio's machine (CLAUDE.md N.17). Paying that on every commit is
 * exactly the cost N.17 exists to avoid. The hook only asserts the baseline is
 * present and parseable; CI owns the real gate.
 *
 * PER-FILE, NOT JUST A TOTAL: unlike the jscpd ratchet (one global count), this
 * baseline is a per-file map, mirroring `.i18n-violations-baseline.json`. A
 * total-only ratchet lets a brand-new broken file in as long as someone else
 * fixed more errors elsewhere in the same PR. Per-file gives the house rule —
 * "new file with violations → BLOCK (zero tolerance)" — for free.
 *
 * SCOPE — tests are ratcheted too. The subapp's test files carry their own error
 * count; tracking them here costs nothing and stops them rotting. The summary
 * reports the source/test split because source errors are what ADR-663 §4 is
 * burning down.
 *
 * CLI:
 *   node scripts/check-dxf-tsc-ratchet.js                  # smoke
 *   node scripts/check-dxf-tsc-ratchet.js --full           # type-check + compare
 *   node scripts/check-dxf-tsc-ratchet.js --write-baseline # lock current counts
 *
 * Env:
 *   DXF_TSC_FULL=1            — force --full behavior even without the flag.
 *   DXF_TSC_BASELINE_FILE=... — redirect baseline (used by the Jest suite).
 *   DXF_TSC_PROJECT=...       — override the tsconfig project path.
 *
 * Exit codes:
 *   0 — no blocking violations (or smoke-mode OK)
 *   1 — baseline missing / invalid, tsc failed to run, or errors rose.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_BASELINE_FILE = path.join(PROJECT_ROOT, '.dxf-tsc-baseline.json');
const DEFAULT_PROJECT = 'src/subapps/dxf-viewer/tsconfig.json';

/** `tsc` needs a raised heap for this project — it OOMs at the default 4GB. */
const TSC_HEAP_MB = 8192;

/** A file whose errors do not count toward the source total (still ratcheted). */
const TEST_FILE_RE = /(__tests__|\.test\.|\.spec\.)/;

/** `path/to/file.ts(12,34): error TS2345: ...` — the only shape tsc emits per error. */
const TSC_ERROR_RE = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):/;

function getBaselineFile() {
  return process.env.DXF_TSC_BASELINE_FILE
    ? path.resolve(process.env.DXF_TSC_BASELINE_FILE)
    : DEFAULT_BASELINE_FILE;
}

function getProject() {
  return process.env.DXF_TSC_PROJECT || DEFAULT_PROJECT;
}

function parseArgs(argv) {
  const out = { full: false, writeBaseline: false, help: false };
  for (const a of argv.slice(2)) {
    if (a === '--full') out.full = true;
    else if (a === '--write-baseline') out.writeBaseline = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (process.env.DXF_TSC_FULL === '1') out.full = true;
  return out;
}

function printHelp() {
  console.log(`CHECK 3.29 — DXF Viewer TypeScript Error Ratchet (ADR-663)

Usage:
  node scripts/check-dxf-tsc-ratchet.js                  # smoke (baseline presence)
  node scripts/check-dxf-tsc-ratchet.js --full           # type-check + compare
  node scripts/check-dxf-tsc-ratchet.js --write-baseline # lock current counts
  DXF_TSC_FULL=1 node scripts/check-dxf-tsc-ratchet.js

Baseline file: ${path.relative(PROJECT_ROOT, getBaselineFile())}
Project:       ${getProject()}
`);
}

/** Normalise a tsc-reported path to a repo-relative POSIX path (baseline keys). */
function normalizeFile(file) {
  let p = String(file).trim().replace(/\\/g, '/');
  const root = PROJECT_ROOT.replace(/\\/g, '/') + '/';
  if (p.startsWith(root)) p = p.slice(root.length);
  return p;
}

function isTestFile(file) {
  return TEST_FILE_RE.test(file);
}

/**
 * Run `tsc --noEmit` and return its raw stdout.
 *
 * tsc exits non-zero WHEN IT FINDS ERRORS, which is the normal case here — so the
 * exit code cannot distinguish "type errors" from "tsc could not run". Absence of
 * parseable output combined with a non-zero exit is what we treat as failure.
 */
function runTsc(project = getProject()) {
  const result = spawnSync('npx', ['tsc', '--noEmit', '-p', project], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    env: { ...process.env, NODE_OPTIONS: `--max-old-space-size=${TSC_HEAP_MB}` },
  });
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  // No diagnostics AND a failure exit ⇒ tsc itself broke (bad project path, OOM,
  // missing binary). Fail closed rather than reporting a triumphant zero errors.
  if (!TSC_ERROR_RE.test(stdout) && result.status !== 0) {
    const detail = (stderr || stdout || `exit ${result.status}`).toString().slice(0, 800);
    throw new Error(`tsc could not run over ${project}: ${detail}`);
  }
  return stdout;
}

/** Parse tsc output → per-file error counts + source/test totals. */
function parseErrors(stdout) {
  const byFile = {};
  let total = 0;
  for (const line of String(stdout).split(/\r?\n/)) {
    const m = TSC_ERROR_RE.exec(line);
    if (!m) continue; // continuation lines of a multi-line diagnostic
    const file = normalizeFile(m[1]);
    byFile[file] = (byFile[file] || 0) + 1;
    total += 1;
  }
  let sourceErrors = 0;
  let testErrors = 0;
  for (const [file, count] of Object.entries(byFile)) {
    if (isTestFile(file)) testErrors += count;
    else sourceErrors += count;
  }
  // Sorted keys keep the baseline diff readable when it is regenerated.
  const sorted = {};
  for (const k of Object.keys(byFile).sort()) sorted[k] = byFile[k];
  return { totalErrors: total, sourceErrors, testErrors, byFile: sorted };
}

function loadBaseline(filePath = getBaselineFile()) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (typeof parsed.totalErrors !== 'number') {
      return { __invalid: 'missing numeric field "totalErrors"' };
    }
    if (!parsed.byFile || typeof parsed.byFile !== 'object') {
      return { __invalid: 'missing object field "byFile"' };
    }
    return parsed;
  } catch (e) {
    return { __invalid: `invalid JSON: ${e.message}` };
  }
}

function writeBaseline(counts, filePath = getBaselineFile()) {
  const payload = {
    description:
      'CHECK 3.29 — DXF Viewer TypeScript error ratchet baseline (ADR-663). The root tsconfig EXCLUDES src/subapps/dxf-viewer, so these errors are invisible to `npm run typecheck`. Per-file counts ratchet DOWN only: a file rising above its entry — or any file with errors absent from the map — blocks the PR. Refresh via `npm run dxf:tsc:baseline` after a legitimate burn-down.',
    generatedAt: new Date().toISOString(),
    generatedBy: 'scripts/check-dxf-tsc-ratchet.js --write-baseline',
    adr: 'ADR-663',
    check: 'CHECK 3.29',
    project: getProject(),
    totalErrors: counts.totalErrors,
    sourceErrors: counts.sourceErrors,
    testErrors: counts.testErrors,
    byFile: counts.byFile,
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n');
  console.log(`✅ Wrote baseline: ${path.relative(PROJECT_ROOT, filePath)}`);
  console.log(`   totalErrors:  ${counts.totalErrors}`);
  console.log(`   sourceErrors: ${counts.sourceErrors}`);
  console.log(`   testErrors:   ${counts.testErrors}`);
  console.log(`   files:        ${Object.keys(counts.byFile).length}`);
}

/**
 * Per-file comparison. Returns the files that rose (`regressions`) and the ones
 * that improved (`cleaned`, informational — used to nudge a baseline refresh).
 */
function compare(baseline, current) {
  const regressions = [];
  const cleaned = [];
  const base = baseline.byFile || {};
  for (const [file, count] of Object.entries(current.byFile)) {
    const was = base[file] || 0;
    if (count > was) {
      regressions.push({ file, baseline: was, current: count, delta: count - was, isNew: !(file in base) });
    }
  }
  for (const [file, was] of Object.entries(base)) {
    const now = current.byFile[file] || 0;
    if (now < was) cleaned.push({ file, baseline: was, current: now, delta: was - now });
  }
  return { regressions, cleaned };
}

function runFull() {
  const baselineFile = getBaselineFile();
  const baseline = loadBaseline(baselineFile);
  if (!baseline || baseline.__invalid) {
    console.error(
      `❌ CHECK 3.29 — baseline ${baseline ? baseline.__invalid : 'missing'}: ${path.relative(PROJECT_ROOT, baselineFile)}`,
    );
    console.error(`   Run: npm run dxf:tsc:baseline`);
    process.exit(1);
  }

  const t0 = Date.now();
  let current;
  try {
    current = parseErrors(runTsc());
  } catch (e) {
    console.error(`❌ CHECK 3.29 — ${e.message}`);
    process.exit(1);
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const { regressions, cleaned } = compare(baseline, current);
  if (regressions.length === 0) {
    const fixed = baseline.totalErrors - current.totalErrors;
    const trend =
      fixed > 0
        ? ` (−${fixed} vs baseline across ${cleaned.length} file(s) — run dxf:tsc:baseline to lock progress)`
        : '';
    console.log(
      `✅ CHECK 3.29 OK — errors:${current.totalErrors}/${baseline.totalErrors}` +
        ` (source:${current.sourceErrors} test:${current.testErrors})${trend} (${elapsed}s)`,
    );
    process.exit(0);
  }

  console.error(`❌ CHECK 3.29 FAIL — TypeScript errors rose in ${regressions.length} file(s):`);
  for (const r of regressions.slice(0, 20)) {
    const tag = r.isNew ? ' [NEW FILE — zero tolerance]' : '';
    console.error(`   ${r.file}: ${r.baseline} → ${r.current} (+${r.delta})${tag}`);
  }
  if (regressions.length > 20) console.error(`   … and ${regressions.length - 20} more.`);
  console.error(``);
  console.error(`Reproduce locally:`);
  console.error(`  npm run dxf:tsc:check`);
  console.error(`  (raw: NODE_OPTIONS="--max-old-space-size=${TSC_HEAP_MB}" npx tsc --noEmit -p ${getProject()})`);
  console.error(``);
  console.error(`Fix the types — do NOT reach for \`any\` / \`as any\` / \`@ts-ignore\` (CLAUDE.md).`);
  console.error(`If a rise is genuinely intentional debt, refresh: npm run dxf:tsc:baseline`);
  process.exit(1);
}

function runSmoke() {
  const baselineFile = getBaselineFile();
  const baseline = loadBaseline(baselineFile);
  if (!baseline || baseline.__invalid) {
    console.error(
      `❌ CHECK 3.29 — baseline ${baseline ? baseline.__invalid : 'missing'}: ${path.relative(PROJECT_ROOT, baselineFile)}`,
    );
    console.error(`   Run: npm run dxf:tsc:baseline`);
    process.exit(1);
  }
  console.log(
    `✅ CHECK 3.29 smoke — baseline OK (errors:${baseline.totalErrors}, source:${baseline.sourceErrors}).` +
      ` Full type-check runs in CI / DXF_TSC_FULL=1.`,
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
    writeBaseline(parseErrors(runTsc()));
    process.exit(0);
  }
  if (args.full) {
    runFull();
    return;
  }
  runSmoke();
}

// Exported for the Jest suite (scripts/__tests__/check-dxf-tsc-ratchet.test.js).
module.exports = {
  parseArgs,
  parseErrors,
  normalizeFile,
  isTestFile,
  loadBaseline,
  writeBaseline,
  compare,
  getBaselineFile,
  getProject,
  runTsc,
  runFull,
  runSmoke,
  printHelp,
  main,
  TSC_ERROR_RE,
  TSC_HEAP_MB,
  DEFAULT_BASELINE_FILE,
  DEFAULT_PROJECT,
};

if (require.main === module) {
  main();
}
