#!/usr/bin/env node
/**
 * CHECK 3.28 — Token-based Copy/Paste Clone Ratchet (jscpd) — ADR-583
 *
 * Closes the blind spot in CHECK 3.18 (SSoT Discover). That scanner is
 * name/regex-based, so it cannot see a *structural* clone that carries a
 * different name (e.g. `clipHatch` copy-pasted as `clipHatchByPoly`). jscpd
 * is a token-based detector: it matches duplicated token sequences regardless
 * of identifier names, and even within a single staged diff.
 *
 * Two layers, mirroring CHECK 3.18 / CHECK 3.22 (deadcode):
 *
 *   --diff   (pre-commit, Layer 1)  Scan ONLY the staged src files. Any clone
 *            found among them is a same-commit sibling clone (the classic
 *            "centralize A, then write B+C as parallel twins") → BLOCK.
 *            Zero-tolerance on new intra-diff clones. Fast (a handful of files).
 *
 *   --full   (CI + opt-in local, Layer 2)  Scan all of src/, read the total
 *            clone count from the JSON report, compare against
 *            .jscpd-baseline.json. Total rose above baseline → BLOCK.
 *            Ratchet-down only: duplication may only decrease. Authoritative
 *            gate; also catches a new file cloning already-committed code,
 *            which a staged-only scan cannot see.
 *
 *   (smoke)  Default with no flag. Verifies the baseline file exists + is valid
 *            JSON. Keeps the local hook fast when --full is not requested.
 *
 * Config SSoT: .jscpdrc.json (minTokens, formats, ignore globs). This script,
 * the npm scripts, and the CI workflow all defer to it — do NOT hardcode a
 * second threshold here.
 *
 * CLI:
 *   node scripts/check-jscpd-ratchet.js                       # smoke
 *   node scripts/check-jscpd-ratchet.js --full                # full scan + compare
 *   node scripts/check-jscpd-ratchet.js --diff <file> [...]   # staged-diff gate
 *   node scripts/check-jscpd-ratchet.js --write-baseline      # lock current total
 *
 * Env:
 *   JSCPD_FULL=1              — force --full behavior even without the flag.
 *   JSCPD_BASELINE_FILE=...   — redirect baseline (used by the Jest suite).
 *   JSCPD_SCAN_ROOT=...       — override the full-scan root (default: src).
 *
 * Exit codes:
 *   0 — no blocking violations (or smoke-mode OK)
 *   1 — baseline missing / invalid, or the tracked metric rose above baseline,
 *       or a new intra-diff clone was detected.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_BASELINE_FILE = path.join(PROJECT_ROOT, '.jscpd-baseline.json');
const CONFIG_FILE = path.join(PROJECT_ROOT, '.jscpdrc.json');

// Only the total clone count is ratcheted. duplicatedLines / percentage are
// stored for human context but never gate (they move with unrelated churn).
const TRACKED_METRICS = ['clones'];

function getBaselineFile() {
  return process.env.JSCPD_BASELINE_FILE
    ? path.resolve(process.env.JSCPD_BASELINE_FILE)
    : DEFAULT_BASELINE_FILE;
}

function getScanRoot() {
  return process.env.JSCPD_SCAN_ROOT || 'src';
}

function parseArgs(argv) {
  const out = { full: false, diff: false, writeBaseline: false, help: false, files: [] };
  for (const a of argv.slice(2)) {
    if (a === '--full') out.full = true;
    else if (a === '--diff') out.diff = true;
    else if (a === '--write-baseline') out.writeBaseline = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else if (a.startsWith('--')) throw new Error(`Unknown argument: ${a}`);
    else out.files.push(a);
  }
  if (process.env.JSCPD_FULL === '1') out.full = true;
  return out;
}

function printHelp() {
  console.log(`CHECK 3.28 — jscpd Clone Ratchet (ADR-583)

Usage:
  node scripts/check-jscpd-ratchet.js                       # smoke (baseline presence)
  node scripts/check-jscpd-ratchet.js --full                # full src/ scan + compare
  node scripts/check-jscpd-ratchet.js --diff <file> [...]   # staged-diff clone gate
  node scripts/check-jscpd-ratchet.js --write-baseline      # lock current total
  JSCPD_FULL=1 node scripts/check-jscpd-ratchet.js

Baseline file: ${path.relative(PROJECT_ROOT, getBaselineFile())}
Config (SSoT): ${path.relative(PROJECT_ROOT, CONFIG_FILE)}
`);
}

// Spawn jscpd over `paths`, return the parsed JSON report object. Writes the
// report to a throwaway temp dir so we never pollute the repo. Runs via `npx`
// with shell:true for cross-platform bin resolution (mirrors check-deadcode).
function runScanner(paths, opts = {}) {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jscpd-run-'));
  const args = [
    'jscpd',
    ...paths,
    '--config', CONFIG_FILE,
    '--reporters', 'json',
    '--output', outputDir,
    '--silent',
  ];
  // Passing individual files as positional args makes jscpd blank the report
  // `name` field; --absolute repopulates it (so the diff gate can name the
  // offending pair). It does not change the clone COUNT, only the labels.
  if (opts.absolute) args.push('--absolute');
  const result = spawnSync('npx', args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
  // jscpd exits non-zero only on internal error, not on "clones found"
  // (thresholds are handled by us via the baseline). A missing report = failure.
  const reportPath = path.join(outputDir, 'jscpd-report.json');
  if (!fs.existsSync(reportPath)) {
    const detail = (result.stderr || result.stdout || '').toString().slice(0, 500);
    fs.rmSync(outputDir, { recursive: true, force: true });
    throw new Error(`jscpd produced no report. ${detail}`);
  }
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  fs.rmSync(outputDir, { recursive: true, force: true });
  return report;
}

// Turn a jscpd `--absolute` name (possibly with the Windows \\?\ long-path
// prefix) into a clean repo-relative path for the block message.
function normalizeName(name) {
  if (!name) return '(unknown)';
  let p = String(name).replace(/^\\\\\?\\/, '').replace(/\\/g, '/');
  const root = PROJECT_ROOT.replace(/\\/g, '/') + '/';
  if (p.startsWith(root)) p = p.slice(root.length);
  return p;
}

function parseSummary(report) {
  const total = report && report.statistics && report.statistics.total;
  if (!total || typeof total.clones !== 'number') {
    throw new Error('Could not read statistics.total.clones from jscpd report');
  }
  return {
    clones: total.clones,
    duplicatedLines: total.duplicatedLines ?? 0,
    percentage: total.percentage ?? 0,
    sources: total.sources ?? 0,
  };
}

function loadBaseline(filePath = getBaselineFile()) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

function writeBaseline(counts, filePath = getBaselineFile()) {
  const payload = {
    description:
      'CHECK 3.28 — jscpd Clone Ratchet baseline (ADR-583). Tracks the total token-based clone count over src/. Ratchet down only: a rise blocks the commit/PR. Refresh via `npm run jscpd:baseline` after legitimate de-duplication.',
    generatedAt: new Date().toISOString(),
    generatedBy: 'scripts/check-jscpd-ratchet.js --write-baseline',
    adr: 'ADR-583',
    check: 'CHECK 3.28',
    clones: counts.clones,
    duplicatedLines: counts.duplicatedLines,
    percentage: Number(counts.percentage.toFixed ? counts.percentage.toFixed(4) : counts.percentage),
    sources: counts.sources,
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n');
  console.log(`✅ Wrote baseline: ${path.relative(PROJECT_ROOT, filePath)}`);
  console.log(`   clones:          ${counts.clones}`);
  console.log(`   duplicatedLines: ${counts.duplicatedLines} (${payload.percentage}%)`);
  console.log(`   (informational)  sources=${counts.sources}`);
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
  const baselineFile = getBaselineFile();
  const baseline = loadBaseline(baselineFile);
  if (!baseline || baseline.__invalid) {
    console.error(`❌ CHECK 3.28 — baseline ${baseline ? baseline.__invalid : 'missing'}: ${path.relative(PROJECT_ROOT, baselineFile)}`);
    console.error(`   Run: npm run jscpd:baseline`);
    process.exit(1);
  }

  const t0 = Date.now();
  const current = parseSummary(runScanner([getScanRoot()]));
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const raises = compare(baseline, current);
  if (raises.length === 0) {
    const cleaned = baseline.clones - current.clones;
    const trend = cleaned > 0 ? ` (−${cleaned} vs baseline — run jscpd:baseline to lock progress)` : '';
    console.log(`✅ CHECK 3.28 OK — clones:${current.clones}/${baseline.clones}${trend} (${elapsed}s)`);
    process.exit(0);
  }

  console.error(`❌ CHECK 3.28 FAIL — token-based clones rose above baseline:`);
  for (const r of raises) {
    console.error(`   ${r.metric}: ${r.baseline} → ${r.current} (+${r.delta})`);
  }
  console.error(``);
  console.error(`Remediation:`);
  console.error(`  1) Extract the duplicated block into the existing SSoT module and import it.`);
  console.error(`  2) Diagnose exactly where: npm run jscpd:scan   (writes an HTML/JSON report)`);
  console.error(`  3) If the rise is intentional debt, refresh the baseline: npm run jscpd:baseline`);
  process.exit(1);
}

// Pre-commit Layer 1: scan only the staged files. Because the scan set IS the
// diff, every clone jscpd reports is a same-commit clone → block, listing pairs.
function runDiff(files) {
  const scanFiles = files.filter((f) => fs.existsSync(path.join(PROJECT_ROOT, f)));
  if (scanFiles.length === 0) {
    console.log('✅ CHECK 3.28 (diff) — no staged src files to scan.');
    process.exit(0);
  }

  let report;
  try {
    report = runScanner(scanFiles, { absolute: true });
  } catch (e) {
    // A tooling failure must not silently pass. Report and fail closed.
    console.error(`❌ CHECK 3.28 (diff) — jscpd failed: ${e.message}`);
    process.exit(1);
  }

  const dups = report.duplicates || [];
  if (dups.length === 0) {
    console.log(`✅ CHECK 3.28 (diff) — no new clones in ${scanFiles.length} staged file(s).`);
    process.exit(0);
  }

  console.error(`❌ CHECK 3.28 (diff) FAIL — ${dups.length} new clone(s) inside this commit:`);
  for (const d of dups.slice(0, 15)) {
    const a = `${normalizeName(d.firstFile.name)}:${d.firstFile.start}-${d.firstFile.end}`;
    const b = `${normalizeName(d.secondFile.name)}:${d.secondFile.start}-${d.secondFile.end}`;
    console.error(`   • ${d.lines} lines / ${d.tokens} tokens`);
    console.error(`       ${a}`);
    console.error(`       ${b}`);
  }
  if (dups.length > 15) console.error(`   … and ${dups.length - 15} more.`);
  console.error(``);
  console.error(`These files duplicate each other. Extract the shared logic into ONE`);
  console.error(`module and import it from both — do not ship parallel twins.`);
  console.error(`Emergency skip (justify to Giorgio): SKIP_JSCPD_DIFF=1 git commit ...`);
  process.exit(1);
}

function runSmoke() {
  const baselineFile = getBaselineFile();
  const baseline = loadBaseline(baselineFile);
  if (!baseline || baseline.__invalid) {
    console.error(`❌ CHECK 3.28 — baseline ${baseline ? baseline.__invalid : 'missing'}: ${path.relative(PROJECT_ROOT, baselineFile)}`);
    console.error(`   Run: npm run jscpd:baseline`);
    process.exit(1);
  }
  console.log(`✅ CHECK 3.28 smoke — baseline OK (clones:${baseline.clones}). Full scan runs in CI / JSCPD_FULL=1.`);
  process.exit(0);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }
  if (args.writeBaseline) {
    writeBaseline(parseSummary(runScanner([getScanRoot()])));
    process.exit(0);
  }
  if (args.diff) { runDiff(args.files); return; }
  if (args.full) { runFull(); return; }
  runSmoke();
}

// Exported for the Jest suite (scripts/__tests__/check-jscpd-ratchet.test.js).
module.exports = {
  parseArgs,
  parseSummary,
  normalizeName,
  loadBaseline,
  writeBaseline,
  compare,
  getBaselineFile,
  getScanRoot,
  runScanner,
  runFull,
  runDiff,
  runSmoke,
  printHelp,
  main,
  TRACKED_METRICS,
  DEFAULT_BASELINE_FILE,
  CONFIG_FILE,
};

if (require.main === module) {
  main();
}
