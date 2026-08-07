#!/usr/bin/env node
/**
 * CHECK 3.40 / ADR-770 **Στρώμα 2β** — η πύλη αντίθεσης σε **χρόνο εκτέλεσης**.
 *
 * ΤΙ ΑΠΑΝΤΑ ΠΟΥ ΤΟ ΣΤΡΩΜΑ 2α ΔΕΝ ΜΠΟΡΟΥΣΕ:
 * το CHECK 3.39 διαβάζει **τι γράφτηκε** (AST) και δηλώνει ρητά τα όριά του (Κ5–Κ7):
 * μόνο literal hex — όχι `rgba()`, όχι `hsl(var(--x))`, όχι `color-mix()`, όχι
 * indirection. Αυτή η πύλη διαβάζει **τι παράγεται** όταν ο κώδικας τρέξει σε
 * πραγματικό browser, και τα δίνει στην **ΙΔΙΑ** μηχανή κρίσης.
 *
 * 🔑 ΔΕΝ ΕΙΝΑΙ ΝΕΑ ΜΗΧΑΝΗ — ΕΙΝΑΙ ΝΕΑ ΠΗΓΗ. Το κριτήριο («αλλάζει η ετυμηγορία ανάμεσα
 * στα δύο θέματα;»), τα κατώφλια WCAG, η ταξινόμηση ρόλων, η αναγνώριση ζεύγους και οι
 * εννέα καταστάσεις ζουν **μία φορά** στα `theme-pairing.js` / `ts-token-palette.js`.
 * Το ADR-749 αποσυναρμολόγησε τέσσερις μηχανές που απαντούσαν το ίδιο ερώτημα με τρεις
 * διαφορετικούς αριθμούς· αυτή η πύλη γεννήθηκε **μετά** από εκείνο το μάθημα.
 *
 * ΤΡΕΙΣ ΝΕΕΣ ΚΑΤΑΣΤΑΣΕΙΣ, αδύνατες στατικά:
 *   · `dangling-var`           — η δήλωση δείχνει σε custom property που ΔΕΝ ΟΡΙΖΕΤΑΙ,
 *                                άρα το στοιχείο βάφεται με **κληρονομημένο** χρώμα.
 *                                Μετρήθηκε: **18** δηλώσεις / **11** ονόματα.
 *   · `ast-runtime-divergence` — ο AST διάβασε άλλο χρώμα από αυτό που βάφει ο browser.
 *                                Σήμερα **0**: αυτό είναι η **βαθμονόμηση** — αποδεικνύει
 *                                ότι τα δύο στρώματα μιλούν για το ίδιο δέντρο.
 *   · `translucent-invisible`  — ημιδιαφανής δήλωση αόρατη σε **κάθε** επιφάνεια.
 *
 * ⚠️ ΤΙ ΔΕΝ ΚΑΛΥΠΤΕΙ, ΡΗΤΑ (το «0» δεν σημαίνει ποτέ «δεν κοίταξα»):
 *   · **σύνθεση προγόνων σε πραγματικές σελίδες**. Μετρήθηκε σε 20/140 διαδρομές: χωρίς
 *     αυθεντικοποίηση οι λίστες δεδομένων βάφουν **ταυτόσημα 33 στοιχεία / 452
 *     χαρακτήρες** — μόνο το sidebar. Μια σάρωση διαδρομών θα μέτραγε το ίδιο τέσσερις
 *     φορές (και σε **ανάμεικτο** θέμα: 17 σκοτεινά / 2 φωτεινά / 1 άγνωστο). Διαγνωστικό
 *     όργανο γι' αυτό υπάρχει και είναι βαθμονομημένο: `runtime-contrast-sweep.js`.
 *   · **style factories** (159) — δεν έχουν τιμή χωρίς ορίσματα.
 *   · **χρώματα από δεδομένα χρήστη** — κανένα token δεν τα λύνει· θέλουν on-color.
 *   Και τα τρία **αριθμούνται** στην αναφορά, δεν υπονοούνται.
 *
 * ΔΥΟ ΜΗΧΑΝΙΣΜΟΙ — ίδιοι με το 3.39, εξ επιλογής:
 *   1. **RATCHET κατά ταυτότητα** στις παραβιάσεις (`compareSets`) — η *ανταλλαγή* μιας
 *      παραβίασης με άλλη μπλοκάρει.
 *   2. **ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ** των δηλώσεων που λύνονται σε χρώμα — κάθε **νέα** μπλοκάρει.
 *
 * ⚠️ ΟΧΙ zero-tolerance, και ο λόγος είναι μετρημένος: `dangling-var` έχει **18**
 * υπάρχοντα και `surface-theme-flip` **70**. Πύλη μηδενικής ανοχής με 134 υπάρχουσες
 * παραβιάσεις δεν είναι αυστηρή· είναι **μονίμως κόκκινη**, δηλαδή θα παρακαμπτόταν.
 *
 * ⚠️ **ΔΕΝ τρέχει στο pre-commit** — σκόπιμα. Απαιτεί dev server + browser (60–190s για
 * κρύα διαδρομή). Ένας hook που θέλει λεπτά, παρακάμπτεται. Layer 2 = CI, στο **υπάρχον**
 * `ui-contrast-ratchet.yml` (νέο workflow θα απαιτούσε εγγραφή στο `.ci-gate-tiers.json`,
 * αλλιώς μπλοκάρει το CHECK 3.37).
 *
 * CLI:
 *   node scripts/check-runtime-contrast-ratchet.js                  # έλεγχος
 *   node scripts/check-runtime-contrast-ratchet.js --report         # ανθρώπινη αναφορά
 *   node scripts/check-runtime-contrast-ratchet.js --write-baseline # reseed
 *   node scripts/check-runtime-contrast-ratchet.js --snapshot <f>   # γράψε το στιγμιότυπο
 *   node scripts/check-runtime-contrast-ratchet.js --from <f>       # κρίνε από αρχείο
 *
 * Env: SKIP_RUNTIME_CONTRAST=1 · RUNTIME_CONTRAST_URL · RUNTIME_CONTRAST_BASELINE_FILE
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { PROJECT_ROOT, runSetRatchetCli } = require('./lib/ratchet-baseline');
const { readTokenPalette, TOKEN_MODULES_DIR } = require('./lib/contrast/ts-token-palette');
const { GLOBALS_CSS } = require('./lib/contrast/css-token-themes');
const { evaluateRuntimeMatrix, auditCoverage, ALL_RATCHETED_STATES } = require('./lib/contrast/runtime-matrix');
const { HARNESS_PATH } = require('./lib/contrast/matrix-snapshot');

const ADR = 'ADR-770 Στρώμα 2β (CHECK 3.40)';

function baselineFile() {
  return process.env.RUNTIME_CONTRAST_BASELINE_FILE
    || path.join(PROJECT_ROOT, '.runtime-contrast-baseline.json');
}

/** Ταυτότητα παραβίασης = κατάσταση + ταυτότητα δήλωσης. Χωρίς γραμμή, χωρίς τιμή. */
const violationId = (f) => `${f.state}::${f.id}`;

/** Το κλειστό σύνολο: κάθε δήλωση που ο browser λύνει σε χρώμα με σημασιολογικό ρόλο. */
function declarationIds(result) {
  return [...new Set(result.findings.map((f) => f.declId))].sort();
}

function analyse(snapshots) {
  const astPalette = readTokenPalette(PROJECT_ROOT);
  const result = evaluateRuntimeMatrix(snapshots, astPalette);
  const coverage = auditCoverage(result);
  if (!coverage.balanced) {
    throw new Error(
      `η λογιστική κάλυψης ΔΕΝ κλείνει (${coverage.actual}/${coverage.expected}, `
      + `ακριτες κρίσιμες: ${coverage.unjudgedJudgeable.length}) — σιωπηλή απόρριψη, fail-closed.`
      + (coverage.unjudgedJudgeable.length
        ? `\n   π.χ. ${coverage.unjudgedJudgeable.slice(0, 5).join(', ')}`
        : ''),
    );
  }
  const violations = result.findings.filter((f) => ALL_RATCHETED_STATES.includes(f.state));
  return {
    result,
    coverage,
    violations,
    violationIds: violations.map(violationId).sort(),
    declarations: declarationIds(result),
  };
}

function buildPayload(m) {
  return {
    adr: ADR,
    generated_from: [HARNESS_PATH, TOKEN_MODULES_DIR, GLOBALS_CSS],
    note:
      'ΔΕΝ είναι δείκτης υγείας: μετρά δηλώσεις χρώματος που ο BROWSER λύνει και που είναι '
      + 'δομικά ασύμβατες με δύο θέματα, συν τρεις καταστάσεις αδύνατες στατικά. Η θεραπεία '
      + 'είναι μετανάστευση σε hsl(var(--…)), όχι μικρότερος αριθμός.',
    violation_count: m.violationIds.length,
    declaration_count: m.declarations.length,
    by_state: m.result.byState,
    counts: m.result.counts,
    unjudged: m.result.unjudged,
    violations: m.violationIds,
    declarations: m.declarations,
  };
}

function printReport(m) {
  const { result } = m;
  console.log(`${ADR} — πλέγμα αντίθεσης σε χρόνο εκτέλεσης (${HARNESS_PATH})\n`);
  console.log('  ΜΕΤΡΗΣΕΙΣ');
  for (const [k, v] of Object.entries(result.counts)) console.log(`    ${k.padEnd(22)} ${v}`);
  console.log('\n  ΓΕΦΥΡΩΣΗ ΜΕ ΤΟΝ ΠΗΓΑΙΟ ΚΩΔΙΚΑ (ο παρονομαστής του ast-runtime-divergence)');
  for (const [k, v] of Object.entries(result.bridge)) {
    const why = k === 'exact' ? 'ίδιο μονοπάτι στο AST — συγκρίσιμο'
      : k === 'export' ? 'το AST ξέρει το αρχείο, όχι τη δήλωση (αναφορά, όχι literal)'
        : 'άγνωστη προέλευση';
    console.log(`    ${k.padEnd(8)} ${String(v).padStart(4)}   ${why}`);
  }
  console.log('\n  ΑΝΑ ΚΑΤΑΣΤΑΣΗ');
  for (const [state, n] of Object.entries(result.byState).sort()) {
    console.log(`    ${ALL_RATCHETED_STATES.includes(state) ? '🔴' : '✅'} ${state.padEnd(26)} ${n}`);
  }
  console.log('\n  ΡΗΤΑ ΑΚΡΙΤΑ — το «0» δεν σημαίνει ποτέ «δεν κοίταξα»');
  for (const [k, v] of Object.entries(result.unjudged)) console.log(`     · ${k.padEnd(24)} ${v}`);
  console.log(`\n  ΛΟΓΙΣΤΙΚΗ: ${m.coverage.actual}/${m.coverage.expected} — κλείνει: ${m.coverage.balanced ? 'ΝΑΙ' : 'ΟΧΙ'}`);
  console.log('\n  ΠΑΡΑΒΙΑΣΕΙΣ ΑΝΑΛΥΤΙΚΑ');
  for (const f of m.violations) console.log(`    [${f.state}] ${f.file}:${f.line}\n       ${f.detail}`);
}

function argValue(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

/**
 * Η ΣΥΛΛΟΓΗ — το μόνο κομμάτι που διαφέρει από την 3.39: εκείνη διαβάζει αρχεία, αυτή
 * ρωτά έναν browser. Μετά το `measure()`, το control-flow είναι **ταυτόσημο** και ζει
 * μία φορά στο `runSetRatchetCli`.
 *
 * `--from <αρχείο>`   κρίνε αποθηκευμένο στιγμιότυπο (χωρίς browser — και για τα tests)
 * `--snapshot <αρχείο>` γράψε ό,τι μαζεύτηκε (το CI το ανεβάζει ως artifact πάντα)
 */
async function measure(args) {
  const fromFile = argValue(args, '--from');
  const snapshotOut = argValue(args, '--snapshot');

  let snapshots;
  if (fromFile) {
    snapshots = JSON.parse(fs.readFileSync(fromFile, 'utf8'));
  } else {
    // eslint-disable-next-line global-require -- φορτώνεται μόνο όταν χρειάζεται browser
    const { collectSnapshots } = require('./lib/contrast/matrix-snapshot');
    try {
      snapshots = await collectSnapshots();
    } catch (e) {
      throw new Error(
        `${e.message}\n   Χρειάζεται dev server: npm run dev   (ή RUNTIME_CONTRAST_URL=…)`,
      );
    }
  }
  if (snapshotOut) {
    fs.writeFileSync(snapshotOut, JSON.stringify(snapshots, null, 1));
    console.log(`✅ Στιγμιότυπο: ${snapshotOut}`);
  }
  return analyse(snapshots);
}

const DESCRIPTOR = {
  adr: 'CHECK 3.40',
  skipEnv: 'SKIP_RUNTIME_CONTRAST',
  get baselineFile() { return baselineFile(); },
  measure,
  buildPayload,
  printReport,
  violationId,
  labels: { violations: 'παραβιάσεις', declarations: 'δηλώσεις' },
  messages: {
    worse: 'η αντίθεση σε χρόνο εκτέλεσης χειροτέρεψε',
    newDeclLabel: 'ΝΕΑ ΔΗΛΩΣΗ ΧΡΩΜΑΤΟΣ',
    newDeclAdvice: [
      'Κάθε νέα δήλωση σταθερού χρώματος σε σημασιολογικό ρόλο μπλοκάρει,',
      'ακόμα κι αν σήμερα περνά και στα δύο θέματα: θα σπάσει μόλις',
      "μετακινηθεί μια επιφάνεια. Γράψ' το θεματικά:  hsl(var(--token))",
    ],
  },
  commands: {
    report: 'npm run runtime-contrast:report',
    baseline: 'npm run runtime-contrast:baseline',
    seed: 'npm run runtime-contrast:baseline',
  },
};

const main = (argv = process.argv) => runSetRatchetCli(DESCRIPTOR, argv);

if (require.main === module) {
  main().catch((e) => {
    console.error(`❌ ${ADR} — απρόσμενο σφάλμα: ${e.message}`);
    process.exit(1);
  });
}

module.exports = { analyse, measure, buildPayload, violationId, declarationIds, baselineFile, main };
