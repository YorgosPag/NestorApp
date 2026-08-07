#!/usr/bin/env node
/**
 * **Η αυθεντία για το «ποιος user-agent μπλοκάρεται»** — διαβασμένη από το `src/middleware.ts`,
 * ποτέ αντιγραμμένη.
 *
 * ## ΓΙΑΤΙ ΔΙΑΒΑΖΕΤΑΙ ΚΑΙ ΔΕΝ ΑΝΤΙΓΡΑΦΕΤΑΙ
 * Το `BLOCKED_BOT_PATTERNS` είναι **κώδικας ασφαλείας** και αλλάζει για λόγους που δεν έχουν
 * καμία σχέση με τα e2e (νέο crawler, νέος scanner). Ένα αντίγραφο εδώ θα ήταν δεύτερη αλήθεια
 * που αποκλίνει **σιωπηλά** την πρώτη φορά που προστεθεί pattern — και η πύλη θα συνέχιζε να
 * λέει «πράσινο» για μια σουίτα που πλέον παίρνει **403 χωρίς σώμα**.
 *
 * Είναι ακριβώς το σχήμα των δύο χειρόγραφων λιστών namespace του CHECK 3.34 (απόκλιναν κατά
 * **63** χωρίς καμία πύλη να τις συγκρίνει) και της χειρόγραφης λίστας 18/26 του CHECK 3.37.
 *
 * ## FAIL-CLOSED
 * Αν η δήλωση δεν βρεθεί ή δεν είναι πίνακας από string literals, **σκάει με όνομα**. Μια
 * ανάγνωση που επιστρέφει σιωπηλά κενό πίνακα θα έκανε **κάθε** UA να «περνά», δηλαδή θα
 * γεννούσε πύλη μονίμως πράσινη — το «0 = κανείς δεν κοίταξε», μέσα στο όργανο που το κυνηγά.
 *
 * @module scripts/lib/e2e-executability/bot-patterns
 */

'use strict';

const path = require('node:path');
const ts = require('typescript');

// Οι πρωτογενείς αναγνώσεις AST ζουν σε ΕΝΑ module (ADR-771 Φ.3). Καταναλώνονται, δεν
// ξαναγράφονται· δες τη σημείωση για τη θέση τους στο ADR-775 §SSoT.
const { parseSource, initializerOf } = require('../contrast-promise/ts-read');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

/** Το αρχείο που ΟΡΙΖΕΙ ποιος μπλοκάρεται. Κώδικας ασφαλείας — μόνο ανάγνωση. */
const MIDDLEWARE_PATH = 'src/middleware.ts';

/** Το όνομα της δήλωσης. Αλλαγή του ⇒ η πύλη σκάει, δεν σιωπά. */
const DECLARATION = 'BLOCKED_BOT_PATTERNS';

/**
 * Κάθε pattern που προκαλεί **403** στο middleware, με τη σειρά που δηλώνεται.
 *
 * @param {string} [root] ρίζα του repo (οι δοκιμές δίνουν μίνι-repo)
 * @returns {{patterns: string[], sourcePath: string}}
 */
function readBotPatterns(root = PROJECT_ROOT) {
  const abs = path.join(root, MIDDLEWARE_PATH);
  const sourceFile = parseSource(abs);
  const initializer = initializerOf(sourceFile, DECLARATION);

  if (initializer === null) {
    throw new Error(
      `[3.46] δεν βρέθηκε η δήλωση \`${DECLARATION}\` στο ${MIDDLEWARE_PATH}.\n`
      + '   Αν μετονομάστηκε, ενημέρωσε το DECLARATION — ΜΗΝ αντιγράψεις τα patterns εδώ.',
    );
  }
  if (!ts.isArrayLiteralExpression(initializer)) {
    throw new Error(
      `[3.46] το \`${DECLARATION}\` δεν είναι πίνακας literal (είναι ${ts.SyntaxKind[initializer.kind]}).\n`
      + '   Η πύλη δεν μπορεί να απαντήσει «ποιος μπλοκάρεται» — αρνείται να μαντέψει.',
    );
  }

  const patterns = [];
  for (const element of initializer.elements) {
    if (!ts.isStringLiteral(element) && !ts.isNoSubstitutionTemplateLiteral(element)) {
      throw new Error(
        `[3.46] μη-literal στοιχείο στο \`${DECLARATION}\` (${ts.SyntaxKind[element.kind]}).\n`
        + '   Fail-closed: ένα pattern που δεν διαβάζεται είναι ένα pattern που δεν ελέγχεται.',
      );
    }
    patterns.push(element.text);
  }

  if (patterns.length === 0) {
    throw new Error(`[3.46] το \`${DECLARATION}\` είναι κενό — κάθε UA θα «περνούσε» ψευδώς.`);
  }
  return { patterns, sourcePath: MIDDLEWARE_PATH };
}

/**
 * Ποια patterns πιάνει αυτός ο user-agent — **με την ίδια σημασιολογία που εκτελεί το
 * middleware**: `userAgent.toLowerCase().includes(pattern)` (γρ. 153 + 201-203).
 *
 * ⚠️ Η αντιγραφή της *σημασιολογίας* είναι αναπόφευκτη· η αντιγραφή των *δεδομένων* όχι.
 * Γι' αυτό η άγκυρα `Π1` περνά τους ίδιους UA και από τις δύο διαδρομές.
 */
function blockingMatches(userAgent, patterns) {
  const lowered = String(userAgent).toLowerCase();
  return patterns.filter((pattern) => lowered.includes(pattern));
}

module.exports = {
  readBotPatterns,
  blockingMatches,
  MIDDLEWARE_PATH,
  DECLARATION,
  PROJECT_ROOT,
};
