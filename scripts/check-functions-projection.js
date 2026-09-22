#!/usr/bin/env node
'use strict';
/**
 * CHECK 3.93 — freshness of the Cloud Functions projection (ADR-874).
 *
 * «Is what the Cloud Functions build compiles EXACTLY what the app SSoT says?»
 *
 * THE INCIDENT (ADR-873 Ε-873.1/Ε-873.2): `functions/src/search/search-config.mirror.ts`
 * was a hand-kept copy of `src/config/search-index-config.ts`. `4bd107bd`
 * (2026-05-02) changed only the SSoT; the Cloud Function — the ONLY production
 * writer of `search_documents` (ADR-029) — kept indexing the old fields for ~5
 * months. A sync script existed, but no hook and no workflow ever called it.
 * Worse (ADR-874 Ε-874.1): the functions build normalized the INDEX with its own
 * copy of `normalizeSearchText` / `generateSearchPrefixes`, while `/api/search`
 * normalized the QUERY with the app's — two algorithms on the two sides of one
 * `array-contains-any`.
 *
 * Now the copies are GENERATED (`npm run generate:functions-projection`) and this
 * gate compares them with the plan. ⛔ ZERO-TOL, no baseline, ever. No trigger:
 * the plan reads the whole consumer tree (a new `COLLECTIONS.KEY` anywhere under
 * `functions/src` changes it), and it costs well under a second.
 *
 * CLI:  node scripts/check-functions-projection.js
 * Env:  SKIP_FUNCTIONS_PROJECTION=1   — bypass (justify to Giorgio)
 *       FUNCTIONS_PROJECTION_ROOT=…   — alternative repo root (Jest fixtures)
 * Exit: 0 fresh · 1 stale / missing / orphan / invalid
 */

const path = require('node:path');

const { judge, STATES } = require('./lib/functions-projection/judge');
const { REGENERATE } = require('./lib/functions-projection/plan');

const ICON = {
  [STATES.STALE]: '✏️  stale (SSoT changed, or the generated file was edited by hand)',
  [STATES.MISSING]: '➕ missing',
  [STATES.ORPHAN]: '🗑️  orphan (no longer projected)',
  [STATES.INVALID]: '⛔ invalid',
};

function report(res) {
  const bad = res.results.filter((r) => r.state !== STATES.FRESH);
  if (bad.length === 0) {
    console.log(`✅ CHECK 3.93 functions projection — ${res.results.length} generated files fresh`);
    return;
  }
  console.error('❌ CHECK 3.93 functions projection — functions/src/generated/ does not match the app SSoT');
  for (const r of bad) console.error(`   ${ICON[r.state]}: ${r.path}${r.detail ? `\n      ${r.detail}` : ''}`);
  const fix = bad.some((r) => r.state === STATES.INVALID)
    ? 'Fix the error above (portable modules import only projected modules / node builtins).'
    : `Run: ${REGENERATE}   — never edit functions/src/generated/ by hand.`;
  console.error(`\n   ${fix}\n   📘 docs/gates/3.93.md · ADR-874`);
}

function main() {
  if (process.env.SKIP_FUNCTIONS_PROJECTION === '1') {
    console.log('⏭️  CHECK 3.93 skipped (SKIP_FUNCTIONS_PROJECTION=1)');
    return;
  }
  const root = process.env.FUNCTIONS_PROJECTION_ROOT || path.resolve(__dirname, '..');
  const res = judge(root);
  report(res);
  process.exitCode = res.ok ? 0 : 1;
}

if (require.main === module) main();

module.exports = { judge };
