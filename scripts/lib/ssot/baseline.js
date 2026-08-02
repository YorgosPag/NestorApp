#!/usr/bin/env node
/**
 * =============================================================================
 * ADR-749 — SSoT ΠΑΡΑΒΙΑΣΕΙΣ: ΤΟ BASELINE (σχήμα v2, ανά αρχείο ΚΑΙ module)
 * =============================================================================
 *
 * ── ΓΙΑΤΙ ΑΛΛΑΞΕ ΤΟ ΣΧΗΜΑ ──────────────────────────────────────────────────
 *
 * v1: `{ "src/a.ts": 4 }`            — σκέτο σύνολο ανά αρχείο
 * v2: `{ "src/a.ts": { "escape-command-bus": 2, "date-local": 2 } }`
 *
 * Το v1 επιτρέπει **ανταλλαγή**: σβήνεις μία παραβίαση ενός module, προσθέτεις
 * μία άλλου, το σύνολο μένει 4, **η πύλη περνάει**. Είναι η ίδια κοκκομετρία
 * που διάλεξε το ESLint bulk-suppressions τον Απρίλιο 2025 — ανά
 * `(αρχείο, κανόνας)` — και για τον ίδιο λόγο.
 *
 * ── FAIL-CLOSED ΣΤΟ ΣΧΗΜΑ ──────────────────────────────────────────────────
 *
 * Baseline v1 **απορρίπτεται με σφάλμα**, δεν «διαβάζεται υποβαθμισμένα».
 * Σιωπηλή υποβάθμιση είναι ακριβώς ο μηχανισμός που παρήγαγε το αρχικό bug:
 * μια πύλη που δουλεύει «κάπως» δεν φαίνεται ποτέ χαλασμένη. Το κανονικό
 * baseline ταξιδεύει στο **ίδιο commit** με αυτόν τον κώδικα, οπότε δεν
 * υπάρχει παράθυρο ασυμβατότητας.
 *
 * ── ΟΤΑΝ ΤΟ ΠΛΗΘΟΣ ΑΝΕΒΑΙΝΕΙ ───────────────────────────────────────────────
 *
 * Εμφανίζονται **ΟΛΕΣ** οι παραβιάσεις του module, όχι μόνο «οι νέες». Δεν
 * υπάρχει αξιόπιστος τρόπος να ξεχωρίσεις ποια γραμμή είναι η καινούργια, και
 * το μάντεμα κρύβει πραγματικά ευρήματα. Είναι η ρητή επιλογή του ESLint:
 * *«Rather than trying to guess which violations to hide, ESLint chooses to
 * show the full picture.»*
 *
 * @see ADR-749
 * @module scripts/lib/ssot/baseline
 */

'use strict';

const fs = require('node:fs');
const { writeBaselineFile } = require('../ratchet-baseline');

const BASELINE_FILE = '.ssot-violations-baseline.json';
const SCHEMA_VERSION = 2;

/**
 * @typedef {object} Baseline
 * @property {number} schema
 * @property {Record<string, Record<string, number>>} files  path → module → πλήθος
 */

/**
 * Διαβάζει το baseline. **Fail-closed**: κάθε πρόβλημα είναι εξαίρεση.
 *
 * @param {string} [filePath]
 * @returns {Baseline}
 * @throws {Error} αν λείπει, είναι άκυρο JSON, ή είναι σχήμα v1
 */
function loadBaseline(filePath = BASELINE_FILE) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Το SSoT baseline δεν βρέθηκε: ${filePath} — είναι tracked στο git, επανάφερέ το.`);
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`Το SSoT baseline δεν διαβάζεται (${filePath}): ${err.message}`);
  }

  const schema = raw._meta && raw._meta.schema;
  if (schema !== SCHEMA_VERSION) {
    throw new Error(
      `Το SSoT baseline είναι σχήμα ${schema ?? 1}, αναμένεται ${SCHEMA_VERSION}.\n` +
      '  Το v1 κρατούσε σκέτο σύνολο ανά αρχείο και επέτρεπε ανταλλαγή παραβιάσεων μεταξύ modules.\n' +
      '  Διόρθωση: npm run ssot:baseline'
    );
  }

  return { schema, files: raw.files && typeof raw.files === 'object' ? raw.files : {} };
}

/**
 * @typedef {object} FileVerdict
 * @property {'clean'|'ratchet-down'|'same'|'blocked'} kind
 * @property {string} file
 * @property {number} current
 * @property {number} baseline
 * @property {boolean} inBaseline
 * @property {{module: string, current: number, baseline: number}[]} regressions
 * @property {{module: string, current: number, baseline: number}[]} improvements
 */

/**
 * Συγκρίνει τα τρέχοντα ανά-module πλήθη ενός αρχείου με το baseline του.
 *
 * Κανόνας ratchet: **κανένα module δεν επιτρέπεται να ανέβει**. Αρκεί ένα για
 * να μπλοκάρει — ακόμη κι αν άλλα κατέβηκαν και το σύνολο έπεσε.
 *
 * @param {string} file
 * @param {Map<string, number>} current
 * @param {Record<string, number>|undefined} baselineEntry
 * @returns {FileVerdict}
 */
function compareFile(file, current, baselineEntry) {
  const inBaseline = baselineEntry !== undefined;
  const base = baselineEntry || {};

  const regressions = [];
  const improvements = [];

  for (const moduleName of allModuleNames(current, base)) {
    const cur = current.get(moduleName) || 0;
    const old = base[moduleName] || 0;
    if (cur > old) regressions.push({ module: moduleName, current: cur, baseline: old });
    else if (cur < old) improvements.push({ module: moduleName, current: cur, baseline: old });
  }

  const currentTotal = sumMap(current);
  const baselineTotal = Object.values(base).reduce((a, b) => a + b, 0);

  return {
    kind: verdictKind(regressions, improvements, currentTotal, baselineTotal),
    file, current: currentTotal, baseline: baselineTotal,
    inBaseline, regressions, improvements,
  };
}

/** @internal */
function verdictKind(regressions, improvements, currentTotal, baselineTotal) {
  if (regressions.length > 0) return 'blocked';
  if (improvements.length > 0) return 'ratchet-down';
  return currentTotal === 0 && baselineTotal === 0 ? 'clean' : 'same';
}

/** @internal ένωση κλειδιών από Map + απλό αντικείμενο, ταξινομημένη */
function allModuleNames(current, base) {
  return [...new Set([...current.keys(), ...Object.keys(base)])].sort();
}

/** @internal */
function sumMap(map) {
  let n = 0;
  for (const v of map.values()) n += v;
  return n;
}

/**
 * Γράφει το baseline. Τα κλειδιά ταξινομούνται ώστε το tracked αρχείο να έχει
 * σταθερό diff μεταξύ regenerations.
 *
 * @param {string} filePath
 * @param {Record<string, Record<string, number>>} files
 * @param {object} [extra] επιπλέον πεδία `_meta`
 */
function writeBaseline(filePath, files, extra = {}) {
  const sortedFiles = {};
  for (const key of Object.keys(files).sort()) sortedFiles[key] = files[key];

  const totalFiles = Object.keys(sortedFiles).length;
  const totalViolations = Object.values(sortedFiles)
    .reduce((sum, perModule) => sum + Object.values(perModule).reduce((a, b) => a + b, 0), 0);

  writeBaselineFile(filePath, {
    _meta: {
      description: 'SSoT centralized-module violations baseline (ratchet, ανά αρχείο ΚΑΙ module)',
      schema: SCHEMA_VERSION,
      generated: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      totalViolations,
      totalFiles,
      rule: 'Κανένα module δεν ανεβαίνει σε κανένα αρχείο. Νέο αρχείο = μηδενική ανοχή.',
      registry: '.ssot-registry.json',
      engine: 'scripts/lib/ssot/scan.js (ΜΙΑ μηχανή — ADR-749)',
      ...extra,
    },
    files: sortedFiles,
  });

  return { totalFiles, totalViolations };
}

module.exports = {
  BASELINE_FILE,
  SCHEMA_VERSION,
  loadBaseline,
  compareFile,
  writeBaseline,
};
