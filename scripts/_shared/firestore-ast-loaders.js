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
// ADR-862 Φ0 Β11 — «από ποιους δρόμους διαβάζει μια client λίστα;» (ο αδελφός του tenant-config)
const READ_SCOPE_CONFIG_FILE = path.join(PROJECT_ROOT, 'src', 'services', 'firestore', 'read-scope-config.ts');

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
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const prop of recordPropertiesOf(parseFile(file), varName)) {
    const value = extractFallbackString(prop.initializer);
    if (value !== null) map.set(prop.name.getText(), value);
  }
  return map;
}

/**
 * Οι `KEY: τιμή` ιδιότητες του object literal `const <varName> = { … }` (με ή χωρίς `as const`)
 * — η ΜΙΑ διάσχιση που μοιράζονται όλοι οι κατάλογοι αυτού του module.
 *
 * @param {ts.SourceFile} sf
 * @param {string} varName
 * @returns {ts.PropertyAssignment[]}
 */
function recordPropertiesOf(sf, varName) {
  /** @type {ts.PropertyAssignment[]} */
  const props = [];
  (function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText() === varName && node.initializer) {
      const obj = unwrapAsExpression(node.initializer);
      if (obj && ts.isObjectLiteralExpression(obj)) props.push(...obj.properties.filter(ts.isPropertyAssignment));
    }
    ts.forEachChild(node, visit);
  })(sf);
  return props;
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
  /** @type {Map<string, {mode: string, fieldName: string}>} */
  const map = new Map();
  for (const prop of recordPropertiesOf(parseFile(TENANT_CONFIG_FILE), 'TENANT_OVERRIDES')) {
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
  return map;
}

/**
 * **Τα πεδία ισότητας των δρόμων ανάγνωσης** ανά KEY — από το `READ_PATH_FIELDS`
 * (ADR-862 Φ0 Β11). Απούσα συλλογή ⇒ ένας δρόμος χωρίς επιπλέον πεδίο.
 *
 * 🔴 Χωρίς αυτό, το CHECK 3.15 ήταν **τυφλό**: το `firestoreQueryService` προσθέτει
 * `cdeReadReach ==` / `createdBy ==` σε κάθε λίστα `files`, και ερώτημα με `orderBy`
 * χρειάζεται composite με αυτό το πεδίο — αλλιώς `FAILED_PRECONDITION` στην παραγωγή.
 *
 * @returns {Map<string, string[]>}
 */
function loadReadPathFields() {
  /** @type {Map<string, string[]>} */
  const map = new Map();
  if (!fs.existsSync(READ_SCOPE_CONFIG_FILE)) return map;
  for (const prop of recordPropertiesOf(parseFile(READ_SCOPE_CONFIG_FILE), 'READ_PATH_FIELDS')) {
    const arr = unwrapAsExpression(prop.initializer);
    if (!arr || !ts.isArrayLiteralExpression(arr)) continue;
    map.set(prop.name.getText(), arr.elements.filter(ts.isStringLiteral).map((e) => e.text));
  }
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
 * @param {Map<string, string[]>|null} [partitionAlias] από {@link buildPartitionAliasMap}
 * @returns {Map<string, string|string[]>} τοπικό όνομα → CollectionKey (ή ένα ανά κλάδο διαμερίσματος)
 */
function buildCollectionAliasMap(sf, partitionAlias = null) {
  /** @type {Map<string, string|string[]>} */
  const alias = new Map();

  /** @param {ts.Node} n */
  function scan(n) {
    const init = ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) ? n.initializer : undefined;
    if (init && /COLLECTIONS$/.test(ts.isPropertyAccessExpression(init) || ts.isElementAccessExpression(init) ? init.expression.getText() : '')) {
      if (ts.isPropertyAccessExpression(init)) {
        alias.set(n.name.text, init.name.getText());
      } else {
        // ADR-866 §2.6.7 — `const c = COLLECTIONS[X[kind]]`: ένα όνομα, ένας κλάδος ανά κάτοχο.
        const keys = resolvePartitionKeys(init.argumentExpression, partitionAlias);
        if (keys) alias.set(n.name.text, keys);
      }
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
  return resolveCollectionArgs(expr, alias, collectionsMap, null)[0] || null;
}

/**
 * **Η ΜΙΑ υλοποίηση** — με κλάδους: `COLLECTIONS[X[kind]]` ⇒ μία απάντηση ανά κλάδο
 * διαμερίσματος (ADR-866 §2.6.7). Κενό ⇒ δεν αναγνωρίστηκε.
 *
 * @param {ts.Expression|undefined} expr
 * @param {Map<string, string>} alias
 * @param {Map<string, string>} collectionsMap
 * @param {Map<string, string[]>|null} partitionAlias από {@link buildPartitionAliasMap}
 * @returns {{key: string|null, name: string|null}[]}
 */
function resolveCollectionArgs(expr, alias, collectionsMap, partitionAlias) {
  if (!expr) return [];

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
    return resolveCollectionArgs(expr.expression.expression, alias, collectionsMap, partitionAlias);
  }

  // `collection(db, X)` / `getCol(X, conv)` — η συλλογή είναι ένα από τα ορίσματα.
  if (ts.isCallExpression(expr)) {
    for (const a of expr.arguments) {
      const r = resolveCollectionArgs(a, alias, collectionsMap, partitionAlias);
      if (r.length > 0) return r;
    }
    return [];
  }

  if (ts.isStringLiteral(expr)) return [{ key: null, name: expr.text }];

  /** @param {string} key */
  const byKey = (key) => ({ key, name: collectionsMap.get(key) || null });

  if (ts.isPropertyAccessExpression(expr) && /COLLECTIONS$/.test(expr.expression.getText())) {
    return [byKey(expr.name.getText())];
  }

  // `COLLECTIONS[X[kind]]` — διαμέρισμα κατόχου: ένας κλάδος ανά κάτοχο.
  if (ts.isElementAccessExpression(expr) && /COLLECTIONS$/.test(expr.expression.getText())) {
    return (resolvePartitionKeys(expr.argumentExpression, partitionAlias) || []).map(byKey);
  }

  if (ts.isIdentifier(expr) && alias && alias.has(expr.text)) {
    return [].concat(alias.get(expr.text)).map(byKey);
  }

  return [];
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

// ---------------------------------------------------------------------------
// Διαμερίσματα κατόχου — `X[kind]` (ADR-866 §2.6.7)
// ---------------------------------------------------------------------------

/**
 * Πού δηλώνονται τα διαμερίσματα. `src/lib` και όχι ολόκληρο το `src/`: το
 * `CustodyPartition` είναι δήλωση **συστήματος** (ιστορικό, αρχεία), που ζει δίπλα στο
 * πρωτογενές του — όχι σε οθόνη ή υπηρεσία.
 */
const CUSTODY_PARTITION_ROOT = path.join(PROJECT_ROOT, 'src', 'lib');

/** Η σειρά των κλάδων — ίδια με το `CUSTODY_KINDS` του `lib/workspace/custody-scope.ts`. */
const CUSTODY_KINDS = Object.freeze(['company', 'personal']);

/** @type {Map<string, string[]>|null} */
let partitionsCache = null;

/** @param {string} dir @param {string[]} out */
function collectTsFiles(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== 'node_modules') collectTsFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * `const X = { company: 'A', personal: 'B' } as const satisfies CustodyPartition` → κλειδιά
 * `['A','B']` με τη σειρά του {@link CUSTODY_KINDS}· `null` αν λείπει κλάδος.
 *
 * @param {ts.Expression} init
 * @returns {string[]|null}
 */
function partitionKeysOf(init) {
  if (!ts.isSatisfiesExpression(init) || init.type.getText() !== 'CustodyPartition') return null;
  const obj = unwrapAsExpression(init.expression);
  if (!obj || !ts.isObjectLiteralExpression(obj)) return null;
  /** @type {Map<string, string>} */
  const byKind = new Map();
  for (const prop of obj.properties) {
    if (ts.isPropertyAssignment(prop) && ts.isStringLiteral(prop.initializer)) {
      byKind.set(prop.name.getText(), prop.initializer.text);
    }
  }
  const keys = CUSTODY_KINDS.map((kind) => byKind.get(kind));
  return keys.every(Boolean) ? keys : null;
}

/**
 * **Κάθε δηλωμένο διαμέρισμα κατόχου**: όνομα σταθεράς → κλειδιά συλλογής ανά κλάδο.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ένα σύστημα με δύο διαμερίσματα διαλέγει συλλογή με `X[kind]`
 * (`AUDIT_LEDGER_COLLECTION[ledger]`). Οι πύλες 3.15/3.35 δέχονταν **μόνο** literal ⇒ το
 * σημείο γινόταν `unanalyzable` και **δεν μετρούσε** — δηλαδή τα ερωτήματα του προσωπικού
 * βιβλίου ιστορικού δεν ελέγχονταν ποτέ για δείκτη ή φίλτρο κατόχου. Με αυτόν τον κατάλογο το
 * σημείο **διπλασιάζεται** σε έναν κλάδο ανά κάτοχο, και κάθε κλάδος κρίνεται όπως literal.
 *
 * 🔑 Ανακαλύπτεται από τον **τύπο** (`satisfies CustodyPartition`), όχι από μητρώο: νέο
 * διαμέρισμα ελέγχεται χωρίς να θυμηθεί κανείς να το δηλώσει εδώ.
 *
 * @param {string} [root]
 * @returns {Map<string, string[]>}
 */
function loadCustodyPartitions(root = CUSTODY_PARTITION_ROOT) {
  // Μία ανακάλυψη ανά διεργασία για την πραγματική ρίζα (οι πύλες σαρώνουν εκατοντάδες αρχεία).
  if (root === CUSTODY_PARTITION_ROOT && partitionsCache) return partitionsCache;
  /** @type {Map<string, string[]>} */
  const map = new Map();
  if (root === CUSTODY_PARTITION_ROOT) partitionsCache = map;
  for (const file of collectTsFiles(root, [])) {
    const src = fs.readFileSync(file, 'utf8');
    if (!src.includes('satisfies CustodyPartition')) continue;
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
    (function visit(node) {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const keys = partitionKeysOf(node.initializer);
        if (keys) map.set(node.name.text, keys);
      }
      ts.forEachChild(node, visit);
    })(sf);
  }
  return map;
}

/**
 * Τοπικό όνομα → κλειδιά διαμερίσματος, **για ένα αρχείο** — με τα ψευδώνυμα εισαγωγής
 * (`import { FILE_COLLECTION as FC }`).
 *
 * @param {ts.SourceFile} sf
 * @param {Map<string, string[]>} partitions από {@link loadCustodyPartitions}
 * @returns {Map<string, string[]>}
 */
function buildPartitionAliasMap(sf, partitions) {
  /** @type {Map<string, string[]>} */
  const local = new Map(partitions);
  for (const stmt of sf.statements) {
    const bindings = ts.isImportDeclaration(stmt) && stmt.importClause && stmt.importClause.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const el of bindings.elements) {
      const imported = el.propertyName ? el.propertyName.getText() : null;
      if (imported && partitions.has(imported)) local.set(el.name.getText(), partitions.get(imported));
    }
  }
  return local;
}

/**
 * `X[expr]` όπου `X` διαμέρισμα ⇒ τα **κλειδιά** όλων των κλάδων· αλλιώς `null`.
 *
 * @param {ts.Expression|undefined} expr
 * @param {Map<string, string[]>} partitionAlias από {@link buildPartitionAliasMap}
 * @returns {string[]|null}
 */
function resolvePartitionKeys(expr, partitionAlias) {
  if (!expr || !partitionAlias || !ts.isElementAccessExpression(expr)) return null;
  if (!ts.isIdentifier(expr.expression)) return null;
  return partitionAlias.get(expr.expression.text) || null;
}

/**
 * **Κλειδιά συλλογής** ενός ορίσματος `firestoreQueryService.*(KEY, …)`: literal ⇒ ένα·
 * διαμέρισμα ⇒ ένα ανά κλάδο· δυναμικό ⇒ κενό (το σημείο μένει `unanalyzable`).
 *
 * @param {ts.Expression|undefined} expr
 * @param {Map<string, string[]>} partitionAlias
 * @returns {string[]}
 */
function resolveCollectionKeys(expr, partitionAlias) {
  if (expr && ts.isStringLiteralLike(expr)) return [expr.text];
  return resolvePartitionKeys(expr, partitionAlias) || [];
}

module.exports = {
  PROJECT_ROOT,
  CUSTODY_PARTITION_ROOT,
  loadCustodyPartitions,
  buildPartitionAliasMap,
  resolvePartitionKeys,
  resolveCollectionKeys,
  resolveCollectionArgs,
  COLLECTIONS_FILE,
  TENANT_CONFIG_FILE,
  FIELD_CONSTANTS_FILE,
  DEFAULT_TENANT_CONFIG,
  parseFile,
  loadStringRecord,
  loadCollectionsMap,
  loadFieldConstants,
  loadTenantOverrides,
  loadReadPathFields,
  READ_SCOPE_CONFIG_FILE,
  resolveTenantFor,
  buildCollectionAliasMap,
  resolveCollectionArg,
  resolveFieldArg,
};
