#!/usr/bin/env node
/**
 * Generate missing i18n keys baseline (ratchet pattern)
 * Scans all .ts/.tsx files in src/ for t('key') calls with missing locale entries
 */
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
const LOCALE_DIR = path.join(SRC_DIR, 'i18n', 'locales', 'el');
const BASELINE_FILE = path.join(__dirname, '..', '.i18n-missing-keys-baseline.json');

const jsonCache = new Map();

function loadLocaleJson(namespace) {
  if (jsonCache.has(namespace)) return jsonCache.get(namespace);
  const filePath = path.join(LOCALE_DIR, `${namespace}.json`);
  if (!fs.existsSync(filePath)) { jsonCache.set(namespace, null); return null; }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    jsonCache.set(namespace, data);
    return data;
  } catch { jsonCache.set(namespace, null); return null; }
}

function keyExists(obj, dottedKey) {
  if (!obj) return false;
  const parts = dottedKey.split('.');
  let current = obj;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !(part in current)) return false;
    current = current[part];
  }
  return true;
}

function extractNamespaces(content) {
  const namespaces = [];
  for (const m of content.matchAll(/useTranslation\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)/g)) {
    namespaces.push(m[1]);
  }
  for (const m of content.matchAll(/useTranslation\(\s*\[([^\]]+)\]\s*\)/g)) {
    for (const item of m[1].matchAll(/['"]([a-zA-Z0-9_-]+)['"]/g)) {
      namespaces.push(item[1]);
    }
  }
  return [...new Set(namespaces)];
}

function extractTCalls(content) {
  const keys = [];
  const regex = /\bt\(\s*['"]([a-zA-Z0-9_.\-]+)['"]\s*[,)]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (!match[1].includes(':')) keys.push(match[1]);
  }
  return keys;
}

// Recursively find all .ts/.tsx files
function findFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', 'dist', '__tests__'].includes(entry.name)) continue;
      results.push(...findFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec|stories|config)\./i.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = findFiles(SRC_DIR);
const violations = {};
let total = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const namespaces = extractNamespaces(content);
  if (namespaces.length === 0) continue;

  const tCalls = extractTCalls(content);
  if (tCalls.length === 0) continue;

  let missing = 0;
  for (const key of tCalls) {
    let found = false;
    for (const ns of namespaces) {
      const json = loadLocaleJson(ns);
      if (json && keyExists(json, key)) { found = true; break; }
    }
    if (!found) missing++;
  }

  if (missing > 0) {
    const relPath = path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/');
    violations[relPath] = missing;
    total += missing;
  }
}

const baseline = {
  _meta: {
    description: 'Missing i18n keys baseline — t() calls without matching locale entry',
    generated: new Date().toISOString().replace(/\.\d+Z/, 'Z'),
    totalViolations: total,
    totalFiles: Object.keys(violations).length,
    rule: 'Counts can only decrease. New files = zero tolerance.'
  },
  files: violations
};

fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2) + '\n');
console.log(`i18n keys baseline: ${total} missing keys in ${Object.keys(violations).length} files`);

// Show top offenders
const sorted = Object.entries(violations).sort((a, b) => b[1] - a[1]);
if (sorted.length > 0) {
  console.log('\nTop offenders:');
  for (const [file, count] of sorted.slice(0, 15)) {
    console.log(`  ${count} missing — ${file}`);
  }
}
