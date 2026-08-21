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
const {
  loadNamespaceBundles,
  loadCompatNamespaces,
  withCompatNamespaces,
  extractNamespaces,
  extractTCalls,
  extractExplicitTCalls,
} = require('./lib/i18n-namespace-extract');

const REPO_ROOT = path.join(__dirname, '..');
const LOCALE_DIR = path.join(REPO_ROOT, 'src', 'i18n', 'locales', 'el');
const BASELINE_FILE = path.join(REPO_ROOT, '.i18n-missing-keys-baseline.json');

// Resolve shared namespace bundles (e.g. COMMON_NAMESPACES) once, so
// useTranslation(<CONST>) call sites are checked, not silently skipped.
const NAMESPACE_BUNDLES = loadNamespaceBundles(REPO_ROOT);

// ADR-280 compat splits: the runtime hook loads `declared + splits` and searches
// the key in ALL of them (useTranslation.ts → resolveAllNamespaces /
// resolveAcrossNamespaces). This gate must ask the SAME question, or it reports
// "missing" for keys the app resolves — and the only way to satisfy it would be to
// COPY the keys back into the parent namespace, undoing the ADR-280 split. See
// scripts/lib/i18n-namespace-extract.js → loadCompatNamespaces (ADR-744 §12).
const COMPAT_NAMESPACES = loadCompatNamespaces(REPO_ROOT);

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

// i18next CLDR plural suffixes: a key referenced as t('foo', { count }) is
// defined in the locale JSON as foo_one / foo_other (etc.), NOT as a bare `foo`.
// The static checker must accept such a key as existing when any plural form is
// present — otherwise legitimate pluralized strings read as "missing".
const I18NEXT_PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other', '_plural'];

/**
 * Check if a dotted key exists in a nested JSON object
 * e.g. 'share.close' → obj.share.close
 *
 * Plural-aware: if the final segment is absent as a bare key, the key still
 * counts as existing when a CLDR plural variant (foo_one/foo_other/…) is present.
 */
function keyExists(obj, dottedKey) {
  if (!obj) return false;
  const parts = dottedKey.split('.');
  const last = parts.pop();
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return false;
    if (!(part in current)) return false;
    current = current[part];
  }
  if (current === null || current === undefined || typeof current !== 'object') return false;
  if (last in current) return true;
  return I18NEXT_PLURAL_SUFFIXES.some((sfx) => `${last}${sfx}` in current);
}

// `extractTCalls` moved to ./lib/i18n-namespace-extract (ADR-744) so the
// shell-slice generator can share it instead of cloning it. Behaviour unchanged.

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
/**
 * I KRISI TOU RATCHET, KATA KADO (ADR-777 8.41).
 *
 * Dexetai kai to PALIO sxima (sketos arithmos = epitrepomena SKETA, rita apo miden).
 * Epistrefei kai to `overflow`, dhladi ta kleidia TOU KADOU pou palindromise: to
 * palio `slice(-newCount)` mporouse na onomasei kleidi pou DEN eftaie.
 *
 * @param {Array<{key:string,line:number,bucket:'bare'|'explicit'}>} missingKeys
 * @param {number|{bare:number,explicit:number}} rawBaseline
 */
function judgeAgainstBaseline(missingKeys, rawBaseline) {
  const allow = typeof rawBaseline === 'number'
    ? { bare: rawBaseline, explicit: 0 }
    : { bare: (rawBaseline && rawBaseline.bare) || 0, explicit: (rawBaseline && rawBaseline.explicit) || 0 };
  const of = (b) => missingKeys.filter(k => k.bucket === b);
  const current = { bare: of('bare').length, explicit: of('explicit').length };
  const blocked = current.bare > allow.bare || current.explicit > allow.explicit;
  const overflow = [...of('bare').slice(allow.bare), ...of('explicit').slice(allow.explicit)];
  return { allow, current, blocked, overflow };
}

let hasBlock = false;
const allMissing = [];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  // Only .ts/.tsx
  if (!/\.(ts|tsx)$/.test(file)) continue;
  // Skip test files, scripts, config
  if (/(__tests__|\.test\.|\.spec\.|\.stories\.|scripts\/|\.config\.)/.test(file)) continue;

  const content = fs.readFileSync(file, 'utf8');
  const declaredNamespaces = extractNamespaces(content, NAMESPACE_BUNDLES);

  if (declaredNamespaces.length === 0) continue;

  const namespaces = withCompatNamespaces(declaredNamespaces, COMPAT_NAMESPACES);

  const tCalls = extractTCalls(content);
  const explicitCalls = extractExplicitTCalls(content);
  if (tCalls.length === 0 && explicitCalls.length === 0) continue;

  const missingKeys = [];

  // 🔴 ΤΟ ΡΗΤΟ NAMESPACE ΕΙΝΑΙ ΙΣΧΥΡΙΣΜΟΣ, ΟΧΙ ΑΠΟΔΕΙΞΗ (ADR-777 §8.41).
  // Το `t('ns:key')` δεν ρωτά τα δηλωμένα namespaces — ρωτά **ένα**, αυτό που
  // ονομάζει. Άρα κρίνεται κι αυτό εκεί, και **μόνο** εκεί: το `src/i18n/config.ts`
  // δεν ορίζει `fallbackNS`, οπότε αστοχία σημαίνει **ωμό κλειδί στην οθόνη**.
  // ⚠️ ΧΩΡΙΣ compat: το compat απαντά «ποια namespaces βλέπει ΤΟ ΑΡΧΕΙΟ», ενώ εδώ
  // ο προγραμματιστής έχει ήδη απαντήσει ο ίδιος — και αυτή είναι η απάντηση που
  // κρίνεται.
  for (const { ns, key, index } of explicitCalls) {
    const json = loadLocaleJson(ns);
    if (json && keyExists(json, key)) continue;
    missingKeys.push({ key: `${ns}:${key}`, line: getLineNumber(content, index), bucket: 'explicit' });
  }

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
      missingKeys.push({ key, line, bucket: 'bare' });
    }
  }

  if (missingKeys.length === 0) continue;

  const normalizedFile = file.replace(/\\/g, '/');
  // KEY - DYO KADOI, OXI ENAS ARITHMOS (ADR-777 8.41). Me ena athroisma i **antallagi**
  // perna athoryva: diorthoneis ena sketo kleidi, prostheteis ena rito `ns:key`, to
  // synolo den kounietai - kai to rito ksanaginetai AORATO, dhladi akrivws i vlavi pou
  // afti i epektasi yparxei gia na kleisei (dogma ADR-749: taftotita, oxi plithos).
  // Dexetai kai to PALIO sxima (sketos arithmos): tote o arithmos einai to epitrepomeno
  // ton **sketon**, kai ta rita ksekinoun apo MIDENIKI anoxi.
  const verdict = judgeAgainstBaseline(missingKeys, baseline[normalizedFile] || 0);
  const { allow, current } = verdict;
  const baselineCount = allow.bare + allow.explicit;
  const currentCount = missingKeys.length;

  // Ratchet logic
  if (!verdict.blocked) {
    // Same or improved — allow
    if (currentCount < baselineCount) {
      console.log(`${GREEN}  📉 ${normalizedFile}: ${baselineCount} → ${currentCount} (-${baselineCount - currentCount})${NC}`);
    }
    continue;
  }

  // New or increased violations — BLOCK
  hasBlock = true;
  const newCount = verdict.overflow.length;
  console.log(`${RED}  🚫 ${normalizedFile}: ${newCount} new missing i18n key(s)${NC}`);
  // Show only the new ones (last N)
  // Deixe ta kleidia TOU KADOU pou palindromise - to sketo `slice(-newCount)` edeixne
  // opoiadipote teleftaia, dhladi mporouse na onomasei kleidi pou DEN eftaie.
  const showKeys = verdict.overflow;
  for (const { key, line, bucket } of showKeys) {
    // To rito `ns:key` elegxthike se ENA namespace - afto pou ONOMAZEI. Anafora
    // pou apari8mei ta DILOMENA tha estelne ton anagnosti na psaxei se la8os arxeio.
    const nsNames = bucket === 'explicit' ? key.split(':')[0] : namespaces.join(', ');
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

module.exports = { judgeAgainstBaseline };
