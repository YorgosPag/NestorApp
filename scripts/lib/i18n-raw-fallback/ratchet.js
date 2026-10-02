/**
 * CHECK 3.97 — εμβέλεια + σύγκριση ratchet (ADR-898 §18.2). Καθαρές συναρτήσεις, χωρίς I/O κρίσης.
 *
 * 🔑 ΕΜΒΕΛΕΙΑ: `src/**\/*.ts(x)` — ΜΑΖΙ με το `src/subapps/dxf-viewer`, ακριβώς όπως το i18n SSoT
 *    (`scripts/_shared/i18n-governance.js` σαρώνει όλο το `src`) και το CHECK 3.8. Μια πύλη i18n με
 *    στενότερη εμβέλεια από τις αδελφές της θα έλεγε «πράσινο» εκεί όπου εκείνες βλέπουν.
 *    Εκτός: tests (`__tests__`, `*.test.*`, `*.spec.*`), `__mocks__`, `*.d.ts`, `src/i18n/locales`.
 *
 * 🔴 RATCHET ΑΝΑ ΑΡΧΕΙΟ: νέο αρχείο με εύρημα ⇒ ΜΠΛΟΚ · πάνω από τη baseline ⇒ ΜΠΛΟΚ · ίσο ⇒ περνά ·
 *    λιγότερα ⇒ περνά και τυπώνεται η πρόοδος. Δηλωμένο κενό: ανταλλαγή ΜΕΣΑ στο ίδιο αρχείο περνά.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SOURCE_RE = /^src\/.*\.tsx?$/;
const EXCLUDED_RE = /(^|\/)(__tests__|__mocks__)\/|\.(test|spec)\.tsx?$|\.d\.ts$|^src\/i18n\/locales\//;

const normalize = (f) => f.trim().replace(/\\/g, '/');

function inScope(file) {
  const f = normalize(file);
  return SOURCE_RE.test(f) && !EXCLUDED_RE.test(f);
}

/** Όλα τα αρχεία της εμβέλειας, σχετικά με τη ρίζα, ταξινομημένα (ντετερμινιστική baseline). */
function walkScope(root, dir = 'src') {
  const out = [];
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walkScope(root, rel));
    else if (inScope(rel)) out.push(rel);
  }
  return out.sort();
}

/**
 * Τρέχον vs baseline, ανά αρχείο.
 * `scope: 'staged'` — αρχείο που δεν σαρώθηκε δεν είναι «καθαρό», απλώς δεν στάλθηκε.
 * `scope: 'all'` — η απουσία από το τρέχον ΕΙΝΑΙ πρόοδος.
 * @param {Record<string, number>} current  μόνο αρχεία με ευρήματα
 * @param {Record<string, number>} baseline
 * @param {string[]} scanned  τα αρχεία που σαρώθηκαν (staged)
 */
function compare(current, baseline, scope, scanned = []) {
  const regressions = [];
  const progress = [];
  for (const [file, now] of Object.entries(current)) {
    const was = baseline[file] || 0;
    if (now > was) regressions.push({ file, was, now, isNewFile: !baseline[file] });
    else if (now < was) progress.push({ file, was, now });
  }
  const seen = scope === 'all' ? Object.keys(baseline) : scanned.filter((f) => baseline[f]);
  for (const file of seen) {
    if (!current[file]) progress.push({ file, was: baseline[file], now: 0 });
  }
  return { regressions, progress };
}

function totals(counts) {
  const values = Object.values(counts);
  return { findings: values.reduce((a, b) => a + b, 0), files: values.length };
}

module.exports = { inScope, walkScope, compare, totals, normalize };
