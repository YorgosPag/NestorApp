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
 * Determine whether a query shape requires a composite index.
 *
 * A query is free (single-field auto-indexed) when:
 *   - It has zero clauses, OR
 *   - It has exactly one clause total (one where XOR one orderBy), OR
 *   - It has one where + one orderBy, both on the same field.
 *
 * Everything else — multiple equality filters on distinct fields, or an
 * equality filter combined with an orderBy on a different field — needs
 * a composite index per Firestore's query planner.
 *
 * @param {QueryShape} shape
 * @returns {boolean}
 */
function requiresCompositeIndex(shape) {
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

  const fields = index.fields;
  const eqCount = shape.equalityFields.length;
  const obCount = shape.orderBy.length;

  if (fields.length < eqCount + obCount) return false;

  // Step 1 — equality prefix (unordered set match, ASCENDING expected).
  const wantEq = [...shape.equalityFields].sort();
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

  // Step 2 — orderBy suffix (strict field + direction match, in order).
  for (let i = 0; i < obCount; i++) {
    const got = fields[eqCount + i];
    const want = shape.orderBy[i];
    if (!got) return false;
    if (got.fieldPath !== want.field) return false;
    if (got.order !== want.direction) return false;
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
  const fields = [];
  // Equality prefix — sorted alphabetically for deterministic output.
  for (const f of [...shape.equalityFields].sort()) {
    fields.push({ fieldPath: f, order: 'ASCENDING' });
  }
  if (shape.arrayContainsField) {
    fields.push({ fieldPath: shape.arrayContainsField, arrayConfig: 'CONTAINS' });
  }
  for (const ob of shape.orderBy) {
    fields.push({ fieldPath: ob.field, order: ob.direction });
  }
  return {
    collectionGroup: shape.collection,
    queryScope: 'COLLECTION',
    fields,
  };
}

module.exports = {
  loadIndexCatalog,
  requiresCompositeIndex,
  indexCoversShape,
  findMatchingIndex,
  suggestIndexJson,
};
