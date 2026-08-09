#!/usr/bin/env node
/**
 * =============================================================================
 * ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ, FAIL-CLOSED — ΜΙΑ ΥΛΟΠΟΙΗΣΗ  (CHECK 3.51 / ADR-781)
 * =============================================================================
 *
 * Και οι τρεις κανόνες (Κ1 · Κ2 · Χ) χρειάζονται την **ίδια** εγγύηση:
 * *κάθε εγγραφή έχει ακριβώς μία δηλωμένη κατάσταση, και το άθροισμα κλείνει*.
 * Μια πύλη που δεν μπορεί να πει «πόσους κοίταξα» δεν μπορεί να πει «κανέναν δεν
 * έχασα» — και το «0» της διαβάζεται ως «κοίταξα».
 *
 * ⚠️ ΓΙΑΤΙ ΖΕΙ ΕΔΩ ΚΑΙ ΟΧΙ ΤΡΕΙΣ ΦΟΡΕΣ: το **CHECK 3.28 (jscpd, N.18)** το έπιασε
 * **πριν** γραφτεί το «done» — 7 γραμμές / 52 tokens, δίδυμα ανάμεσα σε
 * `answerability.js` και `oracle.js`. Ήταν ακριβώς το λάθος που ο κανόνας N.18
 * περιγράφει: «κεντρικοποιείς το Α, γράφεις το Β ως δίδυμο». Η πύλη το είπε
 * πριν το πω εγώ, που είναι όλος ο λόγος ύπαρξής της.
 * =============================================================================
 */

'use strict';

/**
 * @param {string} rule            «Κ1» / «Κ2» / «Χ» — μπαίνει στο μήνυμα σφάλματος
 * @param {object} states          το `Object.freeze({...})` του κανόνα
 * @param {Array<object>} records  εγγραφές με πεδίο `state`
 * @param {(record: object) => string} label  πώς ονομάζεται μια εγγραφή στο σφάλμα
 * @returns {Record<string, number>} απογραφή — **κάθε** κατάσταση, ακόμα και στο 0
 */
function assertClosedLedger(rule, states, records, label) {
  const known = new Set(Object.values(states));
  const census = {};
  for (const state of known) census[state] = 0;

  for (const record of records) {
    if (!known.has(record.state)) {
      throw new Error(`CHECK 3.51 ${rule}: άγνωστη κατάσταση "${record.state}" στο ${label(record)}`);
    }
    census[record.state] += 1;
  }

  const total = Object.values(census).reduce((sum, count) => sum + count, 0);
  if (total !== records.length) {
    throw new Error(`CHECK 3.51 ${rule}: η λογιστική δεν κλείνει — ${total} ≠ ${records.length}`);
  }
  return census;
}

module.exports = { assertClosedLedger };
