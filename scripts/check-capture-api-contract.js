#!/usr/bin/env node
'use strict';
/**
 * CHECK 3.98 — φρεσκάδα του συμβολαίου της εφαρμογής κινητού (ADR-904 Ε6).
 *
 * «Είναι το `contracts/capture-api/` ΑΚΡΙΒΩΣ ό,τι λέει σήμερα ο κώδικας του διακομιστή;»
 *
 * Η εφαρμογή λήψης ζει σε ΧΩΡΙΣΤΟ αποθετήριο και ΔΕΝ μπορεί να κάνει import από το `src/`. Παίρνει τα σχήματα,
 * τα όρια της πολιτικής πανοράματος, τα λεξιλόγια και τις αρνήσεις ως ΠΑΡΑΓΟΜΕΝΟ OpenAPI. Χωρίς αυτή την πύλη,
 * μια αλλαγή του `PANORAMA_MAX_BYTES` ή μια νέα άρνηση θα έφτανε στον server αλλά ΟΧΙ στο συμβόλαιο — ακριβώς το
 * περιστατικό του CHECK 3.93 (χειρόγραφο mirror που απέκλινε ~5 μήνες), σε άλλη γλώσσα.
 *
 * ⛔ ZERO-TOL, καμία baseline. Χωρίς σκανδάλη: τα σχήματα εισάγουν λεξιλόγια από όλη την εφαρμογή.
 *
 * CLI:  node scripts/check-capture-api-contract.js
 * Env:  SKIP_CAPTURE_API_CONTRACT=1   — παράκαμψη (αιτιολόγηση στον Giorgio)
 *       CAPTURE_API_CONTRACT_ROOT=…   — άλλη ρίζα (fixtures του Jest)
 * Exit: 0 fresh · 1 stale / missing / orphan / invalid
 */

const path = require('node:path');

const { judgeOutputs, STATES } = require('./lib/generated-artifacts');
const { buildPlan, REGENERATE } = require('./lib/capture-api-contract/plan');

const ICON = {
  [STATES.STALE]: '✏️  stale (ο κώδικας άλλαξε χωρίς αναπαραγωγή, ή το αρχείο διορθώθηκε με το χέρι)',
  [STATES.MISSING]: '➕ missing',
  [STATES.ORPHAN]: '🗑️  orphan (δεν ανήκει στο συμβόλαιο)',
  [STATES.INVALID]: '⛔ invalid',
};

/** @returns {{ ok: boolean, results: Array<{path:string, state:string, detail?:string}> }} */
function judge(root) {
  const plan = buildPlan(root);
  if (plan.errors.length > 0) {
    return { ok: false, results: plan.errors.map((detail) => ({ path: plan.outputRoot, state: STATES.INVALID, detail })) };
  }
  return judgeOutputs(root, plan.outputs, plan.outputRoot);
}

function report(res) {
  const bad = res.results.filter((r) => r.state !== STATES.FRESH);
  if (bad.length === 0) {
    console.log(`✅ CHECK 3.98 capture API contract — ${res.results.length} generated files fresh`);
    return;
  }
  console.error('❌ CHECK 3.98 capture API contract — contracts/capture-api/ δεν συμφωνεί με τον κώδικα');
  for (const r of bad) console.error(`   ${ICON[r.state]}: ${r.path}${r.detail ? `\n      ${r.detail}` : ''}`);
  const fix = bad.some((r) => r.state === STATES.INVALID)
    ? 'Διόρθωσε το σφάλμα παραπάνω (καθαρά modules · fixture που διαφωνεί με το σχήμα του).'
    : `Τρέξε: ${REGENERATE}   — ποτέ επεξεργασία του contracts/capture-api/ με το χέρι.`;
  console.error(`\n   ${fix}\n   📘 docs/gates/3.98.md · ADR-904 Ε6`);
}

function main() {
  if (process.env.SKIP_CAPTURE_API_CONTRACT === '1') {
    console.log('⏭️  CHECK 3.98 skipped (SKIP_CAPTURE_API_CONTRACT=1)');
    return;
  }
  const root = process.env.CAPTURE_API_CONTRACT_ROOT || path.resolve(__dirname, '..');
  const res = judge(root);
  report(res);
  process.exitCode = res.ok ? 0 : 1;
}

if (require.main === module) main();

module.exports = { judge };
