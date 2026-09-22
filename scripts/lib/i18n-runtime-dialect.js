#!/usr/bin/env node
/**
 * 🗣️ **Η ΔΙΑΛΕΚΤΟΣ ΤΟΥ RUNTIME** — τι **ΛΥΝΕΙ** πραγματικά το i18n της εφαρμογής, σε ΕΝΑ σημείο.
 *
 * Ο runtime είναι `i18next` + **`i18next-icu`** (`src/i18n/config.ts`). Εκεί ο πληθυντικός ζει **ΜΕΣΑ** στο κλειδί:
 *
 *   "threads": "{count, plural, one {# αδιάβαστη συνομιλία} other {# αδιάβαστες συνομιλίες}}"
 *
 * 🔴 **Τα επιθήματα CLDR του σκέτου i18next (`foo_one` / `foo_other` …) ΔΕΝ ΛΥΝΟΝΤΑΙ.** Μετρημένο 2026-09-22 με τις
 * εγκατεστημένες εκδόσεις (i18next 25.7.3 · i18next-icu 2.4.1), `t(k, { count: 1 })`:
 *
 *   | στο locale                         | αποτέλεσμα                                                   |
 *   |------------------------------------|--------------------------------------------------------------|
 *   | `k` + `k_one` + `k_other`          | πάντα το `k` ⇒ «1 αδιάβαστες» — λάθος, και **αόρατο**         |
 *   | μόνο `k_one` / `k_other`           | **ωμό κλειδί** στην οθόνη                                    |
 *   | `k` = `{count, plural, …}`         | «1 αδιάβαστη» ✅                                              |
 *
 * Η άγκυρα `scripts/__tests__/i18n-runtime-dialect.test.js` **ΞΑΝΑΜΕΤΡΑ** τον πίνακα με την πραγματική μηχανή: αν
 * αύριο αλλάξει ο runtime, κοκκινίζει εκείνη — όχι κάποιο σχόλιο που κανείς δεν ξαναδιάβασε.
 *
 * ⛔ **ΤΡΙΑ εργαλεία μοντελοποιούσαν το ΛΑΘΟΣ runtime** (ADR-867 changelog 2026-09-22): το CHECK 3.8 δεχόταν το
 * `foo_other` ως «υπαρκτό `foo`» (και έτσι **έσβησε** από τη baseline το ωμό κλειδί του `MissingFontBanner` που είχε
 * σωστά πιάσει), ο γεννήτορας του shell slice κουβαλούσε «αδέλφια» που κανείς δεν διαβάζει, και καμία πύλη δεν ρωτούσε.
 * Όλα διαβάζουν πλέον **αυτό** το αρχείο — ⛔ ΜΗΝ ξαναγράψεις λίστα επιθημάτων αλλού.
 *
 * CLI (CHECK 3.9): `node scripts/lib/i18n-runtime-dialect.js <locale.json …>` ⇒ exit 1 αν κάποιο κλειδί έχει επίθημα.
 */
const fs = require('node:fs');

/** Οι κατηγορίες CLDR που **θα** εκτελούσε το σκέτο i18next — εδώ είναι **νεκρό γράμμα**. */
const CLDR_PLURAL_SUFFIXES = Object.freeze(['_zero', '_one', '_two', '_few', '_many', '_other', '_plural']);

/** Το επίθημα πληθυντικού του κλειδιού, ή `null`. */
function pluralSuffixOf(key) {
  return CLDR_PLURAL_SUFFIXES.find((suffix) => key.length > suffix.length && key.endsWith(suffix)) ?? null;
}

/** Κάθε διαδρομή φύλλου του δέντρου που ο runtime **δεν** θα λύσει ποτέ (κλειδί με επίθημα). */
function findPluralSuffixKeys(tree, prefix = '') {
  if (tree === null || typeof tree !== 'object') return [];
  return Object.entries(tree).flatMap(([key, value]) => {
    const dotted = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object') return findPluralSuffixKeys(value, dotted);
    return pluralSuffixOf(key) === null ? [] : [dotted];
  });
}

/** @returns {{file: string, keys: string[]}[]} μόνο τα αρχεία με παραβάσεις (άκυρο JSON = άλλης πύλης δουλειά). */
function scanLocaleFiles(files) {
  return files.flatMap((file) => {
    let tree;
    try {
      tree = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return [];
    }
    const keys = findPluralSuffixKeys(tree);
    return keys.length === 0 ? [] : [{ file, keys }];
  });
}

function main(files) {
  const violations = scanLocaleFiles(files.filter((file) => /src[\\/]i18n[\\/]locales[\\/].*\.json$/.test(file)));
  for (const { file, keys } of violations) {
    for (const key of keys) console.log(`  🚫 ${file}: "${key}" — επίθημα πληθυντικού, ο runtime (i18next-icu) ΔΕΝ το λύνει`);
  }
  if (violations.length > 0) {
    console.log('  ↳ Γράψε ΕΝΑ κλειδί: "k": "{count, plural, one {# …} other {# …}}" και κάλεσε t(\'k\', { count })');
  }
  return violations.length === 0 ? 0 : 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { CLDR_PLURAL_SUFFIXES, pluralSuffixOf, findPluralSuffixKeys, scanLocaleFiles, main };
