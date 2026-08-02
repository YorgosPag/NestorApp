#!/usr/bin/env node
/**
 * =============================================================================
 * ADR-749 §5 — ΑΠΟΔΕΙΞΗ ΖΩΗΣ ΑΝΑ PATTERN
 * =============================================================================
 *
 * ── ΤΟ ΠΡΟΒΛΗΜΑ ────────────────────────────────────────────────────────────
 *
 * Στο ESLint / PHPStan / detekt ένας κανόνας είναι **κώδικας**, άρα έχει unit
 * tests. Στο δικό μας μητρώο ένας κανόνας είναι **regex string** — δεδομένο,
 * χωρίς κανένα test. Ένα τέτοιο pattern μπορεί να είναι συντακτικά έγκυρο και
 * **δομικά ανίκανο** να πιάσει οτιδήποτε, για πάντα, χωρίς κανένα σήμα.
 *
 * Έχει συμβεί **τέσσερις** φορές στο έργο, με το ίδιο ακριβώς σχήμα:
 *   · 6 patterns με POSIX `[[:space:]]` — νεκρά στην πύλη (2026-08-03)
 *   · 3 patterns `xlineMode\.(mode|angleValue|offsetDistance)` — το idiom
 *     έχει εξαφανιστεί από τον κώδικα
 *   · `jobs-visibility`: `type\s+JobFilter\s*=` ενώ ο κώδικας γράφει
 *     `export interface`
 *   · v3.0: `(?:...)` που «δεν πιάνει τίποτα» στο ERE
 *
 * Και οι τέσσερις είναι η ίδια πρόταση: **«0 = κανείς δεν κοίταξε», όχι
 * «καθαρό»**. Μια πλήρης σάρωση δεν τα ξεχωρίζει: ο καθαρός φρουρός και ο
 * νεκρός φρουρός δίνουν **και οι δύο** μηδέν ευρήματα.
 *
 * ── Η ΛΥΣΗ (μοντέλο Semgrep) ───────────────────────────────────────────────
 *
 * Το Semgrep απαιτεί κάθε κανόνας-δεδομένο να συνοδεύεται από παραδείγματα
 * **δύο κατευθύνσεων** (`ruleid:` = πρέπει να πιάσει, `ok:` = δεν πρέπει). Τα
 * δικά μας ζουν στο `pattern-proofs.js` ως `shouldMatch` / `shouldSkip`.
 *
 * ⚠️ Η απόδειξη εκτελείται στη μηχανή **ΤΗΣ ΠΥΛΗΣ** (JS RegExp). Αυτό είναι
 * το κρίσιμο σημείο: μέχρι σήμερα το `registry-golden-regex.test.js`
 * επικύρωνε τα patterns με `grep -E`, δηλαδή σε διάλεκτο που **κανένας
 * καταναλωτής δεν εκτελεί**. Γι' αυτό τα 6 POSIX patterns ήταν πράσινα σε 44
 * tests ενώ ήταν νεκρά στην παραγωγή. Ένα test σε λάθος μηχανή δεν είναι test.
 *
 * ⚠️ Το αρχείο `pattern-proofs.js` **δεν είναι test fixture** — γι' αυτό ζει
 * εδώ και όχι σε `__tests__/`. Είναι μέρος του ορισμού του κανόνα, και το
 * διαβάζουν **δύο** καταναλωτές: το golden test και το `ssot:audit`.
 *
 * @see ADR-749 §5
 * @module scripts/lib/ssot/proofs
 */

'use strict';

const PATTERN_PROOFS = require('./pattern-proofs');

/**
 * Κλειδί ενός pattern: `"<module>#<index>"`. Ίδια σύμβαση με το
 * `full-scan.js` ώστε τα δύο σύνολα να συγκρίνονται απευθείας.
 *
 * @param {string} moduleName
 * @param {number} index
 */
function patternKey(moduleName, index) {
  return `${moduleName}#${index}`;
}

/**
 * Ποια patterns **αποδεικνύεται** ότι μπορούν να πιάσουν;
 *
 * Ένα pattern θεωρείται αποδεδειγμένα ζωντανό όταν πιάνει τουλάχιστον μία
 * γραμμή του `shouldMatch` του module του, εκτελεσμένο στη μηχανή της πύλης.
 *
 * @param {import('./registry').SsotModule[]} modules
 * @param {Record<string, {shouldMatch: string, shouldSkip: string}>} [proofs]
 * @returns {Set<string>} κλειδιά patternKey()
 */
function provenPatternKeys(modules, proofs = PATTERN_PROOFS) {
  const proven = new Set();

  for (const mod of modules) {
    const proof = proofs[mod.name];
    if (!proof || typeof proof.shouldMatch !== 'string') continue;

    const lines = proof.shouldMatch.split('\n');
    mod.patterns.forEach((pattern, index) => {
      if (lines.some(line => pattern.re.test(line))) proven.add(patternKey(mod.name, index));
    });
  }

  return proven;
}

/**
 * Patterns που **ούτε** πιάνουν κάτι στο `src/` **ούτε** έχουν απόδειξη.
 *
 * Αυτή η τομή είναι το σήμα. Σκέτο «μηδέν ευρήματα» δεν είναι: μετρημένα 651
 * από 671 patterns δεν πιάνουν τίποτα, και τα περισσότερα είναι απλώς καθαροί
 * φρουροί. Αναφορά με ~97% ψευδώς θετικά δεν διαβάζεται από κανέναν.
 *
 * @param {import('./registry').SsotModule[]} modules
 * @param {Map<string, number>|Set<string>} liveKeys  όσα πιάνουν στο src/
 * @param {Record<string, object>} [proofs]
 * @returns {{module: string, index: number, source: string}[]}
 */
function unprovenPatterns(modules, liveKeys, proofs = PATTERN_PROOFS) {
  const proven = provenPatternKeys(modules, proofs);
  const out = [];

  for (const mod of modules) {
    mod.patterns.forEach((pattern, index) => {
      const key = patternKey(mod.name, index);
      if (liveKeys.has(key)) return;          // ο κώδικας το αποδεικνύει
      if (proven.has(key)) return;            // το παράδειγμα το αποδεικνύει
      out.push({ module: mod.name, index, source: pattern.source });
    });
  }

  return out;
}

module.exports = { PATTERN_PROOFS, patternKey, provenPatternKeys, unprovenPatterns };
