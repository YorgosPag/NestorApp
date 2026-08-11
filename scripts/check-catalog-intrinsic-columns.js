#!/usr/bin/env node
/**
 * **CHECK 3.55 — Η ΠΥΛΗ ΤΟΥ ΚΑΤΑΛΟΓΟΥ** (ADR-784).
 *
 * «**Ρωτά αυτό το πλέγμα το ΠΑΡΑΘΥΡΟ για κάτι που είναι ΚΑΤΑΛΟΓΟΣ;**»
 *
 * Το σκεπτικό, οι μετρήσεις και το «γιατί τα παιδιά και όχι το αρχείο» ζουν στη μηχανή:
 * `scripts/lib/catalog-columns/scan.js`. Εδώ ζει **μόνο** ο μηχανισμός ratchet.
 *
 * ⚠️ **ΓΙΑΤΙ RATCHET ΚΑΙ ΟΧΙ ZERO-TOL** — δοκιμάστηκε και απορρίφθηκε στο CHECK 3.39 με τον
 * ίδιο συλλογισμό: υπάρχουν **ζωντανές** παραβιάσεις σήμερα, άρα zero-tolerance σημαίνει
 * μονίμως κόκκινη πύλη ⇒ παρακάμπτεται με `SKIP_` ⇒ διακοσμητική.
 *
 * ⚠️ **Ο ΑΡΙΘΜΟΣ ΔΕΝ ΕΙΝΑΙ ΔΕΙΚΤΗΣ ΥΓΕΙΑΣ.** Μετρά «πόσοι κατάλογοι δεν ρωτούν **ακόμη**
 * το δοχείο τους». Η θεραπεία είναι **ανά περίπτωση κρίση** — όχι μικρότερος αριθμός. Ένα
 * πλέγμα που θα άλλαζε σε εγγενές **ενώ είναι σταθερής αρίτητας** μειώνει τον αριθμό και
 * **χαλάει** την οθόνη.
 *
 * Εντολές:
 *   node scripts/check-catalog-intrinsic-columns.js                  # έλεγχος
 *   node scripts/check-catalog-intrinsic-columns.js --report         # αναφορά
 *   node scripts/check-catalog-intrinsic-columns.js --write-baseline # reseed
 *
 * Escape: `SKIP_CATALOG_COLUMNS=1`
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { PROJECT_ROOT, runSetRatchetCli } = require('./lib/ratchet-baseline');
const {
  ALL_STATES, RATCHETED_STATES, DECLARED_GAPS,
  scanFile, collectFiles,
} = require('./lib/catalog-columns/scan');

const ADR = 'CHECK 3.55 (ADR-784)';
const BASELINE = '.catalog-columns-baseline.json';

const rel = (p) => path.relative(PROJECT_ROOT, p).replace(/\\/g, '/');

/**
 * ⚠️ **Η ταυτότητα ΔΕΝ κουβαλά γραμμή.** Μια μετακίνηση 20 γραμμών πιο κάτω δεν είναι
 * «διόρθωση + νέα παραβίαση» — είναι η ίδια παραβίαση. Ίδια απόφαση με το CHECK 3.53.
 * Κουβαλά όμως το **κείμενο** της κλάσης: δύο διαφορετικά πλέγματα στο ίδιο αρχείο είναι
 * δύο ξεχωριστές αποφάσεις και πρέπει να μετρώνται χωριστά.
 */
const violationId = (f) => `${f.state}::${rel(f.file)}::${f.detail}`;

function measure() {
  const files = collectFiles(PROJECT_ROOT);
  const findings = [];
  let opaque = 0;
  let parseFailed = 0;

  for (const file of files) {
    const r = scanFile(file, fs.readFileSync(file, 'utf8'));
    if (r.parseFailed) { parseFailed += 1; continue; }
    findings.push(...r.findings);
    opaque += r.opaque;
  }

  const byState = Object.fromEntries(ALL_STATES.map((s) => [s, 0]));
  for (const f of findings) byState[f.state] += 1;

  /**
   * ⚠️ **FAIL-CLOSED ΣΤΗ ΛΟΓΙΣΤΙΚΗ.** Αν έστω ένα πλέγμα δεν μπήκε σε κατάσταση, η πύλη
   * **σκάει** αντί να αναφέρει «καθαρό»: ένα άθροισμα που κλείνει χωρίς να ρωτά «ποιος
   * κρίθηκε» επικυρώνει τον εαυτό του (μάθημα του CHECK 3.40).
   */
  const placed = ALL_STATES.reduce((a, s) => a + byState[s], 0);
  if (placed !== findings.length) {
    throw new Error(
      `η λογιστική ΔΕΝ κλείνει (${placed}/${findings.length}) — σιωπηλή απόρριψη, fail-closed.`,
    );
  }

  const violations = findings.filter((f) => RATCHETED_STATES.includes(f.state));
  return {
    files: files.length,
    findings,
    byState,
    opaque,
    parseFailed,
    violations,
    violationIds: [...new Set(violations.map(violationId))].sort(),
    declarations: [...new Set(findings.map((f) => `${rel(f.file)}::${f.detail}`))].sort(),
  };
}

function buildPayload(m) {
  return {
    adr: ADR,
    generated_from: ['src/**/*.tsx (χωρίς subapps · χωρίς __tests__)'],
    note:
      'ΔΕΝ είναι δείκτης υγείας: μετρά πλέγματα των οποίων τα παιδιά προέρχονται από .map() '
      + '(άγνωστο πλήθος) και που παρ΄ όλα αυτά αποφασίζουν το πλήθος στηλών από το πλάτος '
      + 'του ΠΑΡΑΘΥΡΟΥ. Η θεραπεία είναι κρίση ανά περίπτωση — ένα πλέγμα σταθερής αρίτητας '
      + 'που θα γινόταν εγγενές μειώνει τον αριθμό και ΧΑΛΑΕΙ την οθόνη.',
    violation_count: m.violationIds.length,
    declaration_count: m.declarations.length,
    files_scanned: m.files,
    by_state: m.byState,
    declared_blind_spot: {
      opaque_classname: m.opaque,
      parse_failed: m.parseFailed,
      why: 'className που δεν αποδίδεται σε κείμενο. Μετριέται, ΔΕΝ απαριθμείται — '
        + 'πρότυπο «unanalyzable» του CHECK 3.35.',
    },
    violations: m.violationIds,
    declarations: m.declarations,
  };
}

function printReport(m) {
  console.log(`\n${ADR} — «ρωτά αυτό το πλέγμα το ΠΑΡΑΘΥΡΟ για κάτι που είναι ΚΑΤΑΛΟΓΟΣ;»\n`);
  console.log(`  αρχεία: ${m.files}   πλέγματα που κρίθηκαν: ${m.findings.length}\n`);

  for (const s of ALL_STATES) {
    const mark = RATCHETED_STATES.includes(s) ? '🔴' : DECLARED_GAPS.includes(s) ? '🔶' : '✅';
    console.log(`  ${mark} ${s.padEnd(30)} ${String(m.byState[s]).padStart(5)}`);
  }
  console.log(
    `\n  🔶 τυφλό σημείο (μετρημένο, μη απαριθμημένο): ${m.opaque} className χωρίς κείμενο`
    + `${m.parseFailed ? ` · ${m.parseFailed} αρχεία δεν αναλύθηκαν` : ''}`,
  );

  const byFile = new Map();
  for (const v of m.violations) {
    const k = rel(v.file);
    byFile.set(k, (byFile.get(k) || 0) + 1);
  }
  console.log(`\n  ΚΑΤΑΛΟΓΟΙ ΠΟΥ ΡΩΤΟΥΝ ΤΟ ΠΑΡΑΘΥΡΟ (${byFile.size} αρχεία)\n`);
  for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(3)}  ${f}`);
  }
}

const DESCRIPTOR = {
  adr: ADR,
  skipEnv: 'SKIP_CATALOG_COLUMNS',
  baselineFile: path.join(PROJECT_ROOT, BASELINE),
  measure,
  buildPayload,
  printReport,
  violationId,
  labels: { violations: 'κατάλογοι που ρωτούν το παράθυρο', declarations: 'πλέγματα' },
  messages: {
    worse: 'νέος κατάλογος αποφασίζει στήλες από το πλάτος του ΠΑΡΑΘΥΡΟΥ',
    newDeclLabel: 'ΝΕΟΣ ΚΑΤΑΛΟΓΟΣ ΜΕ ΣΚΑΛΑ BREAKPOINT',
    newDeclAdvice: [
      'Τα παιδιά αυτού του πλέγματος βγαίνουν από .map() — το πλήθος τους είναι ΑΓΝΩΣΤΟ.',
      'Μια σκάλα ρωτά «πόσο φαρδύ είναι το ΠΑΡΑΘΥΡΟ», ενώ το πλέγμα ζει σε ΔΟΧΕΙΟ',
      '(split pane · ScrollArea · dialog): το παράθυρο μπορεί να είναι 2560px και το',
      'δοχείο 600px. Ζήτα τον SSoT:',
      '  gridPatterns.cards.media  → κάρτες ΜΕ εικόνα',
      '  gridPatterns.cards.tile   → συμπαγή πλακίδια',
      'Είναι όντως ΣΤΑΘΕΡΗ αρίτητα (π.χ. 4 πλακίδια KPI); Τότε μη χρησιμοποιείς .map()',
      'με σκάλα — γράψε τα παιδιά ρητά, ή τεκμηρίωσε γιατί το πλήθος είναι σταθερό.',
    ],
  },
  commands: {
    report: 'npm run catalog-columns:report',
    baseline: 'npm run catalog-columns:baseline',
    seed: 'node scripts/check-catalog-intrinsic-columns.js --write-baseline',
  },
};

const main = (argv = process.argv) => runSetRatchetCli(DESCRIPTOR, argv);

if (require.main === module) {
  main().catch((e) => {
    console.error(`❌ ${ADR} — απρόσμενο σφάλμα: ${e.message}`);
    process.exit(1);
  });
}

module.exports = { measure, buildPayload, printReport, violationId, DESCRIPTOR, main };
