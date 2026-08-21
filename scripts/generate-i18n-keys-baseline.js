#!/usr/bin/env node
/**
 * Generate missing i18n keys baseline (ratchet pattern)
 * Scans all .ts/.tsx files in src/ for t('key') calls with missing locale entries
 *
 * 🔴 ΜΙΑ ΜΗΧΑΝΗ, ΜΙΑ ΑΠΑΝΤΗΣΗ (ADR-777 §8.41 · δόγμα ADR-749). Μέχρι τις 2026-08-21
 * αυτό το αρχείο ήταν **δεύτερη υλοποίηση** της ερώτησης που κρίνει η CHECK 3.8:
 * είχε **δικό του** `extractTCalls` και **δεν** εφάρμοζε `withCompatNamespaces`.
 * Μετρημένη απόκλιση στο ΙΔΙΟ δέντρο, την ίδια μέρα: **114** κλειδιά σε 7 αρχεία
 * (διάλεκτος γεννήτορα) έναντι **6** σε 2 (διάλεκτος πύλης) — τα 108 λύνονται όλα
 * μέσω compat, που είναι **πραγματική** συμπεριφορά χρόνου εκτέλεσης
 * (`useTranslation.ts` -> `getCompatNamespaces`).
 *
 * ⚠️ Η ΣΥΝΕΠΕΙΑ ΗΤΑΝ ΧΑΛΑΡΩΣΗ, ΟΧΙ ΑΠΛΩΣ ΘΟΡΥΒΟΣ: το ratchet συνέκρινε
 * `τρέχον(μηχανή πύλης)` με `baseline(μηχανή γεννήτορα)` — φουσκωμένη — άρα ένα
 * αρχείο με compat μπορούσε να **κερδίσει** παραβιάσεις και να περάσει.
 */
const fs = require('fs');
const path = require('path');
const {
  loadNamespaceBundles,
  loadCompatNamespaces,
  withCompatNamespaces,
  extractNamespaces,
  extractTCalls,
  extractExplicitTCalls,
} = require('./lib/i18n-namespace-extract');

const REPO_ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(REPO_ROOT, 'src');
const LOCALE_DIR = path.join(SRC_DIR, 'i18n', 'locales', 'el');
const BASELINE_FILE = path.join(REPO_ROOT, '.i18n-missing-keys-baseline.json');

// Resolve shared namespace bundles (e.g. COMMON_NAMESPACES) once, so
// useTranslation(<CONST>) call sites are scanned, not silently skipped.
const NAMESPACE_BUNDLES = loadNamespaceBundles(REPO_ROOT);
const COMPAT_NAMESPACES = loadCompatNamespaces(REPO_ROOT);

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
  const declared = extractNamespaces(content, NAMESPACE_BUNDLES);
  if (declared.length === 0) continue;
  const namespaces = withCompatNamespaces(declared, COMPAT_NAMESPACES);

  const tCalls = extractTCalls(content);
  const explicitCalls = extractExplicitTCalls(content);
  if (tCalls.length === 0 && explicitCalls.length === 0) continue;

  let missing = 0;
  let missingExplicit = 0;
  // Το ρητό `t('ns:key')` κρίνεται στο namespace που ΟΝΟΜΑΖΕΙ — ό,τι ακριβώς κάνει
  // και η πύλη· χωρίς compat, γιατί ο προγραμματιστής έχει ήδη απαντήσει ο ίδιος.
  for (const { ns, key } of explicitCalls) {
    const json = loadLocaleJson(ns);
    if (!(json && keyExists(json, key))) missingExplicit++;
  }
  for (const { key } of tCalls) {
    let found = false;
    for (const ns of namespaces) {
      const json = loadLocaleJson(ns);
      if (json && keyExists(json, key)) { found = true; break; }
    }
    if (!found) missing++;
  }

  if (missing > 0 || missingExplicit > 0) {
    const relPath = path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/');
    // Sxima v2 - DYO KADOI. Enas arithmos tha epetrepe tin **antallagi** (diorthosi
    // enos sketou + prosthiki enos ritou = idio synolo), pou einai akrivws o tropos
    // me ton opoio ta rita eixan meinei AORATA (ADR-777 8.41 / dogma ADR-749).
    violations[relPath] = { bare: missing, explicit: missingExplicit };
    total += missing + missingExplicit;
  }
}

const baseline = {
  _meta: {
    description: 'Missing i18n keys baseline — t() calls without matching locale entry',
    generated: new Date().toISOString().replace(/\.\d+Z/, 'Z'),
    totalViolations: total,
    totalFiles: Object.keys(violations).length,
    rule: 'Counts can only decrease, PER BUCKET. New files = zero tolerance.'
  },
  files: violations
};

fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2) + '\n');
console.log(`i18n keys baseline: ${total} missing keys in ${Object.keys(violations).length} files`);

// Show top offenders
const sum = (v) => v.bare + v.explicit;
const sorted = Object.entries(violations).sort((a, b) => sum(b[1]) - sum(a[1]));
if (sorted.length > 0) {
  console.log('\nTop offenders (bare = sketo kleidi | explicit = rito ns:key):');
  for (const [file, v] of sorted.slice(0, 15)) {
    console.log(`  ${String(sum(v)).padStart(3)} missing (bare ${v.bare} | explicit ${v.explicit}) — ${file}`);
  }
}
