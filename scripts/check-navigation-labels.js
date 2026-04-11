#!/usr/bin/env node
/**
 * =============================================================================
 * ENTERPRISE: Navigation Label Completeness — Pre-commit Check
 * =============================================================================
 * Verifies that EVERY `href` in `src/config/smart-navigation-factory.ts`
 * has a complete translation chain:
 *
 *   href ('/admin/audit-log')
 *     → getLabelKeyForPath() → 'audit_log'
 *     → NAVIGATION_LABELS[]   → 'admin.auditLog'
 *     → exists in el/navigation.json AND en/navigation.json
 *
 * If ANY link in the chain is missing, the sidebar item silently falls back
 * to displaying its raw `href` (e.g. "/admin/audit-log") — which is exactly
 * the bug that motivated this check (ADR-195 Phase 7 / sidebar regression).
 *
 * No `t()` call exists for these labels (the factory stores i18n keys as
 * plain strings inside maps), so `check-i18n-missing-keys.js` cannot see
 * the link. This script is the dedicated completeness check.
 *
 * EXIT CODES:
 *   0 — all hrefs resolve to valid translations in BOTH locales
 *   1 — at least one href has a broken chain → BLOCK commit
 *
 * Usage:
 *   node scripts/check-navigation-labels.js              # full sweep
 *   node scripts/check-navigation-labels.js <files...>   # ignored (always full)
 * =============================================================================
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FACTORY_FILE = path.join(ROOT, 'src', 'config', 'smart-navigation-factory.ts');
const LOCALE_EL = path.join(ROOT, 'src', 'i18n', 'locales', 'el', 'navigation.json');
const LOCALE_EN = path.join(ROOT, 'src', 'i18n', 'locales', 'en', 'navigation.json');

const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const CYAN = '\x1b[0;36m';
const NC = '\x1b[0m';

function fail(msg) {
  console.error(`${RED}${msg}${NC}`);
  process.exit(1);
}

if (!fs.existsSync(FACTORY_FILE)) {
  // Factory file is optional — if it does not exist, the check is a no-op.
  process.exit(0);
}

const source = fs.readFileSync(FACTORY_FILE, 'utf8');

// ---------------------------------------------------------------------------
// 1. Extract NAVIGATION_LABELS keys
// ---------------------------------------------------------------------------
function extractNavigationLabels(src) {
  const start = src.indexOf('const NAVIGATION_LABELS');
  if (start === -1) fail('check-navigation-labels: could not locate NAVIGATION_LABELS in factory file');
  const braceStart = src.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) fail('check-navigation-labels: could not parse NAVIGATION_LABELS body');
  const body = src.slice(braceStart + 1, end);
  const labels = {};
  // Match `  key: 'value',` and `  'key': 'value',`
  const re = /(?:^|\n)\s*['"]?([a-zA-Z0-9_]+)['"]?\s*:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    labels[m[1]] = m[2];
  }
  return labels;
}

// ---------------------------------------------------------------------------
// 2. Extract getLabelKeyForPath() pathMappings
// ---------------------------------------------------------------------------
function extractPathMappings(src) {
  const fnIdx = src.indexOf('function getLabelKeyForPath');
  if (fnIdx === -1) fail('check-navigation-labels: could not locate getLabelKeyForPath()');
  const mapStart = src.indexOf('pathMappings', fnIdx);
  if (mapStart === -1) fail('check-navigation-labels: could not locate pathMappings');
  const braceStart = src.indexOf('{', mapStart);
  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) fail('check-navigation-labels: could not parse pathMappings body');
  const body = src.slice(braceStart + 1, end);
  const map = {};
  const re = /(?:^|\n)\s*['"]([^'"]*)['"]\s*:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    map[m[1]] = m[2];
  }
  return map;
}

// ---------------------------------------------------------------------------
// 3. Extract every href: '...' literal
// ---------------------------------------------------------------------------
function extractHrefs(src) {
  const hrefs = new Set();
  const re = /href\s*:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const href = m[1];
    // Skip dynamic/external links
    if (href.startsWith('http')) continue;
    if (href.includes('${')) continue;
    hrefs.add(href);
  }
  return Array.from(hrefs).sort();
}

// ---------------------------------------------------------------------------
// 4. Resolve a dotted i18n key inside a nested JSON object
// ---------------------------------------------------------------------------
function resolveKey(obj, dottedKey) {
  const parts = dottedKey.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object' || !(p in cur)) return undefined;
    cur = cur[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const labels = extractNavigationLabels(source);
const pathMappings = extractPathMappings(source);
const hrefs = extractHrefs(source);

if (!fs.existsSync(LOCALE_EL) || !fs.existsSync(LOCALE_EN)) {
  fail(`check-navigation-labels: locale files missing (${LOCALE_EL} / ${LOCALE_EN})`);
}

let elJson, enJson;
try {
  elJson = JSON.parse(fs.readFileSync(LOCALE_EL, 'utf8'));
  enJson = JSON.parse(fs.readFileSync(LOCALE_EN, 'utf8'));
} catch (err) {
  fail(`check-navigation-labels: failed to parse locale JSON — ${err.message}`);
}

const violations = [];

for (const href of hrefs) {
  // Mirror the runtime logic in createNavigationConfig():
  //   const labelKey = itemConfig.href.replace('/', '') || 'home';
  //   const titleKey = getLabelKeyForPath(labelKey);
  //   const title    = labels[titleKey];
  const pathKey = href.replace('/', '') || 'home';
  const labelKey = pathMappings[pathKey] || pathKey;
  const i18nKey = labels[labelKey];

  if (!i18nKey) {
    violations.push({
      href,
      stage: 'NAVIGATION_LABELS',
      detail: `pathKey "${pathKey}" → labelKey "${labelKey}" — no entry in NAVIGATION_LABELS`,
      fix: `Add  ${labelKey}: 'navigation.path.here',  to NAVIGATION_LABELS in smart-navigation-factory.ts`,
    });
    continue;
  }

  const elValue = resolveKey(elJson, i18nKey);
  const enValue = resolveKey(enJson, i18nKey);

  if (!elValue || !enValue) {
    const missingIn = [];
    if (!elValue) missingIn.push('el');
    if (!enValue) missingIn.push('en');
    violations.push({
      href,
      stage: 'locale-json',
      detail: `i18n key "${i18nKey}" missing in: ${missingIn.join(', ')}/navigation.json`,
      fix: `Add the key "${i18nKey}" to src/i18n/locales/{${missingIn.join(',')}}/navigation.json`,
    });
  }
}

if (violations.length === 0) {
  console.log(`${GREEN}  ✅ Navigation labels: all ${hrefs.length} hrefs resolve to valid translations${NC}`);
  process.exit(0);
}

console.error('');
console.error(`${RED}❌ Navigation label completeness check FAILED${NC}`);
console.error(`${RED}   ${violations.length} broken translation chain(s) in src/config/smart-navigation-factory.ts${NC}`);
console.error('');
console.error(`${YELLOW}WHY THIS MATTERS:${NC}`);
console.error(`  Each sidebar item's title is resolved through:`);
console.error(`    href → pathMappings → NAVIGATION_LABELS → navigation.json (el + en)`);
console.error(`  If any link is missing, the sidebar silently displays the raw URL.`);
console.error('');

for (const v of violations) {
  console.error(`${CYAN}  • href: ${v.href}${NC}`);
  console.error(`      stage : ${v.stage}`);
  console.error(`      reason: ${v.detail}`);
  console.error(`      fix   : ${v.fix}`);
  console.error('');
}

console.error(`${YELLOW}Reference: CLAUDE.md SOS. N.11 (i18n SSoT) — fix BEFORE commit${NC}`);
process.exit(1);
