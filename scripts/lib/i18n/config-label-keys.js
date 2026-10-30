/**
 * **ΚΛΕΙΔΙΑ i18n ΣΕ ΑΡΧΕΙΑ ΡΥΘΜΙΣΕΩΝ** (ADR-924 Φ3) — το κοινό λεξιλόγιο των CHECK 3.12 (option labels) και 3.13
 * (προσιτότητα από τον resolver). Ήταν δύο αντίγραφα: ίδιο σχήμα κλειδιού, ίδιο πεδίο αρχείων, ίδια εξαγωγή
 * των μπλοκ `*_LABELS`. Οι δύο πύλες ρωτούν ΑΛΛΟ ερώτημα πάνω στους ΙΔΙΟΥΣ υποψηφίους — άρα οι υποψήφιοι ζουν εδώ.
 *
 * @module scripts/lib/i18n/config-label-keys
 */

'use strict';

const ratchet = require('../per-file-ratchet');

/**
 * Συμβολοσειρά που μοιάζει με κλειδί i18n: τουλάχιστον μία τελεία, τμήματα-αναγνωριστικά. Αποκλείει URLs,
 * μονοπάτια, θραύσματα regex.
 */
const KEY_SHAPE = /^[a-z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+){1,}$/;

const normalizePath = (p) => p.replace(/\\/g, '/');

/** Τα αρχεία ρυθμίσεων που κρίνουν οι δύο πύλες (σχετικά μονοπάτια). */
function isConfigLabelScope(file) {
  const norm = normalizePath(file);
  if (!/\.(ts|tsx)$/.test(norm)) return false;
  if (/(__tests__|\.test\.|\.spec\.|\.stories\.|\.d\.ts$)/.test(norm)) return false;
  if (norm.startsWith('scripts/')) return false;
  return (
    norm.startsWith('src/config/') ||
    /src\/subapps\/[^/]+\/config\/modal-select(\/|\.)/.test(norm) ||
    /src\/constants\/domains\/dropdown-[a-z-]+\.ts$/.test(norm)
  );
}

/**
 * Οι υποψήφιοι μέσα σε μπλοκ `export const FOO_LABELS = { … } as const` — χοντρό λεκτικό παράθυρο ως το `}` που
 * κλείνει (αρκεί για αρχεία σταθερών). `[{ key, index }]`.
 */
function labelsBlockCandidates(content) {
  const out = [];
  const labelsBlockRegex = /export\s+const\s+[A-Z][A-Z0-9_]*_LABELS\s*=\s*\{([\s\S]*?)\n\}\s*as\s+const;?/g;
  for (const block of content.matchAll(labelsBlockRegex)) {
    const body = block[1];
    const baseIndex = block.index + block[0].indexOf(body);
    for (const m of body.matchAll(/['"]([^'"]+)['"]\s*,?/g)) {
      if (KEY_SHAPE.test(m[1])) out.push({ key: m[1], index: baseIndex + m.index });
    }
  }
  return out;
}

/** Η γραμμή (1-based) ενός δείκτη χαρακτήρα. */
function lineOf(content, index) {
  return content.substring(0, index).split('\n').length;
}

/** Ο φάκελος των ελληνικών locale — η αυθεντία κλειδιών και των δύο πυλών (σχετικός με τη ρίζα). */
const EL_LOCALE_DIR = 'src/i18n/locales/el';

/** Κάθε αρχείο του πεδίου (`--all` / `--baseline`) — από την ΕΙΣΟΔΟ (ADR-924 Φ3: ήταν δικός του `readdirSync`). */
function configLabelFiles(input) {
  return ratchet.scopeFiles(input, ['src/config', 'src/subapps', 'src/constants/domains'], isConfigLabelScope);
}

/** Τα ευρήματα ανά αρχείο του πεδίου (`findHits(content)`) — το κείμενο από την είσοδο. */
function scanConfigLabels(files, input, findHits) {
  return ratchet.scanFiles(files, { input, inScope: isConfigLabelScope, findHits });
}

/**
 * Η κρίση των δύο πυλών: γραμμή ανά αρχείο έναντι της baseline της ΕΙΣΟΔΟΥ, χωρίς «(total, baseline)» — όπως τύπωναν
 * πάντα. Επιστρέφει αν μπλοκάρει.
 * @param {{baselineFile: string, noun: string, newNoun: string, describeHit: (hit: object) => string}} spec
 */
function judgeConfigLabels(scanned, input, { baselineFile, ...spec }) {
  return ratchet.printLineVerdict(scanned, ratchet.loadFileCounts(baselineFile, input), { ...spec, showTotals: false });
}

module.exports = {
  KEY_SHAPE, EL_LOCALE_DIR, isConfigLabelScope, labelsBlockCandidates, lineOf, normalizePath,
  configLabelFiles, scanConfigLabels, judgeConfigLabels,
};
