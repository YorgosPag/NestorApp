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
} = require('./lib/i18n-shell-slice/plan');
const RS = require('./lib/i18n-shell-slice/route-slices');
const { wholeNamespacesOf } = RS;
const {
  auditLedger,
  describeFailures,
  auditRouteLedger,
  describeRouteFailures,
  announceLedgerSlack,
  announceRouteSlack,
  HEADROOM_PCT,
  ROUTE_PRESENCE,
  ROUTE_BUDGET,
  ROUTE_SHAPE,
} = require('./lib/i18n-shell-slice/ledger');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const GREEN = '\x1b[0;32m';
const RED = '\x1b[0;31m';
const YELLOW = '\x1b[1;33m';
const DIM = '\x1b[2m';
const NC = '\x1b[0m';

function parseArgs(argv) {
  const out = { dryRun: false, explain: false, help: false, measure: false };
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--explain') out.explain = true;
    // ADR-744 §20 — ΤΟ ΟΡΓΑΝΟ ΤΗΣ ΣΦΡΑΓΙΣΗΣ. Δίνει τους αριθμούς που χρειάζεται ο
    // άνθρωπος για να ξανασφραγίσει, ΧΩΡΙΣ να κρίνει και ΧΩΡΙΣ να γράφει. Δεν
    // σφραγίζει μόνο του: το `why` το γράφει άνθρωπος (πρότυπο `Binary-Size:`).
    else if (arg === '--measure') { out.measure = true; out.dryRun = true; }
    else if (arg === '--help' || arg === '-h') out.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}

function printHelp() {
  console.log(`ADR-744 — i18n shell-slice generator

Usage:
  node scripts/generate-i18n-shell-slice.js [--dry-run] [--explain] [--measure]

Derives the synchronous i18n bootstrap from the static import closure of the
root layout, at key granularity, and writes it to src/i18n/generated/.

  --dry-run   κρίνει τα πάντα, δεν γράφει τίποτα
  --explain   + όρια κλειστότητας και κόστος ανά namespace
  --measure   ΜΟΝΟ οι μετρήσεις ανά διαδρομή· δεν κρίνει, δεν γράφει, βγαίνει 0.
              Το όργανο της ΣΦΡΑΓΙΣΗΣ (ADR-744 §20): δίνει τους αριθμούς, το
              \`why\` το γράφει άνθρωπος.

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

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔴 ADR-744 §20 (Β2) — ΚΑΜΙΑ ΠΡΟΩΡΗ ΕΞΟΔΟΣ. Η ΡΙΖΑ ΗΤΑΝ ΕΔΩ.
  // ═══════════════════════════════════════════════════════════════════════════
  // Μέχρι τις 2026-08-30 αυτή η συνάρτηση ήταν **αλυσίδα από `process.exit(1)`**:
  // η πρώτη άρνηση σκότωνε κάθε επόμενο ερώτημα. Συνέπεια, ΜΕΤΡΗΜΕΝΗ: όσο υπήρχε
  // έστω **μία** ανεπίλυτη δυναμική `t()` σε shell module, **κάθε** υπέρβαση
  // προϋπολογισμού ήταν **ΑΟΡΑΤΗ** — και το `/offers/mandate/new` έζησε στα 7.091
  // με ταβάνι 7.000, αδιατάραχτο, μέχρι να το βρει άνθρωπος. Είναι το σχήμα
  // «`0` σημαίνει *κανείς δεν κοίταξε*» που το CLAUDE.md καταγγέλλει σε τέσσερα
  // σημεία (N.11 · N.12 · N.18 · 3.18) — εδώ, μέσα στο ίδιο μας το εργαλείο.
  //
  // ⚠️ ΚΑΙ Η ΑΛΛΗ ΚΑΤΕΥΘΥΝΣΗ ΗΤΑΝ ΕΞΙΣΟΥ ΤΥΦΛΗ: όταν **μία** διαδρομή έσπαγε το
  // Κ2, ο πίνακας των **άλλων 23** δεν τυπωνόταν ΠΟΤΕ (η `reportRoutes` ζούσε μετά
  // την έξοδο) — δηλαδή το εργαλείο αρνιόταν να δώσει τις μετρήσεις ακριβώς τη
  // στιγμή που τις χρειάζεσαι για να αποφασίσεις.
  //
  // 🔑 Η ΘΕΡΑΠΕΙΑ ΔΕΝ ΕΙΝΑΙ «ΣΥΝΕΧΙΣΕ ΠΑΡΑ ΤΟ ΣΦΑΛΜΑ»: είναι **ρητή κατάσταση**.
  // Ό,τι κρίνεται, κρίνεται· ό,τι δεν μπορεί να κριθεί, ονομάζεται **ΔΕΝ ΚΡΙΘΗΚΕ**
  // και **μετράει ως αποτυχία**. Ένα «δεν κρίθηκε» δεν επιτρέπεται ποτέ να φορέσει
  // τη στολή του «πέρασε» — η ίδια πειθαρχία που το `unjudged()` επιβάλλει ήδη μέσα
  // στο `auditRouteLedger`. Τίποτα δεν γράφεται στον δίσκο αν έστω ένα απέτυχε.
  // ═══════════════════════════════════════════════════════════════════════════
  const failures = [];
  const shellRefused = plan.violations.length > 0;

  const rendered = renderArtifacts(PROJECT_ROOT, config, plan);

  // ⚠️ Ο γράφος περνιέται, δεν ξαναχτίζεται: κοστίζει ~38s και είναι **ο ίδιος**.
  // Οι διαδρομές χτίζονται ΠΡΙΝ την αναφορά, ώστε η αναφορά να ξέρει ποιες
  // εγγραφές policy υπηρετούν σελίδα και να μην τις πει «νεκρές».
  const complete = RS.renderComplete({ projectRoot: PROJECT_ROOT, config, plan, graph, rendered });
  const routes = complete.routes;
  const refusedPages = new Set(complete.refused.map(route => route.page));

  reportPlan(plan, rendered, config, args.explain, routes.map(route => route.unusedPolicy));

  // 🔴 ADR-777 §8.38 — Η ΑΡΝΗΣΗ ΤΟΥ ΜΗΤΡΩΟΥ, ΠΡΙΝ ΓΡΑΦΤΕΙ ΤΙΠΟΤΑ. Ένα artifact που
  // ξεπερνά το ταβάνι μιας εγγραφής δεν επιτρέπεται να προσγειωθεί: αυτό ακριβώς
  // συνέβη με το `search-results` (1,6 KB δηλωμένα → 47,8 KB πραγματικά, 11 μέρες).
  const ledger = auditLedger(
    config.guaranteedNamespaces,
    rendered.slices.resources[config.languages[0]] || {},
    wholeNamespacesOf(plan),
  );

  // 🔴 ADR-777 §8.43 — ΤΟ ΔΕΥΤΕΡΟ ΚΑΤΑΣΤΙΧΟ. Το Κ1 (δομική αντιστροφή), το Κ2
  // (σφράγιση + περιθώριο) και το Κ3 (η προέλευση του αριθμού, ADR-744 §20)
  // κρίνονται ΧΩΡΙΣΤΑ. Ο παρονομαστής είναι το ΙΔΙΟ κέλυφος που μόλις χτίστηκε —
  // όχι ο δίσκος, που μπορεί να είναι παλιός.
  const shellBytes = Buffer.byteLength(
    JSON.stringify(rendered.slices.resources[config.languages[0]] || {}), 'utf8',
  );
  const routeLedger = auditRouteLedger(
    config.routeSlices, observeRouteArtifacts(config, routes, refusedPages), shellBytes,
  );

  if (routes.length > 0) reportRoutes(routes, config.languages[0], routeLedger, shellRefused);

  // ⚠️ Ο ΤΖΟΓΟΣ ΑΝΑΚΟΙΝΩΝΕΤΑΙ ΚΑΙ ΣΤΑ ΔΥΟ ΚΑΤΑΣΤΙΧΑ, ΚΑΙ ΔΕΝ ΜΠΛΟΚΑΡΕΙ (ADR-598).
  for (const line of announceLedgerSlack(ledger.entries)) console.log(`${DIM}${line}${NC}`);
  for (const line of announceRouteSlack(routeLedger.entries)) console.log(`${DIM}${line}${NC}`);

  // ─── Η συγκομιδή των ετυμηγοριών — ΟΛΕΣ, με τη σειρά που τις διαβάζει άνθρωπος ──
  if (shellRefused) {
    failures.push(() => reportViolations(plan.violations));
  }
  if (complete.refused.length > 0) {
    failures.push(() => reportRefusedRoutes(complete.refused));
  }
  if (ledger.failures.length > 0) {
    failures.push(() => {
      console.error(`\n${RED}❌ Το μητρώο μετανάστευσης ξεπέρασε τον προϋπολογισμό του:${NC}`);
      console.error(`${RED}   ${describeFailures(ledger.failures)}${NC}`);
      console.error(`${DIM}   Η θεραπεία είναι ΜΕΤΑΚΟΜΙΣΗ σε σωστό namespace ή per-route slice — όχι μεγαλύτερος αριθμός.${NC}`);
    });
  }
  if (routeLedger.failures.length > 0) {
    failures.push(() => {
      console.error(`\n${RED}❌ Το κατάστιχο των διαδρομών:${NC}`);
      console.error(`${RED}   ${describeRouteFailures(routeLedger.failures, shellBytes)}${NC}`);
      console.error(`${DIM}   Κ1: ένα slice ≥ κέλυφος ΔΕΝ είναι αφαίρεση — η θεραπεία είναι όριο στην κλειστότητα.${NC}`);
      console.error(`${DIM}   Κ2/Κ3: το ταβάνι ΔΕΝ δηλώνεται — υπολογίζεται από τη σφράγιση. Δεν υπάρχει${NC}`);
      console.error(`${DIM}          αριθμός να ανεβάσεις: ή βάζεις ΟΡΙΟ, ή ΣΦΡΑΓΙΖΕΙΣ ΞΑΝΑ με γραμμένο «why».${NC}`);
      console.error(`${DIM}          Οι μετρήσεις: npm run generate:i18n-shell-slice -- --measure${NC}`);
    });
  }

  // 🔑 ΤΟ ΟΡΓΑΝΟ ΤΗΣ ΣΦΡΑΓΙΣΗΣ ΔΕΝ ΕΙΝΑΙ ΠΥΛΗ, ΚΑΙ ΤΟ ΛΕΕΙ ΜΟΝΟ ΤΟΥ.
  if (args.measure) {
    console.log(`\n${YELLOW}  ⚠ --measure: ΜΕΤΡΗΣΗ, ΟΧΙ ΚΡΙΣΗ. Έξοδος 0 ανεξαρτήτως ετυμηγοριών· τίποτα δεν γράφτηκε.${NC}`);
    console.log(`${DIM}    Οι ετυμηγορίες τυπώθηκαν παραπάνω (${failures.length} απέτυχαν). Η πύλη είναι το \`--dry-run\`.${NC}`);
    process.exit(0);
  }

  if (failures.length > 0) {
    for (const report of failures) report();
    console.error(`\n${RED}❌ ${failures.length} ετυμηγορία(ες) απέτυχαν — τίποτα δεν γράφτηκε.${NC}`);
    process.exit(1);
  }

  if (!args.dryRun) writeArtifacts(config, complete.rendered);
  process.exit(0);
}

/**
 * ADR-744 §8 Φ4 — η **παρουσίαση** της άρνησης: ανεπίλυτη δυναμική `t()` ⇒
 * **άρνηση**, ποτέ σιωπηλά μικρότερο slice.
 *
 * 🔑 Ο **υπολογισμός** ζει στο `RS.renderComplete` (κοινός με τον ελεγκτή)· εδώ
 * μένει μόνο ό,τι είναι **έξοδος αυτού του εργαλείου**. Ο ελεγκτής μεταφράζει
 * το ίδιο `refused` σε `fail(...)` — ίδια κρίση, δύο φωνές (πρότυπο `cli.js`).
 */
function reportRefusedRoutes(refused) {
  console.error(`\n${RED}❌ ${refused.length} route slice(s) ΑΡΝΗΘΗΚΑΝ — ανεπίλυτη δυναμική t()${NC}`);
  for (const route of refused) {
    console.error(`${RED}   ${route.url}${NC}`);
    reportViolations(route.violations);
  }
}

/** Compact UTF-8 bytes — η **ίδια** μονάδα με το πρώτο κατάστιχο, ώστε τα δύο να συγκρίνονται. */
function compactBytes(tree) {
  return Buffer.byteLength(JSON.stringify(tree), 'utf8');
}

/**
 * Ό,τι **υπάρχει** ως route slice: τα φρεσκοχτισμένα ΚΑΙ ό,τι κάθεται ήδη στον δίσκο.
 *
 * 🔴 Ο ΔΙΣΚΟΣ ΔΕΝ ΕΙΝΑΙ ΠΟΛΥΤΕΛΕΙΑ: το `writeArtifacts` **γράφει, δεν κλαδεύει**. Χωρίς
 * αυτή τη σάρωση η κατάσταση `orphan-artifact` θα ήταν **αδύνατο να πυροδοτήσει** εδώ —
 * φρουρός χωρίς απόδειξη ζωής (ADR-749 §5). Η θεραπεία είναι **άρνηση**, όχι σιωπηλή
 * διαγραφή: το αρχείο μπορεί να έχει ζωντανό `import` που θα έσπαγε το build.
 */
function observeRouteArtifacts(config, built, refusedPages = new Set()) {
  const [language] = config.languages;
  const suffix = `.${language}.json`;
  const dir = path.join(PROJECT_ROOT, config.outputDir, RS.ROUTES_DIR);
  const seen = new Map(built.map(route => [
    route.id,
    {
      id: route.id,
      page: route.page,
      actual: compactBytes(route.resources),
      // 🔴 ADR-744 §20 (Β2): η άρνηση ταξιδεύει ΜΕ ΤΗ ΜΕΤΡΗΣΗ, ώστε το κατάστιχο να
      // ξέρει ότι ο αριθμός είναι ΚΑΤΩ ΦΡΑΓΜΑ. Χωρίς αυτό, ένα ελλιπές slice κάτω
      // από το ταβάνι θα διαβαζόταν «εντός» — «δεν κρίθηκε» με στολή «πέρασε».
      refused: refusedPages.has(route.page),
    },
  ]));
  if (!fs.existsSync(dir)) return [...seen.values()];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(suffix)) continue;
    const id = name.slice(0, -suffix.length);
    if (seen.has(id)) continue;
    seen.set(id, { id, page: null, actual: compactBytes(JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'))) });
  }
  return [...seen.values()];
}

/**
 * Η αναφορά των διαδρομών — **με τη λογιστική ολόκληρη**.
 *
 * ⚠️ ΤΥΠΩΝΟΝΤΑΙ ΚΑΙ ΟΙ ΚΑΔΟΙ ΠΟΥ ΔΕΝ ΜΠΛΟΚΑΡΟΥΝ. Στο §8.42 αυτό ήταν το **μόνο** που
 * αποκάλυψε πύλη γεννημένη μονίμως πράσινη: ένας κάδος που πρέπει να είναι μη-μηδενικός
 * και τυπώνεται «0» ουρλιάζει· ένας κάδος που δεν τυπώνεται καθόλου διαβάζεται ως
 * «δεν υπάρχει τέτοιος έλεγχος».
 */
function reportRoutes(built, language, audit, shellRefused = false) {
  console.log(`\n${GREEN}  per-route slices (${language}) — κέλυφος: ${audit.shellBytes} bytes · περιθώριο ${HEADROOM_PCT}%:${NC}`);
  if (shellRefused) {
    // 🔴 Η ΔΗΛΩΣΗ ΠΟΥ ΚΑΝΕΙ ΤΟΝ ΑΡΙΘΜΟ ΤΙΜΙΟ. Με ανεπίλυτη `t()` στο κέλυφος, το
    // slice είναι ελλιπές ⇒ κάθε μέτρηση εδώ είναι ΚΑΤΩ ΦΡΑΓΜΑ. Σιωπή εδώ θα
    // παρουσίαζε υποεκτιμημένους αριθμούς ως μετρήσεις.
    console.log(`${YELLOW}    ⚠ ΥΠΟΕΚΤΙΜΗΜΕΝΟ: το κέλυφος αρνήθηκε (ανεπίλυτη t()) — οι μετρήσεις είναι ΚΑΤΩ ΦΡΑΓΜΑ.${NC}`);
  }
  const marks = { [ROUTE_BUDGET.OVER]: '🔴', [ROUTE_SHAPE.SECOND_SHELL]: '⛔' };
  for (const route of built) {
    const entry = audit.entries.find(candidate => candidate.page === route.page);
    const namespaces = Object.keys(route.resources);
    const refused = entry.presence === ROUTE_PRESENCE.REFUSED;
    const mark = refused ? '❔' : (marks[entry.shapeVerdict] || marks[entry.budgetVerdict] || ' ');
    // ⚠️ Η ΑΡΝΗΣΗ ΤΥΠΩΝΕΤΑΙ ΩΣ «—», ΟΧΙ ΩΣ ΑΡΙΘΜΟΣ: ταβάνι δίπλα σε ακρωτηριασμένη
    // μέτρηση διαβάζεται ως σύγκριση που δεν έγινε ποτέ.
    const ceiling = refused ? '  ΔΕΝ ΚΡΙΘΗΚΕ' : `/ ${String(entry.ceiling).padStart(6)}`;
    console.log(
      `   ${mark} ${route.url.padEnd(32)} ${String(entry.actual).padStart(7)} ${ceiling} bytes · `
      + `${((100 * entry.actual) / audit.shellBytes).toFixed(1).padStart(5)}% κελ. · ${namespaces.length} ns [${namespaces.join(', ')}]`
    );
  }
  const tally = state => audit.entries.filter(entry => entry.presence === state).length;
  const axis = verdict => audit.entries.filter(entry => entry.budgetVerdict === verdict || entry.shapeVerdict === verdict).length;
  console.log(
    `${DIM}    λογιστική: ${tally(ROUTE_PRESENCE.PRESENT)} παρόντα · ${tally(ROUTE_PRESENCE.ABSENT)} απόντα · `
    + `${tally(ROUTE_PRESENCE.REFUSED)} αρνηθέντα · ${tally(ROUTE_PRESENCE.ORPHAN)} ορφανά │ `
    + `Κ2 ${axis(ROUTE_BUDGET.WITHIN)} εντός / ${axis(ROUTE_BUDGET.OVER)} εκτός │ `
    + `Κ1 ${axis(ROUTE_SHAPE.PAGE)} σελίδες / ${axis(ROUTE_SHAPE.SECOND_SHELL)} δεύτερα κελύφη${NC}`
  );
  console.log(`${DIM}    (αφαιρεμένα όσα απαντά ήδη το κέλυφος — ένωση θα ήταν ΜΕΓΑΛΥΤΕΡΗ από σήμερα)${NC}`);
}

module.exports = { parseArgs, printHelp, reportViolations, reportPlan, writeArtifacts, main, PROJECT_ROOT };

if (require.main === module) main();
