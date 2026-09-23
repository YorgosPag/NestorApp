'use strict';
/**
 * =============================================================================
 * 🔶 ΠΡΟΫΠΟΛΟΓΙΣΜΟΣ ΤΩΝ ΚΑΔΩΝ ΠΟΥ ΔΕΝ ΚΡΙΝΟΝΤΑΙ (CHECK 3.51 Χ · ADR-781 §15)
 * =============================================================================
 *
 * Το ελάττωμα: το `surface-synthetic-id` πήγε 29 → 132 (18,8% → 68% του προϊόντος)
 * **χωρίς κανέναν συναγερμό**, επειδή οι 🔶 «μετριούνται, δεν απαριθμούνται» — και το
 * `by_state` της baseline, το μόνο σημείο όπου ζούσε ο αριθμός, **δεν το διάβαζε κανείς**.
 *
 * Εδώ ο αριθμός αποκτά αναγνώστη, με δύο φράχτες (βλ. `X_COUNTED_CEILING`):
 *   - `policy`  — δηλωμένο μερίδιο, ισχύει και στη σπορά (η σπορά δεν εγκρίνει τον εαυτό της)
 *   - `ratchet` — πλήθος ≤ `by_state` της baseline (πιάνει 🔴→🔶 που μοιάζει με «πρόοδο»)
 *
 * ⚠️ Η baseline διαβάζεται **fail-closed** μέσα από το `assertClosedLedger` — ΟΧΙ δεύτερη
 * υλοποίηση. Το `by_state` του 2026-09-16 **δεν είχε** `backend-unavailable` ούτε
 * `route-redirected`: μια baseline άλλου λεξιλογίου δεν επιτρέπεται να διαβαστεί ως «0».
 *
 * Φύλλο: εισάγει μόνο `ledger.js` + `states.js` — η αλυσίδα μένει μονόδρομη, και
 * **καμία** npm εξάρτηση (ο χρησμός τρέχει στο CI χωρίς `node_modules`).
 * =============================================================================
 */

const { assertClosedLedger } = require('./ledger');
const { X_STATES, X_COUNTED, X_COUNTED_CEILING } = require('./states');

/**
 * Το `by_state` της baseline, επικυρωμένο: γνωστές καταστάσεις, **όλες** παρούσες,
 * άθροισμα = `declaration_count`. Οτιδήποτε άλλο ⇒ `throw` (ξανασπορά, ποτέ «0»).
 */
function readBaselineCensus(baseline) {
  const byState = baseline && baseline.by_state;
  if (!byState || typeof byState !== 'object') throw new Error('η baseline δεν έχει `by_state`');

  const missing = Object.values(X_STATES).filter((state) => !(Number.isInteger(byState[state]) && byState[state] >= 0));
  if (missing.length > 0) {
    throw new Error(`το \`by_state\` της baseline δεν ξέρει τις καταστάσεις: ${missing.join(', ')} — άλλο λεξιλόγιο, ξανασπορά`);
  }

  const records = Object.entries(byState).flatMap(([state, count]) =>
    Array.from({ length: Number(count) }, () => ({ state })));
  assertClosedLedger('Χ', X_STATES, records, () => 'baseline.by_state');

  if (records.length !== baseline.declaration_count) {
    throw new Error(`το \`by_state\` της baseline αθροίζει ${records.length} ≠ ${baseline.declaration_count} διαδρομές`);
  }
  return byState;
}

/**
 * @param {{ census: Record<string, number>, declarations: string[] }} measured
 * @param {object|null} baseline  `null` στη σπορά ⇒ μόνο η πολιτική
 * @returns {Array<{ id: string, current: number, ceiling: number, why: string }>}
 */
function countedBudgets(measured, baseline) {
  const total = measured.declarations.length;
  const previous = baseline ? readBaselineCensus(baseline) : null;
  const budgets = [];
  for (const state of X_COUNTED) {
    const current = measured.census[state] || 0;
    const share = X_COUNTED_CEILING[state];
    if (typeof share === 'number') {
      budgets.push({
        id: `${state} · πολιτική`,
        current,
        ceiling: Math.floor(share * total),
        why: `δηλωμένο ταβάνι ${Math.round(share * 100)}% των ${total} διαδρομών (X_COUNTED_CEILING)`,
      });
    }
    if (previous) {
      budgets.push({ id: `${state} · ratchet`, current, ceiling: previous[state], why: 'πλήθος της baseline (by_state)' });
    }
  }
  return budgets;
}

module.exports = { readBaselineCensus, countedBudgets };
