#!/usr/bin/env node
/**
 * CHECK 3.70 — ΠΥΛΗ ΤΩΝ ΑΔΕΣΜΕΥΤΩΝ ΑΝΑΓΝΩΡΙΣΤΙΚΩΝ (ADR-808).
 *
 * «Αναφέρει αυτό το αρχείο όνομα που **δεν δηλώνεται, δεν εισάγεται και δεν είναι
 * καθολικό**;» Σε χρόνο εκτέλεσης → `ReferenceError`· σε τύπους → «Cannot find name».
 *
 * 🔴 **ΤΟ ΚΕΝΟ ΠΟΥ ΑΦΗΝΕΙ Ο N.17, ΚΑΙ ΤΟ ΟΙΚΟΣΥΣΤΗΜΑ ΤΟ ΔΗΛΩΝΕΙ ΓΡΑΠΤΩΣ.** Το
 * `typescript-eslint` **απενεργοποιεί** τον κανόνα `no-undef` στη συνιστώμενη ρύθμισή του,
 * με ρητή αιτιολογία ότι «*ο μεταγλωττιστής της TypeScript το κάνει ήδη, και σημαντικά
 * καλύτερα*» — δηλαδή η μοναδική απάντηση της βιομηχανίας είναι «τρέξε `tsc`». Εδώ ο
 * `tsc` είναι **απαγορευμένος για τον πράκτορα** (N.17) και ολόκληρο το
 * `src/subapps/dxf-viewer` είναι **εκτός** του root `tsconfig` (CHECK 3.29, baseline 381
 * σφαλμάτων: ένα **νέο** αδέσμευτο εκεί πνίγεται μέσα της). Άρα το ερώτημα **δεν το
 * απαντά κανείς**.
 *
 * 🏆 **ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟΝ ΚΑΝΟΝΑ ΠΟΥ ΑΠΟΡΡΙΦΘΗΚΕ**: η τεκμηριωμένη αστοχία του `no-undef`
 * είναι ότι «*δεν χρησιμοποιεί την TypeScript για να βρει ποια καθολικά υπάρχουν — βασίζεται
 * στη ρύθμιση του ESLint*» (και το issue #2799 λέγεται κυριολεκτικά «*no-undef: eslint
 * ignores @types*»). Εδώ τα καθολικά **δεν ρυθμίζονται**: παράγονται από τα ίδια τα
 * `lib.*.d.ts` + `@types/*` + τις εξαρτήσεις, με **AST** και τον **πραγματικό κανόνα
 * script-vs-module** της TypeScript (βλ. `lib/module-graph/unbound-identifiers.js`).
 *
 * 🔑 **ΓΕΝΝΙΕΤΑΙ ZERO-TOLERANCE ΕΠΕΙΔΗ ΜΕΤΡΗΘΗΚΕ, ΟΧΙ ΕΠΕΙΔΗ ΕΛΠΙΖΕΤΑΙ**: το ίδιο ρεύμα
 * δουλειάς καθάρισε **10 → 0** σε 15.294 αρχεία (ADR-808 §3). Καμία baseline, ποτέ: δεν
 * υπάρχει «λιγότερα αδέσμευτα από χθες» — **ένα** αρκεί για `ReferenceError` στην οθόνη
 * (μετρημένο: το `entity` του `PropertiesPalette.tsx` έριχνε την παλέτα σε **κάθε** F11).
 *
 * ⚠️ **ΔΥΟ ΣΤΡΩΜΑΤΑ, ΚΑΙ ΤΟ ΟΡΙΟ ΤΟΥ ΠΡΩΤΟΥ ΕΙΝΑΙ ΔΗΛΩΜΕΝΟ.** Η δέσμευση είναι **τοπική**
 * στο αρχείο, άρα τα σταδιοποιημένα αρκούν — **εκτός** από ένα μονοπάτι: αν φύγει μια
 * *καθολική* δήλωση (`declare global`, `export as namespace`, ένα `@types` πακέτο), τότε
 * γίνονται αδέσμευτα αρχεία **που κανείς δεν σταδιοποίησε**. Γι' αυτό το Layer 1
 * **κλιμακώνεται μόνο του σε πλήρη σάρωση** όταν σταδιοποιείται `.d.ts` ή το
 * `package.json`/lockfile, και το Layer 2 τρέχει `--all` **άνευ όρων**.
 *
 * ⚠️ **ΤΟ ΕΡΓΑΛΕΙΟ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΕΦΕΥΡΕΙ**: το σύνολο δεσμεύσεων είναι **επίπεδο**
 * (αγνοεί εμβέλειες) ⇒ μπορεί να **χάσει** σφάλμα, ποτέ να το επινοήσει. Για πύλη που
 * μπλοκάρει commit αυτή είναι η σωστή κατεύθυνση: ένα ψευδώς θετικό διδάσκει τον επόμενο
 * να την αγνοεί (πήχης <10% — εδώ μετρημένα **0**).
 *
 * CLI:
 *   node scripts/check-unbound-identifiers.js            # σταδιοποιημένα (Layer 1)
 *   node scripts/check-unbound-identifiers.js --all      # όλο το δέντρο (Layer 2)
 *   node scripts/check-unbound-identifiers.js --report
 *
 * Escape: `SKIP_UNBOUND_IDENTIFIERS=1`
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const { scanFile } = require('./lib/module-graph/unbound-identifiers');
const { collectSourceFiles, isIgnored } = require('./lib/module-graph/scan-config');
const { toPosix } = require('./lib/module-graph/resolve-specifier');

const PROJECT_ROOT = toPosix(path.resolve(__dirname, '..'));

/**
 * ⚠️ **ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ ΚΑΤΑΣΤΑΣΕΩΝ, fail-closed.** Άγνωστη κατάσταση ⇒ `throw` **με όνομα**:
 * ένα αρχείο που δεν κατατάσσεται πουθενά είναι αρχείο που **κανείς δεν κοίταξε**, και
 * αυτό είναι ακριβώς το σχήμα που η πύλη υπάρχει για να κυνηγά.
 */
const STATES = {
  UNBOUND: 'unbound-identifier',   // ⛔ αναφορά σε όνομα που δεν υπάρχει
  BOUND: 'bound',                  // ✅ κάθε όνομα δεσμεύεται ή είναι καθολικό
  UNPARSABLE: 'unparsable',        // 🔶 σπασμένη σύνταξη — ΑΛΛΟ ερώτημα, όχι δικό μας
  UNREADABLE: 'unreadable',        // 🔶 δεν διαβάστηκε
};
const BLOCKING = [STATES.UNBOUND];

/** Σταδιοποιημένα αρχεία πηγής, απόλυτα posix μονοπάτια. */
function listStaged() {
  try {
    return execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: PROJECT_ROOT, encoding: 'utf8',
    }).split('\n').map((s) => s.trim()).filter(Boolean)
      .map((p) => toPosix(path.resolve(PROJECT_ROOT, p)));
  } catch {
    return [];
  }
}

/**
 * Κλιμακώνει σε πλήρη σάρωση όταν αλλάζει **η ίδια η προμήθεια καθολικών** — αλλιώς η
 * διαγραφή ενός ambient `.d.ts` θα άφηνε σπασμένα αρχεία που κανείς δεν σταδιοποίησε.
 */
function stagedForcesFullScan(staged) {
  return staged.some((f) => f.endsWith('.d.ts')
    || f.endsWith('/package.json') || f.endsWith('/pnpm-lock.yaml'));
}

function isCandidate(absPosix) {
  if (!/\.tsx?$/.test(absPosix) || absPosix.endsWith('.d.ts')) return false;
  const rel = absPosix.startsWith(`${PROJECT_ROOT}/`) ? absPosix.slice(PROJECT_ROOT.length + 1) : absPosix;
  return rel.startsWith('src/') && !isIgnored(rel) && fs.existsSync(absPosix);
}

function measure(argv = []) {
  const staged = listStaged();
  const full = argv.includes('--all') || argv.includes('--report') || stagedForcesFullScan(staged);
  const files = (full ? collectSourceFiles(PROJECT_ROOT, ['src']) : staged).filter(isCandidate);

  const tally = Object.fromEntries(Object.values(STATES).map((s) => [s, 0]));
  const violations = [];

  for (const abs of files) {
    const rel = abs.slice(PROJECT_ROOT.length + 1);
    let src;
    try { src = fs.readFileSync(abs, 'utf8'); } catch { tally[STATES.UNREADABLE]++; continue; }

    // ⚠️ «Καθαρό» και «δεν αναλύθηκε» είναι **ΔΥΟ καταστάσεις, ποτέ μία**: αρχείο που δεν
    //    αναλύθηκε **δεν είναι** καθαρό, και μετρημένο ως καθαρό ξαναγεννά το «0 = κανείς
    //    δεν κοίταξε» (ADR-806 §4). Ο σαρωτής τις δίνει **και τις δύο σε μία ανάλυση**.
    const { parsed, unbound } = scanFile(rel, src, PROJECT_ROOT);
    if (!parsed) { tally[STATES.UNPARSABLE]++; continue; }
    if (unbound.length) {
      tally[STATES.UNBOUND]++;
      for (const h of unbound) violations.push({ file: rel, name: h.name, line: h.line });
      continue;
    }
    tally[STATES.BOUND]++;
  }

  const counted = Object.values(tally).reduce((a, b) => a + b, 0);
  if (counted !== files.length) {
    throw new Error(`CHECK 3.70 — η λογιστική δεν κλείνει: ${counted} ≠ ${files.length}`);
  }

  return { scope: full ? 'all' : 'staged', files: files.length, tally, violations, blocking: violations };
}

function printReport(m) {
  console.log(`📋 CHECK 3.70 — εμβέλεια: ${m.scope} · αρχεία: ${m.files}`);
  // ⚠️ Κάθε κάδος τυπώνεται **ακόμα και στο μηδέν**: ένα «0» που δεν τυπώνεται διαβάζεται
  //    ως «δεν υπάρχει τέτοιος έλεγχος».
  for (const state of Object.values(STATES)) {
    const mark = BLOCKING.includes(state) ? '⛔' : (state === STATES.BOUND ? '✅' : '🔶');
    console.log(`   ${mark} ${state.padEnd(20)} ${m.tally[state]}`);
  }
  if (m.violations.length) {
    console.log('');
    for (const v of m.violations) console.log(`   ⛔ ${v.file}:${v.line} — «${v.name}»`);
  }
}

/**
 * ⚠️ **ΡΑΦΗ ΕΝΕΣΗΣ (`measureFn`) — ΧΩΡΙΣ ΑΥΤΗΝ Ο ΦΡΟΥΡΟΣ ΔΕΝ ΑΠΟΔΕΙΚΝΥΕΤΑΙ ΚΑΛΩΔΙΩΜΕΝΟΣ.**
 * Το δέντρο είναι σήμερα **καθαρό**, άρα κάθε άγκυρα που καλεί το πραγματικό `measure`
 * βλέπει `0` — και ένα `main()` που **δεν κοιτάζει καθόλου** το αποτέλεσμα θα έβγαινε
 * εξίσου πράσινο. Πρότυπο CHECK 3.56/3.61.
 */
function main(argv, measureFn = measure) {
  if (process.env.SKIP_UNBOUND_IDENTIFIERS) return 0;
  const m = measureFn(argv);
  if (argv.includes('--report')) { printReport(m); return 0; }
  if (!m.blocking.length) return 0;

  console.error(`\n❌ CHECK 3.70 — ${m.blocking.length} αδέσμευτο(α) αναγνωριστικό(ά):\n`);
  for (const v of m.violations) console.error(`  ⛔ ${v.file}:${v.line} — «${v.name}»`);
  console.error('\n   Το όνομα δεν δηλώνεται, δεν εισάγεται και δεν είναι καθολικό.');
  console.error('   ⚠️ Ένα `export … from` ΕΠΑΝΕΞΑΓΕΙ — ΔΕΝ εισάγει. Χρειάζεσαι ΔΥΟ γραμμές.');
  console.error('   ⚠️ ΜΗΝ το «λύσεις» με `any` (N.2) ούτε σβήνοντας το export.');
  console.error('   Αναφορά: npm run unbound:report');
  return 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { measure, printReport, main, STATES, BLOCKING, PROJECT_ROOT };
