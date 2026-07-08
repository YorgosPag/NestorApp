#!/usr/bin/env node
/**
 * ADR-598 ΦΑΣΗ 1 — ESLint Warning Ratchet (generic engine)
 *
 * ONE parameterized engine for every "additive ESLint rule" gate in the ADR-598
 * roadmap (G4 jsx-a11y, G7 complexity, G8 security). The ADR §5 originally
 * sketched three separate scripts (check-jsx-a11y-ratchet.js, …). They would be
 * structural clones — same read-baseline → run-eslint → diff → block shape — and
 * would trip our OWN jscpd clone gate (CHECK 3.28 / N.18). So this is a single
 * engine selected by `--gate <name>`; adding a gate = one entry in GATES + a
 * standalone flat config under eslint/gates/, never a copy of this file.
 *
 * Each gate runs ESLint with its own standalone config (`-c <gate.config>`) and
 * counts ONLY that gate's rules via the ruleIds/rulePrefix filter (ESLint 9's
 * --config is additive with the repo's eslint.config.mjs, so the count is scoped
 * by the filter, not by CLI isolation). Rules are `warn`; the gate blocks on a
 * RISE vs baseline, never on a single warning (mirrors the jscpd/deadcode ratchets).
 *
 * Heavy (full-repo ESLint) → CI + opt-in local only, never pre-commit (N.17
 * layer-split principle). The baseline is committed; the ratchet locks from run
 * #1 and may only decrease.
 *
 * CLI:
 *   node scripts/check-eslint-ratchet.js --gate complexity              # smoke
 *   node scripts/check-eslint-ratchet.js --gate complexity --check      # full scan + compare
 *   node scripts/check-eslint-ratchet.js --gate complexity --write-baseline
 *
 * Env:
 *   ESLINT_RATCHET_BASELINE_FILE=...  — redirect baseline (used by the Jest suite).
 *   ESLINT_RATCHET_SCAN_ROOT=...      — override scan root (default: src).
 *
 * Exit codes:
 *   0 — no blocking regression (or smoke OK)
 *   1 — baseline missing/invalid, gate's plugin not installed, ESLint failed,
 *       or the tracked warning count rose above baseline.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Gate registry — the ONLY per-gate knowledge. Add a gate here + a config file.
//   config    : the gate's standalone flat config (run via --config).
//   ruleIds   : exact rule ids whose warnings this gate counts (core-rule gates).
//   rulePrefix: alternatively, count every rule id under this namespace — used by
//               plugin gates whose recommended set is large & versioned. NB: the
//               ESLint run ALSO emits the repo's main-config rules, because
//               ESLint 9's --config is *additive* with the discovered
//               eslint.config.mjs (--no-config-lookup does not suppress it once
//               --config is given). So it is this ruleIds/rulePrefix filter — not
//               CLI isolation — that scopes the count to the gate's own rules.
//   needs     : node_modules dir(s) that must exist (plugin deps). [] = core only.
// ---------------------------------------------------------------------------
const GATES = {
  complexity: {
    adr: 'ADR-598 G7',
    config: 'eslint/gates/complexity.mjs',
    ruleIds: ['complexity', 'max-depth', 'max-params'],
    needs: [],
    baseline: '.eslint-complexity-baseline.json',
  },
  'jsx-a11y': {
    adr: 'ADR-598 G4',
    config: 'eslint/gates/jsx-a11y.mjs',
    ruleIds: null,
    rulePrefix: 'jsx-a11y/', // count every jsx-a11y rule (recommended set is versioned)
    needs: ['eslint-plugin-jsx-a11y'],
    baseline: '.eslint-jsx-a11y-baseline.json',
  },
  security: {
    adr: 'ADR-598 G8',
    config: 'eslint/gates/security.mjs',
    ruleIds: null,
    rulePrefix: 'security/',
    needs: ['eslint-plugin-security'],
    baseline: '.eslint-security-baseline.json',
  },
};

function getGate(name) {
  const gate = GATES[name];
  if (!gate) {
    const known = Object.keys(GATES).join(', ');
    throw new Error(`Unknown --gate "${name}". Known gates: ${known}`);
  }
  return gate;
}

function getBaselineFile(gate) {
  return process.env.ESLINT_RATCHET_BASELINE_FILE
    ? path.resolve(process.env.ESLINT_RATCHET_BASELINE_FILE)
    : path.join(PROJECT_ROOT, gate.baseline);
}

function getScanRoot() {
  return process.env.ESLINT_RATCHET_SCAN_ROOT || 'src';
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

function printHelp() {
  console.log(`ADR-598 ΦΑΣΗ 1 — ESLint Warning Ratchet (generic)

Usage:
  node scripts/check-eslint-ratchet.js --gate <name>                  # smoke
  node scripts/check-eslint-ratchet.js --gate <name> --check          # full scan + compare
  node scripts/check-eslint-ratchet.js --gate <name> --write-baseline # lock current count

Gates: ${Object.keys(GATES).join(', ')}
Scan root: ${getScanRoot()}
`);
}

// A gate's plugin deps must be installed before it can run. Fail closed with a
// clear message rather than letting ESLint throw a cryptic import error.
function assertGateInstalled(gate) {
  for (const dep of gate.needs) {
    if (!fs.existsSync(path.join(PROJECT_ROOT, 'node_modules', dep))) {
      throw new Error(
        `${gate.adr}: "${dep}" is not installed. Add it as a pinned devDependency and run pnpm install first.`
      );
    }
  }
}

// Run ESLint with ONLY the gate's standalone config over the scan root. Returns
// the parsed JSON array of file results. Uses --no-config-lookup so the repo's
// main eslint.config.mjs is ignored and the count is this gate's rules alone.
function runEslint(gate, scanRoot) {
  const args = [
    'eslint',
    scanRoot,
    '--no-config-lookup',
    '--config', gate.config,
    '--format', 'json',
  ];
  const result = spawnSync('npx', args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
  // ESLint exits 1 when it finds warnings-as-problems too, so exit code is not a
  // reliable failure signal. Trust the JSON: parseable stdout = success.
  const stdout = (result.stdout || '').trim();
  if (!stdout) {
    const detail = (result.stderr || '').toString().slice(0, 800);
    throw new Error(`ESLint produced no JSON output. ${detail}`);
  }
  try {
    return JSON.parse(stdout);
  } catch (e) {
    const detail = (result.stderr || '').toString().slice(0, 800);
    throw new Error(`Could not parse ESLint JSON: ${e.message}. ${detail}`);
  }
}

// Reduce ESLint's per-file results into { total, perRule, files }. Only messages
// whose ruleId is in gate.ruleIds are counted (null = count them all). Parse
// errors (ruleId === null) are surfaced as an error — a broken gate config must
// not silently count as "0 warnings".
function summarize(gate, results) {
  const perRule = {};
  let total = 0;
  let filesWith = 0;
  const fatalFiles = [];
  for (const file of results) {
    let inFile = 0;
    for (const m of file.messages || []) {
      if (m.fatal || (m.ruleId === null && m.severity === 2)) {
        fatalFiles.push(`${path.relative(PROJECT_ROOT, file.filePath)}:${m.line || '?'} — ${m.message}`);
        continue;
      }
      if (m.ruleId === null) continue;
      if (gate.ruleIds && !gate.ruleIds.includes(m.ruleId)) continue;
      if (gate.rulePrefix && !m.ruleId.startsWith(gate.rulePrefix)) continue;
      perRule[m.ruleId] = (perRule[m.ruleId] || 0) + 1;
      total++;
      inFile++;
    }
    if (inFile > 0) filesWith++;
  }
  // Parse errors in individual files are a fact of a large shared tree (another
  // agent's WIP, experimental scaffolding excluded from the build). A complexity
  // gate measures *parseable* code, so a handful of them must NOT abort the whole
  // run — they contribute 0 warnings and are reported for visibility. But if a
  // LARGE fraction fails, the gate config itself is broken (e.g. the TS parser is
  // not wired) and a "0 warnings" result would be a false pass → fail closed.
  const scanned = results.length;
  const FATAL_RATIO_ABORT = 0.25;
  if (fatalFiles.length > 0 && scanned > 0 && fatalFiles.length / scanned > FATAL_RATIO_ABORT) {
    const list = fatalFiles.slice(0, 10).map((f) => `\n   • ${f}`).join('');
    throw new Error(
      `ESLint failed to parse ${fatalFiles.length}/${scanned} files (>${FATAL_RATIO_ABORT * 100}%) — ` +
      `the gate config is almost certainly broken (parser not wired?); refusing to trust the count:${list}`
    );
  }
  return { total, perRule, files: filesWith, parseErrors: fatalFiles };
}

function loadBaseline(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (typeof parsed.total !== 'number') return { __invalid: 'missing numeric field "total"' };
    return parsed;
  } catch (e) {
    return { __invalid: `invalid JSON: ${e.message}` };
  }
}

function writeBaseline(gateName, gate, counts, filePath) {
  const payload = {
    description:
      `ADR-598 ΦΑΣΗ 1 — ESLint warning ratchet baseline for gate "${gateName}" (${gate.adr}). ` +
      `Tracks the total ESLint warning count over ${getScanRoot()}/ for this gate's rules. ` +
      `Ratchet down only: a rise blocks the PR. Refresh via the gate's :baseline script after a legitimate cleanup.`,
    generatedBy: `scripts/check-eslint-ratchet.js --gate ${gateName} --write-baseline`,
    adr: gate.adr,
    gate: gateName,
    config: gate.config,
    total: counts.total,
    files: counts.files,
    parseErrors: (counts.parseErrors || []).length,
    perRule: counts.perRule,
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n');
  console.log(`✅ Wrote baseline: ${path.relative(PROJECT_ROOT, filePath)}`);
  console.log(`   gate:  ${gateName} (${gate.adr})`);
  console.log(`   total: ${counts.total} warning(s) across ${counts.files} file(s)`);
  for (const [rule, n] of Object.entries(counts.perRule)) console.log(`     ${rule}: ${n}`);
  if ((counts.parseErrors || []).length > 0) {
    console.log(`   ⓘ ${counts.parseErrors.length} file(s) skipped (unparseable — WIP/experimental, not counted):`);
    for (const f of counts.parseErrors.slice(0, 10)) console.log(`     • ${f}`);
  }
}

function measure(gate) {
  assertGateInstalled(gate);
  return summarize(gate, runEslint(gate, getScanRoot()));
}

function runCheck(gateName, gate) {
  const baselineFile = getBaselineFile(gate);
  const baseline = loadBaseline(baselineFile);
  if (!baseline || baseline.__invalid) {
    console.error(`❌ ${gate.adr} — baseline ${baseline ? baseline.__invalid : 'missing'}: ${path.relative(PROJECT_ROOT, baselineFile)}`);
    console.error(`   Seed it: node scripts/check-eslint-ratchet.js --gate ${gateName} --write-baseline`);
    process.exit(1);
  }

  const t0 = Date.now();
  const current = measure(gate);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  if (current.total <= baseline.total) {
    const cleaned = baseline.total - current.total;
    const trend = cleaned > 0 ? ` (−${cleaned} vs baseline — refresh baseline to lock progress)` : '';
    console.log(`✅ ${gate.adr} OK — ${gateName} warnings:${current.total}/${baseline.total}${trend} (${elapsed}s)`);
    process.exit(0);
  }

  console.error(`❌ ${gate.adr} FAIL — "${gateName}" ESLint warnings rose above baseline: ${baseline.total} → ${current.total} (+${current.total - baseline.total})`);
  console.error(``);
  console.error(`Per-rule now vs baseline:`);
  const rules = new Set([...Object.keys(current.perRule), ...Object.keys(baseline.perRule || {})]);
  for (const r of rules) {
    const c = current.perRule[r] || 0;
    const b = (baseline.perRule || {})[r] || 0;
    const flag = c > b ? '  ⬆' : '';
    console.error(`   ${r}: ${b} → ${c}${flag}`);
  }
  console.error(``);
  console.error(`Fix the new warnings (npx eslint <files> --no-config-lookup -c ${gate.config}),`);
  console.error(`or, if this is accepted debt, refresh the baseline via the gate's :baseline script.`);
  process.exit(1);
}

function runSmoke(gateName, gate) {
  const baselineFile = getBaselineFile(gate);
  const baseline = loadBaseline(baselineFile);
  if (!baseline || baseline.__invalid) {
    console.error(`❌ ${gate.adr} — baseline ${baseline ? baseline.__invalid : 'missing'}: ${path.relative(PROJECT_ROOT, baselineFile)}`);
    process.exit(1);
  }
  console.log(`✅ ${gate.adr} smoke — ${gateName} baseline OK (total:${baseline.total}). Full scan runs in CI / --check.`);
  process.exit(0);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.gate) { printHelp(); process.exit(args.gate ? 0 : (args.help ? 0 : 1)); }
  const gate = getGate(args.gate);
  if (args.writeBaseline) {
    writeBaseline(args.gate, gate, measure(gate), getBaselineFile(gate));
    process.exit(0);
  }
  if (args.check) { runCheck(args.gate, gate); return; }
  runSmoke(args.gate, gate);
}

// Exported for the Jest suite (scripts/__tests__/check-eslint-ratchet.test.js).
module.exports = {
  GATES,
  getGate,
  parseArgs,
  summarize,
  loadBaseline,
  writeBaseline,
  assertGateInstalled,
  getBaselineFile,
  getScanRoot,
  runEslint,
  measure,
  runCheck,
  runSmoke,
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
