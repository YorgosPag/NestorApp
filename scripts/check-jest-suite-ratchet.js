#!/usr/bin/env node
'use strict';

/**
 * =============================================================================
 * ADR-783 — Η ΚΡΙΣΗ: ratchet αποτελέσματος **κατά ταυτότητα αρχείου**
 * =============================================================================
 *
 * Καταναλωτής του `.jest-suite-results.json` που παράγει το `run-jest-suite.js`. Δεν τρέχει
 * tests· κρίνει γεγονότα.
 *
 * ## Γιατί ratchet και όχι «η σουίτα πρέπει να είναι πράσινη»
 * Το `unit.yml` **υπήρχε** και ήταν απενεργοποιημένο. Ο λόγος που ένα workflow απενεργοποιείται
 * είναι πάντα ο ίδιος: γεννήθηκε κόκκινο, έμεινε κόκκινο, έγινε θόρυβος, σβήστηκε. Μια πύλη
 * μονίμως κόκκινη **δεν είναι αυστηρότερη** — είναι ανενεργή (δοκιμάστηκε και απορρίφθηκε
 * ρητά στο CHECK 3.39, και ξανά στο 3.49 για τις 140 συγκρούσεις).
 *
 * Άρα: **το γνωστό χρέος δηλώνεται, κάθε νέο κόκκινο μπλοκάρει.** Είναι το μοντέλο
 * `TestExpectations` του Chromium/WebKit και το quarantine του Google TAP — με μία διαφορά
 * υπέρ μας: εκείνα δηλώνουν *αναμενόμενα αποτελέσματα* ανά test, εδώ η ταυτότητα είναι το
 * **αρχείο** και το σύνολο συγκρίνεται **κατά ταυτότητα**, οπότε μια **ανταλλαγή**
 * (θεραπεύεται το Α, σπάει το Β, «5 → 5») **μπλοκάρει** — το μάθημα του ADR-749.
 *
 * ## Η αστάθεια καταγράφεται, δεν κρίνεται σιωπηλά
 * Αρχείο που απέτυχε και **πέρασε στη δεύτερη εκτέλεση** δεν είναι σπασμένο· είναι ασταθές.
 * Μπαίνει στο **δεύτερο** σύνολο (`declarations`), άρα ένα **νέο** ασταθές αρχείο μπλοκάρει
 * μία φορά και η θεραπεία είναι να **δηλωθεί** — δηλαδή να αποκτήσει όνομα και ιδιοκτήτη
 * αντί να είναι θόρυβος που όλοι ξαναπροσπαθούν.
 *
 * ⚠️ **ΜΗΝ κάνεις reseed** επειδή «λιγότερα ασταθή σήμερα»: ένα ασταθές αρχείο που απλώς
 * δεν εμφανίστηκε **δεν** θεραπεύτηκε. *Απουσία δεν είναι πρόοδος* (μάθημα CHECK 3.38).
 */

const path = require('node:path');
const fs = require('node:fs');

const { PROJECT_ROOT, runSetRatchetCli } = require('./lib/ratchet-baseline');
const { RESULTS_FILE } = require('./run-jest-suite');

const BASELINE_FILE = path.join(PROJECT_ROOT, '.jest-suite-baseline.json');

/** Διαβάζει τα γεγονότα — και **αρνείται** να κρίνει μισή εκτέλεση. */
function measure() {
  const file = path.join(PROJECT_ROOT, RESULTS_FILE);
  if (!fs.existsSync(file)) {
    throw new Error(
      `λείπει το ${RESULTS_FILE}. Τρέξε πρώτα «node scripts/run-jest-suite.js» — η κρίση ` +
        'είναι καταναλωτής γεγονότων, ποτέ παραγωγός τους.',
    );
  }
  const results = JSON.parse(fs.readFileSync(file, 'utf8'));

  if (results.complete !== true) {
    throw new Error(
      `η εκτέλεση είναι ΑΤΕΛΗΣ: ${results.executed}/${results.expected} αρχεία. Ένα μερικό ` +
        'τρέξιμο που διαβάζεται ως «καθαρό» είναι ακριβώς το σχήμα «0 = κανείς δεν κοίταξε».',
    );
  }

  return {
    violationIds: results.failing,
    declarations: results.flaky,
    violations: results.failing.map((f) => ({ file: f, line: 0, state: 'failing', detail: 'απέτυχε δύο φορές' })),
    rerunSkipped: results.rerunSkipped === true,
    executed: results.executed,
  };
}

runSetRatchetCli(
  {
    adr: 'ADR-783 (jest suite result ratchet)',
    skipEnv: 'SKIP_JEST_SUITE_RATCHET',
    scriptName: 'scripts/check-jest-suite-ratchet.js',
    baselineFile: BASELINE_FILE,
    measure,
    buildPayload: (m) => ({
      adr: 'ADR-783',
      why: 'Γνωστό χρέος: αρχεία test που απέτυχαν ΔΥΟ φορές. Κάθε νέο μπλοκάρει.',
      executed: m.executed,
      violations: m.violationIds,
      declarations: m.declarations,
    }),
    printReport: (m) => {
      console.log(`\nADR-783 — αποτέλεσμα σουίτας (${m.executed} αρχεία εκτελέστηκαν)`);
      console.log(`  ⛔ σπασμένα (2/2 αποτυχίες) : ${m.violationIds.length}`);
      console.log(`  🔶 ασταθή (1/2 αποτυχίες)   : ${m.declarations.length}`);
      if (m.rerunSkipped) console.log('  ⚠️  η δεύτερη εκτέλεση ΠΑΡΑΛΕΙΦΘΗΚΕ — πάρα πολλές αποτυχίες');
      for (const file of m.violationIds) console.log(`     ❌ ${file}`);
      for (const file of m.declarations) console.log(`     🔶 ${file}`);
      console.log('');
    },
    labels: { violations: 'σπασμένα αρχεία', declarations: 'ασταθή' },
    messages: {
      worse: 'νέο κόκκινο test στο main',
      newDeclLabel: 'νέο ΑΣΤΑΘΕΣ αρχείο (πέρασε στη δεύτερη εκτέλεση)',
      newDeclAdvice: [
        'Η αστάθεια δεν είναι «περάστε ξανά»: είναι ελάττωμα με ιδιοκτήτη.',
        'Διόρθωσέ την, ή δήλωσέ την στη baseline ώστε να έχει όνομα.',
      ],
    },
    commands: {
      report: 'npm run jest-suite:report',
      baseline: 'npm run jest-suite:baseline',
      seed: 'GitHub Actions → «T2 🧪 Jest Suite Execution» → Run workflow (seed=true)',
    },
    violationId: (violation) => violation.file,
  },
  process.argv,
);
