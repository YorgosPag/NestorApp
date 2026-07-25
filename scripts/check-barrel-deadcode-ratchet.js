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
 * CLI:
 *   node scripts/check-barrel-deadcode-ratchet.js                    # ratchet check
 *   node scripts/check-barrel-deadcode-ratchet.js --report           # human list
 *   node scripts/check-barrel-deadcode-ratchet.js --write-baseline
 *   node scripts/check-barrel-deadcode-ratchet.js --explain useFoo
 *   node scripts/check-barrel-deadcode-ratchet.js --scope src/services --report
 *   node scripts/check-barrel-deadcode-ratchet.js --root <dir>       # analyse another tree
 *
 * Exit codes: 0 = no new dead exports (or report/baseline/explain) · 1 = new
 * dead exports beyond baseline, or a usage error.
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

const PROJECT_ROOT = toPosix(path.resolve(__dirname, '..'));
const DEFAULT_BASELINE = path.join(PROJECT_ROOT, '.barrel-deadcode-baseline.json');
const DEFAULT_SCOPE = 'src/subapps/dxf-viewer';

const OPTIONS_WITH_VALUE = new Set(['--scope', '--root', '--baseline', '--explain', '--json', '--limit']);

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

function runCheck(analysis, options) {
  const baseline = loadBaseline(options.baseline);
  if (!baseline || baseline.__invalid) {
    console.error(`❌ CHECK 3.30 — baseline ${baseline ? baseline.__invalid : 'missing'}: ${path.relative(PROJECT_ROOT, options.baseline)}`);
    console.error(`   Seed it: node scripts/check-barrel-deadcode-ratchet.js --write-baseline`);
    return 1;
  }
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

module.exports = { parseCliArgs, analyse, buildPayload, PROJECT_ROOT, DEFAULT_SCOPE };
