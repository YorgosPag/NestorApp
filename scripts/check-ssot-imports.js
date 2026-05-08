#!/usr/bin/env node
/**
 * CHECK 3.7 — SSoT Import Violations (Centralized Module Ratchet)
 *
 * Node.js rewrite of check-ssot-imports.sh.
 * Zero subprocess spawning → 5-10× faster on Windows (no MSYS2 overhead).
 *
 * Google-style ratchet: counts can only decrease. New files = zero tolerance.
 *
 * CLI:
 *   node scripts/check-ssot-imports.js [files...]
 *
 * Exit codes:
 *   0 — no new violations
 *   1 — new violations found (commit blocked)
 */

'use strict';

const fs   = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// ANSI (matches bash original)
// ---------------------------------------------------------------------------
const RED    = '\x1b[0;31m';
const GREEN  = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const CYAN   = '\x1b[0;36m';
const NC     = '\x1b[0m';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const FLAT_FILE     = '.ssot-registry-flat.txt';
const BASELINE_FILE = '.ssot-violations-baseline.json';

/** Lines starting with these are comment lines (excluded from violation count). */
const COMMENT_RE = /^\s*(\/\/|\*|#)/;

/** Only these file extensions are checked. */
const TS_EXT_RE = /\.(ts|tsx)$/;

// ---------------------------------------------------------------------------
// Pure: flat registry parser
// ---------------------------------------------------------------------------

/**
 * Parse `.ssot-registry-flat.txt` into structured modules.
 * @param {string} text — raw file content
 * @returns {{ exemptRe: RegExp|null, modules: Module[] }}
 *
 * @typedef {{ name: string, re: RegExp|null, allowlist: string[] }} Module
 */
function parseFlatRegistry(text) {
  let exemptRe = null;
  /** @type {Module[]} */
  const modules = [];
  let cur = null;

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (!line) continue;

    if (line.startsWith('EXEMPT:')) {
      exemptRe = new RegExp(line.slice(7));
    } else if (line.startsWith('MODULE:')) {
      if (cur) modules.push(_compileModule(cur));
      cur = { name: line.slice(7), rawPatterns: [], allowlist: [] };
    } else if (line.startsWith('PATTERN:') && cur) {
      cur.rawPatterns.push(line.slice(8));
    } else if (line.startsWith('ALLOW:') && cur) {
      cur.allowlist.push(normalizePath(line.slice(6)));
    }
    // SSOT: lines are informational metadata — skip
  }
  if (cur) modules.push(_compileModule(cur));

  return { exemptRe, modules };
}

/** @internal */
function _compileModule(cur) {
  let re = null;
  if (cur.rawPatterns.length > 0) {
    const combined = cur.rawPatterns.map(p => `(?:${p})`).join('|');
    try {
      re = new RegExp(combined);
    } catch {
      // Fallback: compile individually, skip broken patterns
      const valid = cur.rawPatterns
        .map(p => { try { return new RegExp(p); } catch { return null; } })
        .filter(Boolean);
      re = valid.length > 0 ? new RegExp(valid.map(r => r.source).join('|')) : null;
    }
  }
  return { name: cur.name, re, allowlist: cur.allowlist };
}

// ---------------------------------------------------------------------------
// Pure: baseline helpers
// ---------------------------------------------------------------------------

/**
 * Load and parse the violations baseline file.
 * Returns `{ files: {} }` (empty) on any parse failure.
 * @param {string} filePath
 * @returns {{ files: Record<string, number> }}
 */
function loadBaseline(filePath) {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return { files: raw.files && typeof raw.files === 'object' ? raw.files : {} };
  } catch {
    return { files: {} };
  }
}

// ---------------------------------------------------------------------------
// Pure: path normalization
// ---------------------------------------------------------------------------

/** Normalize path separators to forward slashes. */
function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

// ---------------------------------------------------------------------------
// Pure: allowlist check
// ---------------------------------------------------------------------------

/**
 * Returns true if `normalizedFile` is in the module's allowlist.
 * Allowlist entry can be an exact file path OR a directory prefix.
 * @param {string} normalizedFile
 * @param {string[]} allowlist
 */
function isAllowlisted(normalizedFile, allowlist) {
  return allowlist.some(a => normalizedFile === a || normalizedFile.startsWith(a));
}

// ---------------------------------------------------------------------------
// Pure: violation counting
// ---------------------------------------------------------------------------

/**
 * Count SSoT violations in file content across all modules.
 * Mirrors bash `count_violations()` logic:
 *   - Per module, scan non-comment lines for pattern matches
 *   - Sum across modules (a line can count for multiple modules)
 *
 * @param {string[]} lines   — file content split by newline
 * @param {string}   file    — normalized file path (for allowlist check)
 * @param {Module[]} modules
 * @returns {number}
 */
function countViolations(lines, file, modules) {
  let total = 0;
  for (const mod of modules) {
    if (!mod.re) continue;
    if (isAllowlisted(file, mod.allowlist)) continue;
    for (const line of lines) {
      if (COMMENT_RE.test(line)) continue;
      if (mod.re.test(line)) total++;
    }
  }
  return total;
}

/**
 * Collect per-line violation details for display (blocked commit output).
 * Returns array of formatted strings: `"        [module] linenum:content"`
 *
 * @param {string[]} lines
 * @param {string}   file    — normalized file path
 * @param {Module[]} modules
 * @returns {string[]}
 */
function collectViolationDetails(lines, file, modules) {
  const out = [];
  for (const mod of modules) {
    if (!mod.re) continue;
    if (isAllowlisted(file, mod.allowlist)) continue;
    lines.forEach((line, idx) => {
      if (COMMENT_RE.test(line)) return;
      if (mod.re.test(line)) out.push(`        [${mod.name}] ${idx + 1}:${line}`);
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pure: check a single file
// ---------------------------------------------------------------------------

/**
 * @typedef {{ kind: 'clean'|'ratchet-down'|'same'|'blocked', file: string,
 *             current: number, baseline: number, details?: string[] }} FileResult
 */

/**
 * Check one file against the ratchet rules.
 * Pure: does not write output or call process.exit().
 *
 * @param {string}   file        — original (possibly Windows) path
 * @param {Module[]} modules
 * @param {Record<string,number>} baselineFiles
 * @param {RegExp|null} exemptRe
 * @returns {FileResult|null}   null = skip (non-TS, exempt, deleted)
 */
function checkFile(file, modules, baselineFiles, exemptRe) {
  if (!fs.existsSync(file))          return null;
  if (!TS_EXT_RE.test(file))         return null;

  const normalized = normalizePath(file);
  if (exemptRe && exemptRe.test(normalized)) return null;

  const lines   = fs.readFileSync(file, 'utf8').split('\n');
  const current = countViolations(lines, normalized, modules);
  const baseline = baselineFiles[normalized] ?? 0;
  const inBaseline = Object.prototype.hasOwnProperty.call(baselineFiles, normalized);

  if (current === 0 && baseline === 0) return { kind: 'clean',        file, current, baseline };
  if (current < baseline)              return { kind: 'ratchet-down', file, current, baseline };
  if (current === baseline)            return { kind: 'same',         file, current, baseline };

  // Increased
  const details = collectViolationDetails(lines, normalized, modules);
  return { kind: 'blocked', file, current, baseline, inBaseline, details };
}

// ---------------------------------------------------------------------------
// Output rendering (side-effectful, isolated for testability)
// ---------------------------------------------------------------------------

/** @param {FileResult[]} results */
function renderOutput(results) {
  const ratchetDown = results.filter(r => r.kind === 'ratchet-down');
  const blocked     = results.filter(r => r.kind === 'blocked');

  if (ratchetDown.length > 0) {
    console.log('');
    console.log(`${GREEN}═══════════════════════════════════════════════════════════════${NC}`);
    console.log(`${GREEN}  🎯 RATCHET DOWN — Progress on SSoT centralization${NC}`);
    console.log(`${GREEN}═══════════════════════════════════════════════════════════════${NC}`);
    for (const r of ratchetDown) {
      const diff = r.baseline - r.current;
      console.log(`${GREEN}  ✅ ${r.file}: ${r.baseline} → ${r.current} (-${diff})${NC}`);
    }
    console.log('');
    console.log(`${CYAN}  Run after commit: npm run ssot:baseline${NC}`);
    console.log(`${CYAN}  (to persist the new lower counts into baseline file)${NC}`);
    console.log('');
  }

  if (blocked.length > 0) {
    console.log('');
    console.log(`${RED}═══════════════════════════════════════════════════════════════${NC}`);
    console.log(`${RED}  🚫 COMMIT BLOCKED — SSoT Ratchet Violation${NC}`);
    console.log(`${RED}  Centralized module bypass detected${NC}`);
    console.log(`${RED}═══════════════════════════════════════════════════════════════${NC}`);
    for (const r of blocked) {
      const diff = r.current - r.baseline;
      if (r.inBaseline) {
        console.log(`${RED}\n  ❌ ${r.file}${NC}`);
        console.log(`${RED}     Baseline: ${r.baseline} → Current: ${r.current} (+${diff} new violation(s))${NC}`);
      } else {
        console.log(`${RED}\n  ❌ ${r.file} (NEW FILE — zero tolerance)${NC}`);
        console.log(`${RED}     Found ${r.current} SSoT violation(s)${NC}`);
      }
      for (const d of (r.details || [])) console.log(`${RED}${d}${NC}`);
    }
    console.log('');
    console.log(`${YELLOW}  Fix: Use the centralized module instead of inline code.${NC}`);
    console.log(`${YELLOW}  Registry: .ssot-registry.json (see module descriptions)${NC}`);
    console.log(`${YELLOW}  Audit: npm run ssot:audit${NC}`);
    console.log('');
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) process.exit(0);

  if (!fs.existsSync(FLAT_FILE)) {
    console.log(`${YELLOW}  ⚠️  SSoT flat registry not found. Run: npm run ssot:baseline${NC}`);
    process.exit(0);
  }
  if (!fs.existsSync(BASELINE_FILE)) {
    console.log(`${YELLOW}  ⚠️  SSoT baseline not found. Run: npm run ssot:baseline${NC}`);
    process.exit(0);
  }

  const { exemptRe, modules } = parseFlatRegistry(fs.readFileSync(FLAT_FILE, 'utf8'));
  const { files: baselineFiles } = loadBaseline(BASELINE_FILE);

  const results = files
    .map(f => checkFile(f, modules, baselineFiles, exemptRe))
    .filter(Boolean);

  renderOutput(results);

  const hasBlock = results.some(r => r.kind === 'blocked');
  process.exit(hasBlock ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Exports (for tests)
// ---------------------------------------------------------------------------
module.exports = {
  parseFlatRegistry,
  loadBaseline,
  normalizePath,
  isAllowlisted,
  countViolations,
  collectViolationDetails,
  checkFile,
  renderOutput,
  FLAT_FILE,
  BASELINE_FILE,
  COMMENT_RE,
  TS_EXT_RE,
};

if (require.main === module) main();
