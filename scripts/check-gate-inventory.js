#!/usr/bin/env node
/**
 * CHECK 3.66 — ΠΥΛΗ ΤΟΥ ΜΗΤΡΩΟΥ ΠΥΛΩΝ (ADR-802).
 *
 * «Είναι κάθε πύλη που **τρέχει** γραμμένη στο `CLAUDE.md`, και κάθε γραμμή του `CLAUDE.md`
 * πύλη που **τρέχει**;»
 *
 * Η παραγωγή ζει στο `lib/gate-inventory/inventory.js`, η κρίση στο `…/judge.js`. Εδώ μόνο
 * το CLI + η αναφορά — ίδιο σχήμα με τις υπόλοιπες πύλες αυτού του δέντρου.
 *
 * ⚠️ **ΔΥΟ ΜΗΧΑΝΙΣΜΟΙ**: 🔴 RATCHET **κατά ταυτότητα** για τις αδήλωτες (εκστρατεία που
 * τελειώνει στο μηδέν· με **αριθμό**, η ανταλλαγή «τεκμηρίωσα το Α, πρόσθεσα αδήλωτο το Β»
 * θα περνούσε αθόρυβα — ADR-749) · ⛔ ZERO-TOL για τα φαντάσματα και τις λάθος δηλώσεις,
 * που **ΔΕΝ μπαίνουν ΠΟΤΕ** σε baseline.
 *
 * CLI:
 *   node scripts/check-gate-inventory.js            # κρίση vs baseline
 *   node scripts/check-gate-inventory.js --report   # πλήρης απογραφή
 *   node scripts/check-gate-inventory.js --write-baseline
 *
 * Escape: `SKIP_GATE_INVENTORY=1`
 */

'use strict';

const path = require('node:path');
const ratchet = require('./lib/ratchet-baseline');
const { takeInventory, byGateNumber, EXECUTOR, HOOK, GUIDE, DECLARATIONS_FILE } = require('./lib/gate-inventory/inventory');
const { STATES, BLOCKING, judge, idsOf } = require('./lib/gate-inventory/judge');
const { judgeFreshness, STATES: FRESH_STATES, BLOCKING: FRESH_BLOCKING } = require('./lib/gate-index/freshness');

const ROOT = ratchet.PROJECT_ROOT;
const BASELINE_FILE = path.join(ROOT, '.gate-inventory-baseline.json');

/**
 * ⚠️ ΑΠΟΜΝΗΜΟΝΕΥΣΗ, ΚΑΙ ΕΙΝΑΙ ΑΠΑΡΑΙΤΗΤΗ: ο φρουρός zero-tolerance και το `runSetRatchetCli`
 *    καλούν ΚΑΙ ΟΙ ΔΥΟ το `measure()` στην ίδια εκτέλεση. Χωρίς αυτό η απογραφή + η ανάγνωση
 *    των 55 πηγών γίνονται δύο φορές — το ίδιο σχήμα που στο CHECK 3.68 κόστισε 11,1s ώσπου να
 *    φανεί. Μετρημένο εδώ: 246ms → 137ms.
 */
let _cache = null;
function measure() {
  if (_cache) return _cache;
  return (_cache = measureFresh());
}

/** ⚠️ Ο πλήρης έλεγχος κοστίζει ~140ms — καμία σκανδάλη, καμία μερική ανάλυση. */
function measureFresh() {
  const inv = takeInventory(ROOT);
  const verdict = judge(inv);
  const blocking = verdict.rows.filter((r) => BLOCKING.includes(r.state));

  // ── ΔΕΥΤΕΡΟ ΚΑΤΑΣΤΙΧΟ: «η ΠΗΓΗ και η ΠΡΟΒΟΛΗ συμφωνούν;» (ADR-8xx) ─────────────
  // ⚠️ ΞΕΧΩΡΙΣΤΟ, ΟΧΙ ΝΕΕΣ ΚΑΤΑΣΤΑΣΕΙΣ ΣΤΟ ΠΡΩΤΟ: η λογιστική του πρώτου κλείνει πάνω στον
  //    πληθυσμό «πύλες», εδώ ο πληθυσμός είναι «αρχεία πηγής» (πρότυπο ΔΥΟ ΚΑΤΑΣΤΙΧΩΝ, 3.50).
  //    Όλες οι καταστάσεις είναι ⛔ και ΔΕΝ μπαίνουν ΠΟΤΕ σε baseline.
  const fresh = judgeFreshness(inv, ROOT);
  const freshBlocking = fresh.violations.filter((v) => FRESH_BLOCKING.includes(v.state));

  return {
    verdict,
    freshness: fresh,
    violationIds: idsOf(verdict, STATES.UNDOCUMENTED).sort(byGateNumber),
    declarations: idsOf(verdict, STATES.DECLARED_CI_ONLY).sort(byGateNumber),
    violations: [
      ...blocking.map((r) => ({ file: GUIDE, line: 0, state: r.state, detail: `${r.id} — ${r.detail}`, id: r.id })),
      ...freshBlocking.map((v) => ({ file: GUIDE, line: 0, state: v.state, detail: `${v.id} — ${v.detail}`, id: v.id })),
    ],
    blocking: [...blocking, ...freshBlocking],
  };
}

function printTally(m) {
  const t = m.verdict.tally;
  const c = m.verdict.inv.counts;
  console.log(`📋 CHECK 3.66 — πύλες που ΤΡΕΧΟΥΝ: ${c.runs} (εκτελεστής ${c.dispatched} + hook ${c.hooked}) · γραμμές CLAUDE.md: ${c.rows}`);
  // ⚠️ Κάθε κάδος τυπώνεται ΑΚΟΜΑ ΚΑΙ ΣΤΟ ΜΗΔΕΝ: ένα «0» που δεν τυπώνεται διαβάζεται ως
  //    «δεν υπάρχει τέτοιος έλεγχος» — το σχήμα που όλη αυτή η οικογένεια πυλών κυνηγά.
  for (const state of Object.values(STATES)) {
    const mark = BLOCKING.includes(state) ? '⛔' : (state === STATES.UNDOCUMENTED ? '🔴' : (state === STATES.PROSE_ONLY ? '🔶' : '✅'));
    console.log(`   ${mark} ${state.padEnd(24)} ${t[state]}`);
  }
  // ⚠️ Το δεύτερο κατάστιχο τυπώνεται ΚΑΙ ΣΤΟ ΜΗΔΕΝ: ένα «0» που δεν τυπώνεται διαβάζεται ως
  //    «δεν υπάρχει τέτοιος έλεγχος» — το σχήμα που όλη αυτή η οικογένεια πυλών κυνηγά.
  console.log(`   ── πηγή ⇄ προβολή (docs/gates) ──`);
  for (const state of Object.values(FRESH_STATES)) {
    const mark = FRESH_BLOCKING.includes(state) ? '⛔' : '✅';
    console.log(`   ${mark} ${state.padEnd(24)} ${m.freshness.tally[state]}`);
  }
  const total = Object.values(t).reduce((a, b) => a + b, 0);
  const population = m.verdict.rows.length;
  if (total !== population) throw new Error(`CHECK 3.66 — η λογιστική δεν κλείνει: ${total} ≠ ${population}`);
}

function printReport(m) {
  printTally(m);
  for (const state of [STATES.UNDOCUMENTED, ...BLOCKING, STATES.PROSE_ONLY]) {
    const ids = idsOf(m.verdict, state).sort(byGateNumber);
    if (ids.length) console.log(`\n   ${state}: ${ids.join(' ')}`);
  }
  console.log(`\n   Αυθεντίες: ${EXECUTOR} · ${HOOK} · ${DECLARATIONS_FILE} · ${GUIDE}`);
}

/** ⚠️ Τα ZERO-TOL **ΔΕΝ μπαίνουν ΠΟΤΕ** εδώ: ένα zero-tol που κλειδώνεται με μια σημαία δεν είναι zero-tol. */
function buildPayload(m) {
  if (m.blocking.length) {
    throw new Error(`CHECK 3.66 — άρνηση σποράς: ${m.blocking.length} μπλοκάρουσες καταστάσεις δεν μπαίνουν σε baseline.`);
  }
  return {
    $doc: 'CHECK 3.66 / ADR-802 — ΡΑΤΣΕΤΑ ΚΑΤΑ ΤΑΥΤΟΤΗΤΑ. Ο αριθμός ΔΕΝ είναι δείκτης υγείας: '
      + 'είναι το μέτρο μιας εκστρατείας τεκμηρίωσης που τελειώνει στο ΜΗΔΕΝ.',
    violations: m.violationIds,
    declarations: m.declarations,
  };
}

/**
 * 🔴 ΧΩΡΙΣ ΑΥΤΟ, ΟΛΕΣ ΟΙ ⛔ ΤΟΥ 3.66 ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΤΙΚΕΣ — ΚΑΙ ΗΤΑΝ, ΜΕΤΡΗΜΕΝΑ.
 *
 * Το `runSetRatchetCli` συγκρίνει **μόνο** τα σύνολα `violationIds`/`declarations`. Οι
 * καταστάσεις zero-tolerance ζούσαν στο `blocking`, που το CLI **δεν κοιτάζει ποτέ** — και το
 * `buildPayload` που τις ελέγχει τρέχει **μόνο** στο `--write-baseline`. Αποδεδειγμένο ζωντανά
 * (2026-08-26): με φύτεμα φαντάσματος `| **3.997** |` η αναφορά τύπωνε `⛔ ghost-row 1` και η
 * πύλη απαντούσε `✅ … EXIT=0`.
 *
 * ⚠️ Είναι **ακριβώς** η κλάση που σάρωσε το CHECK 3.69 σε 18 πύλες — και το 3.66 είχε
 *    καταγραφεί εκεί ως «έγκυρος μηχανισμός με δικό του `blocking.length`». Ο ισχυρισμός ήταν
 *    ΨΕΥΔΗΣ: το `blocking.length` υπήρχε, αλλά **εκτός της διαδρομής κρίσης**. *Ένας φρουρός
 *    που υπάρχει σε λάθος διαδρομή δεν είναι φρουρός — και διαβάζεται ως φρουρός.*
 */
function enforceZeroTolerance(argv, measureFn = measure) {
  if (process.env.SKIP_GATE_INVENTORY) return;
  if (argv.includes('--report') || argv.includes('--write-baseline')) return;
  const m = measureFn();
  if (!m.blocking.length) return;
  console.error(`\n❌ CHECK 3.66 — ${m.blocking.length} μπλοκάρουσα(ες) κατάσταση(εις):\n`);
  for (const r of m.blocking) console.error(`  ⛔ ${r.state}: ${r.id}\n     ${r.detail}`);
  console.error('\n   Αναφορά: npm run gate-inventory:report');
  console.error('   ⚠️ ΔΕΝ μπαίνουν ΠΟΤΕ σε baseline — διόρθωσε την αιτία.');
  process.exit(1);
}

if (require.main === module) {
  enforceZeroTolerance(process.argv.slice(2));
  ratchet.runSetRatchetCli({
    adr: 'ADR-802 (CHECK 3.66)',
    skipEnv: 'SKIP_GATE_INVENTORY',
    baselineFile: BASELINE_FILE,
    labels: { violations: 'αδήλωτες πύλες', declarations: 'δηλώσεις μόνο-CI' },
    commands: {
      report: 'npm run gate-inventory:report',
      baseline: 'npm run gate-inventory:baseline',
      seed: 'npm run gate-inventory:baseline',
    },
    measure,
    buildPayload,
    printReport,
    violationId: (f) => f.id,
    messages: {
      worse: 'νέα αδήλωτη πύλη ή φάντασμα στον οδηγό',
      newDeclLabel: 'νέα δήλωση μόνο-CI',
      newDeclAdvice: [],
    },
  });
}

module.exports = { measure, buildPayload, printReport, enforceZeroTolerance, BASELINE_FILE };
