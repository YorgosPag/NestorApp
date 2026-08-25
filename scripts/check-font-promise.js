#!/usr/bin/env node
/**
 * CHECK 3.67 — ΠΥΛΗ ΤΗΣ ΥΠΟΣΧΕΣΗΣ ΓΡΑΜΜΑΤΟΣΕΙΡΑΣ (ADR-803).
 *
 * «Υπόσχεται ο πίνακας υποκατάστασης όψη που **δεν φορτώνεται ΠΟΤΕ**;»
 *
 * Η παραγωγή + η κρίση ζουν στο `lib/font-promise/promise.js`· εδώ μόνο το CLI.
 *
 * ⚠️ **ΔΥΟ ΜΗΧΑΝΙΣΜΟΙ**: 🔴 RATCHET **κατά ταυτότητα** για τις ανεκπλήρωτες υποσχέσεις
 * (εκστρατεία που τελειώνει στο μηδέν — με **αριθμό**, η ανταλλαγή «φόρτωσα το Α, υποσχέθηκα
 * αδήλωτο το Β» θα περνούσε αθόρυβα, ADR-749) · ⛔ ZERO-TOL για αρχείο που λείπει και για
 * λάθος δηλώσεις, που **ΔΕΝ μπαίνουν ΠΟΤΕ** σε baseline.
 *
 * CLI:
 *   node scripts/check-font-promise.js            # κρίση vs baseline
 *   node scripts/check-font-promise.js --report
 *   node scripts/check-font-promise.js --write-baseline
 *
 * Escape: `SKIP_FONT_PROMISE=1`
 */

'use strict';

const path = require('node:path');
const ratchet = require('./lib/ratchet-baseline');
const P = require('./lib/font-promise/promise');

const ROOT = ratchet.PROJECT_ROOT;
const BASELINE_FILE = path.join(ROOT, '.font-promise-baseline.json');

/** ⚠️ Πλήρης έλεγχος ~15ms (2 αρχεία + N `existsSync`) — καμία σκανδάλη, καμία μερική ανάλυση. */
function measure() {
  const inv = P.takeInventory(ROOT);
  const verdict = P.judge(inv);
  const blocking = verdict.rows.filter((r) => P.BLOCKING.includes(r.state));
  return {
    verdict,
    inv,
    violationIds: P.idsOf(verdict, P.STATES.UNKEEPABLE).sort(),
    declarations: P.idsOf(verdict, P.STATES.DECLARED_SYNTHESIZED).sort(),
    violations: blocking.map((r) => ({ file: P.PRELOAD, line: 0, state: r.state, detail: `${r.id} — ${r.detail}`, id: r.id })),
    blocking,
  };
}

function printReport(m) {
  console.log(`📋 CHECK 3.67 — υποσχέσεις: ${m.inv.promised.length} · φορτώνονται: ${m.inv.loaded.length}`);
  // ⚠️ Κάθε κάδος τυπώνεται ΑΚΟΜΑ ΚΑΙ ΣΤΟ ΜΗΔΕΝ: ένα «0» που δεν τυπώνεται διαβάζεται ως
  //    «δεν υπάρχει τέτοιος έλεγχος».
  for (const state of Object.values(P.STATES)) {
    const mark = P.BLOCKING.includes(state) ? '⛔' : (state === P.STATES.UNKEEPABLE ? '🔴' : '✅');
    console.log(`   ${mark} ${state.padEnd(24)} ${m.verdict.tally[state]}`);
  }
  const total = Object.values(m.verdict.tally).reduce((a, b) => a + b, 0);
  if (total !== m.verdict.rows.length) {
    throw new Error(`CHECK 3.67 — η λογιστική δεν κλείνει: ${total} ≠ ${m.verdict.rows.length}`);
  }
  for (const state of [P.STATES.UNKEEPABLE, ...P.BLOCKING]) {
    const ids = P.idsOf(m.verdict, state);
    if (ids.length) console.log(`\n   ${state}: ${ids.join(' · ')}`);
  }
  console.log(`\n   Αυθεντίες: ${P.TABLE} · ${P.PRELOAD} · ${P.DECLARATIONS_FILE}`);
}

/** ⚠️ Τα ZERO-TOL **ΔΕΝ μπαίνουν ΠΟΤΕ** εδώ — ένα zero-tol που κλειδώνεται με σημαία δεν είναι zero-tol. */
function buildPayload(m) {
  if (m.blocking.length) {
    throw new Error(`CHECK 3.67 — άρνηση σποράς: ${m.blocking.length} μπλοκάρουσες καταστάσεις δεν μπαίνουν σε baseline.`);
  }
  return {
    $doc: 'CHECK 3.67 / ADR-803 — ΡΑΤΣΕΤΑ ΚΑΤΑ ΤΑΥΤΟΤΗΤΑ. Ο αριθμός ΔΕΝ είναι δείκτης υγείας: '
      + 'είναι το μέτρο μιας εκστρατείας που τελειώνει στο ΜΗΔΕΝ — κάθε υποσχεμένη όψη φορτωμένη.',
    violations: m.violationIds,
    declarations: m.declarations,
  };
}

/**
 * 🔴 **Ο ΦΡΟΥΡΟΣ ΠΟΥ ΕΛΕΙΠΕ — ΚΑΙ ΧΩΡΙΣ ΑΥΤΟΝ ΟΙ ΠΕΝΤΕ ⛔ ΗΤΑΝ ΔΙΑΚΟΣΜΗΤΙΚΕΣ** (2026-08-25).
 *
 * Το `runSetRatchetCli` συγκρίνει **σύνολα ταυτοτήτων** (`violationIds`, `declarations`) — και
 * **τίποτε άλλο**. Οι μπλοκάρουσες καταστάσεις ταξίδευαν στο `measured.violations`, το οποίο ο
 * κοινός μηχανισμός χρησιμοποιεί **μόνο για να ΤΥΠΩΣΕΙ** λεπτομέρεια σε μια αποτυχία που έχει
 * ήδη αποφασιστεί αλλού· το `buildPayload` πάλι αρνείται μόνο στο `--write-baseline`.
 *
 * **Μετρημένο ζωντανά, δύο φορές**: με `orphan-declaration` εμφυτευμένο, και με `url` που δείχνει
 * σε **ανύπαρκτο αρχείο**, η αναφορά τύπωνε `⛔ unloadable-preload 1` και η πύλη απαντούσε
 * **`✅` με exit 0**. Δηλαδή ακριβώς το «σκαλί πάνω από το AutoCAD» που διαφημίζει το ADR-803 §4.1
 * — *«επαληθεύεται ότι το ΑΡΧΕΙΟ κάθε δηλωμένης όψης υπάρχει όντως»* — **δεν μπορούσε να
 * πυροδοτήσει**. Φρουρός που δεν μπορεί να πυροδοτήσει είναι προσθήκη στους **606 αδρανείς**
 * του ADR-749 §5.
 *
 * ⚠️ Η αδελφή πύλη **CHECK 3.59** το κάνει σωστά με δικό της `if (m.blocking.length > 0)` — άρα
 * το σχήμα «ο κοινός CLI ΔΕΝ κρίνει το zero-tol, το κρίνει ο καλών» είναι το **υπάρχον**
 * συμβόλαιο, και εδώ απλώς είχε παραλειφθεί.
 *
 * ⚠️ Τρέχει **μόνο** στη διαδρομή κρίσης: το `--report` οφείλει να **τυπώνει** (αλλιώς ο
 * άνθρωπος δεν βλέπει τι έσπασε) και το `--write-baseline` το φυλά ήδη το `buildPayload`.
 * Κόστος: μία επιπλέον `measure()` — **~15ms**.
 */
function enforceZeroTolerance(argv, measureFn = measure) {
  if (process.env.SKIP_FONT_PROMISE) return;
  if (argv.includes('--report') || argv.includes('--write-baseline')) return;
  const m = measureFn();
  if (!m.blocking.length) return;
  console.error(`\n❌ CHECK 3.67 — ${m.blocking.length} μπλοκάρουσα(ες) κατάσταση(εις):\n`);
  for (const r of m.blocking) console.error(`  ⛔ ${r.state}: ${r.id} — ${r.detail}`);
  console.error(`\n   Αναφορά: npm run font-promise:report`);
  console.error('   ⚠️ ΔΕΝ μπαίνουν ΠΟΤΕ σε baseline — διόρθωσε την αιτία.');
  process.exit(1);
}

if (require.main === module) {
  enforceZeroTolerance(process.argv.slice(2));
  ratchet.runSetRatchetCli({
    adr: 'ADR-803 (CHECK 3.67)',
    skipEnv: 'SKIP_FONT_PROMISE',
    baselineFile: BASELINE_FILE,
    labels: { violations: 'ανεκπλήρωτες υποσχέσεις', declarations: 'δηλωμένες συνθετικές' },
    commands: {
      report: 'npm run font-promise:report',
      baseline: 'npm run font-promise:baseline',
      seed: 'npm run font-promise:baseline',
    },
    measure,
    buildPayload,
    printReport,
    violationId: (f) => f.id,
    messages: {
      worse: 'νέα όψη υπόσχεται χωρίς να φορτώνεται, ή αρχείο που λείπει',
      newDeclLabel: 'νέα δήλωση «συνθέτει ο browser»',
      newDeclAdvice: [],
    },
  });
}

module.exports = { measure, buildPayload, printReport, enforceZeroTolerance, BASELINE_FILE };
