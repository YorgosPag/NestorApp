#!/usr/bin/env node
/**
 * CHECK 3.25 — No-Navigation-Flash Ratchet (regex-based, ADR-267 / ADR-300)
 *
 * Detects three classes of code that cause visible flash when navigating
 * between sister list/detail pages (e.g. /procurement ↔ /procurement/quotes):
 *
 *   Pattern A — list-fetch hook missing ADR-300 stale-cache support.
 *     File scope: src/hooks/**, src/subapps/* /hooks/** (use*.ts only).
 *     Trigger:   useAsyncData<X[]>  (array generic)
 *     AND       no createStaleCache import from @/lib/stale-cache
 *     AND       no silentInitialFetch: option
 *     Compliant example: src/hooks/procurement/usePurchaseOrders.ts
 *
 *   Pattern B — !isNamespaceReady early-return guard in PageContent.
 *     File scope: src/components/* * /pages/*PageContent.tsx + subapp variant.
 *     Trigger:   `if (!isNamespaceReady) { ... return ... }`
 *     Why bad:   namespace lazy-load (~50-150ms) yields blank flash on remount.
 *     Compliant: sister pages (Contacts/Buildings/Orders/Quotes) skip the guard.
 *
 *   Pattern C — bare `if (loading)` early-return rendering raw <Loader2>.
 *     File scope: same as B.
 *     Trigger:   `if (loading) { ... <Loader2 ... }`
 *     Why bad:   canonical SSoT is <PageLoadingState> guarded by
 *                `loading && data.length === 0` (ADR-229) — bare loading
 *                check fires on every silent refetch -> mid-page flash.
 *
 * Why regex, not AST:
 *   - All three patterns are line-or-near-line localized; multiline regex
 *     with bounded `[\s\S]{0,N}?` non-greedy windows handles them robustly.
 *   - Avoids @typescript-eslint/parser parse cost on every staged file
 *     (smoke target <500ms across <50 files).
 *
 * Ratchet semantics (mirrors CHECK 3.24 / 3.23):
 *   - Baseline:        .no-flash-baseline.json
 *   - New file with violations         → BLOCK (zero tolerance)
 *   - Existing baselined file MORE     → BLOCK
 *   - Existing baselined file ≤        → allow (improvements logged)
 *
 * CLI:
 *   node scripts/check-no-flash-ratchet.js                  # staged via args
 *   node scripts/check-no-flash-ratchet.js --all            # full scan
 *   node scripts/check-no-flash-ratchet.js --write-baseline # regenerate
 *   node scripts/check-no-flash-ratchet.js path/to/file.ts  # explicit
 *
 * Exit codes: 0 = pass, 1 = blocked.
 */

'use strict';

const path = require('node:path');
const ratchet = require('./lib/per-file-ratchet');

if (require.main === module) {
  process.chdir(path.resolve(__dirname, '..'));
}

const BASELINE_FILE =
  process.env.NO_FLASH_BASELINE_FILE || '.no-flash-baseline.json';

// ─── Pattern detectors ───────────────────────────────────────────────────────

const RE_USE_ASYNC_DATA_ARRAY =
  /useAsyncData\s*<\s*[A-Za-z_][\w.]*\s*\[\s*\]\s*>/m;
const RE_STALE_CACHE_IMPORT = /from\s+['"]@\/lib\/stale-cache['"]/;
const RE_SILENT_INITIAL_FETCH = /\bsilentInitialFetch\s*:/;

const RE_NAMESPACE_READY_GUARD =
  /if\s*\(\s*!\s*isNamespaceReady\s*\)\s*\{[\s\S]{0,300}?return/m;

const RE_BARE_LOADING_LOADER2 =
  /if\s*\(\s*loading\s*\)\s*\{[\s\S]{0,200}?<\s*Loader2/m;

// ─── File scope ──────────────────────────────────────────────────────────────

const HOOK_PATH_RES = [
  /^src\/hooks\/(?:[^/]+\/)*use[A-Z]\w*\.ts$/,
  /^src\/subapps\/[^/]+\/hooks\/(?:[^/]+\/)*use[A-Z]\w*\.ts$/,
];
const PAGE_CONTENT_PATH_RES = [
  /^src\/components\/(?:[^/]+\/)*pages\/[A-Z]\w*PageContent\.tsx$/,
  /^src\/subapps\/[^/]+\/components\/(?:[^/]+\/)*pages\/[A-Z]\w*PageContent\.tsx$/,
];

const ALLOWLIST = [
  'src/lib/stale-cache.ts',
  'src/hooks/useAsyncData.ts',
  'src/hooks/__tests__/',
  'src/subapps/dxf-viewer/',
];

function norm(p) {
  return p.replace(/\\/g, '/');
}

function isAllowlisted(filePath) {
  const n = norm(filePath);
  return ALLOWLIST.some((p) => n === p || n.startsWith(p));
}

function isHookFile(filePath) {
  if (/__tests__/.test(filePath)) return false;
  const n = norm(filePath);
  return HOOK_PATH_RES.some((re) => re.test(n));
}

function isPageContentFile(filePath) {
  if (/__tests__/.test(filePath)) return false;
  const n = norm(filePath);
  return PAGE_CONTENT_PATH_RES.some((re) => re.test(n));
}

function isInScope(filePath) {
  return isHookFile(filePath) || isPageContentFile(filePath);
}

// ─── Violation detectors ─────────────────────────────────────────────────────

function lineOf(src, idx) {
  if (idx < 0) return '?';
  return src.slice(0, idx).split('\n').length;
}

function findHookViolations(src) {
  const out = [];
  const m = src.match(RE_USE_ASYNC_DATA_ARRAY);
  if (!m) return out;
  if (RE_STALE_CACHE_IMPORT.test(src) && RE_SILENT_INITIAL_FETCH.test(src)) {
    return out; // compliant — ADR-300 wired
  }
  out.push({
    kind: 'pattern-A-stale-cache-missing',
    line: lineOf(src, src.indexOf(m[0])),
    symbol: 'useAsyncData<T[]> without ADR-300 stale-cache + silentInitialFetch',
  });
  return out;
}

function findPageContentViolations(src) {
  const out = [];
  const mB = src.match(RE_NAMESPACE_READY_GUARD);
  if (mB) {
    out.push({
      kind: 'pattern-B-namespace-ready-guard',
      line: lineOf(src, src.indexOf(mB[0])),
      symbol: 'if (!isNamespaceReady) return — causes blank flash on remount',
    });
  }
  const mC = src.match(RE_BARE_LOADING_LOADER2);
  if (mC) {
    out.push({
      kind: 'pattern-C-bare-loading-loader2',
      line: lineOf(src, src.indexOf(mC[0])),
      symbol: 'if (loading) → <Loader2> — use <PageLoadingState> + length check',
    });
  }
  return out;
}

/** Τα ευρήματα ενός αρχείου του πεδίου — το κείμενο από την ΕΙΣΟΔΟ (ADR-924 Φ3), ποτέ από τον δίσκο εδώ. */
function findViolations(src, filePath) {
  if (isAllowlisted(filePath)) return [];
  if (isHookFile(filePath)) return findHookViolations(src);
  if (isPageContentFile(filePath)) return findPageContentViolations(src);
  return [];
}

const inScope = (file) => isInScope(file) && !isAllowlisted(file);

// ─── File collection ─────────────────────────────────────────────────────────

/** Κάθε αρχείο του πεδίου κάτω από το `src/` — από την ΕΙΣΟΔΟ (`__tests__` κλαδεύεται, όπως πάντα). */
function collectAllFiles(input) {
  return ratchet.scopeFiles(input, ['src'], isInScope, ratchet.pruneTestDirs);
}

// ─── Main ────────────────────────────────────────────────────────────────────

const { yellow: YELLOW, nc: NC } = ratchet.BANNER_COLORS;

function parseArgs(argv) {
  return {
    scanAll: argv.includes('--all'),
    writeBaseline: argv.includes('--write-baseline'),
    args: argv.slice(2),
  };
}

function printFix() {
  console.log(`  ${YELLOW}Fix:${NC}`);
  console.log(`    A. import { createStaleCache } from '@/lib/stale-cache';`);
  console.log(`       + initialData: cache.get() ?? []`);
  console.log(`       + silentInitialFetch: cache.hasLoaded()`);
  console.log(`    B. Remove if (!isNamespaceReady) early-return:`);
  console.log(`       sister pages (Contacts/Buildings/Orders) render without it.`);
  console.log(`    C. Use <PageLoadingState> guarded by`);
  console.log(`       (loading && data.length === 0) — not bare if (loading).`);
  console.log();
}

/** Η πύλη πάνω στο κοινό CLI — ρίζα = ο τρέχων φάκελος τη στιγμή της κλήσης (οι σουίτες τρέχουν σε προσωρινό δέντρο). */
const gate = ratchet.defineBannerGate({
  baselineFile: BASELINE_FILE,
  inScope,
  findHits: findViolations,
  collectAll: collectAllFiles,
  meta: {
    description:
      'No-navigation-flash ratchet (CHECK 3.25, ADR-267/ADR-300). Hooks must use createStaleCache + silentInitialFetch; PageContent must not gate render on isNamespaceReady or bare `if (loading)` <Loader2>.',
    rule: 'List-fetch hooks → ADR-300 stale-cache. PageContents → no namespace guard, no bare loading-only Loader2 returns.',
  },
  banner: {
    downTitle: 'No-flash violations reduced',
    downCommand: 'no-flash:baseline',
    blockedTitle: 'No-Navigation-Flash (CHECK 3.25, ADR-267/300)',
    blockedSubtitle: 'Wire hooks to ADR-300 stale-cache; remove namespace/loader guards',
    newNoun: 'flash-pattern violation(s)',
    describeHit: ({ line, kind, symbol }) => `line ${line} [${kind}]: ${symbol}`,
  },
  printFix,
});

/** `input` = η είσοδος (ADR-924): με `--index` (εκτελεστής) το κείμενο ΤΟΥ COMMIT, όχι του δίσκου. */
function run(argv = process.argv, input = undefined) {
  return gate(parseArgs(argv).args, input);
}

if (require.main === module) {
  process.exit(run(process.argv));
}

module.exports = {
  // detectors
  RE_USE_ASYNC_DATA_ARRAY,
  RE_STALE_CACHE_IMPORT,
  RE_SILENT_INITIAL_FETCH,
  RE_NAMESPACE_READY_GUARD,
  RE_BARE_LOADING_LOADER2,
  findHookViolations,
  findPageContentViolations,
  findViolations,
  // scope
  isHookFile,
  isPageContentFile,
  isInScope,
  isAllowlisted,
  // io
  collectAllFiles,
  // cli
  parseArgs,
  run,
  BASELINE_FILE,
};
