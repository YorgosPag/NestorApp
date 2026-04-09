#!/usr/bin/env node
/**
 * =============================================================================
 * ENTERPRISE: Missing i18n Keys — Pre-commit Check
 * =============================================================================
 * Verifies that all t('key') calls in staged .ts/.tsx files reference keys
 * that actually exist in the corresponding locale JSON file.
 *
 * LOGIC:
 *   1. Find useTranslation('namespace') → determines which JSON to check
 *   2. Find all t('key') / t('key', ...) calls
 *   3. Check if key exists in src/i18n/locales/el/{namespace}.json
 *   4. Report missing keys — BLOCK commit if any found in staged files
 *
 * SKIPS:
 *   - Dynamic keys: t(variable), t(`template`), t(condition ? 'a' : 'b')
 *   - Cross-namespace: t('ns:key') — explicit namespace override (valid)
 *   - Test files, config files, scripts
 *
 * BASELINE: .i18n-missing-keys-baseline.json (ratchet pattern)
 *
 * Usage: node scripts/check-i18n-missing-keys.js file1.tsx file2.ts ...
 * =============================================================================
 */
const fs = require('fs');
const path = require('path');

const LOCALE_DIR = path.join(__dirname, '..', 'src', 'i18n', 'locales', 'el');
const BASELINE_FILE = path.join(__dirname, '..', '.i18n-missing-keys-baseline.json');

// Colors
const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const NC = '\x1b[0m';

// Cache loaded JSON files
const jsonCache = new Map();

function loadLocaleJson(namespace) {
  if (jsonCache.has(namespace)) return jsonCache.get(namespace);
  const filePath = path.join(LOCALE_DIR, `${namespace}.json`);
  if (!fs.existsSync(filePath)) {
    jsonCache.set(namespace, null);
    return null;
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    jsonCache.set(namespace, data);
    return data;
  } catch {
    jsonCache.set(namespace, null);
    return null;
  }
}

/**
 * Check if a dotted key exists in a nested JSON object
 * e.g. 'share.close' → obj.share.close
 */
function keyExists(obj, dottedKey) {
  if (!obj) return false;
  const parts = dottedKey.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return false;
    if (!(part in current)) return false;
    current = current[part];
  }
  return true;
}

/**
 * Extract namespace from useTranslation calls
 * Supports: useTranslation('ns'), useTranslation(['ns1', 'ns2'])
 */
function extractNamespaces(content) {
  const namespaces = [];
  // Single namespace: useTranslation('files')
  const singleMatch = content.matchAll(/useTranslation\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)/g);
  for (const m of singleMatch) {
    namespaces.push(m[1]);
  }
  // Array namespace: useTranslation(['files', 'common'])
  const arrayMatch = content.matchAll(/useTranslation\(\s*\[([^\]]+)\]\s*\)/g);
  for (const m of arrayMatch) {
    const inner = m[1];
    const items = inner.matchAll(/['"]([a-zA-Z0-9_-]+)['"]/g);
    for (const item of items) {
      namespaces.push(item[1]);
    }
  }
  return [...new Set(namespaces)];
}

/**
 * Extract all t('key') calls — only static string keys
 */
function extractTCalls(content) {
  const keys = [];
  // Match t('key') or t('key', ...) — only single-quoted or double-quoted static strings
  const regex = /\bt\(\s*['"]([a-zA-Z0-9_.\-]+)['"]\s*[,)]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const key = match[1];
    // Skip cross-namespace references (ns:key) — these are explicitly scoped
    if (key.includes(':')) continue;
    keys.push({ key, index: match.index });
  }
  return keys;
}

/**
 * Get line number from character index
 */
function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

// Load baseline
let baseline = {};
if (fs.existsSync(BASELINE_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    baseline = data.files || {};
  } catch {
    baseline = {};
  }
}

// Process files
const files = process.argv.slice(2);
let hasBlock = false;
const allMissing = [];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  // Only .ts/.tsx
  if (!/\.(ts|tsx)$/.test(file)) continue;
  // Skip test files, scripts, config
  if (/(__tests__|\.test\.|\.spec\.|\.stories\.|scripts\/|\.config\.)/.test(file)) continue;

  const content = fs.readFileSync(file, 'utf8');
  const namespaces = extractNamespaces(content);

  if (namespaces.length === 0) continue;

  const tCalls = extractTCalls(content);
  if (tCalls.length === 0) continue;

  const missingKeys = [];

  for (const { key, index } of tCalls) {
    // Check in each namespace — if found in ANY, it's valid
    let found = false;
    for (const ns of namespaces) {
      const json = loadLocaleJson(ns);
      if (json && keyExists(json, key)) {
        found = true;
        break;
      }
    }
    if (!found) {
      const line = getLineNumber(content, index);
      missingKeys.push({ key, line });
    }
  }

  if (missingKeys.length === 0) continue;

  const normalizedFile = file.replace(/\\/g, '/');
  const baselineCount = baseline[normalizedFile] || 0;
  const currentCount = missingKeys.length;

  // Ratchet logic
  if (currentCount <= baselineCount) {
    // Same or improved — allow
    if (currentCount < baselineCount) {
      console.log(`${GREEN}  📉 ${normalizedFile}: ${baselineCount} → ${currentCount} (-${baselineCount - currentCount})${NC}`);
    }
    continue;
  }

  // New or increased violations — BLOCK
  hasBlock = true;
  const newCount = currentCount - baselineCount;
  console.log(`${RED}  🚫 ${normalizedFile}: ${newCount} new missing i18n key(s)${NC}`);
  // Show only the new ones (last N)
  const showKeys = missingKeys.slice(-newCount);
  for (const { key, line } of showKeys) {
    const nsNames = namespaces.join(', ');
    console.log(`${YELLOW}     Line ${line}: t('${key}') — not found in [${nsNames}] locale${NC}`);
  }
  allMissing.push({ file: normalizedFile, keys: missingKeys });
}

if (hasBlock) {
  console.log(`${RED}  ❌ Missing i18n keys check FAILED — add keys to locale JSON files${NC}`);
  process.exit(1);
}

console.log(`${GREEN}  ✅ i18n keys: all t() calls have matching locale entries${NC}`);
process.exit(0);
