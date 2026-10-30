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
/**
 * `source` βιβλιοθήκης δίπλα στο script (`"$(dirname "${BASH_SOURCE[0]}")/x.sh"` ή `"$SCRIPT_DIR/x.sh"`) — η κλειστότητα
 * ενός bash script. Ο αναγνώστης ζει ΜΙΑ φορά στο `scripts/lib/commit-source.sh` (3.6 · 3.9 · 3.10, ADR-924 Φ3).
 */
const SHELL_SOURCE_RE = /^\s*source\s+"(?:\$\(dirname "\$\{BASH_SOURCE\[0\]\}"\)|\$SCRIPT_DIR)\/([^"]+)"/gm;

/** Φτάνει το bash script (ή μια βιβλιοθήκη που κάνει `source`) σε αναγνώστη του ευρετηρίου; */
function shellReaches(script, source) {
  const text = source.readText(script) || '';
  if (SHELL_READER_RE.test(text)) return true;
  const dir = script.slice(0, script.lastIndexOf('/'));
  return [...text.matchAll(SHELL_SOURCE_RE)].some(([, lib]) => SHELL_READER_RE.test(source.readText(`${dir}/${lib}`) || ''));
}

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
    ? shellReaches(dispatch.script, source)
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
  const declarations = parseJson(source.readText(DECLARATIONS_FILE), DECLARATIONS_FILE);
  const baselineText = source.readText(BASELINE_FILE);
  const baselineBody = baselineText === null ? {} : JSON.parse(baselineText);
  // ADR-924 Φ4: οι δηλωμένες αναγνώσεις ΠΕΡΙΒΑΛΛΟΝΤΟΣ (η μόνη ανοχή της παγίδας του worker) — κρίνονται κι αυτές·
  //   `rawReads` = το ratchet των ωμών σημείων ανάγνωσης στην κλειστότητα των πυλών (`raw-reads.js`)
  return {
    gates, declared: declarations.declared || {}, environment: declarations.environment || {},
    // `null` = το ratchet ΔΕΝ έχει οπλιστεί σε αυτή την όψη (baseline χωρίς `rawReads`) — ποτέ «όλα νέα»
    baseline: baselineBody.gates || [], rawReads: baselineBody.rawReads || null,
  };
}

module.exports = {
  EXECUTOR, SNAPSHOT_SSOT, DECLARATIONS_FILE, BASELINE_FILE, DISPATCH_RE,
  dispatchesOf, classifyDispatch, takeInventory,
};
