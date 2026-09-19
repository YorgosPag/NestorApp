'use strict';

/**
 * ADR-865 §11.9 — Ο **ΕΝΑΣ** συγγραφέας προς τα αρχεία του GitHub Actions
 * (`$GITHUB_OUTPUT` · `$GITHUB_STEP_SUMMARY`).
 *
 * Ζούσε inline στο `scripts/firestore-deploy/verify-live.js`· η διαδοχή της γραμμής γράφει τις
 * ίδιες εξόδους ⇒ ένα σημείο. Εκτός Actions οι μεταβλητές λείπουν ⇒ **τίποτα** δεν γράφεται
 * (επιστρέφει `false`), ώστε τα ίδια σενάρια να τρέχουν και τοπικά.
 *
 * ⚠️ Τιμή εξόδου με αλλαγή γραμμής θα έσπαγε το `key=value` σε **δεύτερο, πλαστό** κλειδί ⇒
 * **πετά** (τα docs του GitHub απαιτούν delimiter για πολυγραμμικές τιμές — δεν χρειάζονται εδώ).
 */

const fs = require('fs');

/**
 * @param {Record<string, string|number|boolean>} record
 * @returns {boolean} γράφτηκε;
 */
function setOutputs(record, env = process.env) {
  if (!env.GITHUB_OUTPUT) return false;
  const lines = Object.entries(record).map(([key, value]) => {
    const text = String(value);
    if (/[\r\n]/.test(text)) throw new Error(`GITHUB_OUTPUT: η τιμή του «${key}» έχει αλλαγή γραμμής`);
    return `${key}=${text}\n`;
  });
  fs.appendFileSync(env.GITHUB_OUTPUT, lines.join(''));
  return true;
}

/** @returns {boolean} γράφτηκε; */
function appendSummary(markdown, env = process.env) {
  if (!env.GITHUB_STEP_SUMMARY) return false;
  fs.appendFileSync(env.GITHUB_STEP_SUMMARY, markdown.endsWith('\n') ? markdown : `${markdown}\n`);
  return true;
}

module.exports = { setOutputs, appendSummary };
