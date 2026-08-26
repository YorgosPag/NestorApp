#!/usr/bin/env node
/**
 * CHECK 3.71 — ΠΥΛΗ ΤΩΝ ΔΙΠΛΩΝ ΚΛΕΙΔΙΩΝ LOCALE (ADR-810).
 *
 * «Δηλώνεται κλειδί **δύο φορές στο ίδιο αντικείμενο** ενός locale JSON;»
 *
 * 🔴 **ΤΟ ΤΥΦΛΟ ΣΗΜΕΙΟ ΕΙΝΑΙ ΔΟΜΙΚΟ, ΟΧΙ ΠΑΡΑΛΕΙΨΗ.** Το ECMA-404 επιτρέπει διπλά
 * ονόματα και το `JSON.parse` κρατά σιωπηλά **το τελευταίο**. Κάθε υπάρχουσα πύλη i18n
 * ξεκινά από `JSON.parse` ⇒ βλέπει κόσμο όπου το διπλότυπο **δεν υπήρξε ποτέ**. Το
 * **3.8** ρωτά «λείπει κλειδί;» — και δεν λείπει· απλώς κουβαλά **λάθος τιμή** ή έχει
 * καταπιεί δεκάδες αδέλφια. Το **3.33** παράγει τύπους από το ίδιο τυφλό αποτέλεσμα.
 *
 * 📏 **ΜΕΤΡΗΜΕΝΟ ΠΡΙΝ ΓΡΑΦΤΕΙ Η ΠΥΛΗ**: **16 διπλότυπα / 8 αρχεία / 360 νεκρές
 * μεταφράσεις**. Το χειρότερο, `common.json → audit.fields` (γρ. 767 **και** 1100):
 * **177 ετικέτες πεδίων ανά γλώσσα** δεν έφταναν ποτέ στην οθόνη — ο χρήστης έβλεπε
 * **ωμό όνομα πεδίου** στο ιστορικό αλλαγών. Και το `audit.fields.floor` δηλωνόταν
 * **συμβολοσειρά ΚΑΙ αντικείμενο**, γι' αυτό το `audit-timeline-entry.tsx:281` φέρει
 * σχόλιο «*t() may return objects*» — **άμυνα αντί για θεραπεία**.
 *
 * 🔑 **ZERO-TOLERANCE ΕΠΕΙΔΗ ΜΕΤΡΗΘΗΚΕ**: το ίδιο ρεύμα δουλειάς καθάρισε **16 → 0**
 * με κανόνα «**ένωση κλειδιών, νικά η τελευταία τιμή**» — αναπαράγει ακριβώς τη
 * σημερινή συμπεριφορά του i18next ⇒ **μηδέν οπτική αλλαγή**, μόνο επιστροφή των 358.
 * **Καμία baseline, ΠΟΤΕ**: δεν υπάρχει «λιγότερα διπλά κλειδιά από χθες» — ένα αρκεί
 * για να εξαφανίσει 177 μεταφράσεις χωρίς να σπάσει τίποτα.
 *
 * ⚠️ **ΜΗΝ** «λύσεις» κόκκινο σβήνοντας τη ΔΕΥΤΕΡΗ δήλωση: σήμερα εκείνη **νικά**, άρα
 * η διαγραφή της αλλάζει ό,τι βλέπει ο χρήστης. Συγχώνευσε **μέσα** στη δεύτερη.
 * ⚠️ **ΜΗΝ** επεξεργαστείς locale με `JSON.parse` + `stringify`: χάνεις σιωπηλά τα
 * διπλότυπα (μετρημένο ζωντανά — έτσι βρέθηκε το πρώτο) **και** αναμορφώνεις 25 αρχεία
 * που δεν έχουν τη μορφή του `stringify(…,2)`.
 *
 * CLI:
 *   node scripts/check-locale-duplicate-keys.js
 *   node scripts/check-locale-duplicate-keys.js --report
 *
 * Escape: `SKIP_LOCALE_DUPLICATE_KEYS=1`
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { findDuplicateKeys, dottedName } = require('./lib/i18n/duplicate-keys');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(PROJECT_ROOT, 'src', 'i18n', 'locales');

/** ⚠️ Κλειστό σύνολο, fail-closed: άγνωστη κατάσταση ⇒ `throw` με όνομα. */
const STATES = {
  DUPLICATE: 'duplicate-key',   // ⛔ το ίδιο κλειδί, δύο φορές, ίδιο αντικείμενο
  UNPARSABLE: 'unparsable',     // ⛔ δεν είναι έγκυρο JSON — ΠΟΤΕ «καθαρό»
  UNIQUE: 'unique',             // ✅
};
const BLOCKING = [STATES.DUPLICATE, STATES.UNPARSABLE];

function localeFiles() {
  const out = [];
  let langs;
  try { langs = fs.readdirSync(LOCALES_DIR, { withFileTypes: true }); } catch { return out; }
  for (const lang of langs) {
    if (!lang.isDirectory()) continue;
    const dir = path.join(LOCALES_DIR, lang.name);
    for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) out.push(path.join(dir, f));
  }
  return out.sort();
}

/**
 * Σταδιοποιημένα locale JSON — απόλυτα μονοπάτια.
 *
 * ⚠️ **Η ΣΚΑΝΔΑΛΗ ΕΙΝΑΙ ΕΝΤΙΜΗ ΕΔΩ, ΣΕ ΑΝΤΙΘΕΣΗ ΜΕ ΑΛΛΕΣ ΠΥΛΕΣ**: ένα διπλό κλειδί
 * γεννιέται **μόνο** μέσα στο αρχείο που κάποιος έγραψε — καμία αλλαγή αλλού δεν
 * μπορεί να το δημιουργήσει. Δεν υπάρχει το μονοπάτι «σπάει αρχείο που κανείς δεν
 * σταδιοποίησε» που αναγκάζει το CHECK 3.70 να κλιμακώνεται.
 */
function listStagedLocales() {
  try {
    return require('node:child_process')
      .execSync('git diff --cached --name-only --diff-filter=ACMR', { cwd: PROJECT_ROOT, encoding: 'utf8' })
      .split('\n').map((s) => s.trim()).filter(Boolean)
      .filter((p) => p.startsWith('src/i18n/locales/') && p.endsWith('.json'))
      .map((p) => path.resolve(PROJECT_ROOT, p))
      .filter((p) => fs.existsSync(p));
  } catch { return []; }
}

/** ⚠️ Πλήρης έλεγχος ~2,0s (206 αρχεία)· σταδιοποιημένα ~0,3s. */
function measure(argv = []) {
  const full = argv.includes('--all') || argv.includes('--report');
  const files = full ? localeFiles() : listStagedLocales();
  const tally = Object.fromEntries(Object.values(STATES).map((s) => [s, 0]));
  const violations = [];

  for (const abs of files) {
    const rel = path.relative(PROJECT_ROOT, abs).split(path.sep).join('/');
    let dups;
    try {
      dups = findDuplicateKeys(fs.readFileSync(abs, 'utf8'));
    } catch (e) {
      tally[STATES.UNPARSABLE]++;
      violations.push({ file: rel, state: STATES.UNPARSABLE, detail: e.message });
      continue;
    }
    if (!dups.length) { tally[STATES.UNIQUE]++; continue; }
    tally[STATES.DUPLICATE]++;
    for (const d of dups) {
      violations.push({
        file: rel, state: STATES.DUPLICATE,
        detail: `«${dottedName(d)}» δηλώνεται ${d.lines.length} φορές — γραμμές ${d.lines.join(' + ')}`,
      });
    }
  }

  const counted = Object.values(tally).reduce((a, b) => a + b, 0);
  if (counted !== files.length) {
    throw new Error(`CHECK 3.71 — η λογιστική δεν κλείνει: ${counted} ≠ ${files.length}`);
  }
  return { scope: full ? 'all' : 'staged', files: files.length, tally, violations, blocking: violations };
}

function printReport(m) {
  console.log(`📋 CHECK 3.71 — εμβέλεια: ${m.scope} · αρχεία locale: ${m.files}`);
  // ⚠️ Κάθε κάδος τυπώνεται **ακόμα και στο μηδέν**: ένα «0» που δεν τυπώνεται
  //    διαβάζεται ως «δεν υπάρχει τέτοιος έλεγχος».
  for (const state of Object.values(STATES)) {
    const mark = BLOCKING.includes(state) ? '⛔' : '✅';
    console.log(`   ${mark} ${state.padEnd(16)} ${m.tally[state]}`);
  }
  for (const v of m.violations) console.log(`   ⛔ ${v.file}: ${v.detail}`);
}

/**
 * ⚠️ **ΡΑΦΗ ΕΝΕΣΗΣ**: το δέντρο είναι σήμερα καθαρό, άρα κάθε άγκυρα που καλεί το
 * πραγματικό `measure` βλέπει `0` — και ένα `main()` που **δεν κοιτάζει καθόλου** το
 * αποτέλεσμα θα έβγαινε εξίσου πράσινο (πρότυπο 3.56/3.61/3.70).
 */
function main(argv, measureFn = measure) {
  if (process.env.SKIP_LOCALE_DUPLICATE_KEYS) return 0;
  const m = measureFn(argv);
  if (argv.includes('--report')) { printReport(m); return 0; }
  if (!m.blocking.length) return 0;

  console.error(`\n❌ CHECK 3.71 — ${m.blocking.length} διπλό/ά κλειδί/ιά σε locale:\n`);
  for (const v of m.violations) console.error(`  ⛔ ${v.file}: ${v.detail}`);
  console.error('\n   Το `JSON.parse` κρατά ΣΙΩΠΗΛΑ το τελευταίο — τα υπόλοιπα χάνονται.');
  console.error('   ⚠️ ΣΥΓΧΩΝΕΥΣΕ ΜΕΣΑ ΣΤΗ ΔΕΥΤΕΡΗ δήλωση (εκείνη νικά σήμερα).');
  console.error('   ⚠️ ΜΗΝ επεξεργαστείς locale με JSON.parse+stringify — χάνεις τα διπλότυπα.');
  console.error('   Αναφορά: npm run locale-dup-keys:report');
  return 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { measure, printReport, main, STATES, BLOCKING, PROJECT_ROOT };
