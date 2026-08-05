#!/usr/bin/env node
/**
 * SSoT: «τι λένε οι κατάλογοι του Firestore» — διαβασμένο με AST, **μία φορά**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ (ADR-747)
 *
 * Τέσσερις κατάλογοι του `src/` απαντούν ερωτήσεις που **κάθε** στατικός έλεγχος
 * Firestore χρειάζεται:
 *
 *   | κατάλογος                              | ερώτηση                                  |
 *   |----------------------------------------|------------------------------------------|
 *   | `config/firestore-collections.ts`      | «ποιο φυσικό όνομα έχει το KEY;»         |
 *   | `services/firestore/tenant-config.ts`  | «φέρει αυτή η συλλογή πεδίο μισθωτή;»    |
 *   | `config/firestore-field-constants.ts`  | «τι σημαίνει `FIELDS.COMPANY_ID`;»       |
 *   | (ανά αρχείο) τοπικά ψευδώνυμα          | «τι είναι το `CONTACTS_COLLECTION`;»     |
 *
 * Το CHECK 3.15 διάβαζε ήδη τους δύο πρώτους — με **δικούς του** loaders μέσα στο
 * `check-firestore-index-coverage.js`. Όταν χρειάστηκε δεύτερος έλεγχος (CHECK 3.35,
 * tenant scope) η επιλογή ήταν «αντίγραψε τους loaders» ή «βγάλ' τους έξω». Εδώ
 * βγήκαν έξω, **πριν** γραφτεί το δεύτερο αντίγραφο.
 *
 * 🔴 ΤΑ ΔΥΟ ΤΕΛΕΥΤΑΙΑ ΔΕΝ ΕΙΝΑΙ ΠΟΛΥΤΕΛΕΙΑ — ΕΙΝΑΙ Η ΔΙΑΦΟΡΑ ΜΕΤΑΞΥ ΣΗΜΑΤΟΣ ΚΑΙ ΘΟΡΥΒΟΥ
 *
 * Μετρημένο στην απογραφή που γέννησε αυτό το module:
 *
 *   - **Χωρίς** τα τοπικά ψευδώνυμα (`const CONTACTS_COLLECTION = COLLECTIONS.CONTACTS`):
 *     το **65%** των client call sites έβγαινε «άγνωστη συλλογή» και το κατηγόρημα
 *     παραβίασης τα πετούσε **σιωπηλά**. Το ιστορικό σφάλμα του ADR-745
 *     (`buildContactsQuery` χωρίς `companyId`) περνούσε **ακριβώς** από αυτή την τρύπα:
 *     ο scanner θα έλεγε «0 παραβιάσεις» για το αρχείο που **είχε** τη διαρροή.
 *
 *   - **Χωρίς** τις σταθερές πεδίων (`FIELDS.COMPANY_ID → 'companyId'`, 73 χρήσεις):
 *     **61%** των ευρημάτων του Admin SDK ήταν ψευδώς θετικά — ο scanner έβλεπε
 *     «δυναμικό πεδίο» εκεί που ο κώδικας χρησιμοποιούσε το SSoT σωστά.
 *
 * Δηλαδή: ένας scanner που **δεν** καταναλώνει τα SSoT του έργου παράγει και τα δύο
 * είδη ψέματος ταυτόχρονα — χάνει τα αληθινά και εφευρίσκει ψεύτικα.
 *
 * ⚠️ ΚΑΝΟΝΑΣ ΓΙΑ ΟΠΟΙΟΝ ΠΡΟΣΘΕΣΕΙ ΤΡΙΤΟ ΚΑΤΑΝΑΛΩΤΗ: μην αντιγράψεις loader από εδώ
 * στο δικό σου script. Αν χρειάζεσαι κάτι που δεν υπάρχει, **πρόσθεσέ το εδώ**.
 *
 * @module scripts/_shared/firestore-ast-loaders
 * @see ADR-747 — CHECK 3.35 tenant-scope gate
 * @see ADR-742 — tenant-scoped-query SSoT
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const COLLECTIONS_FILE = path.join(PROJECT_ROOT, 'src', 'config', 'firestore-collections.ts');
const TENANT_CONFIG_FILE = path.join(PROJECT_ROOT, 'src', 'services', 'firestore', 'tenant-config.ts');
const FIELD_CONSTANTS_FILE = path.join(PROJECT_ROOT, 'src', 'config', 'firestore-field-constants.ts');

/**
 * Η προεπιλογή του `firestoreQueryService`: **κάθε** συλλογή που δεν δηλώνεται
 * ρητά στο `TENANT_OVERRIDES` θεωρείται company-scoped. Ίδια τιμή με το
 * `DEFAULT_TENANT_CONFIG` του `tenant-config.ts` — αν αλλάξει εκεί, αλλάζει εδώ.
 */
const DEFAULT_TENANT_CONFIG = Object.freeze({ mode: 'companyId', fieldName: 'companyId' });

// ---------------------------------------------------------------------------
// Γενικοί βοηθοί AST
// ---------------------------------------------------------------------------

/**
 * @param {string} file
 * @returns {ts.SourceFile}
 */
function parseFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  return ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
}

/** Ξετύλιξε `X as const` → `X`. @param {ts.Expression} e */
function unwrapAsExpression(e) {
  return e && ts.isAsExpression(e) ? e.expression : e;
}

/**
 * Από `process.env.FOO || 'fallback'` ή `'literal'` πάρε τη συμβολοσειρά.
 *
 * Το `|| 'fallback'` είναι η **παραγωγική** τιμή: το `firestore-collections.ts`
 * επιτρέπει override ανά deployment μέσω env, αλλά ο στατικός έλεγχος κρίνει το
 * default — αυτό είναι που τρέχει και αυτό που περιγράφουν τα rules/indexes.
 *
 * @param {ts.Expression} expr
 * @returns {string|null}
 */
function extractFallbackString(expr) {
  if (!expr) return null;
  if (ts.isStringLiteral(expr)) return expr.text;
  if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
    if (ts.isStringLiteral(expr.right)) return expr.right.text;
  }
  return null;
}

/**
 * Διάβασε ένα object literal `export const <varName> = { KEY: 'value', … }`
 * σε `Map<KEY, value>`.
 *
 * @param {string} file
 * @param {string} varName
 * @returns {Map<string, string>}
 */
function loadStringRecord(file, varName) {
  const sf = parseFile(file);
  /** @type {Map<string, string>} */
  const map = new Map();

  /** @param {ts.Node} node */
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText() === varName && node.initializer) {
      const obj = unwrapAsExpression(node.initializer);
      if (obj && ts.isObjectLiteralExpression(obj)) {
        for (const prop of obj.properties) {
          if (!ts.isPropertyAssignment(prop)) continue;
          const value = extractFallbackString(prop.initializer);
          if (value !== null) map.set(prop.name.getText(), value);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return map;
}

// ---------------------------------------------------------------------------
// Οι τέσσερις κατάλογοι
// ---------------------------------------------------------------------------

/**
 * KEY → φυσικό όνομα συλλογής από το `firestore-collections.ts`.
 *
 * ⚠️ **Το `includeSubcollections` ΔΕΝ είναι προεπιλογή, και αυτό είναι σκόπιμο.**
 * Το CHECK 3.15 (index coverage) είναι **zero-tolerance**: αν ξαφνικά αναγνωρίσει
 * κλειδιά `SUBCOLLECTIONS` που πριν έβγαιναν «άγνωστα», θα αρχίσει να αναλύει
 * σημεία που **ποτέ δεν ανέλυε** και μπορεί να κοκκινίσει σε κώδικα που δεν
 * άλλαξε. Η επέκταση της εμβέλειας ενός zero-tol gate είναι **ξεχωριστή
 * απόφαση**, όχι παρενέργεια ενός refactor.
 *
 * Το CHECK 3.35 τα χρειάζεται (το `.collection()` του Admin SDK δέχεται και
 * υποσυλλογές) και είναι **ratchet**, άρα ζητά ρητά `{ includeSubcollections: true }`.
 *
 * @param {{includeSubcollections?: boolean}} [opts]
 * @returns {Map<string, string>}
 */
function loadCollectionsMap(opts = {}) {
  const collections = loadStringRecord(COLLECTIONS_FILE, 'COLLECTIONS');
  if (opts.includeSubcollections) {
    const sub = loadStringRecord(COLLECTIONS_FILE, 'SUBCOLLECTIONS');
    for (const [k, v] of sub) if (!collections.has(k)) collections.set(k, v);
  }
  return collections;
}

/**
 * `FIELDS.COMPANY_ID` → `'companyId'` (ADR-245B).
 * @returns {Map<string, string>}
 */
function loadFieldConstants() {
  return loadStringRecord(FIELD_CONSTANTS_FILE, 'FIELDS');
}

/**
 * KEY → `{mode, fieldName}` από το `TENANT_OVERRIDES`.
 *
 * ⚠️ Περιέχει **μόνο** τις εξαιρέσεις. Για την πραγματική απάντηση χρησιμοποίησε
 * το {@link resolveTenantFor}, που εφαρμόζει την προεπιλογή.
 *
 * @returns {Map<string, {mode: string, fieldName: string}>}
 */
function loadTenantOverrides() {
  const sf = parseFile(TENANT_CONFIG_FILE);
  /** @type {Map<string, {mode: string, fieldName: string}>} */
  const map = new Map();

  /** @param {ts.Node} node */
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText() === 'TENANT_OVERRIDES' && node.initializer) {
      const obj = unwrapAsExpression(node.initializer);
      if (obj && ts.isObjectLiteralExpression(obj)) {
        for (const prop of obj.properties) {
          if (!ts.isPropertyAssignment(prop)) continue;
          if (!ts.isObjectLiteralExpression(prop.initializer)) continue;
          const entry = { ...DEFAULT_TENANT_CONFIG };
          for (const sub of prop.initializer.properties) {
            if (!ts.isPropertyAssignment(sub)) continue;
            if (!ts.isStringLiteral(sub.initializer)) continue;
            const key = sub.name.getText();
            if (key === 'mode') entry.mode = sub.initializer.text;
            else if (key === 'fieldName') entry.fieldName = sub.initializer.text;
          }
          map.set(prop.name.getText(), entry);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return map;
}

/**
 * Η **πραγματική** απάντηση: overrides + προεπιλογή.
 *
 * @param {Map<string, {mode: string, fieldName: string}>} overrides
 * @param {string} collectionKey
 * @returns {{mode: string, fieldName: string}}
 */
function resolveTenantFor(overrides, collectionKey) {
  return overrides.get(collectionKey) || DEFAULT_TENANT_CONFIG;
}

// ---------------------------------------------------------------------------
// Ανά αρχείο: τοπικά ψευδώνυμα + ανάλυση ορισμάτων
// ---------------------------------------------------------------------------

/**
 * Χάρτης `const CONTACTS_COLLECTION = COLLECTIONS.CONTACTS` → `{CONTACTS_COLLECTION: 'CONTACTS'}`.
 *
 * 🔴 Χωρίς αυτό ο έλεγχος είναι **τυφλός στο κυρίαρχο idiom του έργου** (βλ. header).
 *
 * @param {ts.SourceFile} sf
 * @returns {Map<string, string>} τοπικό όνομα → CollectionKey
 */
function buildCollectionAliasMap(sf) {
  /** @type {Map<string, string>} */
  const alias = new Map();

  /** @param {ts.Node} n */
  function scan(n) {
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.initializer &&
      ts.isPropertyAccessExpression(n.initializer) &&
      /COLLECTIONS$/.test(n.initializer.expression.getText())
    ) {
      alias.set(n.name.text, n.initializer.name.getText());
    }
    ts.forEachChild(n, scan);
  }

  scan(sf);
  return alias;
}

/**
 * Ανάλυσε το όρισμα που δηλώνει συλλογή:
 * `COLLECTIONS.X` · `SUBCOLLECTIONS.X` · τοπικό ψευδώνυμο · `'literal'`.
 *
 * @param {ts.Expression|undefined} expr
 * @param {Map<string, string>} alias           από {@link buildCollectionAliasMap}
 * @param {Map<string, string>} collectionsMap  από {@link loadCollectionsMap}
 * @returns {{key: string|null, name: string|null}|null} `null` ⇒ δεν αναγνωρίστηκε καθόλου
 */
function resolveCollectionArg(expr, alias, collectionsMap) {
  if (!expr) return null;

  // 🔑 Ξετύλιξε το `.withConverter(conv)`: το `collection(db, X).withConverter(c)` κρύβει τη
  // συλλογή μέσα στην **έκφραση** της πρόσβασης ιδιότητας, ενώ ο σαρωτής κοιτά τα ορίσματα
  // (εκεί βρίσκει μόνο τον converter) ⇒ `unanalyzable` ⇒ **η πύλη περνά χωρίς να δει**.
  // Μετρήθηκε 2026-08-05: **9** τέτοια σημεία σε 7 αρχεία — όλα σε υπηρεσίες που ΕΧΟΥΝ
  // σωστό `where('companyId')`. Δηλαδή η πύλη ήταν τυφλή ακριβώς στον κώδικα που περνούσε.
  // ⚠️ Η θεραπεία είναι εδώ, στο **όργανο**, όχι σε 9 αρχεία παραγωγής: το ιδίωμα είναι
  // νόμιμο Firestore v9 και δεν υπάρχει λόγος να το ξαναγράψει κανείς για χάρη του σαρωτή.
  if (
    ts.isCallExpression(expr) &&
    ts.isPropertyAccessExpression(expr.expression) &&
    expr.expression.name.getText() === 'withConverter'
  ) {
    return resolveCollectionArg(expr.expression.expression, alias, collectionsMap);
  }

  // `collection(db, X)` / `getCol(X, conv)` — η συλλογή είναι ένα από τα ορίσματα.
  if (ts.isCallExpression(expr)) {
    for (const a of expr.arguments) {
      const r = resolveCollectionArg(a, alias, collectionsMap);
      if (r) return r;
    }
    return null;
  }

  if (ts.isStringLiteral(expr)) return { key: null, name: expr.text };

  if (ts.isPropertyAccessExpression(expr) && /COLLECTIONS$/.test(expr.expression.getText())) {
    const key = expr.name.getText();
    return { key, name: collectionsMap.get(key) || null };
  }

  if (ts.isIdentifier(expr) && alias && alias.has(expr.text)) {
    const key = alias.get(expr.text);
    return { key, name: collectionsMap.get(key) || null };
  }

  return null;
}

/**
 * Ανάλυσε το **πρώτο όρισμα** ενός `where(...)`: literal ή `FIELDS.X`.
 *
 * @param {ts.Expression|undefined} expr
 * @param {Map<string, string>} fieldConstants από {@link loadFieldConstants}
 * @returns {string|null} `null` ⇒ πραγματικά δυναμικό πεδίο
 */
function resolveFieldArg(expr, fieldConstants) {
  if (!expr) return null;
  if (ts.isStringLiteral(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr) && /FIELDS$/.test(expr.expression.getText())) {
    return fieldConstants.get(expr.name.getText()) || null;
  }
  return null;
}

module.exports = {
  PROJECT_ROOT,
  COLLECTIONS_FILE,
  TENANT_CONFIG_FILE,
  FIELD_CONSTANTS_FILE,
  DEFAULT_TENANT_CONFIG,
  parseFile,
  loadStringRecord,
  loadCollectionsMap,
  loadFieldConstants,
  loadTenantOverrides,
  resolveTenantFor,
  buildCollectionAliasMap,
  resolveCollectionArg,
  resolveFieldArg,
};
