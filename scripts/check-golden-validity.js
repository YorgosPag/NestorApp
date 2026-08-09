#!/usr/bin/env node
'use strict';

/**
 * 🔴 ADR-775 §16 — ΠΥΛΗ ΕΓΚΥΡΟΤΗΤΑΣ ΒΑΣΕΩΝ (golden)
 *
 * *«Απεικονίζει αυτή η βάση σύγκρισης αυτό που ισχυρίζεται ότι ελέγχει;»*
 *
 * Ντετερμινιστική: **PNG + AST**. Κανένας browser, κανένας dev server, καμία εικασία.
 *
 * ⚠️ **ΔΕΝ είναι ratchet — καμία baseline, ποτέ.** Δεν υπάρχει «λιγότερες άκυρες βάσεις από
 * χθες»: **μία** άκυρη βάση είναι ένα test που δεν μπορεί να αποτύχει, δηλαδή ψεύτικη κάλυψη
 * — και η ψεύτικη κάλυψη είναι χειρότερη από καθόλου, γιατί απαντά «πράσινο» σε ερώτηση που
 * κανείς δεν έκανε.
 *
 * ⚠️ Τα μη-μπλοκάροντα κελιά τυπώνονται **ΑΚΟΜΑ ΚΑΙ ΣΤΟ ΜΗΔΕΝ**: ένα «0» που δεν τυπώνεται
 * διαβάζεται ως «δεν υπάρχει τέτοιος έλεγχος» (μάθημα CHECK 3.48 / `Κ6`).
 *
 * Η **σάρωση** ζει στο `lib/golden-triage/scan.js`, η **κρίση** στο `lib/golden-triage/validity.js`.
 * Εδώ μένει μόνο η **αναφορά** — ώστε οι δοκιμές να μεταλλάσσουν εισόδους, όχι την πύλη.
 */

const path = require('node:path');

const { CONFIG_PATH } = require('./lib/e2e-executability/project-identity');
const { scanRepo } = require('./lib/golden-triage/scan');
const { evaluate, STATES } = require('./lib/golden-triage/validity');

const ROOT = path.resolve(__dirname, '..');

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

function printCensus(census, label) {
  console.log(C.dim(`\n  ${label}`));
  for (const [state, count] of Object.entries(census)) {
    const mark = STATES[state].blocking ? '⛔' : '✅';
    console.log(C.dim(`    ${mark} ${state.padEnd(22)} ${String(count).padStart(4)}  `
      + `${STATES[state].why}`));
  }
  const total = Object.values(census).reduce((a, b) => a + b, 0);
  console.log(C.dim(`    ${' '.repeat(25)}${String(total).padStart(4)}  ΣΥΝΟΛΟ (κλειστή λογιστική)`));
}

function subjectOf(row) {
  return row.specFile ? `${row.specFile}:${row.line} → ${row.arg}` : row.rel;
}

function detailOf(row) {
  if (row.state === 'indistinct-baselines') return `ταυτόσημη με: ${row.twins.join(', ')}`;
  if (row.state === 'blank-baseline') {
    const { r, g, b } = row.stats.dominant;
    return `όλη η εικόνα rgb(${r},${g},${b}) — 0 pixels διαφορετικού χρώματος`;
  }
  if (row.state === 'orphan-baseline') return 'κανένα assertion δεν ζητά αυτό το όνομα';
  return STATES[row.state].why;
}

function reportUnparsed(unparsed) {
  console.error(C.red(`\n✗ ${unparsed.length} αρχείο(α) βάσης δεν ταιριάζουν στο πρότυπο `
    + 'ονομασίας — fail-closed, δεν σιωπούν:'));
  for (const f of unparsed) console.error(C.dim(`    ${f.rel}`));
}

function main() {
  const verbose = process.argv.includes('--verbose');
  const scan = scanRepo(ROOT);
  const unparsed = scan.files.filter((f) => f.unparsed);
  if (unparsed.length > 0) {
    reportUnparsed(unparsed);
    return 1;
  }

  const result = evaluate(scan);

  console.log(C.dim(`  πηγή projects : ${CONFIG_PATH} (${scan.projects.length})`));
  console.log(C.dim(`  πρότυπα βάσης : ${scan.templates.length} · ${scan.files.length} αρχεία · `
    + `${scan.expectations.length} προσδοκίες σε ${scan.specFiles.length} spec`));
  printCensus(result.census.file, 'ΣΥΜΠΑΝ Α — αρχεία βάσης');
  printCensus(result.census.expectation, 'ΣΥΜΠΑΝ Β — προσδοκίες spec');

  if (verbose) {
    console.log('');
    for (const e of result.expectations.filter((r) => r.state !== 'satisfied-expectation')) {
      console.log(C.yellow(`    🔶 ${e.state.padEnd(22)} ${subjectOf(e)}`
        + (e.reason ? ` — ${e.reason}` : '')));
    }
  }

  if (result.findings.length === 0) {
    console.log(C.green('\n✓ CHECK εγκυρότητας golden PASS — καμία άκυρη βάση\n'));
    return 0;
  }

  console.log('');
  for (const f of result.findings) {
    console.error(C.red(`  [FAIL] ${f.state.padEnd(22)} ${subjectOf(f)}`));
    console.error(C.dim(`         ${detailOf(f)}`));
  }
  console.error(C.red(`\n✗ FAIL — ${result.findings.length} άκυρη(ες) βάση(εις)\n`));
  return 1;
}

process.exit(main());
