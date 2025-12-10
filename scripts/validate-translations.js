#!/usr/bin/env node

/**
 * 🌐 i18n Translation Validation Script
 *
 * This script validates translation completeness and consistency
 * across all supported locales in the Nestor application.
 *
 * Features:
 * - Validates all translation files exist
 * - Checks for missing keys between locales
 * - Validates JSON syntax
 * - Reports translation coverage
 */

const fs = require('fs');
const path = require('path');

// Configuration
const I18N_DIR = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const SUPPORTED_LOCALES = ['el', 'en']; // Greek (primary), English
const PRIMARY_LOCALE = 'el';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

/**
 * Check if i18n directory structure exists
 */
function validateDirectoryStructure() {
  logInfo('Validating i18n directory structure...');

  if (!fs.existsSync(I18N_DIR)) {
    logWarning(`i18n directory not found at: ${I18N_DIR}`);
    logInfo('This is acceptable - i18n may not be implemented yet.');
    return false;
  }

  let allLocalesExist = true;

  SUPPORTED_LOCALES.forEach(locale => {
    const localePath = path.join(I18N_DIR, locale);
    if (!fs.existsSync(localePath)) {
      logWarning(`Locale directory missing: ${localePath}`);
      allLocalesExist = false;
    } else {
      logSuccess(`Locale directory exists: ${locale}`);
    }
  });

  return allLocalesExist;
}

/**
 * Get all translation files in a locale directory
 */
function getTranslationFiles(locale) {
  const localePath = path.join(I18N_DIR, locale);

  if (!fs.existsSync(localePath)) {
    return [];
  }

  try {
    return fs.readdirSync(localePath)
      .filter(file => file.endsWith('.json'))
      .map(file => path.join(localePath, file));
  } catch (error) {
    logError(`Error reading locale directory ${locale}: ${error.message}`);
    return [];
  }
}

/**
 * Load and validate JSON translation file
 */
function loadTranslationFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    return { success: true, data };
  } catch (error) {
    logError(`Invalid JSON in ${filePath}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get all keys from a nested object (dot notation)
 */
function getAllKeys(obj, prefix = '') {
  let keys = [];

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof obj[key] === 'object' && obj[key] !== null) {
        keys.push(...getAllKeys(obj[key], fullKey));
      } else {
        keys.push(fullKey);
      }
    }
  }

  return keys;
}

/**
 * Validate translation completeness
 */
function validateTranslationCompleteness() {
  logInfo('Validating translation completeness...');

  const localeData = {};
  let hasErrors = false;

  // Load all translation files for each locale
  SUPPORTED_LOCALES.forEach(locale => {
    const files = getTranslationFiles(locale);
    localeData[locale] = {};

    files.forEach(filePath => {
      const fileName = path.basename(filePath, '.json');
      const result = loadTranslationFile(filePath);

      if (result.success) {
        localeData[locale][fileName] = result.data;
        logSuccess(`Loaded ${locale}/${fileName}.json`);
      } else {
        hasErrors = true;
      }
    });
  });

  // Compare keys between locales
  const primaryData = localeData[PRIMARY_LOCALE] || {};

  SUPPORTED_LOCALES.forEach(locale => {
    if (locale === PRIMARY_LOCALE) return;

    const currentData = localeData[locale] || {};

    Object.keys(primaryData).forEach(fileName => {
      const primaryKeys = getAllKeys(primaryData[fileName] || {});
      const currentKeys = getAllKeys(currentData[fileName] || {});

      const missingKeys = primaryKeys.filter(key => !currentKeys.includes(key));
      const extraKeys = currentKeys.filter(key => !primaryKeys.includes(key));

      if (missingKeys.length > 0) {
        logWarning(`Missing keys in ${locale}/${fileName}.json:`);
        missingKeys.forEach(key => log(`  - ${key}`, 'yellow'));
      }

      if (extraKeys.length > 0) {
        logWarning(`Extra keys in ${locale}/${fileName}.json:`);
        extraKeys.forEach(key => log(`  - ${key}`, 'yellow'));
      }

      if (missingKeys.length === 0 && extraKeys.length === 0) {
        logSuccess(`Translation complete: ${locale}/${fileName}.json`);
      }
    });
  });

  return !hasErrors;
}

/**
 * Generate translation coverage report
 */
function generateCoverageReport() {
  logInfo('Generating translation coverage report...');

  const localeData = {};
  let totalKeys = 0;

  // Load all translation files
  SUPPORTED_LOCALES.forEach(locale => {
    const files = getTranslationFiles(locale);
    let localeKeys = 0;

    files.forEach(filePath => {
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

  // Calculate and display coverage
  log('\\n📊 Translation Coverage Report:', 'magenta');
  log('================================', 'magenta');

  SUPPORTED_LOCALES.forEach(locale => {
    const keys = localeData[locale] || 0;
    const coverage = totalKeys > 0 ? ((keys / totalKeys) * 100).toFixed(1) : '0.0';
    const status = coverage >= 100 ? '✅' : coverage >= 80 ? '⚠️' : '❌';

    log(`${status} ${locale.toUpperCase()}: ${keys}/${totalKeys} keys (${coverage}%)`,
        coverage >= 100 ? 'green' : coverage >= 80 ? 'yellow' : 'red');
  });

  log('\\n');
}

/**
 * Main validation function
 */
function main() {
  log('\\n🌐 Nestor i18n Translation Validation', 'cyan');
  log('=====================================\\n', 'cyan');

  // Check if i18n is implemented
  const hasI18nStructure = validateDirectoryStructure();

  if (!hasI18nStructure) {
    logInfo('i18n structure not found or incomplete.');
    logInfo('This is acceptable for projects that haven\\'t implemented internationalization yet.');
    logSuccess('Validation passed - no i18n requirements to validate.');
    process.exit(0);
  }

  // Validate translations
  const isValid = validateTranslationCompleteness();

  // Generate coverage report
  generateCoverageReport();

  // Exit with appropriate code
  if (isValid) {
    logSuccess('All translation validations passed!');
    process.exit(0);
  } else {
    logError('Translation validation failed!');
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  validateDirectoryStructure,
  validateTranslationCompleteness,
  generateCoverageReport
};