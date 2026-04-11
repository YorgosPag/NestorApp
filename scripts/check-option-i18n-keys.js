#!/usr/bin/env node
/**
 * =============================================================================
 * ENTERPRISE: Option-label i18n key integrity — Pre-commit Check 3.12
 * =============================================================================
 * Complements scripts/check-i18n-missing-keys.js.
 *
 * Motivation
 * ----------
 * The existing missing-keys check only inspects explicit `t('key')` calls.
 * Configuration files such as `MODAL_SELECT_SERVICE_CATEGORIES` pass i18n keys
 * as string *literals* inside option arrays (`{ value: 'x', label: 'a.b.c' }`).
 * These reach the UI via a renderer that resolves them dynamically. If the
 * rendered namespace chain does not contain the key, the raw dotted string
 * appears in the dropdown — the exact bug that slipped through on 2026-04-11
 * for the service "Κατηγορία" field.
 *
 * What this check does
 * --------------------
 * For every staged file under:
 *   - src/config/**                                  (service-config, etc.)
 *   - src/subapps/**\/config/modal-select/**         (option catalogs)
 *   - src/constants/domains/dropdown-*.ts            (label tables)
 *
 * it extracts every string literal that appears after `label:` or as the value
 * of a `*_LABELS` object entry and looks like a dotted i18n key (matches
 * /^[a-z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+){1,}$/). Each candidate is searched
 * across **all** `src/i18n/locales/el/*.json` files — if no namespace contains
 * the key, it is reported as orphaned.
 *
 * Ratchet semantics
 * -----------------
 *   - Baseline file: `.option-i18n-keys-baseline.json`
 *   - Counts can only decrease per-file.
 *   - New files start at zero tolerance.
 *   - `npm run option-keys:baseline` refreshes after a legitimate cleanup.
 *
 * Skipped
 * -------
 *   - test files, stories, scripts, markdown
 *   - non-TS/TSX files
 *
 * Usage: node scripts/check-option-i18n-keys.js file1.ts file2.ts ...
 * =============================================================================
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const LOCALE_DIR = path.join(REPO_ROOT, 'src', 'i18n', 'locales', 'el');
const BASELINE_FILE = path.join(REPO_ROOT, '.option-i18n-keys-baseline.json');

const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const NC = '\x1b[0m';

// ---------------------------------------------------------------------------
// Locale index — load every el/*.json once and flatten to a Set of dotted keys.
// ---------------------------------------------------------------------------
let localeKeySet = null;

function buildLocaleIndex() {
  if (localeKeySet) return localeKeySet;
  localeKeySet = new Set();
  if (!fs.existsSync(LOCALE_DIR)) return localeKeySet;
  for (const file of fs.readdirSync(LOCALE_DIR)) {
    if (!file.endsWith('.json')) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(LOCALE_DIR, file), 'utf8'));
      flatten(data, '', localeKeySet);
    } catch {
      // corrupt JSON — ignored here, other checks will catch it
    }
  }
  return localeKeySet;
}

function flatten(obj, prefix, sink) {
  if (obj === null || typeof obj !== 'object') return;
  for (const k of Object.keys(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, key, sink);
    } else {
      sink.add(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Candidate extraction — find i18n key literals in option/label configurations.
// ---------------------------------------------------------------------------
/**
 * A string qualifies as a candidate i18n key when it has at least one dot
 * and looks like a dotted identifier (ASCII letters, digits, underscores).
 * This deliberately filters out URLs, file paths, regex fragments, etc.
 */
const KEY_SHAPE = /^[a-z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+){1,}$/;

/**
 * Extract candidate keys from a source file. We look for two common shapes:
 *
 *   1. `label: 'a.b.c'` — the MODAL_SELECT_* option array pattern.
 *   2. `foo: 'a.b.c'` inside a `_LABELS` const — the dropdown-misc-labels pattern.
 *
 * Returns an array of { key, line } entries.
 */
function extractCandidates(content) {
  const out = [];

  // Shape 1: `label: '...'` or `label: "..."`
  const labelRegex = /\blabel\s*:\s*['"]([^'"]+)['"]/g;
  for (const m of content.matchAll(labelRegex)) {
    const value = m[1];
    if (KEY_SHAPE.test(value)) {
      out.push({ key: value, index: m.index });
    }
  }

  // Shape 2: values inside *_LABELS const objects — only scan inside such blocks.
  // We use a coarse lexical window: from `export const FOO_LABELS = {` up to the
  // matching closing `}`. Good enough for constants files.
  const labelsBlockRegex = /export\s+const\s+[A-Z][A-Z0-9_]*_LABELS\s*=\s*\{([\s\S]*?)\n\}\s*as\s+const;?/g;
  for (const block of content.matchAll(labelsBlockRegex)) {
    const body = block[1];
    const baseIndex = block.index + block[0].indexOf(body);
    const entryRegex = /['"]([^'"]+)['"]\s*,?/g;
    for (const m of body.matchAll(entryRegex)) {
      const value = m[1];
      if (KEY_SHAPE.test(value)) {
        out.push({ key: value, index: baseIndex + m.index });
      }
    }
  }

  return out;
}

function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

/**
 * Files this check cares about. Everything else is skipped fast.
 */
function isInScope(file) {
  const norm = normalizePath(file);
  if (!/\.(ts|tsx)$/.test(norm)) return false;
  if (/(__tests__|\.test\.|\.spec\.|\.stories\.|\.d\.ts$)/.test(norm)) return false;
  if (norm.startsWith('scripts/')) return false;
  return (
    norm.startsWith('src/config/') ||
    /src\/subapps\/[^/]+\/config\/modal-select(\/|\.)/.test(norm) ||
    /src\/constants\/domains\/dropdown-[a-z-]+\.ts$/.test(norm)
  );
}

// ---------------------------------------------------------------------------
// Baseline handling
// ---------------------------------------------------------------------------
let baseline = { files: {} };
if (fs.existsSync(BASELINE_FILE)) {
  try {
    baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    if (!baseline.files) baseline.files = {};
  } catch {
    baseline = { files: {} };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const files = process.argv.slice(2);
const localeKeys = buildLocaleIndex();
let hasBlock = false;
let totalChecked = 0;

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  if (!isInScope(file)) continue;
  totalChecked += 1;

  const content = fs.readFileSync(file, 'utf8');
  const candidates = extractCandidates(content);
  if (candidates.length === 0) continue;

  const orphans = [];
  for (const { key, index } of candidates) {
    if (!localeKeys.has(key)) {
      orphans.push({ key, line: getLineNumber(content, index) });
    }
  }

  if (orphans.length === 0) continue;

  const normFile = normalizePath(file);
  const baselineCount = baseline.files[normFile] || 0;
  const currentCount = orphans.length;

  if (currentCount <= baselineCount) {
    if (currentCount < baselineCount) {
      console.log(`${GREEN}  📉 ${normFile}: ${baselineCount} → ${currentCount} (-${baselineCount - currentCount}) option i18n orphans${NC}`);
    }
    continue;
  }

  hasBlock = true;
  const newCount = currentCount - baselineCount;
  console.log(`${RED}  🚫 ${normFile}: ${newCount} new orphan option i18n key(s)${NC}`);
  const showKeys = orphans.slice(-newCount);
  for (const { key, line } of showKeys) {
    console.log(`${YELLOW}     Line ${line}: '${key}' — not present in any src/i18n/locales/el/*.json${NC}`);
  }
}

if (hasBlock) {
  console.log(`${RED}  ❌ Option-label i18n key check FAILED — add keys to locale JSON or remove orphaned labels${NC}`);
  process.exit(1);
}

if (totalChecked > 0) {
  console.log(`${GREEN}  ✅ Option i18n keys: all ${totalChecked} config file(s) have resolvable labels${NC}`);
}
process.exit(0);
