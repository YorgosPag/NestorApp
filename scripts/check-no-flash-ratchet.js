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

const fs = require('node:fs');
const path = require('node:path');

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

function findViolations(filePath) {
  if (!fs.existsSync(filePath)) return [];
  if (isAllowlisted(filePath)) return [];
  const src = fs.readFileSync(filePath, 'utf8');
  if (isHookFile(filePath)) return findHookViolations(src);
  if (isPageContentFile(filePath)) return findPageContentViolations(src);
  return [];
}

// ─── File collection ─────────────────────────────────────────────────────────

function collectAllFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const full = norm(path.join(dir, entry.name));
    if (entry.isDirectory()) {
      collectAllFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && isInScope(full)) {
      out.push(full);
    }
  }
  return out;
}

function collectFiles({ scanAll, args }) {
  if (scanAll) return collectAllFiles('src');
  const explicit = args.filter((a) => !a.startsWith('--')).map(norm);
  return explicit.filter((f) => isInScope(f));
}

// ─── Baseline ────────────────────────────────────────────────────────────────

function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')).files ?? {};
  } catch {
    return {};
  }
}

function writeBaseline(files) {
  const baseline = {};
  let totalViolations = 0;
  let totalFiles = 0;
  for (const f of files) {
    if (isAllowlisted(f)) continue;
    const v = findViolations(f);
    if (v.length > 0) {
      baseline[f] = v.length;
      totalViolations += v.length;
      totalFiles += 1;
    }
  }
  const out = {
    _meta: {
      description:
        'No-navigation-flash ratchet (CHECK 3.25, ADR-267/ADR-300). Hooks must use createStaleCache + silentInitialFetch; PageContent must not gate render on isNamespaceReady or bare `if (loading)` <Loader2>.',
      generated: new Date().toISOString(),
      totalViolations,
      totalFiles,
      rule: 'List-fetch hooks → ADR-300 stale-cache. PageContents → no namespace guard, no bare loading-only Loader2 returns.',
    },
    files: baseline,
  };
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(out, null, 2) + '\n');
  return { totalViolations, totalFiles };
}

// ─── Main ────────────────────────────────────────────────────────────────────

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const NC = '\x1b[0m';

function parseArgs(argv) {
  return {
    scanAll: argv.includes('--all'),
    writeBaseline: argv.includes('--write-baseline'),
    args: argv.slice(2),
  };
}

function run(argv = process.argv) {
  const opts = parseArgs(argv);
  if (opts.writeBaseline) {
    const files = collectAllFiles('src');
    const { totalViolations, totalFiles } = writeBaseline(files);
    console.log(`✅ Baseline written: ${BASELINE_FILE}`);
    console.log(`   Files: ${totalFiles} | Violations: ${totalViolations}`);
    return 0;
  }
  const files = collectFiles(opts);
  if (!files.length) return 0;

  const baseline = loadBaseline();
  let hasBlock = false;
  const blocked = [];
  const improved = [];

  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    if (!isInScope(file)) continue;
    if (isAllowlisted(file)) continue;
    const violations = findViolations(file);
    const current = violations.length;
    const base = baseline[file] ?? 0;
    if (current === 0 && base === 0) continue;
    if (current < base) {
      improved.push({ file, from: base, to: current });
      continue;
    }
    if (current === base) continue;
    hasBlock = true;
    blocked.push({ file, current, base, isNew: base === 0, violations });
  }

  if (improved.length) {
    console.log(
      `\n${GREEN}═══════════════════════════════════════════════════════════════${NC}`
    );
    console.log(`${GREEN}  🎯 RATCHET DOWN — No-flash violations reduced${NC}`);
    console.log(
      `${GREEN}═══════════════════════════════════════════════════════════════${NC}`
    );
    for (const { file, from, to } of improved) {
      console.log(`  ✅ ${file}: ${from} → ${to} (-${from - to})`);
    }
    console.log(`\n  ${YELLOW}Run after commit: npm run no-flash:baseline${NC}\n`);
  }

  if (hasBlock) {
    console.log(
      `\n${RED}═══════════════════════════════════════════════════════════════${NC}`
    );
    console.log(
      `${RED}  🚫 COMMIT BLOCKED — No-Navigation-Flash (CHECK 3.25, ADR-267/300)${NC}`
    );
    console.log(
      `${RED}  Wire hooks to ADR-300 stale-cache; remove namespace/loader guards${NC}`
    );
    console.log(
      `${RED}═══════════════════════════════════════════════════════════════${NC}\n`
    );
    for (const { file, current, base, isNew, violations } of blocked) {
      if (isNew) {
        console.log(`  ❌ ${file} (NEW FILE — zero tolerance)`);
        console.log(`     Found ${current} flash-pattern violation(s)`);
      } else {
        console.log(`  ❌ ${file}`);
        console.log(
          `     Baseline: ${base} → Current: ${current} (+${current - base})`
        );
      }
      for (const { line, kind, symbol } of violations) {
        console.log(`     line ${line} [${kind}]: ${symbol}`);
      }
      console.log();
    }
    console.log(`  ${YELLOW}Fix:${NC}`);
    console.log(`    A. import { createStaleCache } from '@/lib/stale-cache';`);
    console.log(`       + initialData: cache.get() ?? []`);
    console.log(`       + silentInitialFetch: cache.hasLoaded()`);
    console.log(`    B. Remove if (!isNamespaceReady) early-return:`);
    console.log(`       sister pages (Contacts/Buildings/Orders) render without it.`);
    console.log(`    C. Use <PageLoadingState> guarded by`);
    console.log(`       (loading && data.length === 0) — not bare if (loading).`);
    console.log();
    return 1;
  }

  return 0;
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
  loadBaseline,
  writeBaseline,
  collectAllFiles,
  collectFiles,
  // cli
  parseArgs,
  run,
  BASELINE_FILE,
};
