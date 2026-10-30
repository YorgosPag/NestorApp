/**
 * CHECK 3.107 — **ΤΟ ΣΤΑΤΙΚΟ ΣΚΕΛΟΣ ΤΗΣ ΑΠΟΔΕΙΞΗΣ** (ADR-924 Φ4, §8.11): πόσα ωμά σημεία ανάγνωσης `fs` ζουν σε κάθε
 * αρχείο της κλειστότητας των πυλών που κρίνουν το commit — και ratchet ανά αρχείο, ώστε να μη γεννιούνται νέα.
 *
 * 🔑 Ο ΡΟΛΟΣ ΤΟΥ: η ΑΠΟΔΕΙΞΗ είναι δυναμική (η παγίδα και το κατάστιχο του worker — §8.11) και πιάνει κάθε διαρροή που
 *    ΤΡΕΧΕΙ. Αυτό εδώ κρατά την πόρτα κλειστή σε ό,τι δεν έχει τρέξει ακόμη: ένα νέο `fs.readFileSync` σε βιβλιοθήκη πύλης
 *    μπλοκάρει στο commit που το φέρνει — περάσε την είσοδο, ή δήλωσε γιατί (ποτέ «θα το δει το CI»).
 * ⚠️ Δεν είναι κάθε ωμή ανάγνωση διαρροή: οι κλάδοι «χωρίς είσοδο ⇒ δίσκος» (σουίτες, γεννήτορες) είναι νόμιμοι. Γι' αυτό
 *    ratchet και όχι μηδενική ανοχή — το χρέος μετριέται και μόνο μειώνεται.
 *
 * @module scripts/lib/gate-commit-view/raw-reads
 */

'use strict';

const { importClosure } = require('../ts-import-closure');

/** Οι ΑΥΘΕΝΤΙΕΣ — εδώ ζει, επίτηδες, η μία ανάγνωση του δίσκου πίσω από την είσοδο. */
const READ_AUTHORITIES = Object.freeze(new Set([
  'scripts/lib/gate-input.js',
  'scripts/lib/git-index-snapshot.js',
  'scripts/lib/module-graph/scan-config.js',
  'scripts/lib/ts-module-loader.js',
  'scripts/lib/ts-import-closure.js',
]));

/** Ωμό σημείο ανάγνωσης: `fs.x(` ή αποδομημένο `x(` — ποτέ σε γραμμή σχολίου. */
const RAW_READ = /\b(?:fs\.)?(?:readFileSync|existsSync|statSync|lstatSync|readdirSync)\s*\(/g;
const COMMENT_LINE = /^\s*(?:\/\/|\*|\/\*)/;

/** Πόσα ωμά σημεία ανάγνωσης έχει ένα κείμενο κώδικα. */
function countRawReads(text) {
  return text.split('\n').filter(line => !COMMENT_LINE.test(line))
    .reduce((sum, line) => sum + (line.match(RAW_READ) || []).length, 0);
}

/**
 * `{ αρχείο: πλήθος }` πάνω στην ΕΝΩΣΗ των κλειστοτήτων (μόνο `scripts/`, χωρίς τις αυθεντίες) — μόνο αρχεία με > 0.
 * @param {string[]} scripts τα scripts των πυλών που κρίνουν το commit
 * @param {{has: (rel: string) => boolean, readText: (rel: string) => ?string}} source δίσκος ή όψη commit
 */
function measureRawReads(scripts, source) {
  const files = new Set();
  for (const entry of scripts) {
    for (const file of importClosure({ entries: [entry], readText: source.readText, has: source.has })) {
      if (file.startsWith('scripts/') && file.endsWith('.js') && !READ_AUTHORITIES.has(file)) files.add(file);
    }
  }
  const counts = {};
  for (const file of [...files].sort()) {
    const count = countRawReads(source.readText(file) || '');
    if (count > 0) counts[file] = count;
  }
  return counts;
}

/**
 * Το ratchet: `grown` = αρχείο με ΠΕΡΙΣΣΟΤΕΡΑ σημεία από τη baseline (ή νέο) ⇒ μπλοκάρει· `shrunk` = λιγότερα ⇒ κλείδωσέ το.
 * @returns {{grown: Array<{file: string, from: number, to: number}>, shrunk: Array<{file: string, from: number, to: number}>}}
 */
function compareRawReads(current, baseline) {
  const grown = [];
  const shrunk = [];
  for (const file of [...new Set([...Object.keys(current), ...Object.keys(baseline)])].sort()) {
    const from = baseline[file] || 0;
    const to = current[file] || 0;
    if (to > from) grown.push({ file, from, to });
    else if (to < from) shrunk.push({ file, from, to });
  }
  return { grown, shrunk };
}

module.exports = { READ_AUTHORITIES, countRawReads, measureRawReads, compareRawReads };
