/**
 * CHECK 3.107 — ΠΟΙΑ ΠΗΓΗ ΚΡΙΝΕΙ ΚΑΘΕ ΠΥΛΗ (ADR-924). Η **παραγωγή**, χωρίς κρίση.
 *
 * Για κάθε πύλη που δρομολογεί ο εκτελεστής: το script της, τα ορίσματά της, και αν **ρωτά**
 * (`--index`) και **μπορεί να απαντήσει** (η κλειστότητα `require` φτάνει στο SSoT
 * `scripts/lib/git-index-snapshot.js`). Και τα δύο χρειάζονται: σημαία χωρίς αναγνώστη είναι
 * διακόσμηση· αναγνώστης χωρίς σημαία δεν ενεργοποιείται ποτέ από τον hook.
 *
 * ⚠️ Εμβέλεια = οι πύλες του `run-checks-parallel.js` (ο δρομολογητής της Φάσης 1). Οι φάσεις
 * 0/0.5/0.6… του ίδιου του hook είναι bash χωρίς δρομολογητή — εκτός εμβέλειας, ΔΗΛΩΜΕΝΑ (ADR-924 §4).
 *
 * @module scripts/lib/gate-commit-view/inventory
 */

'use strict';

const { importClosure } = require('../ts-import-closure');

const EXECUTOR = 'scripts/run-checks-parallel.js';
const SNAPSHOT_SSOT = 'scripts/lib/git-index-snapshot.js';
const DECLARATIONS_FILE = '.gate-commit-view.json';
const BASELINE_FILE = '.gate-commit-view-baseline.json';
const INDEX_FLAG = "'--index'";
/** Μία δρομολόγηση: id · script · ό,τι ακολουθεί ως το `)` που την κλείνει (τα ορίσματα, πολυγραμμικά). */
const DISPATCH_RE = /add[A-Za-z]+\(\s*'(3\.\d+)',\s*'[^']*',\s*'([^']+)'([^;]*?)\);/g;
/** Ο αναγνώστης του ευρετηρίου σε bash. */
const SHELL_READER_RE = /git (?:show ":|cat-file -e ":)/;

/** Οι δρομολογήσεις του εκτελεστή — ίδια πύλη δύο φορές (κλάδοι `if`) ⇒ ενώνονται τα ορίσματα. */
function dispatchesOf(executorText) {
  const byId = new Map();
  for (const [, id, script, args] of executorText.matchAll(DISPATCH_RE)) {
    const prior = byId.get(id);
    byId.set(id, { id, script, args: prior ? `${prior.args} ${args}` : args });
  }
  return [...byId.values()];
}

/** Ρωτά το script την όψη του commit, και φτάνει σε αναγνώστη που μπορεί να την απαντήσει; */
function classifyDispatch(dispatch, source) {
  const asksIndex = dispatch.args.includes(INDEX_FLAG);
  if (!source.has(dispatch.script)) return { ...dispatch, asksIndex, reader: false, missing: true };
  const reader = dispatch.script.endsWith('.sh')
    ? SHELL_READER_RE.test(source.readText(dispatch.script) || '')
    : importClosure({ entries: [dispatch.script], readText: source.readText, has: source.has }).includes(SNAPSHOT_SSOT);
  return { ...dispatch, asksIndex, reader, missing: false };
}

function parseJson(text, file) {
  if (text === null) throw new Error(`${file} λείπει — μέρος της πύλης, όχι προαιρετικό.`);
  return JSON.parse(text);
}

/**
 * @param {{has: (rel: string) => boolean, readText: (rel: string) => ?string}} source δίσκος ή όψη commit
 * @returns {{gates: object[], declared: Record<string, string>, baseline: string[]}}
 */
function takeInventory(source) {
  const executor = source.readText(EXECUTOR);
  if (executor === null) throw new Error(`${EXECUTOR} λείπει — η απογραφή δεν έχει αυθεντία.`);
  const gates = dispatchesOf(executor).map(dispatch => classifyDispatch(dispatch, source));
  const declared = parseJson(source.readText(DECLARATIONS_FILE), DECLARATIONS_FILE).declared || {};
  const baselineText = source.readText(BASELINE_FILE);
  const baseline = baselineText === null ? [] : JSON.parse(baselineText).gates || [];
  return { gates, declared, baseline };
}

module.exports = {
  EXECUTOR, SNAPSHOT_SSOT, DECLARATIONS_FILE, BASELINE_FILE, DISPATCH_RE,
  dispatchesOf, classifyDispatch, takeInventory,
};
