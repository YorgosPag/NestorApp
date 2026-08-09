#!/usr/bin/env node
/**
 * =============================================================================
 * SSoT — ΤΟ ΚΛΕΙΣΤΟ ΣΥΜΠΑΝ ΤΩΝ i18n ΚΛΕΙΔΙΩΝ  (ADR-781 §3)
 * =============================================================================
 *
 * ΤΟ ΕΡΩΤΗΜΑ: «ποια ακριβώς dotted κλειδιά ΥΠΑΡΧΟΥΝ σε ένα bundle;»
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * ------------------------------
 * Ο χρησμός του CHECK 3.51 πρέπει να αναγνωρίσει ένα ωμό κλειδί μέσα σε HTML.
 * Το προφανές ευρετικό — `/\w+(\.\w+)+/` — είναι **λάθος εργαλείο**: πιάνει
 * `nestorconstruct.gr`, `report.pdf`, `v1.2.3`, `Date.now`. Ένας χρησμός που
 * παράγει ψευδώς θετικά δεν διαβάζεται· ένας που τα κρύβει με φίλτρα δεν
 * ελέγχεται. Η μόνη ασφαλής διατύπωση είναι **κλειστό, πεπερασμένο σύμπαν**:
 * η συμβολοσειρά είναι ωμό κλειδί **μόνο αν είναι κυριολεκτικά κλειδί κάποιου
 * locale bundle**. Αυτό το αρχείο παράγει αυτό το σύμπαν.
 *
 * ΓΙΑΤΙ ΕΙΝΑΙ ΞΕΧΩΡΙΣΤΟ SSoT ΚΑΙ ΟΧΙ ΤΡΙΤΟ ΑΝΤΙΓΡΑΦΟ (N.0.2 — Boy Scout)
 * ----------------------------------------------------------------------
 * Η ίδια ακριβώς συνάρτηση ζούσε ιδιωτικά στο
 * `scripts/check-i18n-resolver-reachability.js` (CHECK 3.13). Αντί για τρίτη
 * υλοποίηση, εκείνη έγινε **καταναλωτής** αυτής.
 *
 * ⚠️ ΤΟ `flattenSchema` ΤΟΥ `scripts/_shared/i18n-governance.js` ΔΕΝ ΕΙΝΑΙ ΤΟ ΙΔΙΟ
 * ΚΑΙ ΔΕΝ ΕΝΟΠΟΙΕΙΤΑΙ. Εκείνο απαντά «τι **ΤΥΠΟΣ** κάθεται σε κάθε μονοπάτι;»
 * (`'object'`, `'string'`, `'array'`) για σύγκριση σχημάτων el↔en, και **βάζει
 * και τους ενδιάμεσους κόμβους** στο αποτέλεσμα. Εδώ το ερώτημα είναι «ποια
 * μονοπάτια **ΑΠΑΝΤΟΥΝ** σε ένα `t()`;» και ένας ενδιάμεσος κόμβος **δεν
 * απαντά**. Δύο διαφορετικά ερωτήματα με παρόμοιο σχήμα κώδικα: η ένωσή τους
 * θα ήταν ακριβώς το λάθος του ADR-749 (μία μηχανή, δύο σημασίες, σιωπηλή
 * απόκλιση) — με αντεστραμμένη φορά.
 *
 * ΣΗΜΑΣΙΟΛΟΓΙΑ ΦΥΛΛΟΥ — ΤΗΝ ΟΡΙΖΕΙ ΤΟ i18next, ΟΧΙ ΕΜΕΙΣ
 * -------------------------------------------------------
 *   συμβολοσειρά / αριθμός / boolean / null  → **φύλλο** (απαντά)
 *   πίνακας                                  → **φύλλο** (απαντά· `returnObjects`)
 *   απλό αντικείμενο                         → **ΟΧΙ φύλλο** (το i18next
 *                                              επιστρέφει το ίδιο το κλειδί)
 *
 * Το τρίτο είναι ο λόγος που δεν αρκεί «υπάρχει το μονοπάτι;»: ένα `t('a.b')`
 * που δείχνει σε αντικείμενο **βάφει το κλειδί στην οθόνη** — δηλαδή είναι
 * ακριβώς η βλάβη που κυνηγάμε, όχι εξαίρεση από αυτήν.
 * =============================================================================
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Απαντά ένα `t()` αυτή η τιμή; Βλ. «ΣΗΜΑΣΙΟΛΟΓΙΑ ΦΥΛΛΟΥ» στην κεφαλίδα.
 * @param {unknown} value
 * @returns {boolean}
 */
function isAnswerableValue(value) {
  if (value === undefined) return false;
  if (Array.isArray(value)) return true;
  return value === null || typeof value !== 'object';
}

/**
 * Ισοπεδώνει ένα bundle σε dotted κλειδιά που **απαντούν**.
 * Οι ενδιάμεσοι κόμβοι ΔΕΝ μπαίνουν.
 *
 * @param {unknown} bundle  το root object ενός namespace
 * @param {Set<string>} [sink]
 * @param {string} [prefix]
 * @returns {Set<string>}
 */
function flattenAnswerableKeys(bundle, sink = new Set(), prefix = '') {
  if (bundle === null || typeof bundle !== 'object' || Array.isArray(bundle)) return sink;
  for (const name of Object.keys(bundle)) {
    const key = prefix ? `${prefix}.${name}` : name;
    const value = bundle[name];
    if (isAnswerableValue(value)) sink.add(key);
    else flattenAnswerableKeys(value, sink, key);
  }
  return sink;
}

/**
 * Ένα σκέτο lookup — χρήσιμο όταν δεν θέλεις να ισοπεδώσεις ολόκληρο bundle
 * για μία ερώτηση. Επιστρέφει την ΤΙΜΗ (ή `undefined`), ώστε ο καλών να
 * αποφασίσει ο ίδιος με το `isAnswerableValue`.
 *
 * @param {unknown} bundle
 * @param {string} dottedKey
 * @returns {unknown}
 */
function lookupKey(bundle, dottedKey) {
  let cursor = bundle;
  for (const segment of dottedKey.split('.')) {
    if (cursor === null || typeof cursor !== 'object' || Array.isArray(cursor)) return undefined;
    cursor = cursor[segment];
  }
  return cursor;
}

/** Απαντά το bundle αυτό το κλειδί; (`lookupKey` + `isAnswerableValue`) */
function answersKey(bundle, dottedKey) {
  return isAnswerableValue(lookupKey(bundle, dottedKey));
}

/**
 * Τα namespaces μιας γλώσσας = τα ονόματα των αρχείων της. **Ποτέ χειρόγραφη
 * λίστα** — μια χειρόγραφη λίστα namespace είναι ακριβώς το σχήμα που στο
 * CHECK 3.34 είχε αποκλίνει κατά 63.
 *
 * @param {string} localeDir
 * @returns {string[]} ταξινομημένα
 */
function listNamespaces(localeDir) {
  if (!fs.existsSync(localeDir)) return [];
  return fs
    .readdirSync(localeDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => path.basename(name, '.json'))
    .sort();
}

/**
 * Διαβάζει ένα namespace από τον δίσκο. **Επιστρέφει `null` σε χαλασμένο JSON,
 * ΠΟΤΕ `{}`** — ένα κενό αντικείμενο διαβάζεται ως «κοίταξα, δεν έχει κλειδιά»,
 * που είναι η ίδια η ψευδαίσθηση που όλες οι πύλες αυτού του repo κυνηγούν.
 *
 * @returns {{ok: true, data: object} | {ok: false, reason: string}}
 */
function readNamespaceFile(localeDir, namespace) {
  const file = path.join(localeDir, `${namespace}.json`);
  if (!fs.existsSync(file)) return { ok: false, reason: 'missing' };
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (error) {
    return { ok: false, reason: `unparsable: ${error.message}` };
  }
}

/**
 * Το κλειστό σύμπαν μιας γλώσσας.
 *
 * @param {string} localeDir
 * @param {string[]} [namespaces] προεπιλογή: όλα τα αρχεία του φακέλου
 * @returns {{index: Map<string, Set<string>>, unreadable: Array<{namespace: string, reason: string}>}}
 *   `unreadable` **δεν σιωπά**: ένα namespace που δεν διαβάστηκε είναι
 *   άγνωστο, όχι άδειο, και ο καλών οφείλει να αποφασίσει τι σημαίνει.
 */
function buildKeyIndex(localeDir, namespaces = listNamespaces(localeDir)) {
  const index = new Map();
  const unreadable = [];
  for (const namespace of namespaces) {
    const read = readNamespaceFile(localeDir, namespace);
    if (!read.ok) {
      unreadable.push({ namespace, reason: read.reason });
      continue;
    }
    index.set(namespace, flattenAnswerableKeys(read.data));
  }
  return { index, unreadable };
}

/**
 * Η ένωση κάθε κλειδιού κάθε namespace — **το σύμπαν του χρησμού**.
 * Επιστρέφει `Set<string>` με τα σκέτα dotted κλειδιά (χωρίς πρόθεμα ns),
 * γιατί το HTML δεν φέρει namespace: ο server βάφει `navigation.pages.home`,
 * όχι `navigation:navigation.pages.home`.
 *
 * @param {string} localeDir
 * @returns {{universe: Set<string>, byNamespace: Map<string, Set<string>>, unreadable: Array}}
 */
function buildKeyUniverse(localeDir) {
  const { index, unreadable } = buildKeyIndex(localeDir);
  const universe = new Set();
  for (const keys of index.values()) for (const key of keys) universe.add(key);
  return { universe, byNamespace: index, unreadable };
}

module.exports = {
  isAnswerableValue,
  flattenAnswerableKeys,
  lookupKey,
  answersKey,
  listNamespaces,
  readNamespaceFile,
  buildKeyIndex,
  buildKeyUniverse,
};
