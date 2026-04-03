#!/usr/bin/env node

/**
 * i18n Translation Validation Script
 *
 * Validates locale directory presence, namespace parity and schema parity.
 */

const path = require('path');
const {
  LOCALES_DIR,
  PRIMARY_LOCALE,
  SUPPORTED_LOCALES,
  compareSchemas,
  getLocaleFiles,
  readJson,
} = require('./_shared/i18n-governance');

const fs = require('fs');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color] || colors.reset}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`OK ${message}`, 'green');
}

function logError(message) {
  log(`ERROR ${message}`, 'red');
}

function logWarning(message) {
  log(`WARN ${message}`, 'yellow');
}

function logInfo(message) {
  log(`INFO ${message}`, 'cyan');
}

function validateDirectoryStructure() {
  logInfo('Validating i18n directory structure...');

  if (!fs.existsSync(LOCALES_DIR)) {
    logWarning(`i18n directory not found at: ${LOCALES_DIR}`);
    return false;
  }

  let allLocalesExist = true;

  SUPPORTED_LOCALES.forEach((locale) => {
    const localePath = path.join(LOCALES_DIR, locale);
    if (!fs.existsSync(localePath)) {
      logError(`Locale directory missing: ${localePath}`);
      allLocalesExist = false;
    } else {
      logSuccess(`Locale directory exists: ${locale}`);
    }
  });

  return allLocalesExist;
}

function getTranslationFiles(locale) {
  return getLocaleFiles(locale).map((file) => path.join(LOCALES_DIR, locale, file));
}

function loadTranslationFile(filePath) {
  try {
    return { success: true, data: readJson(filePath) };
  } catch (error) {
    logError(`Invalid JSON in ${filePath}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function getAllKeys(obj, prefix = '') {
  let keys = [];

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        keys = keys.concat(getAllKeys(obj[key], fullKey));
      } else {
        keys.push(fullKey);
      }
    }
  }

  return keys;
}

function validateTranslationCompleteness() {
  logInfo('Validating translation completeness...');

  const localeData = {};
  let hasErrors = false;
  const primaryFiles = getLocaleFiles(PRIMARY_LOCALE);

  SUPPORTED_LOCALES.forEach((locale) => {
    const files = getTranslationFiles(locale);
    localeData[locale] = {};

    files.forEach((filePath) => {
      const fileName = path.basename(filePath, '.json');
      const result = loadTranslationFile(filePath);
      if (result.success) {
        localeData[locale][fileName] = result.data;
      } else {
        hasErrors = true;
      }
    });
  });

  SUPPORTED_LOCALES.forEach((locale) => {
    const localeFiles = getLocaleFiles(locale);
    const missingFiles = primaryFiles.filter((file) => !localeFiles.includes(file));
    const extraFiles = localeFiles.filter((file) => !primaryFiles.includes(file));

    if (missingFiles.length > 0) {
      hasErrors = true;
      logError(`Missing namespace files in ${locale}: ${missingFiles.join(', ')}`);
    }

    if (extraFiles.length > 0) {
      hasErrors = true;
      logError(`Unexpected namespace files in ${locale}: ${extraFiles.join(', ')}`);
    }
  });

  const primaryData = localeData[PRIMARY_LOCALE] || {};

  SUPPORTED_LOCALES.forEach((locale) => {
    if (locale === PRIMARY_LOCALE) {
      return;
    }

    const currentData = localeData[locale] || {};

    Object.keys(primaryData).forEach((fileName) => {
      const comparison = compareSchemas(primaryData[fileName] || {}, currentData[fileName] || {});

      if (comparison.missing.length > 0) {
        hasErrors = true;
        logWarning(`Missing keys in ${locale}/${fileName}.json:`);
        comparison.missing.forEach((key) => log(`  - ${key}`, 'yellow'));
      }

      if (comparison.extra.length > 0) {
        hasErrors = true;
        logWarning(`Extra keys in ${locale}/${fileName}.json:`);
        comparison.extra.forEach((key) => log(`  - ${key}`, 'yellow'));
      }

      if (comparison.typeMismatches.length > 0) {
        hasErrors = true;
        logWarning(`Type mismatches in ${locale}/${fileName}.json:`);
        comparison.typeMismatches.forEach((mismatch) => {
          log(`  - ${mismatch.path}: expected ${mismatch.expected}, received ${mismatch.actual}`, 'yellow');
        });
      }

      if (
        comparison.missing.length === 0 &&
        comparison.extra.length === 0 &&
        comparison.typeMismatches.length === 0
      ) {
        logSuccess(`Translation complete: ${locale}/${fileName}.json`);
      }
    });
  });

  return !hasErrors;
}

function generateCoverageReport() {
  logInfo('Generating translation coverage report...');

  const localeData = {};
  let totalKeys = 0;

  SUPPORTED_LOCALES.forEach((locale) => {
    const files = getTranslationFiles(locale);
    let localeKeys = 0;

    files.forEach((filePath) => {
      const result = loadTranslationFile(filePath);
      if (result.success) {
        const keys = getAllKeys(result.data);
        localeKeys += keys.length;
        if (locale === PRIMARY_LOCALE) {
          totalKeys += keys.length;
        }
      }
    });

    localeData[locale] = localeKeys;
  });

  log('\nTranslation Coverage Report:', 'magenta');
  log('============================', 'magenta');

  SUPPORTED_LOCALES.forEach((locale) => {
    const keys = localeData[locale] || 0;
    const coverage = totalKeys > 0 ? ((keys / totalKeys) * 100).toFixed(1) : '0.0';
    const color = coverage === '100.0' ? 'green' : 'yellow';
    log(`${locale.toUpperCase()}: ${keys}/${totalKeys} keys (${coverage}%)`, color);
  });

  log('');
}

function main() {
  log('\ni18n Translation Validation', 'cyan');
  log('===========================\n', 'cyan');

  const hasI18nStructure = validateDirectoryStructure();
  if (!hasI18nStructure) {
    logWarning('i18n structure not found or incomplete.');
    process.exit(1);
  }

  const isValid = validateTranslationCompleteness();
  generateCoverageReport();

  if (isValid) {
    logSuccess('All translation validations passed.');
    process.exit(0);
  }

  logError('Translation validation failed.');
  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  validateDirectoryStructure,
  validateTranslationCompleteness,
  generateCoverageReport,
};
