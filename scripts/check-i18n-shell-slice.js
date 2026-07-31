#!/usr/bin/env node
'use strict';
/**
 * CHECK 3.34 — i18n shell-slice freshness gate (ADR-744)
 *
 * THE QUESTION NOTHING ASKED BEFORE
 * ---------------------------------
 * `src/i18n/config.ts` carried a hand-written list of synchronously-loaded
 * namespaces, and `lazy-config.ts` carried a second hand-written list of 72
 * "critical" ones. The two drifted apart by 63 entries and every CHECK stayed
 * green, because no gate compared either list against the code that actually
 * renders. This gate asks exactly that, and nothing else: **is the synchronous
 * bootstrap still what the shell needs?**
 *
 * NOT A RATCHET — deliberately, and for the same reason as CHECK 3.33
 * -------------------------------------------------------------------
 * Freshness is binary. If you ever find yourself writing
 * `.i18n-shell-slice-baseline.json`, you have taken a wrong turn: a "tolerated
 * number of stale keys" is a tolerated number of raw keys on the user's screen.
 *
 * TWO LAYERS, AND AN HONEST STATEMENT OF WHERE THE CHEAP ONE STOPS
 * ---------------------------------------------------------------
 * Layer 1 (this script, default) is what a pre-commit hook can afford. It never
 * builds the module graph — that costs ~19s for 13.877 modules — and instead
 * leans on the manifest the generator already wrote:
 *
 *   A. artifact integrity   the slice on disk is the bytes the manifest records
 *                           ⇒ catches a hand-edited generated file
 *   B. locale drift         re-prune the RECORDED key set out of the CURRENT
 *                           locale files and compare ⇒ EXACT, not an
 *                           approximation, because the key set is the
 *                           generator's own output
 *   C. shell surface drift  re-fingerprint every staged file that the manifest
 *                           lists as a shell module ⇒ catches a changed t()
 *                           call AND a changed import edge, which is the only
 *                           way a new module can enter the closure
 *   D. resolution drift     a newly added file that would satisfy a specifier
 *                           the generator recorded as unresolved
 *
 * What Layer 1 CANNOT see: a re-export chain rewritten OUTSIDE any shell module
 * (barrel B forwards X; X's declaration moves from C to D). No shell file's
 * bytes change, yet the closure does. That is real, it is rare, and it is why
 * Layer 2 exists — `--full` rebuilds the graph and regenerates from scratch,
 * run in CI on every PR (.github/workflows/i18n-governance.yml). Stating the
 * gap is the point; a gate that implies coverage it does not have is worse than
 * one that does not exist.
 *
 * CLI:
 *   node scripts/check-i18n-shell-slice.js [staged files…]   # Layer 1
 *   node scripts/check-i18n-shell-slice.js --full            # Layer 2 (CI)
 *   node scripts/check-i18n-shell-slice.js --help
 *
 * Env:
 *   SKIP_I18N_SHELL_SLICE=1   — bypass (justify to Giorgio).
 *
 * Exit: 0 fresh · 1 stale, hand-edited, missing, or unclassified dynamic key.
 */

const fs = require('node:fs');
const path = require('node:path');

const { bootstrap } = require('./lib/i18n-shell-slice/cli');
const {
  analyseFile,
  buildModuleGraph,
  buildShellPlan,
  renderArtifacts,
  hydrateWants,
  makeNamespaceReader,
  manifestPath,
} = require('./lib/i18n-shell-slice/plan');
const { buildSlices, stableStringify, sha256, fingerprintShellFile } = require('./lib/i18n-shell-slice/slice-build');
const { loadNamespaceBundles } = require('./lib/i18n-namespace-extract');
const { loadKeyConstants } = require('./lib/i18n-shell-slice/key-extract');
const { parseModule } = require('./lib/module-graph/parse-module');
const { readTsPathAliases, resolveSpecifier, toPosix } = require('./lib/module-graph/resolve-specifier');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const REGENERATE = 'npm run generate:i18n-shell-slice';
const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const DIM = '\x1b[2m';
const NC = '\x1b[0m';

/**
 * CRLF/BOM/trailing-blank differences are checkout artefacts, not staleness.
 * `core.autocrlf=true` with no `.gitattributes` means the working-tree copy of a
 * generated file carries CRLF while the generator writes LF; comparing raw bytes
 * would make this gate permanently red on every Windows machine (ADR-727 trap #2).
 */
function normalize(text) {
  return text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\s*$/, '\n');
}

function readManifest(config) {
  const file = path.join(PROJECT_ROOT, manifestPath(config));
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function fail(reason, remedy = REGENERATE) {
  console.error(`${RED}❌ CHECK 3.34 FAIL — ${reason}${NC}`);
  console.error('');
  console.error('Remediation:');
  console.error(`  1) Regenerate: ${remedy}`);
  console.error('  2) Stage the result: git add src/i18n/generated/');
  console.error('  3) Never hand-edit those files — they are machine output (ADR-744).');
  console.error('');
  console.error('Emergency skip (justify to Giorgio): SKIP_I18N_SHELL_SLICE=1 git commit ...');
  process.exit(1);
}

// ─── Layer 1 ─────────────────────────────────────────────────────────────────

/**
 * A. the generated bytes are the bytes the manifest signed.
 *
 * The manifest records sha256 of the LF text the generator wrote, and
 * `stableStringify` output is already normalized, so hashing the normalized
 * working-tree copy is an apples-to-apples comparison on any platform.
 */
function checkArtifactIntegrity(manifest) {
  for (const [relPath, expected] of Object.entries(manifest.artifacts)) {
    const file = path.join(PROJECT_ROOT, relPath);
    if (!fs.existsSync(file)) return `${relPath} is missing.`;
    if (sha256(normalize(fs.readFileSync(file, 'utf8'))) !== expected) {
      return `${relPath} does not match the sha256 recorded in the manifest — it was hand-edited or half-regenerated.`;
    }
  }
  return null;
}

/** B. the recorded key set, re-pruned out of the locales that are on disk right now. */
function checkLocaleDrift(config, manifest) {
  const slices = buildSlices({
    wants: hydrateWants(manifest.wants),
    languages: manifest.languages,
    readNamespace: makeNamespaceReader(PROJECT_ROOT, config),
  });
  for (const language of manifest.languages) {
    const relPath = toPosix(path.join(config.outputDir, `shell-slice.${language}.json`));
    const expected = stableStringify(slices.resources[language] || {});
    const file = path.join(PROJECT_ROOT, relPath);
    if (!fs.existsSync(file)) return `${relPath} is missing.`;
    if (normalize(expected) !== normalize(fs.readFileSync(file, 'utf8'))) {
      return `${relPath} no longer matches the locale files — a translation the shell ships was edited without regenerating.`;
    }
  }
  return null;
}

/** C. a staged shell module whose i18n surface or import edges moved. */
function checkStagedShellFiles(config, manifest, stagedFiles) {
  const context = {
    bundles: loadNamespaceBundles(PROJECT_ROOT),
    keyConstants: loadKeyConstants(PROJECT_ROOT, config.keyConstants),
    excludeConsumers: config.excludeConsumers,
  };
  const graph = { modules: new Map(), projectRoot: PROJECT_ROOT };

  for (const relFile of stagedFiles) {
    const recorded = manifest.shellFiles[relFile];
    if (recorded === undefined) continue;
    const abs = toPosix(path.join(PROJECT_ROOT, relFile));
    if (!fs.existsSync(abs)) return `${relFile} is a shell module in the manifest but no longer exists.`;
    try {
      graph.modules.set(abs, parseModule(abs, fs.readFileSync(abs, 'utf8')));
    } catch {
      return `${relFile} could not be parsed; the shell slice cannot be judged.`;
    }
    const analysis = analyseFile(PROJECT_ROOT, relFile, graph, context);
    if (fingerprintShellFile(analysis) !== recorded) {
      return `${relFile} is a shell module and its i18n surface or its imports changed — the slice may no longer cover it.`;
    }
  }
  return null;
}

/** D. a new file that makes a previously-unresolved specifier resolve. */
function checkNewlyResolvableSpecs(manifest, stagedFiles) {
  if (manifest.unresolvedSpecs.length === 0 || stagedFiles.length === 0) return null;
  const added = new Set(stagedFiles.map(f => toPosix(path.join(PROJECT_ROOT, f))));
  const aliases = readTsPathAliases(PROJECT_ROOT);
  for (const entry of manifest.unresolvedSpecs) {
    const [fromRel, spec] = entry.split(' → ');
    if (!spec) continue;
    const resolved = resolveSpecifier(spec, toPosix(path.join(PROJECT_ROOT, fromRel)), {
      projectRoot: PROJECT_ROOT, aliases, fileSet: added,
    });
    if (resolved.kind === 'internal') {
      return `a new file now satisfies '${spec}' (from ${fromRel}), which the shell walk had recorded as unresolved — the closure may have grown.`;
    }
  }
  return null;
}

function runLayerOne(config, stagedFiles) {
  const manifest = readManifest(config);
  if (manifest === null) {
    fail(`${manifestPath(config)} is missing or unreadable — the shell slice has never been generated.`);
    return;
  }
  const reason =
    checkArtifactIntegrity(manifest) ||
    checkLocaleDrift(config, manifest) ||
    checkStagedShellFiles(config, manifest, stagedFiles) ||
    checkNewlyResolvableSpecs(manifest, stagedFiles);

  if (reason) fail(reason);
  console.log(
    `${GREEN}  ✅ CHECK 3.34 OK — shell slice matches ${Object.keys(manifest.wants).length} namespace(s) / ` +
    `${manifest.stats.matchedKeys} keys ${DIM}(${manifest.stats.sliceBytes} bytes, ${manifest.stats.shellFiles} shell modules)${NC}`
  );
}

// ─── Layer 2 ─────────────────────────────────────────────────────────────────

function runFull(config) {
  const plan = buildShellPlan(PROJECT_ROOT, config, buildModuleGraph(PROJECT_ROOT));
  if (plan.violations.length > 0) {
    const first = plan.violations[0];
    fail(
      `${plan.violations.length} unresolved dynamic t() call(s) in shell modules, ` +
      `starting at ${first.file}:${first.line} — ${first.snippet}`,
      'classify them in .i18n-shell-slice.json → dynamicKeyPolicy',
    );
    return;
  }

  const rendered = renderArtifacts(PROJECT_ROOT, config, plan);
  for (const [relPath, text] of rendered.artifacts) {
    const file = path.join(PROJECT_ROOT, relPath);
    const actual = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (actual === null) fail(`${relPath} is missing.`);
    if (normalize(actual) !== normalize(text)) {
      fail(`${relPath} is not what the generator produces from the current code.`);
    }
  }
  const manifestFile = path.join(PROJECT_ROOT, manifestPath(config));
  const actualManifest = fs.existsSync(manifestFile) ? fs.readFileSync(manifestFile, 'utf8') : null;
  if (actualManifest === null || normalize(actualManifest) !== normalize(rendered.manifestText)) {
    fail(`${manifestPath(config)} is out of date with the shell closure.`);
  }

  console.log(
    `${GREEN}✅ CHECK 3.34 OK (full) — ${rendered.manifest.stats.shellFiles} shell modules, ` +
    `${rendered.manifest.namespaces.length} namespaces, ${rendered.manifest.stats.sliceBytes} bytes${NC}`
  );
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { full: false, help: false, files: [] };
  for (const arg of argv.slice(2)) {
    if (arg === '--full') out.full = true;
    else if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg.startsWith('--')) throw new Error(`Unknown argument: ${arg}`);
    else out.files.push(arg.replace(/\\/g, '/'));
  }
  return out;
}

function printHelp() {
  console.log(`CHECK 3.34 — i18n shell-slice freshness gate (ADR-744)

Usage:
  node scripts/check-i18n-shell-slice.js [staged files…]   Layer 1 (pre-commit, no module graph)
  node scripts/check-i18n-shell-slice.js --full            Layer 2 (CI, rebuilds and regenerates)

Zero tolerance, no baseline file. Fix a failure with: ${REGENERATE}
Skip (justify to Giorgio): SKIP_I18N_SHELL_SLICE=1
`);
}

function main() {
  if (process.env.SKIP_I18N_SHELL_SLICE === '1') {
    console.log(`${DIM}  ⏭  CHECK 3.34 skipped (SKIP_I18N_SHELL_SLICE=1)${NC}`);
    process.exit(0);
    return;
  }
  const started = bootstrap({
    argv: process.argv,
    parseArgs,
    printHelp,
    projectRoot: PROJECT_ROOT,
    reportError: (message, phase) => {
      if (phase === 'config') fail(message, 'fix .i18n-shell-slice.json');
      else console.error(`${RED}❌ CHECK 3.34 — ${message}${NC}`);
    },
    exit: code => process.exit(code),
  });
  if (started === null) return;
  const { args, config } = started;

  if (args.full) runFull(config);
  else runLayerOne(config, args.files);
  process.exit(0);
}

module.exports = {
  normalize,
  readManifest,
  checkArtifactIntegrity,
  checkLocaleDrift,
  checkStagedShellFiles,
  checkNewlyResolvableSpecs,
  runLayerOne,
  runFull,
  parseArgs,
  printHelp,
  main,
  PROJECT_ROOT,
};

if (require.main === module) main();
