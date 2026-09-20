/**
 * Firestore Index Matcher — maps query shapes to composite indexes.
 *
 * Consumed by scripts/check-firestore-index-coverage.js (pre-commit CHECK 3.15).
 * Reads firestore.indexes.json and determines whether a derived query shape
 * can be served by an existing composite index.
 *
 * Semantics (Firestore composite indexing, simplified):
 *   - A single-field query (one where OR one orderBy) does not require a
 *     composite index — Firestore auto-indexes every single field.
 *   - A multi-field query requires an index whose leading slots cover the
 *     equality (==/in) filters — in any order within the equality prefix —
 *     followed by the orderBy fields in the exact order and direction of
 *     the query. A longer index (extra trailing fields) still covers the
 *     query via prefix match.
 *   - Array-contains filters are treated as "unanalyzable" for v1 and
 *     skipped (callers should flag the call-site so a human can verify).
 *
 * This module is dependency-free (Node stdlib only) so it is safe to
 * require from any pre-commit context — no build step, no transpile.
 *
 * @module scripts/_shared/firestore-index-matcher
 */

'use strict';

const fs = require('node:fs');

/**
 * @typedef {Object} IndexField
 * @property {string} fieldPath
 * @property {'ASCENDING'|'DESCENDING'|'ARRAY_CONTAINS'} order
 */

/**
 * @typedef {Object} IndexEntry
 * @property {string} collectionGroup
 * @property {string} queryScope
 * @property {IndexField[]} fields
 */

/**
 * @typedef {{field: string, direction: 'ASCENDING'|'DESCENDING'}} OrderBySpec
 */

/**
 * @typedef {Object} QueryShape
 * @property {string}            collection          Firestore collection name (not key).
 * @property {string[]}          equalityFields      Distinct fields with equality (==) filters.
 * @property {OrderBySpec[]}     orderBy             Ordered list of orderBy clauses.
 * @property {string|null}       arrayContainsField  Optional array-contains field (v1: treated as unanalyzable).
 * @property {string[]}          [rangeFields]       Distinct fields carrying a range/inequality
 *                                                   filter (`<` `<=` `>` `>=` `!=` `not-in`).
 *                                                   Απόν ή κενό ⇒ ερώτημα χωρίς εύρος.
 * @property {'default'|'super_admin'} variant       Which tenant variant this shape represents.
 */

/**
 * Load firestore.indexes.json and index its entries by collectionGroup.
 *
 * @param {string} indexesFilePath Absolute path to firestore.indexes.json.
 * @returns {Map<string, IndexEntry[]>} Map from collection name → index entries.
 */
function loadIndexCatalog(indexesFilePath) {
  const raw = fs.readFileSync(indexesFilePath, 'utf8');
  const parsed = JSON.parse(raw);
  const indexes = Array.isArray(parsed.indexes) ? parsed.indexes : [];

  /** @type {Map<string, IndexEntry[]>} */
  const byCollection = new Map();

  for (const idx of indexes) {
    if (!idx || typeof idx.collectionGroup !== 'string') continue;
    if (!Array.isArray(idx.fields) || idx.fields.length === 0) continue;

    /** @type {IndexField[]} */
    const fields = idx.fields.map((f) => {
      if (f.arrayConfig === 'CONTAINS') {
        return { fieldPath: f.fieldPath, order: 'ARRAY_CONTAINS' };
      }
      return {
        fieldPath: f.fieldPath,
        order: f.order === 'DESCENDING' ? 'DESCENDING' : 'ASCENDING',
      };
    });

    /** @type {IndexEntry} */
    const entry = {
      collectionGroup: idx.collectionGroup,
      queryScope: idx.queryScope || 'COLLECTION',
      fields,
    };

    const list = byCollection.get(entry.collectionGroup) || [];
    list.push(entry);
    byCollection.set(entry.collectionGroup, list);
  }

  return byCollection;
}

/**
 * Ερώτημα **χωρίς εύρος**: πότε είναι ελεύθερο (μονοπεδιακός αυτόματος δείκτης).
 *
 * Ελεύθερο όταν: καμία ρήτρα · ακριβώς μία ρήτρα · ένα `where` + ένα `orderBy` στο **ίδιο**
 * πεδίο (η ταξινόμηση σε πεδίο ισότητας δεν προσθέτει τίποτα — όλες οι τιμές ίδιες).
 *
 * @param {QueryShape} shape
 * @returns {boolean}
 */
function requiresCompositeWithoutRange(shape) {
  const eq = shape.equalityFields.length;
  const ob = shape.orderBy.length;
  const ac = shape.arrayContainsField ? 1 : 0;
  const total = eq + ob + ac;

  if (total <= 1) return false;

  // Single where + single orderBy on the same field → free.
  if (eq === 1 && ob === 1 && ac === 0 && shape.equalityFields[0] === shape.orderBy[0].field) {
    return false;
  }

  return true;
}

/**
 * **Ο ΕΝΑΣ κριτής: ποιον δείκτη απαιτεί αυτό το σχήμα;**
 *
 * 🔴 Γιατί υπάρχει (ADR-869 §7): μέχρι σήμερα το `QueryShape` **δεν είχε καν πεδίο εύρους**.
 * Κάθε `where(x, '>=', v)` γινόταν προειδοποίηση «composite coverage uncertain» και η πύλη
 * έκρινε μόνο την **προβολή ισοτήτων** του ερωτήματος — δηλαδή ένα ερώτημα **άλλο** από αυτό
 * που τρέχει. Μετρημένο 2026-09-20: το `files` με `cdeReadReach ==` + `isDeleted ==` +
 * `purgeAt <=` περνούσε **πράσινο** (υπάρχει `cdeReadReach↑, isDeleted↑`) ενώ ζωντανά
 * επιστρέφει `FAILED_PRECONDITION` — «πράσινο που σημαίνει ΔΕΝ ΚΟΙΤΑΞΑ».
 *
 * **Ο κανόνας** (τεκμηρίωση Firestore, επαληθευμένος ζωντανά — ο δείκτης που πρότεινε το ίδιο
 * το Firestore ήρθε ταυτόσημος με αυτόν που υπολογίζει η συνάρτηση):
 *   1. ισότητες (οποιαδήποτε σειρά μεταξύ τους)
 *   2. **το πεδίο εύρους**
 *   3. τα υπόλοιπα `orderBy`, με τη σειρά τους
 * και «if you have a filter with a range comparison, your first ordering must be on the same
 * field» ⇒ ρητό `orderBy` σε **άλλο** πεδίο = ερώτημα που σκάει σε χρόνο εκτέλεσης.
 *
 * ⚠️ **Πολλαπλά πεδία εύρους ⇒ `undecidable`, ΕΠΙΤΗΔΕΣ.** Η σειρά τους μέσα στον δείκτη
 * κρίνεται από **επιλεκτικότητα**, που καμία στατική ανάλυση δεν ξέρει. Μετρημένα **0** τέτοια
 * σημεία σήμερα· να μαντέψει η πύλη θα ήταν ακριβώς ο **αδρανής φρουρός** που το έργο έχει
 * ήδη πληρώσει (N.12 · 606/671 dormant patterns). Λέει «δεν ξέρω» και σταματά.
 *
 * @param {QueryShape} shape
 * @returns {{status:'free'}
 *          |{status:'required', fields: IndexField[], eqCount: number, rangeDirectionFlexible: boolean}
 *          |{status:'invalid-query', reason: string}
 *          |{status:'undecidable', reason: string}}
 */
function requiredIndexFor(shape) {
  const ranges = [...new Set(shape.rangeFields || [])];

  if (ranges.length > 1) {
    return {
      status: 'undecidable',
      reason: `πολλαπλά πεδία εύρους (${ranges.join(', ')}) — η σειρά τους στον δείκτη κρίνεται `
        + 'από επιλεκτικότητα, που δεν προκύπτει στατικά',
    };
  }

  if (ranges.length === 0) {
    if (!requiresCompositeWithoutRange(shape)) return { status: 'free' };
    const fields = [...shape.equalityFields].sort().map((f) => ({ fieldPath: f, order: 'ASCENDING' }));
    for (const ob of shape.orderBy) fields.push({ fieldPath: ob.field, order: ob.direction });
    return { status: 'required', fields, eqCount: shape.equalityFields.length, rangeDirectionFlexible: false };
  }

  const rangeField = ranges[0];
  const first = shape.orderBy.length > 0 ? shape.orderBy[0] : null;

  if (first && first.field !== rangeField) {
    return {
      status: 'invalid-query',
      reason: `πρώτο orderBy("${first.field}") ≠ πεδίο εύρους ("${rangeField}") — το Firestore `
        + 'απαιτεί η πρώτη ταξινόμηση να είναι στο πεδίο του εύρους',
    };
  }

  // Πεδίο που έχει ΚΑΙ ισότητα ΚΑΙ εύρος μπαίνει μία φορά, στη θέση του εύρους.
  const equalities = shape.equalityFields.filter((f) => f !== rangeField);
  const fields = [...equalities].sort().map((f) => ({ fieldPath: f, order: 'ASCENDING' }));
  fields.push({ fieldPath: rangeField, order: first ? first.direction : 'ASCENDING' });
  for (const ob of shape.orderBy.slice(1)) fields.push({ fieldPath: ob.field, order: ob.direction });

  if (fields.length <= 1) return { status: 'free' };
  // Χωρίς ρητό `orderBy` η σάρωση γίνεται και αντίστροφα ⇒ δεκτή **οποιαδήποτε** φορά στο
  // πεδίο εύρους. Με ρητό `orderBy` η φορά είναι δεσμευτική.
  return { status: 'required', fields, eqCount: equalities.length, rangeDirectionFlexible: first === null };
}

// ⚠️ ΔΕΝ υπάρχει πια `requiresCompositeIndex(shape) => boolean`. Ήταν περιτύλιγμα γύρω από
// το `requiredIndexFor` και, μόλις ο καταναλωτής πέρασε στον κριτή, έμεινε **χωρίς καλούντα**.
// Ένας exporter χωρίς caller δεν είναι SSoT — είναι νεκρός κώδικας (ADR-869 §12.5).
// Ρώτα τον κριτή: `requiredIndexFor(shape).status === 'required'`.

/**
 * Check whether a given composite index covers a query shape.
 *
 * Matching algorithm:
 *   1. Take the first N index fields as the equality prefix, where N = #equalityFields.
 *      They must all be ASCENDING/DESCENDING (not ARRAY_CONTAINS) and together form
 *      exactly the same unordered set as shape.equalityFields.
 *   2. After the prefix, the next M index fields must match shape.orderBy one-for-one
 *      in both fieldPath and order/direction (M = #orderBy).
 *   3. Any trailing index fields beyond that are allowed (prefix match wins).
 *
 * Array-contains queries are skipped (returns true) to avoid false positives
 * pending a v2 implementation that understands ARRAY_CONTAINS placement.
 *
 * @param {IndexEntry} index
 * @param {QueryShape} shape
 * @returns {boolean}
 */
function indexCoversShape(index, shape) {
  if (shape.arrayContainsField) {
    // v1: treat array-contains as covered to avoid false positives.
    // The coverage check at the call-site layer will emit an info line.
    return true;
  }

  // ΕΝΑΣ κριτής: η κάλυψη ελέγχεται πάντα εναντίον του ΙΔΙΟΥ απαιτούμενου δείκτη που
  // υπολογίζει το {@link requiredIndexFor} — ποτέ δεύτερος, παράλληλος υπολογισμός.
  const required = requiredIndexFor(shape);
  if (required.status === 'free') return true;
  // «Άκυρο ερώτημα» και «δεν αποφασίζεται» ΔΕΝ είναι «καλυμμένο»: τα αναφέρει η πύλη χωριστά.
  if (required.status !== 'required') return false;

  const fields = index.fields;
  const { eqCount } = required;
  const want = required.fields;

  if (fields.length < want.length) return false;

  // Step 1 — equality prefix (unordered set match, ASCENDING expected).
  const wantEq = want.slice(0, eqCount).map((f) => f.fieldPath).sort();
  const gotEq = [];
  for (let i = 0; i < eqCount; i++) {
    const f = fields[i];
    if (f.order === 'ARRAY_CONTAINS') return false;
    gotEq.push(f.fieldPath);
  }
  gotEq.sort();
  for (let i = 0; i < eqCount; i++) {
    if (wantEq[i] !== gotEq[i]) return false;
  }

  // Step 2 — εύρος (αν υπάρχει) + orderBy, με τη σειρά και τη φορά τους.
  for (let i = eqCount; i < want.length; i++) {
    const got = fields[i];
    if (!got) return false;
    if (got.fieldPath !== want[i].fieldPath) return false;
    // Η φορά του πεδίου εύρους είναι ελεύθερη ΜΟΝΟ όταν το ερώτημα δεν δήλωσε `orderBy`.
    const directionFree = required.rangeDirectionFlexible && i === eqCount;
    if (!directionFree && got.order !== want[i].order) return false;
  }

  return true;
}

/**
 * Find an index in the catalog that covers the shape, or null if none exists.
 *
 * @param {Map<string, IndexEntry[]>} catalog
 * @param {QueryShape} shape
 * @returns {IndexEntry|null}
 */
function findMatchingIndex(catalog, shape) {
  const list = catalog.get(shape.collection) || [];
  for (const idx of list) {
    if (indexCoversShape(idx, shape)) return idx;
  }
  return null;
}

/**
 * Emit a ready-to-paste firestore.indexes.json snippet for a missing shape.
 *
 * @param {QueryShape} shape
 * @returns {object}
 */
function suggestIndexJson(shape) {
  const required = requiredIndexFor(shape);
  // Η πρόταση είναι ο ΙΔΙΟΣ απαιτούμενος δείκτης — αλλιώς η πύλη θα πρότεινε κάτι που η ίδια
  // δεν δέχεται (μετρημένη παγίδα: το `suggest` έγραφε το σχήμα ΧΩΡΙΣ το πεδίο εύρους).
  const fields = required.status === 'required'
    ? required.fields.map((f) => ({ ...f }))
    : [
      ...[...shape.equalityFields].sort().map((f) => ({ fieldPath: f, order: 'ASCENDING' })),
      ...shape.orderBy.map((ob) => ({ fieldPath: ob.field, order: ob.direction })),
    ];

  if (shape.arrayContainsField) {
    fields.splice(required.status === 'required' ? required.eqCount : fields.length, 0, {
      fieldPath: shape.arrayContainsField,
      arrayConfig: 'CONTAINS',
    });
  }
  return {
    collectionGroup: shape.collection,
    queryScope: 'COLLECTION',
    fields,
  };
}

module.exports = {
  loadIndexCatalog,
  requiredIndexFor,
  indexCoversShape,
  findMatchingIndex,
  suggestIndexJson,
};
