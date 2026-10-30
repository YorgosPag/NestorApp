/**
 * **Η ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ μιας πύλης** — ένα κατάστιχο ανά κατάσταση, κάθε κατάσταση και στο μηδέν, και **άρνηση**
 * για ό,τι δεν είναι γνωστή κατάσταση (fail-closed: μια καινούργια κατάσταση που κανείς δεν μετρά δεν γίνεται
 * σιωπηλά «καθαρό»).
 *
 * 🧹 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (ADR-924 §8.8, jscpd): το ίδιο `tallyOf` + `idsOf` ζούσε σε ΠΕΝΤΕ κριτές πυλών (3.66 · 3.67 · 3.68 ·
 * 3.69 · 3.84) με τρεις διαλέκτους του ίδιου ελέγχου (`in` · `Set.has` · `=== undefined`). Διαφορά = το όνομα της πύλης.
 *
 * @module scripts/lib/gate-ledger
 */

'use strict';

/**
 * @param {Array<{state: string, id?: string}>} rows
 * @param {Record<string, string>} states οι γνωστές καταστάσεις (`STATES` της πύλης)
 * @param {string} check π.χ. `'3.69'` — μπαίνει στο μήνυμα της άρνησης
 * @param {{withId?: boolean}} [options] `withId` ⇒ το μήνυμα ονομάζει και τη γραμμή
 * @returns {Record<string, number>}
 */
function closedTally(rows, states, check, { withId = false } = {}) {
  const tally = Object.fromEntries(Object.values(states).map((state) => [state, 0]));
  for (const row of rows) {
    if (!(row.state in tally)) {
      throw new Error(`CHECK ${check} — άγνωστη κατάσταση «${row.state}»${withId ? ` (${row.id})` : ''}`);
    }
    tally[row.state] += 1;
  }
  return tally;
}

/**
 * Η ίδια κλειστή λογιστική, σε **δηλωμένη σειρά** καταστάσεων και με ονομασμένο κατάστιχο (3.52 σελίδες/ομάδες ·
 * 3.53 δείκτες/έγγραφα) — άγνωστη κατάσταση ⇒ σφάλμα, άθροισμα ≠ πληθυσμός ⇒ σφάλμα.
 * @param {Array<{state: string}>} findings
 * @param {string[]} order
 * @param {string} check
 * @param {string} label το όνομα του κατάστιχου στο μήνυμα
 */
function orderedTally(findings, order, check, label) {
  const ledger = Object.fromEntries(order.map((s) => [s, 0]));
  for (const f of findings) {
    if (!(f.state in ledger)) throw new Error(`CHECK ${check}: άγνωστη κατάσταση «${f.state}» στη λογιστική ${label}`);
    ledger[f.state] += 1;
  }
  const summed = order.reduce((acc, s) => acc + ledger[s], 0);
  if (summed !== findings.length) {
    throw new Error(`CHECK ${check}: η λογιστική ${label} δεν κλείνει (${summed} ≠ ${findings.length})`);
  }
  return ledger;
}

/** Οι ταυτότητες των γραμμών μιας κατάστασης. */
const idsOf = (verdict, state) => verdict.rows.filter((r) => r.state === state).map((r) => r.id);

module.exports = { closedTally, orderedTally, idsOf };
