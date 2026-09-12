#!/usr/bin/env node
/**
 * CHECK 3.78 — **Η ΠΥΛΗ ΤΗΣ ΠΟΛΙΤΙΚΗΣ ΡΥΘΜΟΥ** (ADR-855 Α5).
 *
 * «**Δηλώνει** αυτή η διαδρομή όριο — και **συμφωνεί** η δήλωση με ό,τι επιβάλλεται;»
 *
 * Η απογραφή ζει στο `lib/rate-limit-policy/inventory.js`, η κρίση στο `…/judge.js`· εδώ
 * μόνο το CLI και η αναφορά — ίδιο σχήμα με κάθε άλλη πύλη αυτού του δέντρου.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ ΠΟΥ ΤΗ ΓΕΝΝΗΣΕ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `options.category` των επτά wrappers **δεν διαβαζόταν ποτέ**: η κατηγορία έβγαινε
 * αποκλειστικά από 9 γραμμές προθεμάτων για **449** διαδρομές. Τέσσερα έγγραφα υπόσχονταν
 * όρια που ο κώδικας δεν επέβαλλε (ADR-068 §3/§4/§6 · PR-1C · ADR-844 §13 · ADR-170), και
 * **καμία** δοκιμή δεν άγγιζε τη μηχανή — `grep` σε κάθε `*.test.*` του δέντρου: **κενό**.
 *
 * ⚠️ Η Φ1 του ADR-855 διόρθωσε τη **μηχανή**. Αυτή η πύλη φυλά το **ερώτημα**: χωρίς
 *    αυτήν, η επόμενη διαδρομή που ξεχνά να δηλώσει, ή ο επόμενος πίνακας που αποκλίνει
 *    από τις δηλώσεις, ξαναγεννά την ίδια σιωπή.
 *
 * 🏆 **ΚΑΝΕΙΣ ΣΤΗΝ ΑΓΟΡΑ ΔΕΝ ΡΩΤΑ ΑΥΤΟ**: Envoy Gateway · NGINX Gateway Fabric · API7
 *    δηλώνουν πολιτική **ανά διαδρομή** — αλλά καμία αναζήτηση δεν βρήκε lint rule ή CI
 *    gate που να ελέγχει *ποια* διαδρομή **ξέχασε** να δηλώσει, ή αν η δήλωση **συμφωνεί**
 *    με την επιβολή. Στα gateways η δήλωση *είναι* η επιβολή, οπότε το ερώτημα δεν
 *    γεννιέται· εδώ υπάρχουν **δύο** πηγές, και γι' αυτό γεννιέται.
 *
 * CLI:
 *   node scripts/check-rate-limit-policy.js                  # κρίση vs baseline
 *   node scripts/check-rate-limit-policy.js --report         # πλήρης απογραφή
 *   node scripts/check-rate-limit-policy.js --write-baseline # reseed μετά από καθάρισμα
 *
 * Escape: SKIP_RATE_LIMIT_POLICY=1
 */

'use strict';

const path = require('node:path');

const { PROJECT_ROOT, runSetRatchetCli } = require('./lib/ratchet-baseline');
const { takeInventory, ROUTES_DIR, CONFIG_FILE } = require('./lib/rate-limit-policy/inventory');
const { STATES, ORDER, RATCHETED_STATES, judge, violationId, idsOf } = require('./lib/rate-limit-policy/judge');

const BASELINE_FILE = path.join(PROJECT_ROOT, '.rate-limit-policy-baseline.json');

/** Σύμβολο ανά κατάσταση — ό,τι μετράει μπροστά, ώστε να μην κρύβεται. */
const MARK = {
  [STATES.UNDECLARED]: '🔴',
  [STATES.SHADOWED]: '🔴',
  [STATES.AGREES]: '✅',
  [STATES.VIA_FACTORY]: '✅',
};

function measure() {
  const inventory = takeInventory(PROJECT_ROOT);
  const verdict = judge(inventory);
  return { inventory, verdict, violationIds: verdict.violationIds, declarations: verdict.declarations };
}

function buildPayload(m) {
  const v = m.verdict;
  // Η κατανομή των ζευγών — **περιγραφή**, ποτέ κριτήριο: ο ratchet κρίνει ταυτότητες.
  const byPair = {};
  for (const f of v.violations.filter((f) => f.state === STATES.SHADOWED)) {
    const key = `${f.declared}→${f.enforced}`;
    byPair[key] = (byPair[key] || 0) + 1;
  }

  return {
    adr: 'ADR-855 (CHECK 3.78)',
    generated_from: [ROUTES_DIR, CONFIG_FILE],
    note:
      'ΔΕΝ είναι δείκτης υγείας: μετρά (α) διαδρομές που δεν δηλώνουν βαθμίδα ορίου και '
      + '(β) διαδρομές που δηλώνουν άλλη από όση επιβάλλεται. Η θεραπεία είναι ΔΗΛΩΣΗ στη '
      + 'διαδρομή ή διόρθωση του πίνακα προθεμάτων — ποτέ μικρότερος αριθμός.',
    population: v.population,
    tally: v.tally,
    mismatch_by_pair: byPair,
    violation_count: v.violationIds.length,
    declaration_count: v.declarations.length,
    violations: v.violationIds,
    declarations: v.declarations,
  };
}

function printReport(m) {
  const v = m.verdict;
  console.log(`CHECK 3.78 — πολιτική ρυθμού (${ROUTES_DIR} × ${CONFIG_FILE})\n`);
  console.log(`  διαδρομές: ${v.population}   προθέματα πίνακα: ${m.inventory.table.prefixes.length}`);
  console.log(`  προεπιλογή: ${m.inventory.fallback}\n`);

  // ⚠️ Κάθε κάδος τυπώνεται **ακόμα και στο μηδέν**: ένα «0» που δεν φαίνεται διαβάζεται
  //    ως «δεν υπάρχει τέτοιος έλεγχος» — σχήμα πληρωμένο πολλές φορές σε αυτό το δέντρο.
  console.log('  ΚΑΤΑΣΤΙΧΟ (κλειστό):');
  for (const state of ORDER) {
    console.log(`    ${MARK[state]} ${state.padEnd(24)} ${String(v.tally[state]).padStart(4)}`);
  }

  // ⚠️ «ΝΕΚΡΕΣ ΓΡΑΜΜΕΣ», ΟΧΙ «ΛΑΘΟΣ ΟΡΙΑ» — και η διατύπωση είναι το νόημα: μετά τη Φ1 του
  //    ADR-855 η δήλωση κερδίζει, άρα αυτές οι διαδρομές τρέχουν **σωστά**. Ό,τι είναι
  //    σπασμένο είναι η γραμμή του πίνακα, που για αυτές δεν πυροδοτεί ποτέ.
  console.log('\n  ΝΕΚΡΕΣ ΓΡΑΜΜΕΣ ΠΙΝΑΚΑ ανά ζεύγος (δηλώνει → ο πίνακας λέει):');
  const byPair = {};
  for (const f of v.violations.filter((f) => f.state === STATES.SHADOWED)) {
    const key = `${f.declared} → ${f.enforced}`;
    (byPair[key] = byPair[key] || []).push(f.url);
  }
  for (const [pair, urls] of Object.entries(byPair).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`    ${String(urls.length).padStart(4)}  ${pair}`);
    for (const url of urls) console.log(`            ${url}`);
  }

  console.log('\n  ΑΔΗΛΩΤΕΣ (καμία βαθμίδα, ούτε μέσω εργοστασίου):');
  for (const url of idsOf(v, STATES.UNDECLARED)) console.log(`    · ${url}`);

  // 🔶 Δηλωμένο κενό: υπολογισμένο κλειδί που η πηγή δεν βεβαίωσε. Τυπώνεται **πάντα**.
  console.log(`\n  🔶 ΜΗ-ΕΠΙΛΥΣΙΜΑ προθέματα: ${v.unresolvedPrefixes.length}`);
  for (const u of v.unresolvedPrefixes) console.log(`    · ${u.expression} → ${u.category}`);
}

const DESCRIPTOR = {
  adr: 'CHECK 3.78',
  skipEnv: 'SKIP_RATE_LIMIT_POLICY',
  baselineFile: BASELINE_FILE,
  measure,
  buildPayload,
  printReport,
  violationId,
  labels: { violations: 'παραβιάσεις', declarations: 'εργοστασιακές δηλώσεις' },
  messages: {
    worse: 'η πολιτική ρυθμού χειροτέρεψε',
    newDeclLabel: 'ΝΕΑ ΔΙΑΔΡΟΜΗ ΜΕ ΒΑΘΜΙΔΑ ΚΡΥΜΜΕΝΗ ΣΕ ΕΡΓΟΣΤΑΣΙΟ',
    newDeclAdvice: [
      'Η διαδρομή δεν δηλώνει βαθμίδα στο δικό της αρχείο — τη δηλώνει το εργοστάσιο.',
      'Δεν είναι λάθος, αλλά ΔΕΝ φαίνεται στην ανασκόπηση: ο αναγνώστης του route.ts',
      'δεν μπορεί να δει ποιο όριο ισχύει. Δήλωσέ το ρητά, ή πρόσθεσε γραμμή εδώ',
      'αφού απαντήσεις «ποιο όριο παίρνει αυτή η διαδρομή, και ποιος το ξέρει;».',
    ],
  },
  commands: {
    report: 'npm run rate-limit-policy:report',
    baseline: 'npm run rate-limit-policy:baseline',
    seed: 'node scripts/check-rate-limit-policy.js --write-baseline',
  },
};

const main = (argv = process.argv) => runSetRatchetCli(DESCRIPTOR, argv);

if (require.main === module) {
  main().catch((e) => {
    console.error(`❌ CHECK 3.78 — απρόσμενο σφάλμα: ${e.message}`);
    process.exit(1);
  });
}

module.exports = { measure, buildPayload, printReport, DESCRIPTOR, BASELINE_FILE, main, RATCHETED_STATES };
