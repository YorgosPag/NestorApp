#!/usr/bin/env node

const path = require('path');

const {
  LOCALES_DIR,
  SUPPORTED_LOCALES,
  getNamespacesForLocale,
  parseConstArray,
  parseTranslationNamespaceUnion,
  readText,
} = require('./_shared/i18n-governance');

const lazyConfigPath = path.join(__dirname, '..', 'src', 'i18n', 'lazy-config.ts');
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

function main() {
  const errors = [];
  const warnings = [];

  const configuredLanguages = parseConstArray(lazyConfigPath, 'SUPPORTED_LANGUAGES');
  const configuredNamespaces = parseConstArray(lazyConfigPath, 'SUPPORTED_NAMESPACES');
  const primaryNamespaces = getNamespacesForLocale('el');
  const generatedNamespaces = parseTranslationNamespaceUnion(generatedTypesPath);
  const runtimeConfig = readText(runtimeConfigPath);

  const languageDiff = compareSets(SUPPORTED_LOCALES, configuredLanguages);
  if (languageDiff.missing.length > 0 || languageDiff.extra.length > 0) {
    errors.push(
      `SUPPORTED_LANGUAGES drift. Missing: ${languageDiff.missing.join(', ') || '-'} | Extra: ${languageDiff.extra.join(', ') || '-'}`
    );
  }

  const namespaceDiff = compareSets(primaryNamespaces, configuredNamespaces);
  if (namespaceDiff.missing.length > 0 || namespaceDiff.extra.length > 0) {
    errors.push(
      `SUPPORTED_NAMESPACES drift vs ${LOCALES_DIR}\\el. Missing: ${namespaceDiff.missing.join(', ') || '-'} | Extra: ${namespaceDiff.extra.join(', ') || '-'}`
    );
  }

  const generatedDiff = compareSets(primaryNamespaces, generatedNamespaces);
  if (generatedDiff.missing.length > 0 || generatedDiff.extra.length > 0) {
    errors.push(
      `Generated TranslationNamespace drift. Missing: ${generatedDiff.missing.join(', ') || '-'} | Extra: ${generatedDiff.extra.join(', ') || '-'}`
    );
  }

  if (runtimeConfig.includes('pseudo: { common: commonPseudo, landing: landingPseudo, navigation: navigationEl, admin: adminEl }')) {
    errors.push('Runtime config still falls back to non-pseudo preload resources for pseudo language.');
  }

  const requiredPseudoImports = [
    "import navigationPseudo from './locales/pseudo/navigation.json';",
    "import adminPseudo from './locales/pseudo/admin.json';",
  ];

  requiredPseudoImports.forEach((statement) => {
    if (!runtimeConfig.includes(statement)) {
      warnings.push(`Runtime preload import missing: ${statement}`);
    }
  });

  SUPPORTED_LOCALES.forEach((locale) => {
    const namespaces = getNamespacesForLocale(locale);
    const diff = compareSets(primaryNamespaces, namespaces);

    if (diff.missing.length > 0 || diff.extra.length > 0) {
      errors.push(
        `${locale} locale namespace drift. Missing: ${diff.missing.join(', ') || '-'} | Extra: ${diff.extra.join(', ') || '-'}`
      );
    }
  });

  warnings.forEach((message) => printFinding('warn', message));
  errors.forEach((message) => printFinding('error', message));

  if (errors.length > 0) {
    console.log(`i18n config validation failed with ${errors.length} error(s).`);
    process.exit(1);
  }

  console.log('i18n config validation passed.');
}

main();
