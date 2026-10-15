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
 *                           the generator recorded as unresolved — in the
 *                           shell, any declared route OR lazy closure (§28, §31)
 *   E. global inputs        config · constants · aliases · bundles · toolchain (§30)
 *   F. lazy-route map       ADR-744 §31 — when a `src` module is staged, REBUILD
 *                           the lazy-route map with an on-demand graph over the
 *                           index + a content-addressed local cache, and compare
 *                           with the committed artifact (lazy-freshness.js).
 *                           Red only when the OUTPUT changes. Otherwise the
 *                           graph-free judgement (`judgeLazyArtifact`) runs.
 *
 * What Layer 1 used to be blind to, and how each closed (ADR-744 §31):
 *   · a re-export rewritten in a barrel the walk READS but that is not a member
 *     → `manifest.consultedFiles` for the shell/route walks (63 barrels); the
 *       lazy walks' barrels (234 outside every table, measured) → check F
 *   · `import {A}` → `{A, B}` under an unchanged `kind + spec` fingerprint
 *     → the fingerprint is now `walkSurface(mod)` (names, exports, re-exports)
 *   · anything inside the 8.329-file lazy closures → check F
 * Layer 2 still exists — `--full` rebuilds the eager graph and regenerates from
 * scratch, in CI on every PR (.github/workflows/i18n-shell-slice.yml). Stating
 * what is covered is the point; a gate that implies coverage it does not have
 * is worse than one that does not exist.
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
const { loadConfig } = require('./lib/i18n-shell-slice/config');
const { materializeIndex } = require('./lib/git-index-snapshot');
const {
  buildModuleGraph,
  buildShellPlan,
  renderArtifacts,
  manifestPath,
} = require('./lib/i18n-shell-slice/plan');
const RS = require('./lib/i18n-shell-slice/route-slices');
const { checkGlobalInputs, globalInputPaths } = require('./lib/i18n-shell-slice/global-inputs');
const { checkLazyRouteFreshness } = require('./lib/i18n-shell-slice/lazy-freshness');
const { createIndexSources, CACHE_REL } = require('./lib/i18n-shell-slice/source-cache');
// N.7.1 — οι έλεγχοι A–D ζουν στο δικό τους module· επανεξάγονται παρακάτω για τα tests.
const LayerOneChecks = require('./lib/i18n-shell-slice/layer-one-checks');
const {
  normalize,
  checkArtifactIntegrity,
  checkLedgerBudget,
  checkRouteLedger,
  checkShellCensus,
  checkLocaleDrift,
  checkRouteLocaleDrift,
  checkStagedShellFiles,
  checkNewlyResolvableSpecs,
} = LayerOneChecks;

const PROJECT_ROOT = path.resolve(__dirname, '..');
const REGENERATE = 'npm run generate:i18n-shell-slice';
const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const DIM = '\x1b[2m';
const NC = '\x1b[0m';

function readManifest(config, root = PROJECT_ROOT) {
  const file = path.join(root, manifestPath(config));
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


/**
 * @param {object} [lazySources] ADR-744 §31 — `{ sources, cacheDir }` για τον έλεγχο F· η πύλη `--index`
 *   δίνει την πηγή του ΕΥΡΕΤΗΡΙΟΥ, αλλιώς διαβάζεται ο δίσκος του `root`.
 */
function runLayerOne(config, stagedFiles, root = PROJECT_ROOT, lazySources = {}) {
  const manifest = readManifest(config, root);
  if (manifest === null) {
    fail(`${manifestPath(config)} is missing or unreadable — the shell slice has never been generated.`);
    return;
  }
  // F. ADR-744 §31 — ο χάρτης τεμπέλικων διαδρομών, ΞΑΝΑΧΤΙΣΜΕΝΟΣ όταν σταδιοποιείται module του `src`.
  const lazy = checkLazyRouteFreshness({ config, stagedFiles, root, ...lazySources });
  if (lazy.stats !== null) {
    const { parses, hits, ms, source } = lazy.stats;
    console.log(`${DIM}  ↻ CHECK 3.34 F — χάρτης τεμπέλικων διαδρομών ξαναχτίστηκε (${source}): ${parses} parses · ${hits} από μνήμη · ${ms} ms${NC}`);
  }
  // 🔴 ADR-744 §20 (Β2) — ΚΑΜΙΑ ΑΛΥΣΙΔΑ `||`, ΓΙΑ ΤΟΝ ΙΔΙΟ ΛΟΓΟ ΜΕ ΤΟΝ ΓΕΝΝΗΤΟΡΑ.
  // Το `a || b || c` σημαίνει «ο πρώτος που μιλά σκοτώνει τους υπόλοιπους»: όσο ένα
  // artifact ήταν χειρόγραφα πειραγμένο, **κανείς** δεν μάθαινε ποτέ ότι ταυτόχρονα
  // μια διαδρομή ήταν εκτός ταβανιού. Ο άνθρωπος διόρθωνε, ξανάτρεχε, έβρισκε το
  // επόμενο — ένα σφάλμα ανά κύκλο. Τώρα τρέχουν ΟΛΑ και αναφέρονται ΟΛΑ.
  const reasons = [
    checkArtifactIntegrity(manifest, root),
    checkLedgerBudget(config, manifest, root),
    checkRouteLedger(config, manifest, root),
    ...checkShellCensus(config, manifest, root),
    checkLocaleDrift(config, manifest, root),
    checkRouteLocaleDrift(config, manifest, root),
    checkStagedShellFiles(config, manifest, stagedFiles, root),
    checkNewlyResolvableSpecs(manifest, stagedFiles, root),
    // E. ADR-744 §30 — οι ΚΑΘΟΛΙΚΕΣ είσοδοι: config · σταθερές · aliases · bundles · toolchain.
    checkGlobalInputs(config, manifest, root),
    ...lazy.reasons,
  ].filter(reason => reason !== null && reason !== undefined);

  if (reasons.length > 0) {
    fail(reasons.length === 1 ? reasons[0] : `${reasons.length} ευρήματα:\n     · ${reasons.join('\n     · ')}`);
  }
  console.log(
    `${GREEN}  ✅ CHECK 3.34 OK — shell slice matches ${Object.keys(manifest.wants).length} namespace(s) / ` +
    `${manifest.stats.matchedKeys} keys ${DIM}(${manifest.stats.sliceBytes} bytes, ${manifest.stats.shellFiles} shell modules)${NC}`
  );
}

// ─── Layer 2 ─────────────────────────────────────────────────────────────────

function runFull(config) {
  // ⚠️ Ο γράφος ΚΡΑΤΙΕΤΑΙ. Ήταν inline και πεταγόταν, οπότε ο ελεγκτής δεν
  // μπορούσε να ρωτήσει τι παράγουν οι διαδρομές — κοστίζει ~20s και είναι
  // **ο ίδιος** που θα ξαναχτιζόταν (ADR-744 §15 Φ4).
  const graph = buildModuleGraph(PROJECT_ROOT);
  const plan = buildShellPlan(PROJECT_ROOT, config, graph);
  if (plan.violations.length > 0) {
    const first = plan.violations[0];
    fail(
      `${plan.violations.length} unresolved dynamic t() call(s) in shell modules, ` +
      `starting at ${first.file}:${first.line} — ${first.snippet}`,
      'classify them in .i18n-shell-slice.json → dynamicKeyPolicy',
    );
    return;
  }

  // 🔴 ADR-744 §15 Φ4 — Η ΑΝΑΠΑΡΑΓΩΓΗ ΠΡΕΠΕΙ ΝΑ ΕΙΝΑΙ **ΟΛΟΚΛΗΡΗ**.
  // Το `renderArtifacts` δίνει **2** artifacts· η πηγή παράγει **19**. Μέχρι τις
  // 2026-08-28 αυτός ο βρόχος συνέκρινε 2 και το manifest diff αποτύγχανε πάντα
  // (17 route entries + sliceBytes + inputsSha256) — πύλη δομικά αδύνατο να
  // περάσει, **8 ημέρες κόκκινη στο CI**. Ο ίδιος ιδιοκτήτης με τον γεννήτορα:
  // αντιγραφή εδώ θα ήταν το sibling clone του N.18 / CHECK 3.28.
  const complete = RS.renderComplete({ projectRoot: PROJECT_ROOT, config, plan, graph, rendered: renderArtifacts(PROJECT_ROOT, config, plan) });
  if (complete.refused.length > 0) {
    const first = complete.refused[0];
    fail(
      `${complete.refused.length} route slice(s) refuse to emit — unresolved dynamic t(), starting at ${first.url}`,
      'classify them in .i18n-shell-slice.json → dynamicKeyPolicy',
    );
    return;
  }
  const rendered = complete.rendered;
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
  const out = { full: false, help: false, index: false, files: [] };
  for (const arg of argv.slice(2)) {
    if (arg === '--full') out.full = true;
    else if (arg === '--index') out.index = true;
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
  node scripts/check-i18n-shell-slice.js --index [staged files…]   Layer 1 on the git INDEX (the hook)
  node scripts/check-i18n-shell-slice.js --full           Layer 2 (CI, rebuilds and regenerates)

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
  else if (args.index) runLayerOneOnIndex(config, args.files);
  else runLayerOne(config, args.files);
  process.exit(0);
}

/**
 * 🔴 **ΚΡΙΝΕ ΤΟ COMMIT, ΟΧΙ ΤΟΝ ΔΙΣΚΟ** (2026-09-27). Σε δέντρο με παράλληλους πράκτορες,
 * ξένες **αστάδιοποίητες** αλλαγές σε locale μπλόκαραν commit που δεν άγγιζε κανένα locale —
 * και αντίστροφα, ένα commit με μπαγιάτικο slice θα περνούσε αν τύχαινε ο δίσκος να είναι
 * φρέσκος. Εδώ ΚΑΘΕ είσοδος του Layer 1 (config · `src/i18n/**` · key constants · τα
 * σταδιοποιημένα modules) διαβάζεται από το **ευρετήριο**, υλοποιημένο σε προσωρινό φάκελο.
 * Ο `fail()` κάνει `process.exit` ⇒ ο καθαρισμός δένεται στο `exit`, όχι σε `finally`.
 */
function runLayerOneOnIndex(workingConfig, stagedFiles) {
  // 🔑 ADR-744 §30 — τα αρχεία των καθολικών εισόδων έρχονται από το ΜΗΤΡΩΟ, όχι από χειρόγραφη
  // λίστα εδώ (ήταν: config · tsconfig · keyConstants — χωρίς bundles, μητρώα, toolchain).
  const baseSpecs = [
    path.posix.dirname(workingConfig.localesDir),
    workingConfig.outputDir,
    ...stagedFiles,
  ];
  let specs = [...baseSpecs, ...globalInputPaths(PROJECT_ROOT, workingConfig, PROJECT_ROOT)];
  let snapshot = materializeIndex({ repoRoot: PROJECT_ROOT, pathspecs: specs });
  let config;
  try {
    config = loadConfig(snapshot.root);
    // Δεύτερο πέρασμα: το config του ΕΥΡΕΤΗΡΙΟΥ μπορεί να δηλώνει αρχείο που το config του δίσκου δεν ξέρει.
    const missing = globalInputPaths(snapshot.root, config, PROJECT_ROOT).filter(file => !specs.includes(file));
    if (missing.length > 0) {
      snapshot.dispose();
      specs = [...specs, ...missing];
      snapshot = materializeIndex({ repoRoot: PROJECT_ROOT, pathspecs: specs });
    }
  } catch (error) {
    snapshot.dispose();
    fail(error.message, 'fix .i18n-shell-slice.json');
    return;
  }
  process.on('exit', snapshot.dispose);
  // F κρίνει κι αυτό το ΕΥΡΕΤΗΡΙΟ: σύνολο αρχείων + κείμενα από το git, μνήμη στο repo (όχι στο στιγμιότυπο).
  runLayerOne(config, stagedFiles, snapshot.root, {
    sources: createIndexSources({ repoRoot: PROJECT_ROOT, root: snapshot.root }),
    cacheDir: path.join(PROJECT_ROOT, CACHE_REL),
  });
}

module.exports = {
  ...LayerOneChecks,
  readManifest,
  runLayerOne,
  runLayerOneOnIndex,
  runFull,
  parseArgs,
  printHelp,
  main,
  PROJECT_ROOT,
};

if (require.main === module) main();
