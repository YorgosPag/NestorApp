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

const ROOT = ratchet.PROJECT_ROOT;
const BASELINE_FILE = path.join(ROOT, '.gate-inventory-baseline.json');

/** ⚠️ Ο πλήρης έλεγχος κοστίζει ~40ms (4 αρχεία, 4 regex) — καμία σκανδάλη, καμία μερική ανάλυση. */
function measure() {
  const verdict = judge(takeInventory(ROOT));
  const blocking = verdict.rows.filter((r) => BLOCKING.includes(r.state));
  return {
    verdict,
    violationIds: idsOf(verdict, STATES.UNDOCUMENTED).sort(byGateNumber),
    declarations: idsOf(verdict, STATES.DECLARED_CI_ONLY).sort(byGateNumber),
    violations: blocking.map((r) => ({ file: GUIDE, line: 0, state: r.state, detail: `${r.id} — ${r.detail}`, id: r.id })),
    blocking,
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

if (require.main === module) {
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

module.exports = { measure, buildPayload, printReport, BASELINE_FILE };
