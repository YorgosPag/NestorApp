#!/usr/bin/env node
/**
 * Shared utility — Firestore Rules Parser (CommonJS)
 *
 * Regex-based parser for `firestore.rules` used by CHECK 3.16
 * (`scripts/check-firestore-rules-test-coverage.js`).
 *
 * Mirrors the TypeScript implementation at
 * `tests/firestore-rules/_harness/rule-shape-validator.ts`. The pre-commit
 * hook must run without ts-jest/ts-node, so the JS copy is the canonical
 * version used by tooling.
 *
 * See ADR-298 §3.4 Validation E and §1.5 pitfall (ε).
 *
 * @since 2026-04-11 (ADR-298 Phase A)
 */

'use strict';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @typedef {{
 *   collection: string,
 *   lineStart: number,
 *   lineEnd: number,
 *   firstAllowReadExpression: string | null,
 *   firstAllowReadLeg: string | null,
 * }} RuleBlock
 */

/**
 * @typedef {{
 *   collection: string,
 *   lineStart: number,
 *   problem: 'missing_super_admin_short_circuit' | 'no_allow_read',
 *   actualFirstLeg: string | null,
 * }} ShapeViolation
 */

/**
 * Parse `firestore.rules` content and return every top-level match block.
 *
 * For each block, extracts the first `allow read: if ...;` expression,
 * locates the first balanced parenthesised subexpression (the tenant-
 * decision gate), and splits it on top-level `||` to get the first OR leg.
 *
 * Rationale: the canonical shape is
 *   allow read: if isAuthenticated() && (isSuperAdminOnly() || ...);
 * so the legs we care about live *inside* the first outer paren group,
 * not at the top level of the expression.
 *
 * @param {string} rulesContent
 * @returns {RuleBlock[]}
 */
function parseFirestoreRules(rulesContent) {
  const lines = rulesContent.split('\n');
  const blocks = [];
  const topLevelMatchRegex = /^ {4}match \/([a-zA-Z_][a-zA-Z0-9_]*)\/\{/;

  for (let i = 0; i < lines.length; i++) {
    const m = topLevelMatchRegex.exec(lines[i]);
    if (!m) continue;

    const collection = m[1];
    const lineStart = i + 1;
    const lineEnd = findBlockEnd(lines, i);
    const body = lines.slice(i, lineEnd).join('\n');

    const expr = extractFirstAllowRead(body);
    const gateBody = expr ? extractOuterGateBody(expr) : null;
    const leg = gateBody ? splitFirstOrLeg(gateBody) : null;

    blocks.push({
      collection,
      lineStart,
      lineEnd,
      firstAllowReadExpression: expr,
      firstAllowReadLeg: leg,
    });
  }

  return blocks;
}

/**
 * Return the body of the *last* top-level balanced `(...)` subexpression
 * in `expr`, preferring groups that contain a top-level `||` operator.
 * This is the pragmatic tenant-decision gate in Firestore rules, which
 * is always structured as `isAuthenticated() && (... || ...)`. Empty or
 * purely-method-call parens (e.g. `isAuthenticated()`) are skipped.
 *
 * Returns null if no suitable paren group exists.
 *
 * @param {string} expr
 * @returns {string | null}
 */
function extractOuterGateBody(expr) {
  /** @type {string[]} */
  const topLevelGroups = [];
  let depth = 0;
  let groupStart = -1;

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === '(') {
      if (depth === 0) groupStart = i + 1;
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0 && groupStart >= 0) {
        topLevelGroups.push(expr.slice(groupStart, i).trim());
        groupStart = -1;
      }
    }
  }

  // Prefer groups that contain a top-level `||` (the tenant gate). Fall
  // back to the last non-empty group.
  for (let i = topLevelGroups.length - 1; i >= 0; i--) {
    const g = topLevelGroups[i];
    if (g.length > 0 && containsTopLevelOr(g)) return g;
  }
  for (let i = topLevelGroups.length - 1; i >= 0; i--) {
    if (topLevelGroups[i].length > 0) return topLevelGroups[i];
  }
  return null;
}

/**
 * @param {string} s
 * @returns {boolean}
 */
function containsTopLevelOr(s) {
  let depth = 0;
  for (let i = 0; i < s.length - 1; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0 && ch === '|' && s[i + 1] === '|') return true;
  }
  return false;
}

/**
 * Test whether a leg string is a call to `isSuperAdminOnly()`.
 *
 * @param {string | null} leg
 * @returns {boolean}
 */
function isSuperAdminShortCircuit(leg) {
  if (!leg) return false;
  return /^isSuperAdminOnly\s*\(\s*\)$/.test(leg);
}

/**
 * Validate that every listed collection opens its allow-read expression
 * with `isSuperAdminOnly()`. Phase A scope — expansion in Phase B.
 *
 * @param {readonly RuleBlock[]} blocks
 * @param {readonly string[]} targetCollections
 * @returns {ShapeViolation[]}
 */
function validateSuperAdminShortCircuit(blocks, targetCollections) {
  const violations = [];
  const targetSet = new Set(targetCollections);

  for (const block of blocks) {
    if (!targetSet.has(block.collection)) continue;

    if (!block.firstAllowReadExpression) {
      violations.push({
        collection: block.collection,
        lineStart: block.lineStart,
        problem: 'no_allow_read',
        actualFirstLeg: null,
      });
      continue;
    }

    if (!isSuperAdminShortCircuit(block.firstAllowReadLeg)) {
      violations.push({
        collection: block.collection,
        lineStart: block.lineStart,
        problem: 'missing_super_admin_short_circuit',
        actualFirstLeg: block.firstAllowReadLeg,
      });
    }
  }

  return violations;
}

/**
 * Split an expression on its top-level `||` and return the first leg.
 * Tracks paren depth so that `(a || b) || c` returns `(a || b)`.
 *
 * @param {string} expression
 * @returns {string}
 */
function splitFirstOrLeg(expression) {
  let depth = 0;
  for (let i = 0; i < expression.length - 1; i++) {
    const ch = expression[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0 && ch === '|' && expression[i + 1] === '|') {
      return expression.slice(0, i).trim();
    }
  }
  return expression.trim();
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Strip Firestore path parameters like `/{projectId}` from a line so the
 * brace counter doesn't mistake them for block delimiters. Covers both
 * plain params and wildcards (`{docs=**}`).
 *
 * @param {string} line
 * @returns {string}
 */
function stripPathParams(line) {
  return line.replace(/\/\{[a-zA-Z_][a-zA-Z0-9_]*(?:=\*\*)?\}/g, '/__PARAM__');
}

/**
 * Find the line (exclusive end index) where a match block closes.
 * Counts `{`/`}` starting from the block opening line. Path parameters
 * (e.g. `/{projectId}`) are scrubbed first so they don't affect depth.
 *
 * @param {string[]} lines
 * @param {number} startIdx
 * @returns {number}
 */
function findBlockEnd(lines, startIdx) {
  let depth = 0;
  for (let i = startIdx; i < lines.length; i++) {
    const scrubbed = stripPathParams(lines[i]);
    for (const ch of scrubbed) {
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return i + 1;
      }
    }
  }
  return lines.length;
}

/**
 * Extract the body of the first `allow read: if ...;` expression in a
 * match block. Returns null if the block has no explicit allow-read.
 *
 * @param {string} body
 * @returns {string | null}
 */
function extractFirstAllowRead(body) {
  // Strip comments before scanning so that `// OR super_admin` style
  // annotations don't bleed into the extracted OR legs.
  const stripped = stripComments(body);
  const allowReadStart = stripped.search(/allow\s+read\s*:\s*if\s+/);
  if (allowReadStart < 0) return null;

  const after = stripped.slice(allowReadStart).replace(/allow\s+read\s*:\s*if\s+/, '');
  const semicolonIdx = after.indexOf(';');
  if (semicolonIdx < 0) return null;

  return after.slice(0, semicolonIdx).replace(/\s+/g, ' ').trim();
}

/**
 * Remove line and block comments. Applied to the whole match block body
 * before the allow-read expression is extracted.
 *
 * @param {string} s
 * @returns {string}
 */
function stripComments(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

module.exports = {
  parseFirestoreRules,
  isSuperAdminShortCircuit,
  validateSuperAdminShortCircuit,
  splitFirstOrLeg,
};
