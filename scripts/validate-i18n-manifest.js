#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  getLocaleFiles,
  parseConstArray,
  parseTranslationNamespaceUnion,
} = require('./_shared/i18n-governance');

const root = process.cwd();
const manifestPath = path.join(root, 'src', 'i18n', 'namespace-manifest.json');
const lazyConfigPath = path.join(root, 'src', 'i18n', 'lazy-config.ts');
const generatedTypesPath = path.join(root, 'src', 'types', 'i18n.ts');

function readManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function countLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length;
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
  const manifest = readManifest();
  const manifestNamespaces = manifest.namespaces.map((entry) => entry.namespace).sort();
  const localeNamespaces = getLocaleFiles('el').map((file) => path.basename(file, '.json')).sort();
  const configuredNamespaces = parseConstArray(lazyConfigPath, 'SUPPORTED_NAMESPACES').sort();
  const typedNamespaces = parseTranslationNamespaceUnion(generatedTypesPath).sort();

  const errors = [];
  const warnings = [];

  const requiredFields = manifest.policy.requiredFields;
  for (const entry of manifest.namespaces) {
    for (const field of requiredFields) {
      if (entry[field] === undefined) {
        errors.push(`Manifest entry '${entry.namespace}' missing required field '${field}'.`);
      }
    }
  }

  const manifestVsLocales = compareSets(localeNamespaces, manifestNamespaces);
  if (manifestVsLocales.missing.length > 0 || manifestVsLocales.extra.length > 0) {
    errors.push(`Manifest/locales drift. Missing: ${manifestVsLocales.missing.join(', ') || '-'} | Extra: ${manifestVsLocales.extra.join(', ') || '-'}`);
  }

  const manifestVsConfig = compareSets(manifestNamespaces, configuredNamespaces);
  if (manifestVsConfig.missing.length > 0 || manifestVsConfig.extra.length > 0) {
    errors.push(`Manifest/lazy-config drift. Missing: ${manifestVsConfig.missing.join(', ') || '-'} | Extra: ${manifestVsConfig.extra.join(', ') || '-'}`);
  }

  const manifestVsTypes = compareSets(manifestNamespaces, typedNamespaces);
  if (manifestVsTypes.missing.length > 0 || manifestVsTypes.extra.length > 0) {
    errors.push(`Manifest/generated-types drift. Missing: ${manifestVsTypes.missing.join(', ') || '-'} | Extra: ${manifestVsTypes.extra.join(', ') || '-'}`);
  }

  for (const entry of manifest.namespaces) {
    const localePath = path.join(root, 'src', 'i18n', 'locales', 'el', `${entry.namespace}.json`);
    const actualLines = countLines(localePath);
    if (actualLines > entry.budget.maxLines) {
      const message = `Budget overrun: ${entry.namespace}.json has ${actualLines} lines (budget ${entry.budget.maxLines})`;
      if (entry.budget.warnOnly || manifest.policy.oversizedNamespaceRule === 'warn') {
        warnings.push(message);
      } else {
        errors.push(message);
      }
    }

    if (entry.splitRequired && entry.targetNamespaces.length === 0) {
      errors.push(`Split-required namespace '${entry.namespace}' has no targetNamespaces plan.`);
    }
  }

  warnings.forEach((message) => console.log(`[WARN] ${message}`));
  errors.forEach((message) => console.log(`[ERROR] ${message}`));

  if (errors.length > 0) {
    console.log(`i18n manifest validation failed with ${errors.length} error(s).`);
    process.exit(1);
  }

  console.log(`i18n manifest validation passed with ${warnings.length} warning(s).`);
}

main();
