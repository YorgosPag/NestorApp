#!/usr/bin/env node
/**
 * =============================================================================
 * ADR-029 SSoT GUARD — search-config sync check
 * =============================================================================
 *
 * Verifies that `functions/src/search/search-config.mirror.ts` stays in sync
 * with the main-app SSoT `src/config/search-index-config.ts`.
 *
 * Why: Cloud Functions run in a separate build and cannot import from src/.
 * The mirror is a hand-maintained copy. This check enforces the invariant
 * that the two SEARCH_INDEX_CONFIG maps match.
 *
 * Allowed differences (see search-config.mirror.ts header):
 *   - `satisfies PermissionId` annotation — Functions has no PermissionId type
 *   - `statsFields: [...]` entries — Functions indexes but doesn't render stats
 *   - Import paths — Functions uses relative imports
 *
 * Exit codes:
 *   0 = configs in sync
 *   1 = drift detected (prints unified diff)
 *   2 = internal error (e.g., could not locate SEARCH_INDEX_CONFIG block)
 *
 * @enterprise ADR-029 Phase C — Prevention guardrails
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const MAIN_CONFIG = path.join(REPO_ROOT, 'src/config/search-index-config.ts');
const MIRROR_CONFIG = path.join(REPO_ROOT, 'functions/src/search/search-config.mirror.ts');

// ---------------------------------------------------------------------------
// Block extraction
// ---------------------------------------------------------------------------

/**
 * Extract the body of `export const SEARCH_INDEX_CONFIG<…> = { … };` from
 * a TypeScript source. Returns the text between the opening `{` and the
 * matching closing `}` (exclusive), or null if not found.
 */
function extractConfigBlock(source) {
  const re = /export\s+const\s+SEARCH_INDEX_CONFIG\b[^=]*=\s*\{/;
  const match = re.exec(source);
  if (!match) return null;

  const start = match.index + match[0].length;
  let depth = 1;
  let inString = null;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString !== null) {
      if (ch === '\\') { i++; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (inTemplate) {
      if (ch === '\\') { i++; continue; }
      if (ch === '`') inTemplate = false;
      continue;
    }

    if (ch === '/' && next === '/') { inLineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { inBlockComment = true; i++; continue; }
    if (ch === '"' || ch === "'") { inString = ch; continue; }
    if (ch === '`') { inTemplate = true; continue; }

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return source.slice(start, i);
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Normalization — strip differences that are allowed by design
// ---------------------------------------------------------------------------

function normalize(block) {
  let out = block;

  // Remove line + block comments (safe inside the config block — no URLs etc.)
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/\/\/[^\n]*/g, '');

  // Drop `satisfies PermissionId` annotations (main app only)
  out = out.replace(/\s+satisfies\s+PermissionId\b/g, '');

  // Drop any `statsFields: [ … ]` property (including trailing comma)
  // We have to hand-roll bracket matching because statsFields contains
  // nested objects.
  out = removeKey(out, 'statsFields');

  // Strip the `🏢 ENTERPRISE` comment markers that only appear in main
  // (they've already been removed by the comment strip above, but keep
  // this for defence in depth).
  out = out.replace(/🏢[^\n]*/g, '');

  // Collapse whitespace
  out = out.replace(/\s+/g, ' ').trim();
  // Remove trailing commas before `}` or `]` (cosmetic differences)
  out = out.replace(/,\s*([}\]])/g, '$1');
  // Strip whitespace adjacent to brackets, braces, parens, commas, colons
  out = out.replace(/\s*([{}\[\]()])\s*/g, '$1');
  out = out.replace(/\s*,\s*/g, ',');
  out = out.replace(/\s*:\s*/g, ':');

  return out;
}

/**
 * Remove `keyName: <value>,?` from an object literal block.
 * Handles nested braces/brackets and trailing comma.
 */
function removeKey(block, keyName) {
  const re = new RegExp(`\\b${keyName}\\s*:\\s*`, 'g');
  let result = block;

  while (true) {
    const m = re.exec(result);
    if (!m) break;

    const keyStart = m.index;
    let i = m.index + m[0].length;

    // Skip any leading whitespace (already consumed by regex)
    // Walk the value — match brackets/braces/strings
    let depth = 0;
    let inString = null;
    let valueEnd = -1;

    for (; i < result.length; i++) {
      const ch = result[i];
      if (inString !== null) {
        if (ch === '\\') { i++; continue; }
        if (ch === inString) inString = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue; }
      if (ch === '{' || ch === '[' || ch === '(') { depth++; continue; }
      if (ch === '}' || ch === ']' || ch === ')') {
        if (depth === 0) { valueEnd = i; break; }
        depth--;
        continue;
      }
      if (ch === ',' && depth === 0) { valueEnd = i + 1; break; }
    }

    if (valueEnd === -1) break;

    // Also eat following whitespace + comma if present
    let tail = valueEnd;
    while (tail < result.length && /[\s,]/.test(result[tail])) tail++;

    result = result.slice(0, keyStart) + result.slice(tail);
    re.lastIndex = keyStart;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Diff helper
// ---------------------------------------------------------------------------

function findFirstDiff(a, b) {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return i;
  }
  return a.length === b.length ? -1 : len;
}

function contextWindow(text, idx, radius) {
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + radius);
  return `…${text.slice(start, end)}…`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const mainSrc = fs.readFileSync(MAIN_CONFIG, 'utf8');
  const mirrorSrc = fs.readFileSync(MIRROR_CONFIG, 'utf8');

  const mainBlock = extractConfigBlock(mainSrc);
  const mirrorBlock = extractConfigBlock(mirrorSrc);

  if (!mainBlock) {
    console.error(`[search-config-sync] Could not find SEARCH_INDEX_CONFIG in ${MAIN_CONFIG}`);
    process.exit(2);
  }
  if (!mirrorBlock) {
    console.error(`[search-config-sync] Could not find SEARCH_INDEX_CONFIG in ${MIRROR_CONFIG}`);
    process.exit(2);
  }

  const mainNorm = normalize(mainBlock);
  const mirrorNorm = normalize(mirrorBlock);

  if (mainNorm === mirrorNorm) {
    console.log('[search-config-sync] ✅ mirror in sync with SSoT');
    process.exit(0);
  }

  const divergeAt = findFirstDiff(mainNorm, mirrorNorm);

  console.error('[search-config-sync] ❌ DRIFT DETECTED');
  console.error('');
  console.error(`  SSoT:   ${path.relative(REPO_ROOT, MAIN_CONFIG)}`);
  console.error(`  Mirror: ${path.relative(REPO_ROOT, MIRROR_CONFIG)}`);
  console.error('');
  console.error(`  First divergence at normalized offset ${divergeAt}:`);
  console.error('');
  console.error(`    SSoT   : ${contextWindow(mainNorm, divergeAt, 60)}`);
  console.error(`    Mirror : ${contextWindow(mirrorNorm, divergeAt, 60)}`);
  console.error('');
  console.error('  Resolution:');
  console.error('    1. Update the mirror to match the SSoT (or vice-versa if SSoT is wrong)');
  console.error('    2. Remember allowed differences: `satisfies PermissionId`, `statsFields`');
  console.error('    3. Re-run: node scripts/check-search-config-sync.js');
  console.error('');

  process.exit(1);
}

main();
