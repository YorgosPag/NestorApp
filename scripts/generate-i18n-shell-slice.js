#!/usr/bin/env node
'use strict';
/**
 * ADR-744 — i18n shell-slice generator (Φ1).
 *
 * PROBLEM (measured 2026-07-31, not estimated)
 * --------------------------------------------
 * `src/i18n/config.ts` shipped 295.093 bytes of locale JSON synchronously —
 * 40% of it `admin.json`, which is not even on screen — and a SECOND, hand-kept
 * list of 72 `CRITICAL_NAMESPACES` loaded asynchronously after `i18n.init()`.
 * The two lists had drifted with nothing checking them against each other: 63
 * namespaces were on the async list only, so any surface using them could paint
 * a raw key (`search.globalSearch`) before the await resolved. That is not a
 * missing translation — the strings exist; they had not arrived.
 *
 * WHAT THIS DOES INSTEAD
 * ----------------------
 * Derives the synchronous bootstrap from the code, at KEY granularity:
 *
 *   1. static import closure of `src/app/layout.tsx`   → the first JS chunk
 *   2. namespaces + keys each of those modules asks for
 *   3. those keys, and only those, pruned out of the locale files
 *   4. a manifest carrying a sha256 of every input, so CHECK 3.34 can ask
 *      "is this still what the code needs?" — the question no gate asked before
 *
 * The list stops being something a reviewer must remember and becomes something
 * the tool derives. Divergence becomes structurally impossible rather than
 * merely discouraged.
 *
 * CLI:
 *   node scripts/generate-i18n-shell-slice.js            # write the slice
 *   node scripts/generate-i18n-shell-slice.js --dry-run  # report, write nothing
 *   node scripts/generate-i18n-shell-slice.js --explain  # + boundaries and per-namespace cost
 *
 * Exit: 0 written/clean · 1 an unclassified dynamic key, or a bad config.
 */

const fs = require('node:fs');
const path = require('node:path');

const { CONFIG_FILE } = require('./lib/i18n-shell-slice/config');
const { bootstrap } = require('./lib/i18n-shell-slice/cli');
const {
  buildModuleGraph,
  buildShellPlan,
  deadPolicyEntries,
  renderArtifacts,
  manifestPath,
  buildManifest,
  sliceName,
} = require('./lib/i18n-shell-slice/plan');
const { stableStringify } = require('./lib/i18n-shell-slice/slice-build');
const RS = require('./lib/i18n-shell-slice/route-slices');
const MG = require('./lib/module-graph');
const { auditLedger, describeFailures } = require('./lib/i18n-shell-slice/ledger');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const GREEN = '\x1b[0;32m';
const RED = '\x1b[0;31m';
const YELLOW = '\x1b[1;33m';
const DIM = '\x1b[2m';
const NC = '\x1b[0m';

function parseArgs(argv) {
  const out = { dryRun: false, explain: false, help: false };
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--explain') out.explain = true;
    else if (arg === '--help' || arg === '-h') out.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}

function printHelp() {
  console.log(`ADR-744 — i18n shell-slice generator

Usage:
  node scripts/generate-i18n-shell-slice.js [--dry-run] [--explain]

Derives the synchronous i18n bootstrap from the static import closure of the
root layout, at key granularity, and writes it to src/i18n/generated/.

Config: ${CONFIG_FILE} (shell roots, languages, dynamic-key policy)
Gate:   npm run check:i18n-shell-slice  (CHECK 3.34)
`);
}

/**
 * The refusal that makes the guarantee real. A dynamic `t()` the ladder cannot
 * resolve is not a rounding error — it is the one shape that silently omits a
 * key from the slice and puts it on screen raw.
 */
function reportViolations(violations) {
  console.error(`${RED}❌ ADR-744 — ${violations.length} unresolved dynamic t() call(s) in shell modules.${NC}`);
  console.error('   The slice cannot know which keys these need, so it will not guess.\n');
  for (const violation of violations.slice(0, 25)) {
    console.error(`   ${violation.file}:${violation.line}`);
    console.error(`${DIM}      ${violation.snippet}${NC}`);
  }
  if (violations.length > 25) console.error(`   … and ${violations.length - 25} more`);
  console.error(`\nClassify each one in ${CONFIG_FILE} → dynamicKeyPolicy, e.g.:`);
  console.error(`${DIM}   "src/components/ui/ProductTour/product-tour-overlay.tsx": {`);
  console.error('     "prefixes": ["common:tour"],');
  console.error(`     "reason": "step.titleKey comes from tour configs under common.tour.*"${NC}`);
  console.error('   }');
}

function reportPlan(plan, rendered, config, explain, routeUnusedPolicy = []) {
  const { stats } = rendered.manifest;
  console.log(`${GREEN}ADR-744 shell slice${NC}`);
  console.log(`  shell closure   : ${stats.shellFiles} modules  ${DIM}(cut at ${stats.dynamicBoundaries} dynamic + ${stats.routeBoundaries} route boundaries)${NC}`);
  console.log(`  namespaces      : ${rendered.manifest.namespaces.length}  ${DIM}${rendered.manifest.namespaces.join(', ')}${NC}`);
  console.log(`  keys sliced     : ${stats.matchedKeys}`);
  console.log(`  languages       : ${config.languages.join(', ')}`);
  if (rendered.manifest.guaranteedNamespaces.length > 0) {
    console.log(`${YELLOW}  whole (migration ledger, should reach zero):${NC}`);
    const audit = auditLedger(
      config.guaranteedNamespaces,
      rendered.slices.resources[config.languages[0]] || {},
      wholeNamespacesOf(plan),
    );
    for (const entry of audit.entries) {
      const mark = entry.verdict === 'within-budget' ? ' ' : '🔴';
      console.log(
        `${YELLOW}   ${mark} ${entry.namespace.padEnd(22)} ${String(entry.actual).padStart(7)} / ` +
        `${String(entry.budget).padStart(7)} bytes${NC}`,
      );
    }
    console.log(
      `${YELLOW}      ${'ΣΥΝΟΛΟ'.padEnd(24)} ${String(audit.total).padStart(7)} / ${String(audit.limit).padStart(7)}${NC}`,
    );
  }
  console.log(`  ${GREEN}slice bytes     : ${stats.sliceBytes}${NC}  ${DIM}(was 295.093 synchronous, el+en)${NC}`);

  // 🔑 Η τομή κελύφους × διαδρομών ζει πλέον στο `plan.js` — είναι **κρίση**, όχι
  // εκτύπωση, και μέχρι σήμερα δεν την έλεγχε καμία άγκυρα (Group 16).
  const dead = deadPolicyEntries(plan.unusedPolicy, routeUnusedPolicy);
  if (dead.length > 0) {
    console.log(`${YELLOW}  ⚠ dead dynamicKeyPolicy entries (no unresolved call any more): ${dead.join(', ')}${NC}`);
  }
  if (!explain) return;

  console.log(`\n${DIM}  dynamic boundaries (not in the first chunk):${NC}`);
  plan.closure.dynamicBoundaries.forEach(file => console.log(`${DIM}    ${file}${NC}`));
  const missing = rendered.manifest.unresolvableKeys;
  if (missing.length > 0) {
    console.log(`\n${YELLOW}  ${missing.length} shell key(s) no locale defines — CHECK 3.8 territory, not this gate's:${NC}`);
    missing.slice(0, 20).forEach(key => console.log(`${DIM}    ${key}${NC}`));
    if (missing.length > 20) console.log(`${DIM}    … and ${missing.length - 20} more${NC}`);
  }
}

function writeArtifacts(config, rendered) {
  const outDir = path.join(PROJECT_ROOT, config.outputDir);
  fs.mkdirSync(outDir, { recursive: true });
  for (const [relPath, text] of rendered.artifacts) {
    const target = path.join(PROJECT_ROOT, relPath);
    // Τα route slices ζουν σε υποφάκελο (`routes/`) — δημιουργείται εδώ, ώστε
    // η εγγραφή να είναι ΜΙΑ διαδρομή κώδικα για όλα τα artifacts.
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text, 'utf8');
  }
  fs.writeFileSync(path.join(PROJECT_ROOT, manifestPath(config)), rendered.manifestText, 'utf8');
  console.log(`${GREEN}  ✓ wrote ${rendered.artifacts.size} artifact(s) + manifest to ${config.outputDir}/${NC}`);
  console.log(`${DIM}    (${config.languages.length} slice(s) + shell-slice.whole.json — the completeness list the runtime reads)${NC}`);
}

function main() {
  const started = bootstrap({
    argv: process.argv,
    parseArgs,
    printHelp,
    projectRoot: PROJECT_ROOT,
    reportError: message => console.error(`${RED}❌ ${message}${NC}`),
    exit: code => process.exit(code),
  });
  if (started === null) return;
  const { args, config } = started;

  const graph = buildModuleGraph(PROJECT_ROOT);
  const plan = buildShellPlan(PROJECT_ROOT, config, graph);

  if (plan.violations.length > 0) {
    reportViolations(plan.violations);
    process.exit(1);
    return;
  }

  const rendered = renderArtifacts(PROJECT_ROOT, config, plan);

  // ⚠️ Ο γράφος περνιέται, δεν ξαναχτίζεται: κοστίζει ~38s και είναι **ο ίδιος**.
  // Οι διαδρομές χτίζονται ΠΡΙΝ την αναφορά, ώστε η αναφορά να ξέρει ποιες
  // εγγραφές policy υπηρετούν σελίδα και να μην τις πει «νεκρές».
  const routes = emitRouteSlices(config, plan, rendered, graph);
  if (routes === null) process.exit(1);
  reportPlan(plan, rendered, config, args.explain, routes.map(route => route.unusedPolicy));

  // 🔑 ΤΑ ROUTE SLICES ΥΠΟΓΡΑΦΟΝΤΑΙ ΑΠΟ ΤΟ ΙΔΙΟ MANIFEST — καμία νέα μηχανή
  // φρεσκάδας. Το `checkArtifactIntegrity` του CHECK 3.34 διατρέχει το
  // `manifest.artifacts`, οπότε ένα χειρόγραφα πειραγμένο ή μισο-παραγμένο route
  // slice μπλοκάρει **δωρεάν**. Ένα artifact που κανείς δεν υπογράφει είναι
  // ακριβώς το σχήμα που το ADR-744 υπάρχει για να καταργήσει.
  // 🔴 ADR-777 §8.38 — Η ΑΡΝΗΣΗ ΤΟΥ ΜΗΤΡΩΟΥ, ΠΡΙΝ ΓΡΑΦΤΕΙ ΤΙΠΟΤΑ. Ένα artifact που
  // ξεπερνά το ταβάνι μιας εγγραφής δεν επιτρέπεται να προσγειωθεί: αυτό ακριβώς
  // συνέβη με το `search-results` (1,6 KB δηλωμένα → 47,8 KB πραγματικά, 11 μέρες).
  const ledger = auditLedger(
    config.guaranteedNamespaces,
    rendered.slices.resources[config.languages[0]] || {},
    wholeNamespacesOf(plan),
  );
  if (ledger.failures.length > 0) {
    console.error(`\n${RED}❌ Το μητρώο μετανάστευσης ξεπέρασε τον προϋπολογισμό του:${NC}`);
    console.error(`${RED}   ${describeFailures(ledger.failures)}${NC}`);
    console.error(`${DIM}   Η θεραπεία είναι ΜΕΤΑΚΟΜΙΣΗ σε σωστό namespace ή per-route slice — όχι μεγαλύτερος αριθμός.${NC}`);
    process.exit(1);
  }

  const merged = mergeRouteArtifacts({ rendered, routes, config, plan });
  if (!args.dryRun) writeArtifacts(config, merged);
  if (routes.length > 0) reportRoutes(routes, config.languages[0]);
  process.exit(0);
}

/** Το `rendered`, με τα route slices μέσα στα artifacts ΚΑΙ μέσα στο manifest. */
function mergeRouteArtifacts({ rendered, routes, config, plan }) {
  if (routes.length === 0) return rendered;
  const artifacts = new Map(rendered.artifacts);
  for (const route of routes) artifacts.set(route.artifactPath, stableStringify(route.resources));
  const manifest = buildManifest({ config, plan, artifacts, slices: rendered.slices });
  return { ...rendered, artifacts, manifest, manifestText: stableStringify(manifest) };
}

/**
 * ADR-744 §8 Φ4 — τα per-route slices, με **την ίδια** μηχανή και τον **ίδιο**
 * φρουρό: ανεπίλυτη δυναμική `t()` ⇒ **άρνηση**, ποτέ σιωπηλά μικρότερο slice.
 * @returns {?object[]} `null` όταν κάποια διαδρομή αρνήθηκε
 */
function emitRouteSlices(config, plan, rendered, graph) {
  const declared = Object.keys(config.routeSlices || {});
  if (declared.length === 0) return [];

  const [language] = config.languages;
  const shellSlice = JSON.parse(rendered.artifacts.get(MG.toPosix(path.join(config.outputDir, sliceName(language)))) || '{}');
  const built = RS.buildAllRouteSlices(PROJECT_ROOT, config, graph, shellSlice, wholeNamespacesOf(plan));

  const refused = built.filter(route => route.violations.length > 0);
  if (refused.length === 0) return built;

  console.error(`\n${RED}❌ ${refused.length} route slice(s) ΑΡΝΗΘΗΚΑΝ — ανεπίλυτη δυναμική t()${NC}`);
  for (const route of refused) {
    console.error(`${RED}   ${route.url}${NC}`);
    reportViolations(route.violations);
  }
  return null;
}

function reportRoutes(built, language) {
  console.log(`\n${GREEN}  per-route slices (${language}):${NC}`);
  for (const route of built) {
    const namespaces = Object.keys(route.resources);
    const bytes = Buffer.byteLength(stableStringify(route.resources), 'utf8');
    console.log(
      `    ${route.url.padEnd(34)} ${String(bytes).padStart(7)} bytes · ` +
        `${namespaces.length} ns [${namespaces.join(', ')}]`
    );
  }
  console.log(`${DIM}    (αφαιρεμένα όσα απαντά ήδη το κέλυφος — ένωση θα ήταν ΜΕΓΑΛΥΤΕΡΗ από σήμερα)${NC}`);
}

/** Τα namespaces που ταξιδεύουν ΟΛΟΚΛΗΡΑ στο κέλυφος — δεν τα ξαναζητά καμία διαδρομή. */
function wholeNamespacesOf(plan) {
  return [...plan.wants.entries()].filter(([, want]) => want.whole).map(([namespace]) => namespace);
}

module.exports = { parseArgs, printHelp, reportViolations, reportPlan, writeArtifacts, main, PROJECT_ROOT };

if (require.main === module) main();
