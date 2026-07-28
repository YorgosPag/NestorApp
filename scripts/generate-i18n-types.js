#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const {
  LOCALES_DIR,
  PRIMARY_LOCALE,
  ensureDir,
  listJsonFiles,
  readJson,
} = require('./_shared/i18n-governance');

const TYPES_OUTPUT_DIR = path.join(__dirname, '..', 'src', 'types');
const TYPES_OUTPUT_FILE = path.join(TYPES_OUTPUT_DIR, 'i18n.ts');
const DEFAULT_LOCALE_DIR = path.join(LOCALES_DIR, PRIMARY_LOCALE);

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
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

function checkI18nExists() {
  if (!fs.existsSync(LOCALES_DIR)) {
    logWarning('i18n directory not found.');
    return false;
  }

  const primaryLocalePath = path.join(LOCALES_DIR, PRIMARY_LOCALE);
  if (!fs.existsSync(primaryLocalePath)) {
    logWarning(`Primary locale '${PRIMARY_LOCALE}' directory not found.`);
    return false;
  }

  return true;
}

function getTranslationFiles(localeDir = DEFAULT_LOCALE_DIR) {
  return listJsonFiles(localeDir).map((file) => path.join(localeDir, file));
}

// Single reader for "the namespace set this generator is built from". CHECK 3.33
// (scripts/check-i18n-types-freshness.js) calls this instead of re-implementing
// the read loop — if the two ever diverged, the freshness gate would be
// comparing against something the generator would never produce.
function collectTranslationData(localeDir = DEFAULT_LOCALE_DIR) {
  const filePaths = getTranslationFiles(localeDir);
  const data = {};
  const failures = [];

  filePaths.forEach((filePath) => {
    const result = parseTranslationFile(filePath);
    if (result.success) {
      data[result.fileName] = result.data;
    } else {
      failures.push(path.basename(filePath));
    }
  });

  return { data, failures, fileCount: filePaths.length };
}

function parseTranslationFile(filePath) {
  try {
    const data = readJson(filePath);
    const fileName = path.basename(filePath, '.json');
    return { fileName, data, success: true };
  } catch (error) {
    logError(`Error parsing ${filePath}: ${error.message}`);
    return { success: false };
  }
}

function sanitizeSegment(segment) {
  const alphanumeric = segment.replace(/[^a-zA-Z0-9]/g, ' ');
  return alphanumeric
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function getObjectPropertyKey(key) {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key}'`;
}

function inferArrayType(values, interfaceName, registry) {
  if (values.length === 0) {
    return 'readonly unknown[]';
  }

  const itemTypes = [...new Set(values.map((value) => {
    if (Array.isArray(value)) {
      return inferArrayType(value, `${interfaceName}Item`, registry);
    }
    if (value !== null && typeof value === 'object') {
      return registerInterface(value, `${interfaceName}Item`, registry);
    }
    if (typeof value === 'string') {
      return 'string';
    }
    if (typeof value === 'number') {
      return 'number';
    }
    if (typeof value === 'boolean') {
      return 'boolean';
    }
    return 'unknown';
  }))].sort();

  return `readonly (${itemTypes.join(' | ')})[]`;
}

function registerInterface(obj, interfaceName, registry) {
  if (registry.has(interfaceName)) {
    return interfaceName;
  }

  const lines = [`interface ${interfaceName} {`];

  for (const [key, value] of Object.entries(obj)) {
    let typeExpression = 'string';

    if (Array.isArray(value)) {
      typeExpression = inferArrayType(value, `${interfaceName}${sanitizeSegment(key)}`, registry);
    } else if (value !== null && typeof value === 'object') {
      typeExpression = registerInterface(value, `${interfaceName}_${sanitizeSegment(key)}`, registry);
    } else if (typeof value === 'number') {
      typeExpression = 'number';
    } else if (typeof value === 'boolean') {
      typeExpression = 'boolean';
    }

    lines.push(`  ${getObjectPropertyKey(key)}: ${typeExpression};`);
  }

  lines.push('}');
  registry.set(interfaceName, lines.join('\n'));
  return interfaceName;
}

// ADR-727 — the header must be a function of the INPUTS, never of the clock.
//
// Until 2026-07-29 this line was `Generated: ${new Date().toISOString()}`, which
// made every run emit a different file. That single line structurally forbade
// the industry-standard freshness check ("regenerate, then fail if the diff is
// non-empty" — `go generate` + `git diff --exit-code`, Bazel `diff_test`), and
// the types silently rotted for four months as a result.
//
// The fingerprint keeps the traceability the timestamp pretended to offer and
// adds what it never could: it answers "was this file built from the locales
// that are on disk right now?" — which is the actual question.
function fingerprintTranslationData(translationData) {
  const hash = crypto.createHash('sha256');

  for (const namespace of Object.keys(translationData).sort()) {
    hash.update(namespace);
    hash.update('\0');
    hash.update(JSON.stringify(translationData[namespace]));
    hash.update('\0');
  }

  return hash.digest('hex');
}

function buildHeader(translationData) {
  return `/**
 * Auto-generated i18n TypeScript Definitions
 *
 * This file is automatically generated from translation files.
 * Do not edit manually.
 *
 * Generated from: sha256:${fingerprintTranslationData(translationData)}
 */

/* eslint-disable custom/no-hardcoded-strings, @typescript-eslint/no-empty-object-type */

`;
}

function buildInterfaceRegistry(translationData, namespaces) {
  const registry = new Map();

  namespaces.forEach((namespace) => {
    registerInterface(translationData[namespace], `I18n_${sanitizeSegment(namespace)}`, registry);
  });

  return registry;
}

function buildPublicExports(namespaces) {
  let block = 'export interface I18nKeys {\n';

  namespaces.forEach((namespace) => {
    block += `  '${namespace}': I18n_${sanitizeSegment(namespace)};\n`;
  });

  block += '}\n\n';
  block += `export type TranslationNamespace = ${namespaces.map((namespace) => `'${namespace}'`).join(' | ')};\n\n`;
  block += `export type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? \`${'${Key}'}.\${NestedKeyOf<ObjectType[Key]>}\`
    : \`${'${Key}'}\`
}[keyof ObjectType & (string | number)];

export type TranslationKey = NestedKeyOf<I18nKeys>;
`;

  return block;
}

function generateTypeDefinitions(translationData) {
  const namespaces = Object.keys(translationData).sort();
  let typeDefinitions = buildHeader(translationData);

  if (namespaces.length === 0) {
    typeDefinitions += `export interface I18nKeys {
  [key: string]: string;
}

export type TranslationNamespace = 'common';
`;
    return typeDefinitions;
  }

  for (const definition of buildInterfaceRegistry(translationData, namespaces).values()) {
    typeDefinitions += `${definition}\n\n`;
  }

  return typeDefinitions + buildPublicExports(namespaces);
}

function writeTypeDefinitions(content) {
  ensureDir(TYPES_OUTPUT_DIR);
  fs.writeFileSync(TYPES_OUTPUT_FILE, content, 'utf8');
  logSuccess(`TypeScript definitions written to: ${TYPES_OUTPUT_FILE}`);
}

function main() {
  log('\ni18n TypeScript Types Generator', 'cyan');
  log('===============================\n', 'cyan');

  if (!checkI18nExists()) {
    process.exit(1);
  }

  const { data, failures } = collectTranslationData();

  if (failures.length > 0) {
    process.exit(1);
  }

  writeTypeDefinitions(generateTypeDefinitions(data));
  logInfo(`Generated namespaces: ${Object.keys(data).sort().join(', ')}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  generateTypeDefinitions,
  fingerprintTranslationData,
  buildHeader,
  collectTranslationData,
  getTranslationFiles,
  checkI18nExists,
  parseTranslationFile,
  writeTypeDefinitions,
  DEFAULT_LOCALE_DIR,
  TYPES_OUTPUT_FILE,
};
