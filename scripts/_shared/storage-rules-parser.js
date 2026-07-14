#!/usr/bin/env node
/**
 * Shared utility — Storage Rules Parser (CommonJS)
 *
 * Identity-based parser for `storage.rules` used by CHECK 3.19
 * (`scripts/check-storage-rules-test-coverage.js`).
 *
 * Mirrors the structure and export style of the Firestore counterpart at
 * `scripts/_shared/firestore-rules-parser.js`. The pre-commit hook must run
 * without ts-jest/ts-node, so this JS copy is the canonical version used by
 * tooling.
 *
 * ── Why identity, not line numbers (ADR-657 / ADR-301) ──────────────────────
 * The previous coverage checker matched a `match` block to its manifest entry
 * by LINE NUMBER (rulesRange overlap). Any line inserted ABOVE a block silently
 * unmoored every block below it — a helper added at the top of storage.rules
 * would shift all ranges and mask real coverage gaps. This parser instead reads
 * a `// @pathId: <id>` annotation placed directly above every inner `match`
 * block, so a block's identity travels with it regardless of line shifts.
 *
 * @since 2026-07-15 (ADR-657 — CHECK 3.19 line-shift-proof refactor)
 */

'use strict';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @typedef {{
 *   pathId: string | null,
 *   matchPath: string,
 *   lineStart: number,
 *   lineEnd: number,
 *   body: string,
 * }} StorageRuleBlock
 */

/**
 * Parse `storage.rules` content and return every inner-level `match` block
 * (children of the outer `match /b/{bucket}/o { ... }` service wrapper, which
 * is itself skipped).
 *
 * For each block, the full match path (including `{param}` and `{p=**}`
 * segments) is captured, and the `// @pathId: <id>` annotation immediately
 * above the block is read as the block's stable identity. `pathId` is `null`
 * when no annotation is present — Validation E in the checker turns that into a
 * blocking violation (a new storage path cannot ship without an identity).
 *
 * @param {string} rulesContent
 * @returns {StorageRuleBlock[]}
 */
function parseStorageRules(rulesContent) {
  const lines = rulesContent.split('\n');
  /** @type {StorageRuleBlock[]} */
  const blocks = [];

  for (let i = 0; i < lines.length; i++) {
    const matchPath = extractMatchPath(lines[i]);
    if (matchPath === null) continue;
    // Skip the outer bucket wrapper `match /b/{bucket}/o { ... }`.
    if (matchPath.startsWith('/b/')) continue;

    const lineStart = i + 1;
    const lineEnd = findBlockEnd(lines, i);
    const body = lines.slice(i, lineEnd).join('\n');
    const pathId = extractPathIdAnnotation(lines, i);

    blocks.push({ pathId, matchPath, lineStart, lineEnd, body });
  }

  return blocks;
}

/**
 * Return the pathIds that appear more than once across the parsed blocks.
 * Blocks with a `null` pathId are ignored here (handled by the missing-id
 * validation). Used by CHECK 3.19 Validation F.
 *
 * @param {readonly StorageRuleBlock[]} blocks
 * @returns {string[]} Sorted unique list of duplicated pathIds.
 */
function findDuplicatePathIds(blocks) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const b of blocks) {
    if (!b.pathId) continue;
    counts.set(b.pathId, (counts.get(b.pathId) || 0) + 1);
  }
  const dupes = [];
  for (const [id, n] of counts) {
    if (n > 1) dupes.push(id);
  }
  return dupes.sort();
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract the full match path from a `match <path> {` line, or `null` if the
 * line does not open a match block. The path may contain `{param}` and
 * `{param=**}` wildcard segments — we anchor on the trailing block-opening
 * `{` at end of line rather than stopping at the first `{`, so the WHOLE path
 * is captured (needed for exact PENDING matching).
 *
 * @param {string} line
 * @returns {string | null}
 */
function extractMatchPath(line) {
  const m = /^\s*match\s+(\S.*?)\s*\{\s*$/.exec(line);
  return m ? m[1] : null;
}

/**
 * Read the `// @pathId: <id>` annotation for the block opening at
 * `matchIdx`. Scans upward through the contiguous run of comment/blank lines
 * directly above the `match` line (the doc banner), returning the first id
 * found. Stops at the first line that is neither blank nor a `//` comment.
 *
 * @param {string[]} lines
 * @param {number} matchIdx
 * @returns {string | null}
 */
function extractPathIdAnnotation(lines, matchIdx) {
  const re = /^\s*\/\/\s*@pathId:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*$/;
  for (let i = matchIdx - 1; i >= 0; i--) {
    const line = lines[i];
    const mm = re.exec(line);
    if (mm) return mm[1];
    const trimmed = line.trim();
    if (trimmed !== '' && !trimmed.startsWith('//')) break;
  }
  return null;
}

/**
 * Strip Storage path parameters like `/{fileName}` or `/{topoFile=**}` from a
 * line so the brace counter doesn't mistake them for block delimiters.
 *
 * @param {string} line
 * @returns {string}
 */
function stripPathParams(line) {
  return line.replace(/\/\{[a-zA-Z_][a-zA-Z0-9_]*(?:=\*\*)?\}/g, '/__PARAM__');
}

/**
 * Find the line (exclusive end index) where a match block closes. Counts
 * `{`/`}` from the block opening line; path parameters are scrubbed first so
 * they don't affect depth.
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

module.exports = {
  parseStorageRules,
  findDuplicatePathIds,
};
