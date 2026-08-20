#!/usr/bin/env node

const path = require('path');

const {
  LOCALES_DIR,
  SUPPORTED_LOCALES,
  SUPPORTED_LANGUAGES,
  getNamespacesForLocale,
  parseConstArray,
  parseNamespaceLoaders,
  parseTranslationNamespaceUnion,
  readText,
} = require('./_shared/i18n-governance');

const lazyConfigPath = path.join(__dirname, '..', 'src', 'i18n', 'lazy-config.ts');
/**
 * 🔴 **ΤΟ `SUPPORTED_LANGUAGES` ΜΕΤΑΚΟΜΙΣΕ** (ADR-777 §8.29) — και ο έλεγχος έπρεπε
 * να μετακομίσει μαζί του.
 *
 * Ο `parseConstArray` είναι **regex, όχι AST**: διαβάζει τον *ορισμό* μιας σταθεράς
 * μέσα σε **ένα** αρχείο και **δεν ακολουθεί re-export**. Το `lazy-config.ts` πλέον
 * επανεξάγει τη σταθερά αντί να τη δηλώνει, οπότε ο parser έβρισκε **κενό σύνολο**
 * και η πύλη ανέφερε «Missing: el, en, pseudo» — δηλαδή ότι λείπουν **όλες** οι
 * γλώσσες, τη στιγμή που δεν έλειπε καμία.
 *
 * ⚠️ Το `SUPPORTED_NAMESPACES` **δεν** μετακόμισε και εξακολουθεί να δηλώνεται στο
 * `lazy-config.ts` — γι' αυτό τα δύο μονοπάτια είναι ξεχωριστά αντί για ένα.
 */
const languagesPath = path.join(__dirname, '..', 'src', 'i18n', 'languages.ts');
const namespaceLoadersPath = path.join(__dirname, '..', 'src', 'i18n', 'namespace-loaders.ts');
const runtimeConfigPath = path.join(__dirname, '..', 'src', 'i18n', 'config.ts');
const generatedTypesPath = path.join(__dirname, '..', 'src', 'types', 'i18n.ts');

function printFinding(level, message) {
  const prefix = level === 'error' ? 'ERROR' : 'WARN';
  console.log(`[${prefix}] ${message}`);
}

function compareSets(reference, candidate) {
  const referenceSet = new Set(reference);
  const candidateSet = new Set(candidate);

  return {
    missing: reference.filter((entry) => !candidateSet.has(entry)),
    extra: candidate.filter((entry) => !referenceSet.has(entry)),
  };
}

function driftError(label, diff) {
  if (diff.missing.length === 0 && diff.extra.length === 0) {
    return [];
  }

  return [
    `${label}. Missing: ${diff.missing.join(', ') || '-'} | Extra: ${diff.extra.join(', ') || '-'}`,
  ];
}

// ADR-666: το pseudo παράγεται runtime από το el μέσω postProcessor.
// Δεν επιτρέπονται pseudo resource αρχεία ή static imports τους — θα ξανα-τύλιγαν
// ήδη τυλιγμένο κείμενο και θα ξανάφερναν το drift που κατάργησε το ADR-666.
function collectRuntimeConfigErrors(runtimeConfig) {
  const errors = [];

  if (/locales\/pseudo\//.test(runtimeConfig)) {
    errors.push(
      'Runtime config imports pseudo locale files. ADR-666: pseudo is a runtime transform ' +
        '(src/i18n/pseudo-post-processor.ts) — it must have no resource files.'
    );
  }

  if (!runtimeConfig.includes('pseudoPostProcessor')) {
    errors.push('Runtime config no longer registers the pseudo postProcessor (ADR-666).');
  }

  return errors;
}

function collectLocaleParityErrors(primaryNamespaces) {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    driftError(`${locale} locale namespace drift`, compareSets(primaryNamespaces, getNamespacesForLocale(locale)))
  );
}

/**
 * 🔴 ADR-752 — ΤΟ ΕΡΩΤΗΜΑ ΠΟΥ ΔΕΝ ΕΚΑΝΕ ΚΑΝΕΙΣ: **φορτώνεται** το namespace;
 *
 * Έξι namespaces (`textTemplates`, `textSpell`, `textFonts`, `textDraft`, `textAi`,
 * `dxf-viewer-dimensions`) είχαν αρχεία σε el **και** en, καταχωρίσεις στους παραγόμενους τύπους
 * και ~20 αρχεία καταναλωτές — αλλά **κανένα `case` στο `namespace-loaders.ts`**. Το
 * `loadTranslations` έπεφτε στο `default: null`, κατέγραφε **άδειο** bundle, και κάθε `t()`
 * ζωγράφιζε ωμό κλειδί. Το βρήκε άνθρωπος σε στιγμιότυπο οθόνης, όχι πύλη.
 *
 * Τρεις **ρητές** καταστάσεις — καμία σιωπηλή απόρριψη:
 *   - `no-loader`   : αρχείο locale χωρίς `case` ⇒ άδειο bundle, ωμά κλειδιά (το αρχικό σφάλμα).
 *   - `orphan`      : `case` χωρίς αρχείο ⇒ σφάλμα δυναμικής εισαγωγής στον browser.
 *   - `wrong-target`: το `case` δείχνει σε άλλη γλώσσα ή άλλο αρχείο ⇒ σιωπηλά **λάθος** κείμενο,
 *                     που είναι χειρότερο από ωμό κλειδί: μοιάζει σωστό.
 */
function collectLoaderErrors() {
  const loaders = parseNamespaceLoaders(namespaceLoadersPath);

  return SUPPORTED_LOCALES.flatMap((locale) => {
    const entries = loaders[locale] ?? [];
    const declared = entries.map((entry) => entry.namespace);
    const errors = driftError(
      `${locale} namespace loader drift in ${path.basename(namespaceLoadersPath)} ` +
        '(no-loader ⇒ empty bundle ⇒ raw keys on screen — ADR-752)',
      compareSets(getNamespacesForLocale(locale), declared)
    );

    const wrongTarget = entries
      .filter((entry) => entry.dir !== locale || entry.file !== entry.namespace)
      .map((entry) => `${entry.namespace} → ./locales/${entry.dir}/${entry.file}.json`);

    if (wrongTarget.length > 0) {
      errors.push(`${locale} loader points at the wrong file: ${wrongTarget.join(', ')}`);
    }

    return errors;
  });
}

function main() {
  const warnings = [];

  const primaryNamespaces = getNamespacesForLocale('el');
  const errors = [
    // ADR-666: το lazy-config δηλώνει ΓΛΩΣΣΕΣ (incl. pseudo = runtime transform),
    // όχι locales-με-αρχεία. Σύγκριση με SUPPORTED_LANGUAGES, όχι SUPPORTED_LOCALES.
    ...driftError(
      'SUPPORTED_LANGUAGES drift',
      compareSets(SUPPORTED_LANGUAGES, parseConstArray(languagesPath, 'SUPPORTED_LANGUAGES'))
    ),
    ...driftError(
      `SUPPORTED_NAMESPACES drift vs ${LOCALES_DIR}\\el`,
      compareSets(primaryNamespaces, parseConstArray(lazyConfigPath, 'SUPPORTED_NAMESPACES'))
    ),
    ...driftError(
      'Generated TranslationNamespace drift',
      compareSets(primaryNamespaces, parseTranslationNamespaceUnion(generatedTypesPath))
    ),
    ...collectRuntimeConfigErrors(readText(runtimeConfigPath)),
    ...collectLocaleParityErrors(primaryNamespaces),
    ...collectLoaderErrors(),
  ];

  warnings.forEach((message) => printFinding('warn', message));
  errors.forEach((message) => printFinding('error', message));

  if (errors.length > 0) {
    console.log(`i18n config validation failed with ${errors.length} error(s).`);
    process.exit(1);
  }

  console.log('i18n config validation passed.');
}

main();
