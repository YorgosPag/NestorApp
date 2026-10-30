'use strict';
/**
 * **ΠΑΡΑΓΟΜΕΝΑ ΑΡΧΕΙΑ ΑΠΕΝΑΝΤΙ ΣΤΟ ΣΧΕΔΙΟ** — η ΜΙΑ κρίση φρεσκάδας (πρότυπο Kubernetes `update-codegen` /
 * `verify-codegen`): ο γεννήτορας γράφει το σχέδιο, η πύλη ρωτά «ξαναπαράγεται ίδιο;».
 *
 * Καταναλωτές: CHECK 3.93 (προβολή Cloud Functions, ADR-874) · CHECK 3.98 (συμβόλαιο εφαρμογής κινητού, ADR-904 Ε6).
 * Εξήχθη από το `functions-projection/judge.js` με την άφιξη του δεύτερου (N.0.2) — ένα σχήμα, όχι δίδυμα.
 *
 * Καταστάσεις:
 *   fresh    — το αρχείο ισούται με το σχέδιο
 *   stale    — διαφέρει: το SSoT άλλαξε χωρίς αναπαραγωγή, Ή κάποιος το διόρθωσε με το χέρι (η ίδια αποτυχία)
 *   missing  — το σχέδιο το έχει, ο δίσκος όχι
 *   orphan   — ο δίσκος το έχει, το σχέδιο όχι
 *   invalid  — το ίδιο το σχέδιο δεν χτίζεται (ορίζει ο καλών)
 *
 * Οι αλλαγές γραμμής κανονικοποιούνται και στις δύο πλευρές: `core.autocrlf=true` χωρίς `.gitattributes` ⇒ το
 * working tree μπορεί να κρατά CRLF (μάθημα του CHECK 3.33).
 *
 * 🔑 ADR-924: η ΚΡΙΣΗ (`judgeOutputs`) διαβάζει από την ΕΙΣΟΔΟ — με `--index` κρίνεται ό,τι θα δεσμευτεί, όχι ο δίσκος.
 * Η ΕΦΑΡΜΟΓΗ (`applyJudgement`, γεννήτορες) γράφει πάντα στον δίσκο: εκεί ζει η δουλειά που θα σταδιοποιηθεί.
 */

const fs = require('node:fs');
const path = require('node:path');
const { toLf } = require('./text-eol');
const { openGateInput } = require('./gate-input');

const STATES = { FRESH: 'fresh', STALE: 'stale', MISSING: 'missing', ORPHAN: 'orphan', INVALID: 'invalid' };

const readLf = (abs) => toLf(fs.readFileSync(abs, 'utf8'));

/** Κάθε αρχείο κάτω από το `outputRoot`, ως σχετική διαδρομή με `/` — από την ΕΙΣΟΔΟ (ADR-924 Φ3). */
function listGenerated(root, outputRoot, input = openGateInput({ root })) {
  return input.files([outputRoot], { accept: () => true }).map(input.rel);
}

function stateOf(output, input) {
  const text = input.read(output.path);
  if (text === null) return STATES.MISSING;
  return toLf(text) === output.content ? STATES.FRESH : STATES.STALE;
}

/**
 * **Ο δίσκος απέναντι στα σχεδιασμένα αρχεία** `[{ path, content }]` κάτω από το `outputRoot`.
 * @returns {{ ok: boolean, results: Array<{ path: string, state: string }> }}
 */
function judgeOutputs(root, outputs, outputRoot, input = openGateInput({ root })) {
  const planned = new Set(outputs.map((o) => o.path));
  const results = outputs.map((o) => ({ path: o.path, state: stateOf(o, input) }));
  for (const file of listGenerated(root, outputRoot, input)) {
    if (!planned.has(file)) results.push({ path: file, state: STATES.ORPHAN });
  }
  return { ok: results.every((r) => r.state === STATES.FRESH), results };
}

function writeOutput(root, output) {
  const abs = path.join(root, output.path);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, output.content, 'utf8');
}

function removeOrphan(root, rel) {
  fs.unlinkSync(path.join(root, rel));
  let dir = path.dirname(path.join(root, rel));
  while (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
    dir = path.dirname(dir);
  }
}

/** **Εφάρμοσε την κρίση**: γράψε ό,τι δεν είναι φρέσκο, σβήσε τα ορφανά. */
function applyJudgement(root, outputs, results) {
  const byPath = new Map(outputs.map((o) => [o.path, o]));
  const written = [];
  const removed = [];
  for (const r of results) {
    if (r.state === STATES.ORPHAN) { removeOrphan(root, r.path); removed.push(r.path); }
    else if (r.state !== STATES.FRESH) { writeOutput(root, byPath.get(r.path)); written.push(r.path); }
  }
  return { written, removed };
}

/**
 * Ο ΚΟΙΝΟΣ γεννήτορας (3.93 · 3.98 — ήταν δίδυμοι): `judgeWith(input)` ⇒ `{ plan, results }` — σφάλμα σχεδίου ⇒ ΤΙΠΟΤΑ
 * δεν γράφεται. `input` (ADR-924 Φ5) = η όψη από την οποία παράγεται: με `--index` το commit· η εγγραφή πάντα ο δίσκος.
 */
function generateArtifacts(root, judgeWith, input) {
  const { plan, results } = judgeWith(input);
  if (plan.errors.length > 0) return { ok: false, errors: plan.errors, written: [], removed: [] };
  const { written, removed } = applyJudgement(root, plan.outputs, results);
  return { ok: true, errors: [], written, removed, total: plan.outputs.length };
}

/** Η κοινή αναφορά γεννήτορα — επιστρέφει τον κωδικό εξόδου. `failure` = το μήνυμα όταν το σχέδιο δεν χτίζεται. */
function reportGeneration(res, { label, failure }) {
  if (!res.ok) {
    console.error(`❌ ${label} — ${failure}`);
    for (const e of res.errors) console.error(`   • ${e}`);
    return 1;
  }
  for (const p of res.written) console.log(`   ✍️  ${p}`);
  for (const p of res.removed) console.log(`   🗑️  ${p}`);
  console.log(`✅ ${label} — ${res.total} files, ${res.written.length} written, ${res.removed.length} removed`);
  return 0;
}

module.exports = { STATES, readLf, listGenerated, judgeOutputs, applyJudgement, generateArtifacts, reportGeneration };
