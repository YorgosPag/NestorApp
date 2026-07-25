#!/usr/bin/env node
/**
 * CHECK 3.30 — Barrel-aware dead-export ratchet (ADR-364 §10.9).
 *
 * WHY THIS EXISTS (measured, ADR-364 §10.7.1): of 4 hand-verified dead symbols
 * in the DXF viewer, knip 6.6.2 found 1 — and still 1 with
 * `--include-entry-exports`. Not a misconfiguration: `knip.json:14` declares
 * `src/**\/index.ts` an entry point, so a barrel is public API and everything it
 * re-exports is "used" by construction. Barrel-only exports are invisible to it
 * BY DESIGN.
 *
 * The question this gate asks instead:
 *   «ποιος εισάγει αυτό το σύμβολο ΕΚΤΟΣ από barrel;»
 * A barrel forwards; it does not consume. Zero non-barrel importers ⇒ dead.
 *
 * NOT a type-check (N.17): `ts.createSourceFile` parses, it does not build a
 * Program and never runs diagnostics.
 *
 * WHERE IT RUNS — CI, not the commit hot path (ADR-364 §10.9.1):
 *   --check builds two reachability fixpoints over ~13k files (~30s). That is a
 *   Layer 2 (CI) cost, exactly like CHECK 3.29 (ADR-663). Worse, the ratchet has
 *   a KNOWN false-positive class in its blocking direction: a brand-new file that
 *   is correct but not wired up yet (the ADR-684 `generic-solid` case) is
 *   indistinguishable from a new orphan. Google's bar for a commit-blocking
 *   analysis is "never stop the build for correct code" — this gate does not meet
 *   it, and must not block a commit. It meets the review-tier bar (<10% effective
 *   false positives: 12/12 hand-checked, 10/10 negative control) so it fails CI,
 *   where a human reads it. The hook only runs --smoke.
 *
 * CLI:
 *   node scripts/check-barrel-deadcode-ratchet.js                    # ratchet check
 *   node scripts/check-barrel-deadcode-ratchet.js --smoke            # baseline present + sane (~ms, hook)
 *   node scripts/check-barrel-deadcode-ratchet.js --triage           # dead vs UNFINISHED (ADR-364 §10.9.2)
 *   node scripts/check-barrel-deadcode-ratchet.js --report           # human list
 *   node scripts/check-barrel-deadcode-ratchet.js --write-baseline
 *   node scripts/check-barrel-deadcode-ratchet.js --explain useFoo
 *   node scripts/check-barrel-deadcode-ratchet.js --scope src/services --report
 *   node scripts/check-barrel-deadcode-ratchet.js --root <dir>       # analyse another tree
 *
 * Exit codes: 0 = no new dead exports (or report/baseline/explain/smoke) · 1 =
 * new dead exports beyond baseline, unreadable baseline, or a usage error.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { readTsPathAliases, toPosix } = require('./lib/module-graph/resolve-specifier');
const { buildGraph, computeLiveness, collectAllImporters, usageKey } = require('./lib/module-graph/build-graph');
const { classifyExports, BUCKETS } = require('./lib/module-graph/classify-exports');
const { collectSourceFiles, isEntryFile } = require('./lib/module-graph/scan-config');
const { TEST_PATTERN } = require('./lib/module-graph/parse-module');
const { loadBaseline, writeBaselineFile, compareSets } = require('./lib/ratchet-baseline');
const { readAddHistory, readAdrStatus, triage } = require('./lib/deadcode-triage');

const PROJECT_ROOT = toPosix(path.resolve(__dirname, '..'));
const DEFAULT_BASELINE = path.join(PROJECT_ROOT, '.barrel-deadcode-baseline.json');
const DEFAULT_SCOPE = 'src/subapps/dxf-viewer';
const ADR_DIR = path.join(PROJECT_ROOT, 'docs/centralized-systems/reference/adrs');

const OPTIONS_WITH_VALUE = new Set(['--scope', '--root', '--baseline', '--explain', '--json', '--limit']);

/**
 * Fields the baseline MUST carry for a comparison to mean anything. Without them
 * a truncated file still parses as JSON, `baseline.deadExports || []` reads as an
 * empty set, and every one of the 1.625 known entries is reported as "new" — a
 * corrupt baseline would look like a catastrophic regression instead of a corrupt
 * baseline. Shared by --smoke and --check so both fail the same way (N.18).
 */
const REQUIRED_BASELINE_KEYS = ['deadExportCount', 'deadFileCount'];

function parseCliArgs(argv) {
  const out = { scopes: [], root: PROJECT_ROOT, baseline: DEFAULT_BASELINE, limit: 60, mode: 'check' };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    const value = OPTIONS_WITH_VALUE.has(arg) ? rest[i += 1] : undefined;
    if (OPTIONS_WITH_VALUE.has(arg) && value === undefined) throw new Error(`${arg} needs a value`);
    if (arg === '--scope') out.scopes.push(value.replace(/\\/g, '/').replace(/\/$/, ''));
    else if (arg === '--root') out.root = toPosix(path.resolve(value));
    else if (arg === '--baseline') out.baseline = path.resolve(value);
    else if (arg === '--json') out.json = path.resolve(value);
    else if (arg === '--limit') out.limit = Number(value);
    else if (arg === '--explain') { out.mode = 'explain'; out.symbol = value; }
    else if (arg === '--report') out.mode = 'report';
    else if (arg === '--write-baseline') out.mode = 'write-baseline';
    else if (arg === '--check') out.mode = 'check';
    else if (arg === '--smoke') out.mode = 'smoke';
    else if (arg === '--triage') out.mode = 'triage';
    else if (arg === '--help' || arg === '-h') out.mode = 'help';
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (out.scopes.length === 0) out.scopes.push(DEFAULT_SCOPE);
  return out;
}

function analyse(options) {
  const root = options.root;
  const aliases = readTsPathAliases(root).length ? readTsPathAliases(root) : readTsPathAliases(PROJECT_ROOT);
  const files = collectSourceFiles(root);
  const parseErrors = [];

  const graph = buildGraph({
    projectRoot: root,
    aliases,
    files,
    readFile: f => fs.readFileSync(f, 'utf8'),
    onParseError: (file, error) => parseErrors.push({ file, message: error.message }),
  });

  const relOf = abs => toPosix(path.relative(root, abs));
  const isEntry = abs => isEntryFile(relOf(abs));
  // Two fixpoints. Their difference IS the "test-only" bucket — no heuristic.
  const live = computeLiveness(graph, { isEntry });
  const test = computeLiveness(graph, { isEntry, withTests: true });
  const allImporters = collectAllImporters(graph);

  const inScope = abs => {
    const rel = relOf(abs);
    return !TEST_PATTERN.test(rel) && options.scopes.some(s => rel === s || rel.startsWith(`${s}/`));
  };

  return {
    graph, live, test, allImporters, relOf, parseErrors, files,
    result: classifyExports(graph, live, test, { inScope }),
  };
}

const idOf = (relOf, entry) => `${relOf(entry.file)}#${entry.name}`;

function printSummary({ result, relOf, parseErrors, files, options }) {
  console.log(`\n📐 CHECK 3.30 — barrel-aware dead exports (ADR-364 §10.9)`);
  console.log(`   scope: ${options.scopes.join(', ')}   parsed: ${files.length} files`);
  console.log(`   scanned in scope: ${result.scanned} modules`);
  console.log(`   ☠️  dead        ${result.dead.length}   (nothing imports it, name unseen anywhere else)`);
  console.log(`   🔒 unusedExport ${result.unusedExport.length}   (used inside its own file — drop the \`export\`, keep the code)`);
  console.log(`   ❓ suspect     ${result.suspect.length}   (no importer, but the name still appears in real code)`);
  console.log(`   🧪 testOnly  ${result.testOnly.length}   (only tests import it — NOT ratcheted)`);
  console.log(`   ✅ live      ${result.live.length}`);
  console.log(`   📄 dead files ${result.deadFiles.length}`);
  if (parseErrors.length) console.log(`   ⚠️  unparsed (treated as live): ${parseErrors.length}`);
  void relOf;
}

function printList(title, entries, relOf, limit) {
  if (entries.length === 0) return;
  console.log(`\n${title}`);
  entries.slice(0, limit).forEach(e => console.log(`  ${relOf(e.file)}:${e.line}  ${e.name}`));
  if (entries.length > limit) console.log(`  … +${entries.length - limit} more (raise --limit)`);
}

function runReport(analysis, options) {
  const { result, relOf } = analysis;
  printSummary({ ...analysis, options });
  printList('☠️  DEAD (zero importers outside barrels, name unseen elsewhere)', result.dead, relOf, options.limit);
  printList('🔒 UNUSED EXPORT (alive inside its file — un-export, do not delete)', result.unusedExport, relOf, options.limit);
  printList('❓ SUSPECT (verify by hand before touching)', result.suspect, relOf, options.limit);
  printList('🧪 TEST-ONLY', result.testOnly, relOf, options.limit);
  if (result.deadFiles.length) {
    console.log(`\n📄 DEAD FILES (every declared export dead, no side-effect import)`);
    result.deadFiles.slice(0, options.limit).forEach(f => console.log(`  ${relOf(f)}`));
    if (result.deadFiles.length > options.limit) {
      console.log(`  … +${result.deadFiles.length - options.limit} more (raise --limit)`);
    }
  }
  console.log(`\n⚠️  A listing is EVIDENCE, not a licence to delete. One file at a time, with proof.`);
  return 0;
}

function explainOccurrences(analysis, mod, exp) {
  const { graph, live, relOf } = analysis;
  const token = exp.localName || exp.name;
  const rec = graph.identifierOwners.get(token);
  if (!rec) return '  name occurs in real code: nowhere but its own file';
  if (rec.overflow) return `  name occurs in real code: widely (>${require('./lib/module-graph/build-graph').OWNER_SAMPLE} modules)`;
  const others = rec.files.filter(f => f !== mod.file);
  if (others.length === 0) return '  name occurs in real code: nowhere but its own file';
  return `  name occurs in real code:\n${others
    .map(f => `       ${relOf(f)}   ${live.liveModules.has(f) ? '(LIVE module)' : '(unreachable module — no evidence of life)'}`)
    .join('\n')}`;
}

function explainOne(analysis, mod, exp) {
  const { live, test, allImporters, relOf, result } = analysis;
  const key = usageKey(mod.file, exp.name);
  const bucket = BUCKETS.find(b => result[b].some(e => e.file === mod.file && e.name === exp.name)) || 'out-of-scope';
  console.log(`\n${relOf(mod.file)}:${exp.line}  ${exp.name}   → ${bucket}`);
  console.log(`  module reachable from a root: ${live.liveModules.has(mod.file) ? 'yes' : 'NO'}`);
  console.log(`  reachable by name: ${live.liveSymbols.has(key) ? 'yes' : 'no'}   via tests: ${test.liveSymbols.has(key) ? 'yes' : 'no'}`);
  const importers = allImporters.get(key) || [];
  console.log(importers.length === 0
    ? '  importers (anywhere, reachable or not): none'
    : `  importers (anywhere, reachable or not):\n${importers
        .map(f => `       ${relOf(f)}   ${live.liveModules.has(f) ? '(LIVE)' : '(itself unreachable)'}`).join('\n')}`);
  if (live.opaque.has(mod.file)) console.log('  module is an entry point or namespace-imported → forced live');
  console.log(`  used inside its own file: ${exp.localUses > 1 ? `yes (${exp.localUses - 1}×)` : 'no'}`);
  console.log(explainOccurrences(analysis, mod, exp));
}

function runExplain(analysis, options) {
  const target = options.symbol;
  let found = 0;
  for (const mod of analysis.graph.modules.values()) {
    for (const exp of mod.exports) {
      if (exp.origin !== 'local') continue;
      if (exp.name !== target && exp.localName !== target) continue;
      found += 1;
      explainOne(analysis, mod, exp);
    }
  }
  if (found === 0) console.log(`No module-level export named "${target}" in the analysed tree.`);
  return 0;
}

function buildPayload(analysis, options) {
  const { result, relOf } = analysis;
  return {
    generated: new Date().toISOString(),
    adr: 'ADR-364 §10.9 (CHECK 3.30)',
    scopes: options.scopes,
    note: 'Evidence list. Deletion requires manual proof per file — see ADR-364 §10.7.',
    deadExportCount: result.dead.length,
    deadExports: result.dead.map(e => idOf(relOf, e)),
    deadFileCount: result.deadFiles.length,
    deadFiles: result.deadFiles.map(relOf),
    unusedExportCount: result.unusedExport.length,
    suspectCount: result.suspect.length,
    testOnlyCount: result.testOnly.length,
  };
}

function runWriteBaseline(analysis, options) {
  const payload = buildPayload(analysis, options);
  writeBaselineFile(options.baseline, payload);
  console.log(`✅ Wrote ${path.relative(PROJECT_ROOT, options.baseline)} — ${payload.deadExportCount} dead exports / ${payload.deadFileCount} dead files.`);
  return 0;
}

function reportRegression(label, added, hint) {
  console.error(`\n❌ CHECK 3.30 FAIL — ${added.length} new dead ${label}:\n`);
  added.slice(0, 40).forEach(id => console.error(`  ${id}`));
  if (added.length > 40) console.error(`  … +${added.length - 40} more`);
  console.error(`\n${hint}`);
}

/** Fail-closed baseline read shared by --smoke and --check. null ⇒ already reported. */
function readBaseline(options) {
  const baseline = loadBaseline(options.baseline, REQUIRED_BASELINE_KEYS);
  if (baseline && !baseline.__invalid) return baseline;
  console.error(`❌ CHECK 3.30 — baseline ${baseline ? baseline.__invalid : 'missing'}: ${path.relative(PROJECT_ROOT, options.baseline)}`);
  console.error(`   Seed it: npm run barrel-deadcode:baseline`);
  return null;
}

/**
 * Layer 1 (pre-commit): assert the baseline is present and structurally sane.
 * Deliberately does NOT analyse — see the "WHERE IT RUNS" note at the top. This
 * catches the one failure mode that is genuinely local (a baseline deleted,
 * truncated or half-merged) in milliseconds; CI owns the real comparison.
 */
function runSmoke(_analysis, options) {
  const baseline = readBaseline(options);
  if (!baseline) return 1;
  console.log(
    `✅ CHECK 3.30 smoke — baseline OK (${baseline.deadExportCount} dead exports / ` +
      `${baseline.deadFileCount} dead files). Full scan runs in CI — local: npm run barrel-deadcode:check`,
  );
  return 0;
}

/**
 * Provenance triage (ADR-364 §10.9.2). Answers the question the reachability
 * graph cannot: is a dead file DEAD, or merely NOT FINISHED YET? Reads the
 * frozen baseline + git birth commits + the referenced ADRs' own status lines.
 * No graph build — this is about history, not reachability.
 */
function runTriage(_analysis, options) {
  const baseline = readBaseline(options);
  if (!baseline) return 1;

  let history;
  try {
    history = readAddHistory({ root: PROJECT_ROOT, scope: options.scopes[0] });
  } catch (e) {
    console.error(`❌ CHECK 3.30 triage — ${e.message}`);
    return 1;
  }
  const statusCache = new Map();
  const statusOf = num => {
    if (!statusCache.has(num)) statusCache.set(num, readAdrStatus(ADR_DIR, num));
    return statusCache.get(num);
  };

  const t = triage(baseline.deadFiles || [], { history, statusOf });
  const pct = n => `${((n / t.total) * 100).toFixed(0)}%`.padStart(4);

  console.log(`\n📐 CHECK 3.30 — provenance triage of ${t.total} dead files (ADR-364 §10.9.2)`);
  console.log(`   baseline: ${path.relative(PROJECT_ROOT, options.baseline)}   scope: ${options.scopes.join(', ')}`);
  console.log(`\n   🔴 DO NOT TOUCH  ${String(t.notouch.length).padStart(4)} ${pct(t.notouch.length)}  born under a still-open ADR — unfinished, not dead`);
  console.log(`   🟡 NEEDS A LOOK  ${String(t.look.length).padStart(4)} ${pct(t.look.length)}  recent, or the ADR status could not be read`);
  console.log(`   🟢 LEGACY        ${String(t.legacy.length).padStart(4)} ${pct(t.legacy.length)}  old + closed/pre-ADR — start looking HERE`);
  console.log(`\n   why:`);
  t.reasons.slice(0, 12).forEach(r => console.log(`     ${String(r.count).padStart(4)}  ${r.reason}`));

  if (options.json) {
    writeBaselineFile(options.json, { generated: new Date().toISOString(), adr: 'ADR-364 §10.9.2', ...t });
    console.log(`\n📝 JSON written: ${options.json}`);
  }
  console.log(`\n⚠️  A bucket is NOT a licence. 🟢 means "look here first", never "delete these".`);
  console.log(`   Per-file protocol: ADR-364 §10.7. Incident 2026-04-24 is why.`);
  return 0;
}

function runCheck(analysis, options) {
  const baseline = readBaseline(options);
  if (!baseline) return 1;
  const { result, relOf } = analysis;
  const exports = compareSets(result.dead.map(e => idOf(relOf, e)), baseline.deadExports || []);
  const deadFiles = compareSets(result.deadFiles.map(relOf), baseline.deadFiles || []);

  if (exports.added.length === 0 && deadFiles.added.length === 0) {
    const cleaned = exports.removed.length + deadFiles.removed.length;
    console.log(cleaned > 0
      ? `✅ CHECK 3.30 OK — ${cleaned} entr(ies) cleaned vs baseline (${exports.baselineCount} exports / ${deadFiles.baselineCount} files). Lock it in: npm run barrel-deadcode:baseline`
      : `✅ CHECK 3.30 OK — no new barrel-only dead exports (baseline: ${exports.baselineCount} exports / ${deadFiles.baselineCount} files)`);
    return 0;
  }
  if (exports.added.length) {
    reportRegression('export(s)', exports.added,
      'Fix: import it from real code, delete it, or — if it is genuinely reachable in a way\n' +
      'this gate cannot see — run --explain <symbol> and say so in the ADR before rebaselining.');
  }
  if (deadFiles.added.length) reportRegression('file(s)', deadFiles.added, 'Fix: wire it up or delete it.');
  return 1;
}

function printHelp() {
  console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n/, ''));
}

function main() {
  let options;
  try {
    options = parseCliArgs(process.argv);
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }
  if (options.mode === 'help') { printHelp(); process.exit(0); }

  // Neither smoke nor triage needs the graph: smoke reads a file, triage reads
  // history. Both would otherwise pay ~30s for an answer they never consult.
  if (options.mode === 'smoke') process.exit(runSmoke(null, options));
  if (options.mode === 'triage') process.exit(runTriage(null, options));

  const started = Date.now();
  const analysis = analyse(options);
  const runners = { report: runReport, explain: runExplain, 'write-baseline': runWriteBaseline, check: runCheck };
  const code = runners[options.mode](analysis, options);

  if (options.json) {
    writeBaselineFile(options.json, buildPayload(analysis, options));
    console.log(`📝 JSON written: ${options.json}`);
  }
  if (options.mode !== 'explain') console.log(`⏱  ${((Date.now() - started) / 1000).toFixed(1)}s`);
  process.exit(code);
}

if (require.main === module) main();

module.exports = {
  parseCliArgs,
  analyse,
  buildPayload,
  readBaseline,
  runSmoke,
  PROJECT_ROOT,
  DEFAULT_SCOPE,
  REQUIRED_BASELINE_KEYS,
};
