#!/usr/bin/env node
'use strict';

/**
 * =============================================================================
 * CHECK 3.54 — ΠΥΛΗ ΕΚΤΕΛΕΣΗΣ ΤΩΝ ΑΓΚΥΡΩΝ  (ADR-783)
 * =============================================================================
 *
 * «**Μπορεί αυτό το αρχείο test να κοκκινίσει κάτι;**»
 *
 * Το CHECK 3.47 ρωτά *ποιος το διεκδικεί* (ποιο `jest.config*.js`). Αυτό ρωτά *ποιος το
 * **εκτελεί**, και τι γίνεται όταν αποτύχει*. Είναι διαφορετικό ερώτημα με διαφορετική
 * απάντηση: μετρημένο στις 2026-08-11 με αυτή την ίδια πύλη, **3.289 από τα 3.458**
 * κρινόμενα αρχεία test εκτελούνταν σε κάθε PR και **κανένα δεν μπορούσε να κοκκινίσει
 * τίποτα** — τρέχουν μέσα από το `coverage-ratchet.yml`, που έχει `continue-on-error: true`
 * (σωστά, για τον δικό του σκοπό) και κρίνει **ποσοστό κάλυψης**, όχι pass/fail.
 *
 * ## Γιατί ΠΥΛΗ και όχι «ένα workflow ακόμη»
 * Το ελάττωμα ονομάστηκε **τρεις** φορές και λύθηκε **τρεις** φορές τοπικά:
 *   · ADR-587 §6.1 — 11 tests κόκκινα στο main επί 6 commits ⇒ `capability-anchors.yml`
 *   · ADR-775 §11  — 369 e2e tests που δεν τρέχει κανένα workflow ⇒ **ανοιχτό**
 *   · ADR-782 §3   — οι άγκυρες `Β`/`Ψ`/`Φ` δεν μπλοκάρουν ⇒ αφορμή αυτού του ADR
 * Κάθε λύση ήταν μια **χειρόγραφη λίστα σουιτών** μέσα σε ένα workflow. Είκοσι εννέα
 * τέτοιες κλήσεις σήμερα — το ίδιο σχήμα με τις δύο λίστες namespace του CHECK 3.34, που
 * είχαν αποκλίνει κατά **63** χωρίς καμία πύλη να τις συγκρίνει. Ένα anchor χωρίς gate
 * είναι σχόλιο (CHECK 3.36)· ένα gate που ονομάζει τα δικά του anchors είναι **λίστα**.
 *
 * ## ΤΡΕΙΣ ΑΝΕΞΑΡΤΗΤΕΣ ΕΡΩΤΗΣΕΙΣ — ΠΟΤΕ ΜΙΑ ΜΕ «Ή» (μάθημα CHECK 3.41)
 *   **Ε1** Φτάνει σε αυτό το αρχείο κάποια κλήση εκτελεστή;      → `unexecuted`
 *   **Ε2** Μπορεί αυτή η κλήση να αποτύχει;                      → `non-blocking-only`
 *   **Ε3** Καταλαβαίνω κάθε κλήση που μοιάζει με εκτέλεση;       → `unresolvable-command`
 * Ένας κανόνας με «ή» θα έμενε πράσινος πάνω στο ίδιο το ελάττωμα: το `coverage-ratchet`
 * απαντά **ναι** στην Ε1 για **όλα** τα αρχεία του default config.
 *
 * ## ⚠️ ZERO-TOLERANCE, ΚΑΜΙΑ BASELINE, ΠΟΤΕ
 * Δεν υπάρχει «λιγότερα ανεκτέλεστα από χθες»: **ένα** αρκεί για να ζήσει ένα κόκκινο test
 * στο main επί έξι commits, που είναι ακριβώς το μετρημένο ιστορικό. Είναι εφικτό ως
 * zero-tol **επειδή** ο εκτελεστής (`jest-suite.yml`) προηγείται — όχι επειδή ελπίζουμε.
 *
 * ## Escape
 * `SKIP_ANCHOR_EXECUTION=1` — και η **ονομαστική** διαφυγή είναι το `.anchor-execution.json`
 * (κλειστό σύνολο, λόγος υποχρεωτικός).
 */

const {
  BLOCKING_COMMAND_STATES,
  BLOCKING_FILE_STATES,
  COMMAND_STATES,
  DECLARATIONS_FILE,
  FILE_STATES,
  GAP_FILE_STATES,
  buildExecutionCensus,
} = require('./lib/anchor-execution/census');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const NC = '\x1b[0m';

/** Γιατί υπάρχει κάθε κατάσταση — το κείμενο είναι μέρος της πύλης, όχι διακόσμηση. */
const WHY = {
  unexecuted: 'κανένα workflow δεν το τρέχει ⇒ γράφτηκε, δεν εκτελείται, κανείς δεν το μαθαίνει',
  'non-blocking-only': 'εκτελείται ΜΟΝΟ μέσα από continue-on-error ⇒ η αποτυχία του δεν αλλάζει τίποτα',
  'blocking-path-filtered': 'μπλοκάρει, αλλά το workflow ξυπνά με φίλτρο διαδρομών ⇒ αλλαγή αλλού δεν το ξυπνά',
  'blocking-unconditional': 'το τρέχει workflow που ξυπνά πάντα και η αποτυχία του κοκκινίζει',
  'declared-exempt': `δηλωμένη εξαίρεση με λόγο στο ${DECLARATIONS_FILE}`,
  'outside-partition': 'το κρίνει ήδη το CHECK 3.47 (αστάδιαστο/αγνοημένο/διπλοδιεκδικούμενο)',
  'unresolvable-command': 'εντολή που μοιάζει με εκτέλεση test και ΔΕΝ αναλύεται ⇒ ποτέ σιωπηλή απόρριψη',
  'orphan-declaration': 'δήλωση εξαίρεσης για αρχείο που δεν υπάρχει ⇒ η εξαίρεση προστατεύει το τίποτα',
  'reasonless-declaration': 'δήλωση εξαίρεσης χωρίς λόγο ⇒ λίστα, όχι απόφαση',
  'execution-blocking': 'κλήση που μπορεί να κοκκινίσει',
  'execution-non-blocking': 'κλήση με continue-on-error',
  'execution-conditional': 'κλήση σε βήμα με if: ⇒ δεν είναι εγγύηση εκτέλεσης',
  'execution-manual-only': 'κλήση σε workflow χωρίς αυτόματη σκανδάλη',
  'execution-disabled-workflow': 'κλήση μέσα σε αρχείο .disabled ⇒ δεν τρέχει ποτέ',
  'execution-tolerated': 'κλήση με «|| …» και τίποτα μετά ⇒ η αποτυχία της καταπίνεται',
};

/** 🔶 Καταστάσεις κλήσης που δεν είναι παράβαση, αλλά δεν είναι και εγγύηση. */
const COMMAND_GAP_STATES = [
  'execution-non-blocking',
  'execution-conditional',
  'execution-manual-only',
  'execution-disabled-workflow',
  'execution-tolerated',
];

/** Τα αρχεία που πυροδοτούν τον έλεγχο. Η σκανδάλη ζει ΕΔΩ, όχι σε λίστα του runner. */
const TRIGGERS = [
  /^\.github\/workflows\//,
  /^package\.json$/,
  /^jest\.config[^/]*\.js$/,
  /^playwright\.config\.ts$/,
  /^\.anchor-execution\.json$/,
  /^scripts\/(check-anchor-execution\.js|lib\/anchor-execution\/|lib\/ci\/workflow-meta\.js)/,
  /\.(test|spec)\.[jt]sx?$/,
];

function triggers(files) {
  return files.some((file) => TRIGGERS.some((re) => re.test(file.replace(/\\/g, '/'))));
}

function printLedger(title, ledger, blocking, gaps) {
  console.log(`\n  ${title}`);
  for (const [state, count] of Object.entries(ledger)) {
    const mark = blocking.includes(state) ? '⛔' : gaps.includes(state) ? '🔶' : '✅';
    console.log(`    ${mark} ${state.padEnd(28)} ${String(count).padStart(5)}  ${DIM}${WHY[state]}${NC}`);
  }
}

function main(argv) {
  if (process.env.SKIP_ANCHOR_EXECUTION === '1') return 0;

  const report = argv.includes('--report');
  const all = argv.includes('--all') || report;
  const staged = argv.filter((arg) => !arg.startsWith('-'));
  if (!all && staged.length > 0 && !triggers(staged)) return 0;

  const census = buildExecutionCensus(process.cwd());

  if (report) {
    console.log('\nCHECK 3.54 — απογραφή εκτέλεσης αγκυρών (ADR-783)');
    console.log(`  ${census.judged} κρινόμενα αρχεία test · ${census.total} στην απογραφή 3.47`);
    printLedger('αρχεία', census.fileLedger, BLOCKING_FILE_STATES, GAP_FILE_STATES);
    printLedger('κλήσεις εκτελεστή', census.commandLedger, BLOCKING_COMMAND_STATES, COMMAND_GAP_STATES);
    console.log('');
    return 0;
  }

  if (census.violations.length > 0) {
    console.log(`\n${RED}═══════════════════════════════════════════════════════════════════${NC}`);
    console.log(`${RED}  🚫 COMMIT BLOCKED — άγκυρα χωρίς εκτελεστή (CHECK 3.54 · ADR-783)${NC}`);
    console.log(`${RED}═══════════════════════════════════════════════════════════════════${NC}\n`);
    for (const violation of census.violations.slice(0, 25)) {
      console.log(`  ❌ ${violation.file}`);
      console.log(`     [${violation.state}] ${WHY[violation.state]}`);
      if (violation.detail) console.log(`     ${DIM}${violation.detail}${NC}`);
    }
    if (census.violations.length > 25) {
      console.log(`\n  ${DIM}… και άλλα ${census.violations.length - 25}${NC}`);
    }
    console.log(`\n  ${YELLOW}Ένα test που δεν μπορεί να κοκκινίσει τίποτα είναι σχόλιο (CHECK 3.36).${NC}`);
    console.log(`  ${YELLOW}Θεραπεία: κάν' το να το τρέχει το jest-suite.yml (η ιδιοκτησία λύνεται στο 3.47),${NC}`);
    console.log(`  ${YELLOW}ή δήλωσέ το ΜΕ ΛΟΓΟ στο ${DECLARATIONS_FILE}.${NC}`);
    console.log(`\n  Αναφορά: npm run anchor-execution:report\n`);
    return 1;
  }

  const { fileLedger } = census;
  console.log(
    `${GREEN}✅ CHECK 3.54 — κάθε άγκυρα έχει εκτελεστή${NC} ` +
      `(${fileLedger['blocking-unconditional']} μπλοκάρουν · ` +
      `${fileLedger['blocking-path-filtered']} με φίλτρο διαδρομών · ` +
      `${fileLedger['declared-exempt']} δηλωμένες εξαιρέσεις)`,
  );
  return 0;
}

module.exports = {
  BLOCKING_COMMAND_STATES,
  BLOCKING_FILE_STATES,
  COMMAND_GAP_STATES,
  COMMAND_STATES,
  FILE_STATES,
  TRIGGERS,
  WHY,
  main,
  triggers,
};

if (require.main === module) process.exit(main(process.argv.slice(2)));
