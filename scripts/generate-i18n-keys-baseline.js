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
const { collectMissingKeys, judgeAgainstBaseline } = require('./lib/i18n-missing-keys-ratchet');

const REPO_ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(REPO_ROOT, 'src');
const LOCALE_DIR = path.join(SRC_DIR, 'i18n', 'locales', 'el');
const BASELINE_FILE = path.join(REPO_ROOT, '.i18n-missing-keys-baseline.json');

// Resolve shared namespace bundles (e.g. COMMON_NAMESPACES) once, so
// useTranslation(<CONST>) call sites are scanned, not silently skipped.
const NAMESPACE_BUNDLES = loadNamespaceBundles(REPO_ROOT);
const COMPAT_NAMESPACES = loadCompatNamespaces(REPO_ROOT);

// MIA MHXANH: i idia synartisi metraei kai gia tin pyli kai gia ti baseline.
const DEPS = {
  bundles: NAMESPACE_BUNDLES,
  compat: COMPAT_NAMESPACES,
  loadLocale: (ns) => loadLocaleJson(ns),
  extractNamespaces,
  extractTCalls,
  extractExplicitTCalls,
  withCompatNamespaces,
  keyExists,
};

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
  const found = collectMissingKeys(content, DEPS);
  if (!found) continue;
  const missing = found.missingKeys.filter(k => k.bucket === 'bare').length;
  const missingExplicit = found.missingKeys.filter(k => k.bucket === 'explicit').length;

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

// ── LAYER 2 (--check): to IDIO perasma, alla KRINEI anti na grafei ───────────
//
// GIATI YPARXEI. Mexri 2026-08-21 i CHECK 3.8 eixe MONO Layer 1 (staged arxeia).
// To i18n-governance.yml to eixe grammeno os aitiologia: «do not support a
// repo-wide --all mode ... would be a no-op, so they are intentionally omitted».
// Omos o PLIRIS sarwtis ITAN IDI EDW - aplws EGRAFE anti na KRINEI. Synepeia:
// kamia paraviasi se arxeio pou kaneis den stage-arei den fanike POTE, kai i
// baseline emeine mpagiatiki 3 mines (11/4 enanti 25/8 pragmatikon).
if (process.argv.includes('--check')) {
  const committed = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')).files || {};
  const offenders = [];
  const healed = [];
  const seen = new Set();
  for (const [file, v] of Object.entries(violations)) {
    seen.add(file);
    const fake = [
      ...Array.from({ length: v.bare }, () => ({ bucket: 'bare' })),
      ...Array.from({ length: v.explicit }, () => ({ bucket: 'explicit' })),
    ];
    const verdict = judgeAgainstBaseline(fake, committed[file] || 0);
    if (verdict.blocked) offenders.push({ file, allow: verdict.allow, current: verdict.current });
    else if (verdict.current.bare + verdict.current.explicit < verdict.allow.bare + verdict.allow.explicit) healed.push(file);
  }
  // Arxeio pou EFYGE apo ta violations alla yparxei sti baseline = therapeftike.
  for (const file of Object.keys(committed)) if (!seen.has(file)) healed.push(file);

  for (const h of healed) console.log('  [DOWN] ' + h + ' - therapeftike, i baseline mporei na sfixei');
  if (offenders.length === 0) {
    console.log('  [OK] CHECK 3.8 Layer 2: kamia paravasi pano apo ti baseline se olo to src/');
    process.exit(0);
  }
  for (const o of offenders) {
    console.log('  [BLOCK] ' + o.file + ': bare ' + o.current.bare + '/' + o.allow.bare
      + ' | explicit ' + o.current.explicit + '/' + o.allow.explicit);
  }
  console.log('  Diorthosi: prosthese ta kleidia sta locale JSON, i tekmiriose me `npm run i18n:keys-baseline`.');
  process.exit(1);
}

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
