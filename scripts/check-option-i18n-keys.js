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
 * Configuration files such as `VOCAB_SERVICE_CATEGORIES` pass i18n keys
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
const path = require('path');
const { commitInput } = require('./lib/gate-input');
const labels = require('./lib/i18n/config-label-keys');

const { KEY_SHAPE, EL_LOCALE_DIR: LOCALE_DIR, lineOf } = labels;
const BASELINE_FILE = '.option-i18n-keys-baseline.json';

const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const NC = '\x1b[0m';

// ---------------------------------------------------------------------------
// Locale index — load every el/*.json once and flatten to a Set of dotted keys.
// ---------------------------------------------------------------------------
function buildLocaleIndex(input) {
  const localeKeySet = new Set();
  const listing = input.children(LOCALE_DIR);
  if (!listing) return localeKeySet;
  for (const file of listing.files) {
    if (!file.endsWith('.json')) continue;
    try {
      flatten(JSON.parse(input.read(`${LOCALE_DIR}/${file}`)), '', localeKeySet);
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
 * Extract candidate keys from a source file. We look for two common shapes:
 *
 *   1. `label: 'a.b.c'` — the MODAL_SELECT_* option array pattern.
 *   2. `foo: 'a.b.c'` inside a `_LABELS` const — the dropdown-misc-labels pattern (`config-label-keys`).
 *
 * Returns an array of { key, index } entries.
 */
function extractCandidates(content) {
  const out = [];

  // Shape 1: `label: '...'` or `label: "..."`
  const labelRegex = /\blabel\s*:\s*['"]([^'"]+)['"]/g;
  for (const m of content.matchAll(labelRegex)) {
    if (KEY_SHAPE.test(m[1])) out.push({ key: m[1], index: m.index });
  }

  out.push(...labels.labelsBlockCandidates(content));
  return out;
}

/** Οι ορφανές ετικέτες ενός αρχείου: υποψήφιοι που δεν υπάρχουν σε κανένα `el/*.json`. */
function orphansOf(content, localeKeys) {
  return extractCandidates(content)
    .filter(({ key }) => !localeKeys.has(key))
    .map(({ key, index }) => ({ key, line: lineOf(content, index) }));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
/**
 * `files` = τα σταδιοποιημένα. `input` = η είσοδος (ADR-924): με `--index` (εκτελεστής) τα locale, η baseline και τα
 * αρχεία ΤΟΥ COMMIT, όχι του δίσκου.
 */
function run(files, input = commitInput(path.join(__dirname, '..'))) {
  const localeKeys = buildLocaleIndex(input);
  const scanned = labels.scanConfigLabels(files, input, (content) => orphansOf(content, localeKeys));
  const hasBlock = labels.judgeConfigLabels(scanned, input, {
    baselineFile: BASELINE_FILE,
    noun: 'option i18n orphans',
    newNoun: 'new orphan option i18n key(s)',
    describeHit: ({ key }) => `'${key}' — not present in any src/i18n/locales/el/*.json`,
  });

  if (hasBlock) {
    console.log(`${RED}  ❌ Option-label i18n key check FAILED — add keys to locale JSON or remove orphaned labels${NC}`);
    return 1;
  }
  if (scanned.length > 0) {
    console.log(`${GREEN}  ✅ Option i18n keys: all ${scanned.length} config file(s) have resolvable labels${NC}`);
  }
  return 0;
}

if (require.main === module) process.exit(run(process.argv.slice(2).filter((a) => !a.startsWith('--'))));

module.exports = { run, extractCandidates };
