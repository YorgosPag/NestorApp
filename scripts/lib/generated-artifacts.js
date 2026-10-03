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
 */

const fs = require('node:fs');
const path = require('node:path');

const STATES = { FRESH: 'fresh', STALE: 'stale', MISSING: 'missing', ORPHAN: 'orphan', INVALID: 'invalid' };

const readLf = (abs) => fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');

/** Κάθε αρχείο κάτω από το `outputRoot`, ως σχετική διαδρομή με `/`. */
function listGenerated(root, outputRoot) {
  const base = path.join(root, outputRoot);
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(abs);
      else out.push(path.relative(root, abs).split(path.sep).join('/'));
    }
  };
  walk(base);
  return out;
}

function stateOf(root, output) {
  const abs = path.join(root, output.path);
  if (!fs.existsSync(abs)) return STATES.MISSING;
  return readLf(abs) === output.content ? STATES.FRESH : STATES.STALE;
}

/**
 * **Ο δίσκος απέναντι στα σχεδιασμένα αρχεία** `[{ path, content }]` κάτω από το `outputRoot`.
 * @returns {{ ok: boolean, results: Array<{ path: string, state: string }> }}
 */
function judgeOutputs(root, outputs, outputRoot) {
  const planned = new Set(outputs.map((o) => o.path));
  const results = outputs.map((o) => ({ path: o.path, state: stateOf(root, o) }));
  for (const file of listGenerated(root, outputRoot)) {
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

module.exports = { STATES, readLf, listGenerated, judgeOutputs, applyJudgement };
