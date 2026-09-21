#!/usr/bin/env node
/**
 * =============================================================================
 * CHECK 3.11 — Navigation Label Completeness (ADR-871 §10.6 Υ16)
 * =============================================================================
 * «Υπάρχει κάθε `navLabelKey` του καταλόγου της στήλης σε `el` ΚΑΙ `en`;»
 *
 * ΤΙ ΑΛΛΑΞΕ (2026-09-21): μέχρι τότε ο τίτλος **συμπεραινόταν** από το href μέσα από
 * τρία βήματα (href → getLabelKeyForPath → NAVIGATION_LABELS → locale), και αυτός ο
 * έλεγχος υπήρχε για να επαληθεύει ότι η αλυσίδα δεν έσπασε. Πλέον ο τίτλος είναι
 * **δηλωμένος** δίπλα στον προορισμό (`navLabelKey`, στα `src/config/office-navigation/
 * catalog-*.ts`), οπότε η ερώτηση απλοποιείται σε ένα βήμα: κλειδί → locale.
 *
 * Κανένα `t('…')` δεν υπάρχει για αυτά τα κλειδιά (είναι **δεδομένα**), άρα ο
 * `check-i18n-missing-keys.js` (CHECK 3.8) δεν τα βλέπει — αυτός είναι ο δικός τους έλεγχος.
 *
 * 🔴 ΚΑΝΕΝΑ ΤΥΦΛΟ ΣΗΜΕΙΟ: ένα `navLabelKey:` που δεν είναι κυριολεκτικό string **ούτε** σταθερά
 * `const X = '…'` του ίδιου αρχείου **ΜΠΛΟΚΑΡΕΙ** — «δεν μπορώ να το διαβάσω» δεν είναι «καθαρό»
 * (το σχήμα του «0 = κανείς δεν κοίταξε», N.11/N.12). Η εκτελούμενη απόδειξη ζει στο jest
 * `office-navigation-integrity.test.ts`· αυτό είναι το γρήγορο φρένο του hook.
 *
 * EXIT: 0 — όλα τα κλειδιά λύνονται και στις δύο γλώσσες · 1 — τουλάχιστον ένα όχι.
 * Usage: node scripts/check-navigation-labels.js   (πάντα πλήρης σάρωση· αγνοεί ορίσματα)
 * =============================================================================
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CATALOG_DIR = path.join(ROOT, 'src', 'config', 'office-navigation');
const LOCALE = {
  el: path.join(ROOT, 'src', 'i18n', 'locales', 'el', 'navigation.json'),
  en: path.join(ROOT, 'src', 'i18n', 'locales', 'en', 'navigation.json'),
};

const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const CYAN = '\x1b[0;36m';
const NC = '\x1b[0m';

function fail(msg) {
  console.error(`${RED}${msg}${NC}`);
  process.exit(1);
}

function catalogFiles() {
  if (!fs.existsSync(CATALOG_DIR)) fail(`check-navigation-labels: λείπει ο κατάλογος ${CATALOG_DIR}`);
  return fs
    .readdirSync(CATALOG_DIR)
    .filter((name) => /^catalog-.+\.ts$/.test(name))
    .map((name) => path.join(CATALOG_DIR, name));
}

/** `const NAME = 'value'` του αρχείου — οι μόνες μη-κυριολεκτικές τιμές που δεχόμαστε. */
function fileConstants(src) {
  const constants = new Map();
  const re = /const\s+([A-Z_][A-Z0-9_]*)\s*=\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src)) !== null) constants.set(m[1], m[2]);
  return constants;
}

/** Κάθε `navLabelKey:` του αρχείου → κλειδί, ή σημείωση ότι δεν διαβάζεται. */
function extractTitleKeys(file) {
  const src = fs.readFileSync(file, 'utf8');
  const constants = fileConstants(src);
  const found = [];
  const re = /navLabelKey\s*:\s*(?:['"]([^'"]+)['"]|([A-Za-z_$][\w$]*))/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const line = src.slice(0, m.index).split('\n').length;
    if (m[1] !== undefined) found.push({ file, line, key: m[1] });
    else if (constants.has(m[2])) found.push({ file, line, key: constants.get(m[2]) });
    else found.push({ file, line, key: null, raw: m[2] });
  }
  return found;
}

function resolveKey(obj, dottedKey) {
  let cur = obj;
  for (const part of dottedKey.split('.')) {
    if (cur == null || typeof cur !== 'object' || !(part in cur)) return undefined;
    cur = cur[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

function loadLocales() {
  const out = {};
  for (const [lang, file] of Object.entries(LOCALE)) {
    try {
      out[lang] = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      fail(`check-navigation-labels: δεν διαβάζεται το ${file} — ${err.message}`);
    }
  }
  return out;
}

function main() {
  const locales = loadLocales();
  const entries = catalogFiles().flatMap(extractTitleKeys);
  if (entries.length === 0) fail('check-navigation-labels: 0 `navLabelKey` βρέθηκαν — ο έλεγχος δεν κοίταξε τίποτα');

  const violations = [];
  for (const entry of entries) {
    const where = `${path.relative(ROOT, entry.file)}:${entry.line}`;
    if (entry.key === null) {
      violations.push(`${where} — navLabelKey: ${entry.raw} (ούτε κυριολεκτικό ούτε const του αρχείου — δεν επαληθεύεται)`);
      continue;
    }
    const missing = Object.keys(LOCALE).filter((lang) => !resolveKey(locales[lang], entry.key));
    if (missing.length > 0) violations.push(`${where} — "${entry.key}" λείπει από: ${missing.join(', ')}`);
  }

  if (violations.length > 0) {
    console.error(`${RED}❌ CHECK 3.11 — ${violations.length} τίτλος(οι) στήλης χωρίς μετάφραση:${NC}`);
    for (const v of violations) console.error(`   ${CYAN}${v}${NC}`);
    console.error(`${RED}   Πρόσθεσε το κλειδί στο navigation.json σε el ΚΑΙ en (N.11).${NC}`);
    process.exit(1);
  }
  const unique = new Set(entries.map((e) => e.key)).size;
  console.log(`${GREEN}✅ CHECK 3.11 — ${entries.length} τίτλοι (${unique} κλειδιά) λύνονται σε el + en${NC}`);
}

main();
