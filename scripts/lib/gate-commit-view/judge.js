/**
 * CHECK 3.107 — Η ΚΡΙΣΗ (ADR-924). Καθαρή: παίρνει απογραφή, δίνει γραμμές με κατάσταση.
 *
 * «Κρίνει αυτή η πύλη ό,τι **θα δεσμευτεί** — ή τον δίσκο, όπου ζει και η ξένη αστάδιοποίητη δουλειά;»
 *
 * @module scripts/lib/gate-commit-view/judge
 */

'use strict';

const MIN_REASON_LENGTH = 40;

const STATES = Object.freeze({
  COMMIT_VIEW: 'commit-view',                 // ✅ ρωτά `--index` ΚΑΙ φτάνει στο SSoT
  DECLARED: 'declared',                       // ✅ κρίνει τον δίσκο, με λόγο
  BASELINE: 'baseline',                       // 🔶 χρέος που προϋπήρχε — μόνο μειώνεται
  UNDECLARED: 'undeclared',                   // ⛔ κρίνει τον δίσκο, κανείς δεν το είπε
  FLAG_WITHOUT_READER: 'flag-without-reader', // ⛔ περνά `--index` αλλά δεν διαβάζει ποτέ το ευρετήριο
  MISSING_SCRIPT: 'missing-script',           // ⛔ δρομολογείται script που δεν υπάρχει
  REASONLESS: 'reasonless-declaration',       // ⛔ δήλωση χωρίς επαρκή λόγο
  ORPHAN: 'orphan-declaration',               // ⛔ δήλωση για πύλη που δεν δρομολογείται
  STALE_BASELINE: 'stale-baseline',           // ⬇ στη baseline αλλά πλέον κρίνει το commit / δεν τρέχει
});

const BLOCKING = new Set([
  STATES.UNDECLARED, STATES.FLAG_WITHOUT_READER, STATES.MISSING_SCRIPT, STATES.REASONLESS, STATES.ORPHAN,
]);

function stateOf(gate, declared, baseline) {
  if (gate.missing) return STATES.MISSING_SCRIPT;
  if (gate.asksIndex && !gate.reader) return STATES.FLAG_WITHOUT_READER;
  if (gate.asksIndex && gate.reader) return STATES.COMMIT_VIEW;
  if (Object.prototype.hasOwnProperty.call(declared, gate.id)) {
    return String(declared[gate.id]).trim().length >= MIN_REASON_LENGTH ? STATES.DECLARED : STATES.REASONLESS;
  }
  return baseline.has(gate.id) ? STATES.BASELINE : STATES.UNDECLARED;
}

/** Δηλώσεις και baseline που δεν αντιστοιχούν σε πύλη που κρίνει τον δίσκο. */
function strayRows(inv, byId) {
  const rows = [];
  for (const id of Object.keys(inv.declared)) {
    if (!byId.has(id)) rows.push({ id, state: STATES.ORPHAN, script: null });
  }
  // «Stale» = δεν χρωστάει πια: κρίνει το commit, δηλώθηκε, ή δεν τρέχει. Μια μπλοκάρουσα κατάσταση
  // (π.χ. flag-without-reader) ΔΕΝ ξεχρεώνει — θα ήταν δεύτερη, αντιφατική γραμμή για την ίδια πύλη.
  const settled = new Set([STATES.COMMIT_VIEW, STATES.DECLARED]);
  for (const id of inv.baseline) {
    const gate = byId.get(id);
    if (!gate || settled.has(gate.state)) rows.push({ id, state: STATES.STALE_BASELINE, script: gate ? gate.script : null });
  }
  return rows;
}

/** @param {{gates: object[], declared: Record<string, string>, baseline: string[]}} inv */
function judge(inv) {
  const baseline = new Set(inv.baseline);
  const rows = inv.gates.map(gate => ({ ...gate, state: stateOf(gate, inv.declared, baseline) }));
  const byId = new Map(rows.map(row => [row.id, row]));
  return [...rows, ...strayRows(inv, byId)];
}

function tallyOf(rows) {
  const tally = Object.fromEntries(Object.values(STATES).map(state => [state, 0]));
  for (const row of rows) {
    if (!(row.state in tally)) throw new Error(`ΑΓΝΩΣΤΗ ΚΑΤΑΣΤΑΣΗ: ${row.state}`);
    tally[row.state] += 1;
  }
  return tally;
}

module.exports = { STATES, BLOCKING, MIN_REASON_LENGTH, judge, tallyOf };
