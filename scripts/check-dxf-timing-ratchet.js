#!/usr/bin/env node
/**
 * =============================================================================
 * DXF Viewer Timing SSoT Ratchet — Pre-commit Check 3.27 (ADR-516 Phase 2)
 * =============================================================================
 *
 * Motivation
 * ----------
 * ADR-516 unified every *intentional* timing value of the DXF Viewer
 * (throttle / debounce / animation / persist / lifecycle / gesture) into ONE
 * SSoT: `src/subapps/dxf-viewer/config/dxf-timing.ts → DXF_TIMING`, organised
 * in 7 latency categories. Phase 2 rewired ~50 bypass constants (the 24×
 * `AUTO_SAVE_DEBOUNCE_MS = 500`, the 16ms frame throttles, gesture/animation/
 * lifecycle one-offs) to reference `DXF_TIMING.*` instead of hardcoding a number.
 *
 * This check prevents regression: any NEW raw numeric timing literal assigned
 * to a timing-suffixed constant/property inside the DXF Viewer subapp must
 * point at `DXF_TIMING` instead. A reference such as
 *   const X = DXF_TIMING.persist.ENTITY_AUTOSAVE;
 * has no digit after `=`/`:` and therefore never matches.
 *
 * Scope (path-scoped — unlike the global ssot-baseline-engine)
 * -----------------------------------------------------------
 * Only `src/subapps/dxf-viewer/**` .ts/.tsx files. The DXF_TIMING SSoT covers
 * the viewer; the rest of the app has no timing SSoT yet, so app-wide
 * enforcement would block with nowhere to point — deliberately out of scope.
 *
 * Detection regex
 * ---------------
 * A timing-suffixed identifier (`*_MS`, `*_DELAY`, `*_THROTTLE`, `*_DEBOUNCE`,
 * `*_INTERVAL`, `*_TIMEOUT`, `*_DURATION`, `*_WINDOW`, `*_ms`, `*Ms`) directly
 * assigned a NON-ZERO numeric literal: `NAME = 500` / `NAME: 500`. Type
 * annotations (`foo?: number`, `foo: number`) and SSoT references
 * (`= DXF_TIMING.*`) never match (no digit follows).
 *
 * The leading `[1-9]` requirement deliberately skips `= 0` initializers, which
 * are runtime metric/timestamp accumulators (`parseTimeMs: 0`, `totalMs: 0`,
 * `lastRunMs = 0`), NOT centralizable config. Rate fields ending in `PerMs`
 * (e.g. `samplesPerMs`) are excluded too. Comment-only lines are skipped.
 *
 * Allowlist
 * ---------
 * The DXF_TIMING SSoT definition + the three facade configs (they legitimately
 * hold the canonical numeric values). Self-contained (like check-tabs-import-
 * ratchet / check-no-flash-ratchet) — NOT registered in `.ssot-registry.json`,
 * so the global ssot-baseline-engine never applies this regex app-wide.
 *
 * Ratchet semantics
 * -----------------
 *   - Baseline file: `.dxf-timing-baseline.json`
 *   - Counts can only decrease per-file.
 *   - New files start at zero tolerance.
 *   - `npm run dxf-timing:baseline` refreshes after legit cleanup.
 *
 * Modes
 * -----
 *   default      scan files passed as args (pre-commit, silent on PASS)
 *   --all        full subapp scan, audit summary (no block)
 *   --report     full subapp scan, verbose per-file breakdown
 *   --baseline   full subapp scan, write `.dxf-timing-baseline.json`
 *
 * Reference: docs/centralized-systems/reference/adrs/ADR-516-timing-latency-ssot.md §5.4
 * =============================================================================
 */
'use strict';
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const BASELINE_FILE = path.join(REPO_ROOT, '.dxf-timing-baseline.json');
const MODULE_NAME = 'dxf-viewer-timing';
const SCOPE_PREFIX = 'src/subapps/dxf-viewer/';

// SSoT definition + facades — the only files allowed to hold raw timing numbers.
const ALLOWLIST = [
  'src/subapps/dxf-viewer/config/dxf-timing.ts',
  'src/subapps/dxf-viewer/config/panel-tokens.ts',
  'src/subapps/dxf-viewer/config/timing-config.ts',
  'src/subapps/dxf-viewer/config/settings-config.ts',
];

// Tests / type-decls / stories / docs — not enforced.
const EXEMPT_RE = /(__tests__\/|\.test\.|\.spec\.|\.stories\.|\.d\.ts$|\/docs\/)/;

const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const NC = '\x1b[0m';

// ---------------------------------------------------------------------------
// Detection regex — timing-suffixed identifier assigned a numeric literal.
// A reference (`= DXF_TIMING.persist.X`) has no digit and never matches.
// ---------------------------------------------------------------------------
// Non-zero leading digit skips `= 0` runtime-metric initializers. `(?<!Per)`
// drops rate fields like `samplesPerMs`.
const TIMING_REGEX =
  /\b[A-Za-z_][A-Za-z0-9_]*(?:_MS|_DELAY|_THROTTLE|_DEBOUNCE|_INTERVAL|_TIMEOUT|_DURATION|_WINDOW|_ms|(?<!Per)Ms)\b\s*[:=]\s*[1-9]/g;

const COMMENT_RE = /^\s*(\/\/|\*|\/\*)/;

// ---------------------------------------------------------------------------
// Scope / allowlist
// ---------------------------------------------------------------------------
function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

function isAllowlisted(file) {
  const norm = normalizePath(file);
  return ALLOWLIST.some((entry) => norm === normalizePath(entry));
}

function isInScope(file) {
  const norm = normalizePath(file);
  if (!/\.(ts|tsx)$/.test(norm)) return false;
  if (!norm.startsWith(SCOPE_PREFIX)) return false;
  if (EXEMPT_RE.test(norm)) return false;
  if (isAllowlisted(file)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Match counting (skip comment-only lines)
// ---------------------------------------------------------------------------
function countViolations(content) {
  const hits = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (COMMENT_RE.test(line)) continue;
    TIMING_REGEX.lastIndex = 0;
    let m;
    while ((m = TIMING_REGEX.exec(line)) !== null) {
      hits.push({ match: m[0].trim(), line: i + 1 });
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Full subapp walk
// ---------------------------------------------------------------------------
function walkScope(dir, out = []) {
  const abs = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '__tests__'].includes(entry.name)) continue;
      walkScope(rel, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && isInScope(rel)) {
      out.push(rel);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Baseline IO
// ---------------------------------------------------------------------------
function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) return { files: {} };
  try {
    const data = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    return { files: data.files ?? {} };
  } catch {
    return { files: {} };
  }
}

function writeBaseline(fileCounts) {
  const sortedFiles = Object.fromEntries(
    Object.entries(fileCounts).sort(([a], [b]) => a.localeCompare(b)),
  );
  const totalViolations = Object.values(fileCounts).reduce((a, b) => a + b, 0);
  const payload = {
    _meta: {
      module: MODULE_NAME,
      description:
        'DXF Viewer raw timing literal baseline. Ratchet enforced via CHECK 3.27 (ADR-516 §5.4). ' +
        'Counts can only decrease per-file. New files: zero tolerance. ' +
        'Each entry should migrate to DXF_TIMING (config/dxf-timing.ts) when its file is touched.',
      adr: 'ADR-516',
      generatedAt: new Date().toISOString(),
      totalFiles: Object.keys(sortedFiles).length,
      totalViolations,
    },
    files: sortedFiles,
  };
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return { totalFiles: Object.keys(sortedFiles).length, totalViolations };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const wantAll = args.includes('--all') || args.includes('--audit');
const wantReport = args.includes('--report');
const wantBaseline = args.includes('--baseline') || args.includes('--write-baseline');

if (wantBaseline) {
  const files = walkScope(SCOPE_PREFIX.replace(/\/$/, ''));
  const fileCounts = {};
  for (const file of files) {
    const content = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
    const hits = countViolations(content);
    if (hits.length > 0) fileCounts[normalizePath(file)] = hits.length;
  }
  const { totalFiles, totalViolations } = writeBaseline(fileCounts);
  console.log(
    `${GREEN}✅ Baseline written: ${BASELINE_FILE}${NC}\n` +
    `${GREEN}   ${totalFiles} files / ${totalViolations} violations${NC}`,
  );
  process.exit(0);
}

if (wantReport || wantAll) {
  const files = walkScope(SCOPE_PREFIX.replace(/\/$/, ''));
  const entries = [];
  let totalViolations = 0;
  for (const file of files) {
    const content = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
    const hits = countViolations(content);
    if (hits.length === 0) continue;
    totalViolations += hits.length;
    entries.push({ file: normalizePath(file), hits });
  }
  entries.sort((a, b) => b.hits.length - a.hits.length || a.file.localeCompare(b.file));

  if (wantReport) {
    for (const { file, hits } of entries) {
      console.log(`${YELLOW}${file}${NC}  (${hits.length})`);
      for (const h of hits) console.log(`  L${h.line}  ${h.match}`);
    }
    console.log('');
  }
  console.log(
    `${GREEN}📊 DXF timing audit: ${entries.length} files / ${totalViolations} raw timing literals${NC}`,
  );
  process.exit(0);
}

// Default: ratchet mode — scan provided args (staged files from pre-commit).
const stagedFiles = args.filter((a) => !a.startsWith('--'));

if (stagedFiles.length === 0) {
  process.exit(0);
}

const baseline = loadBaseline();
let hasBlock = false;
let totalChecked = 0;
const reductions = [];

for (const file of stagedFiles) {
  const abs = path.isAbsolute(file) ? file : path.join(REPO_ROOT, file);
  if (!fs.existsSync(abs)) continue;
  const rel = normalizePath(path.relative(REPO_ROOT, abs));
  if (!isInScope(rel)) continue;
  totalChecked += 1;

  const content = fs.readFileSync(abs, 'utf8');
  const hits = countViolations(content);
  if (hits.length === 0) {
    if (baseline.files[rel]) {
      reductions.push(
        `${GREEN}  📉 ${rel}: ${baseline.files[rel]} → 0 raw timing literals (fully migrated)${NC}`,
      );
    }
    continue;
  }

  const baselineCount = baseline.files[rel] ?? 0;
  const currentCount = hits.length;

  if (currentCount <= baselineCount) {
    if (currentCount < baselineCount) {
      reductions.push(
        `${GREEN}  📉 ${rel}: ${baselineCount} → ${currentCount} (-${baselineCount - currentCount}) raw timing literals${NC}`,
      );
    }
    continue;
  }

  hasBlock = true;
  const newCount = currentCount - baselineCount;
  console.log(
    `${RED}  🚫 ${rel}: ${newCount} new raw timing literal(s) (total ${currentCount}, baseline ${baselineCount})${NC}`,
  );
  for (const { match, line } of hits.slice(-newCount)) {
    console.log(
      `${YELLOW}     Line ${line}: ${match} — point at DXF_TIMING (config/dxf-timing.ts), ADR-516${NC}`,
    );
  }
}

for (const line of reductions) console.log(line);

if (hasBlock) {
  console.log('');
  console.log(
    `${RED}  ❌ DXF timing ratchet FAILED — centralize raw timing literals into DXF_TIMING${NC}`,
  );
  console.log(
    `${YELLOW}     SSoT: src/subapps/dxf-viewer/config/dxf-timing.ts (DXF_TIMING, 7 categories)${NC}`,
  );
  console.log(
    `${YELLOW}     If a concept is missing, add a categorized key first — never hardcode.${NC}`,
  );
  console.log(
    `${YELLOW}     After legit cleanup: npm run dxf-timing:baseline${NC}`,
  );
  process.exit(1);
}

if (totalChecked > 0) {
  console.log(
    `${GREEN}  ✅ DXF timing: no new raw timing literals (${totalChecked} file(s) in scope)${NC}`,
  );
}
process.exit(0);
