/**
 * Το κοινό `main` των πυλών κατάστιχου «σύνορο / μητρώο» (CHECK 3.61 · 3.75 · 3.95): παράκαμψη → σκανδάλη →
 * ΕΙΣΟΔΟΣ (ADR-924: `--index` ⇒ η όψη του commit) → σάρωση → κατάστιχο (κάθε κάδος, και στο μηδέν) → εύρημα + θεραπεία.
 *
 * 🧹 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (ADR-924 §8.8, jscpd): τρία δίδυμα `main` + τρεις δίδυμοι εκτυπωτές γραμμής κατάστιχου.
 *
 * @module scripts/lib/import-boundary/cli
 */

'use strict';

const { openGateInput, INDEX_FLAG } = require('../gate-input');

const GREEN = '\x1b[0;32m';
const RED = '\x1b[0;31m';
const YELLOW = '\x1b[1;33m';
const DIM = '\x1b[2m';
const NC = '\x1b[0m';

/** Μία γραμμή κατάστιχου — ⛔/✅ μόνο για τις μπλοκάρουσες καταστάσεις. */
function ledgerRow(tally, state, blocking, width = 24) {
  const mark = blocking.includes(state) ? (tally[state] > 0 ? '⛔' : '✅') : '  ';
  console.log(`${DIM}     ${mark} ${state.padEnd(width)} ${String(tally[state]).padStart(7)}${NC}`);
}

/** Τίτλος ενότητας κατάστιχου. */
function ledgerTitle(text) {
  console.log(`${DIM}  ${text}${NC}`);
}

/**
 * @param {{check: string, skipEnv: string, affects: (file: string) => boolean, root: string,
 *          sweep: (input: object) => {violations: object[]}, printLedger: (result: object) => void,
 *          ok: string, found: (n: number) => string, advice: string[]}} spec
 * @returns {number} κωδικός εξόδου
 */
function runLedgerGate(spec, argv = process.argv) {
  if (process.env[spec.skipEnv]) return 0;
  // Η ΣΚΑΝΔΑΛΗ αποφασίζει **ΑΝ** τρέχει, ποτέ **ΠΟΣΟ** σαρώνει· και ο κώδικας της πύλης είναι σκανδάλη (3.43 · 3.57).
  const staged = argv.slice(2).filter((a) => !a.startsWith('--'));
  if (staged.length > 0 && !staged.some(spec.affects)) return 0;

  const result = spec.sweep(openGateInput({ root: spec.root, index: argv.includes(INDEX_FLAG) }));
  spec.printLedger(result);
  if (result.violations.length === 0) {
    console.log(`${GREEN}  ✅ CHECK ${spec.check} — ${spec.ok}${NC}`);
    return 0;
  }
  console.log(`${RED}  🚫 CHECK ${spec.check} — ${spec.found(result.violations.length)}:${NC}`);
  for (const v of result.violations) console.log(`${YELLOW}     [${v.state}] ${v.rel} — ${v.detail}${NC}`);
  for (const line of spec.advice) console.log(`${DIM}     ${line}${NC}`);
  return 1;
}

/** Το `require.main` μιας τέτοιας πύλης: κωδικός εξόδου, και σφάλμα μέτρησης ⇒ 1 με όνομα (fail-closed). */
function runAsScript(main, check) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(`${RED}⛔ CHECK ${check} — ${error.message}${NC}`);
    process.exit(1);
  }
}

module.exports = { ledgerRow, ledgerTitle, runLedgerGate, runAsScript, DIM, NC };
