#!/usr/bin/env node
/**
 * CHECK 3.69 — ΠΥΛΗ ΤΟΥ ΜΗΤΡΩΟΥ ΓΡΑΜΜΑΤΟΣΕΙΡΩΝ (ADR-805).
 *
 * «Έχει κάθε δυαδικό γραμματοσειράς που **διανέμουμε** δηλωμένη, **επιτρεπόμενη** άδεια — και
 * το επιβεβαιώνει το **ίδιο το αρχείο**;»
 *
 * Η απογραφή + η κρίση ζουν στο `lib/font-assets/`· εδώ μόνο το CLI.
 *
 * ⚠️ **ΔΥΟ ΜΗΧΑΝΙΣΜΟΙ**: ⛔ ZERO-TOL για τα δομικά (αδήλωτο, ορφανό, μη αναγνώσιμο, μη
 * επαληθεύσιμο, **απόκλιση δήλωσης**) — **ΔΕΝ μπαίνουν ΠΟΤΕ σε baseline** · 🔴 RATCHET **κατά
 * ταυτότητα** για τις εκστρατείες (μη επιτρεπόμενη άδεια, έλλειψη απόδοσης).
 *
 * 🔴 **Ο ΦΡΟΥΡΟΣ ΤΟΥ ZERO-TOL ΕΙΝΑΙ ΡΗΤΟΣ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΜΑΘΗΜΑ ΤΗΣ ΙΔΙΑΣ ΜΕΡΑΣ.** Το
 * `runSetRatchetCli` συγκρίνει **μόνο** τα σύνολα `violationIds` / `declarations`. Μια πύλη που
 * βάζει τις μπλοκάρουσες καταστάσεις σε **άλλο πεδίο** τις κάνει **διακοσμητικές** — μετρημένο
 * ζωντανά στο CHECK 3.67, που απαντούσε `✅ exit 0` ενώ η αναφορά του τύπωνε `⛔ 1`. Εδώ οι
 * μπλοκάρουσες κρίνονται **πριν** το ratchet, με δική τους άγκυρα.
 *
 * CLI:
 *   node scripts/check-font-assets.js            # κρίση vs baseline
 *   node scripts/check-font-assets.js --report
 *   node scripts/check-font-assets.js --write-baseline
 *
 * Escape: `SKIP_FONT_ASSETS=1`
 */

'use strict';

const path = require('node:path');
const ratchet = require('./lib/ratchet-baseline');
const A = require('./lib/font-assets/assets');

const ROOT = ratchet.PROJECT_ROOT;
const BASELINE_FILE = path.join(ROOT, '.font-assets-baseline.json');

/**
 * ⚠️ **Καμία σκανδάλη, καμία μερική ανάλυση.** Το πλήρες κοστίζει ~0,6s (`git ls-files` + N
 * `opentype.parse`), και όταν το πλήρες είναι φθηνό η μερική ανάλυση δεν είναι βελτιστοποίηση:
 * είναι **δεύτερη αυθεντία που αποκλίνει σιωπηλά**, χωρίς αντάλλαγμα (πρότυπο CHECK 3.60/3.63).
 */
function measure() {
  const inv = A.takeInventory(ROOT);
  const verdict = A.judge(inv);
  const blocking = verdict.rows.filter((r) => A.BLOCKING.includes(r.state));
  const ratcheted = verdict.rows.filter((r) => A.RATCHETED.includes(r.state));
  return {
    inv,
    verdict,
    blocking,
    violations: blocking.map((r) => ({ file: r.id, line: 0, state: r.state, detail: r.detail, id: `${r.state} :: ${r.id}` })),
    // ⚠️ ΤΑΥΤΟΤΗΤΑ = «κατάσταση :: αρχείο». Με σκέτο αρχείο, η **ανταλλαγή** (θεραπεύεται η
    //    άδεια, εμφανίζεται έλλειψη απόδοσης στο ΙΔΙΟ αρχείο) θα περνούσε αθόρυβα — ADR-749.
    violationIds: ratcheted.map((r) => `${r.state} :: ${r.id}`).sort(),
    declarations: Object.keys(inv.registry).sort(),
  };
}

function printReport(m) {
  console.log(`📋 CHECK 3.69 — διανέμονται: ${m.inv.shipped.length} · δηλώσεις: ${Object.keys(m.inv.registry).length}`);
  // ⚠️ Κάθε κάδος τυπώνεται ΑΚΟΜΑ ΚΑΙ ΣΤΟ ΜΗΔΕΝ: ένα «0» που δεν τυπώνεται διαβάζεται ως
  //    «δεν υπάρχει τέτοιος έλεγχος».
  for (const state of Object.values(A.STATES)) {
    const mark = A.BLOCKING.includes(state) ? '⛔' : (A.RATCHETED.includes(state) ? '🔴' : '✅');
    console.log(`   ${mark} ${state.padEnd(22)} ${m.verdict.tally[state]}`);
  }
  const total = Object.values(m.verdict.tally).reduce((a, b) => a + b, 0);
  if (total !== m.verdict.rows.length) {
    throw new Error(`CHECK 3.69 — η λογιστική δεν κλείνει: ${total} ≠ ${m.verdict.rows.length}`);
  }
  for (const state of [...A.RATCHETED, ...A.BLOCKING]) {
    for (const row of m.verdict.rows.filter((r) => r.state === state)) {
      console.log(`\n   ${state}: ${row.id}\n      ${row.detail}`);
    }
  }
  console.log(`\n   Αυθεντίες: ${A.REGISTRY_FILE} · ${A.ALLOWLIST_FILE} · το name table κάθε αρχείου`);
}

/** ⚠️ Τα ZERO-TOL **ΔΕΝ μπαίνουν ΠΟΤΕ** εδώ (πρότυπο CHECK 3.44). */
function buildPayload(m) {
  if (m.blocking.length) {
    throw new Error(`CHECK 3.69 — άρνηση σποράς: ${m.blocking.length} μπλοκάρουσες καταστάσεις δεν μπαίνουν σε baseline.`);
  }
  return {
    $doc: 'CHECK 3.69 / ADR-805 — ΡΑΤΣΕΤΑ ΚΑΤΑ ΤΑΥΤΟΤΗΤΑ («κατάσταση :: αρχείο»). Ο αριθμός ΔΕΝ '
      + 'είναι δείκτης υγείας: είναι το μέτρο εκστρατειών που τελειώνουν στο ΜΗΔΕΝ — κάθε '
      + 'διανεμόμενη γραμματοσειρά με εγκεκριμένη άδεια και το κείμενό της να ταξιδεύει μαζί.',
    violations: m.violationIds,
    declarations: m.declarations,
  };
}

/** Δες το docblock της κεφαλίδας: χωρίς αυτό οι πέντε ⛔ θα ήταν διακοσμητικές. */
function enforceZeroTolerance(argv, measureFn = measure) {
  if (process.env.SKIP_FONT_ASSETS) return;
  if (argv.includes('--report') || argv.includes('--write-baseline')) return;
  const m = measureFn();
  if (!m.blocking.length) return;
  console.error(`\n❌ CHECK 3.69 — ${m.blocking.length} μπλοκάρουσα(ες) κατάσταση(εις):\n`);
  for (const r of m.blocking) console.error(`  ⛔ ${r.state}: ${r.id}\n     ${r.detail}`);
  console.error('\n   Αναφορά: npm run font-assets:report');
  console.error('   ⚠️ ΔΕΝ μπαίνουν ΠΟΤΕ σε baseline — διόρθωσε την αιτία.');
  process.exit(1);
}

if (require.main === module) {
  enforceZeroTolerance(process.argv.slice(2));
  ratchet.runSetRatchetCli({
    adr: 'ADR-805 (CHECK 3.69)',
    skipEnv: 'SKIP_FONT_ASSETS',
    baselineFile: BASELINE_FILE,
    labels: { violations: 'γραμματοσειρές με ανοιχτό ζήτημα άδειας', declarations: 'δηλωμένα στοιχεία' },
    commands: {
      report: 'npm run font-assets:report',
      baseline: 'npm run font-assets:baseline',
      seed: 'npm run font-assets:baseline',
    },
    measure,
    buildPayload,
    printReport,
    violationId: (f) => f.id,
    messages: {
      worse: 'νέα γραμματοσειρά με μη εγκεκριμένη άδεια, ή απόδοση που έπαψε να ταξιδεύει',
      newDeclLabel: 'νέο δηλωμένο στοιχείο γραμματοσειράς',
      newDeclAdvice: [],
    },
  });
}

module.exports = { measure, buildPayload, printReport, enforceZeroTolerance, BASELINE_FILE };
