const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..', '..');
const I18N_DIR = path.join(ROOT_DIR, 'src', 'i18n');
const LOCALES_DIR = path.join(I18N_DIR, 'locales');
const PRIMARY_LOCALE = 'el';
const SUPPORTED_LOCALES = ['el', 'en', 'pseudo'];
const SOURCE_GLOBS = ['src', 'app', 'subapps'].map((segment) => path.join(ROOT_DIR, segment));

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function getLocaleDir(locale) {
  return path.join(LOCALES_DIR, locale);
}

function getLocaleFiles(locale) {
  const localeDir = getLocaleDir(locale);

  if (!fs.existsSync(localeDir)) {
    return [];
  }

  return fs.readdirSync(localeDir)
    .filter((name) => name.endsWith('.json'))
    .sort();
}

function getNamespacesForLocale(locale) {
  return getLocaleFiles(locale).map((fileName) => path.basename(fileName, '.json'));
}

function flattenSchema(value, trail = [], acc = new Map()) {
  const currentPath = trail.join('.');

  if (Array.isArray(value)) {
    acc.set(currentPath, 'array');
    const itemTypes = [...new Set(value.map((item) => {
      if (Array.isArray(item)) {
        return 'array';
      }
      if (item === null) {
        return 'null';
      }
      return typeof item;
    }))].sort();

    if (itemTypes.length > 0) {
      acc.set(`${currentPath}[]`, itemTypes.join('|'));
    }

    return acc;
  }

  if (value !== null && typeof value === 'object') {
    if (currentPath) {
      acc.set(currentPath, 'object');
    }

    for (const [key, child] of Object.entries(value)) {
      flattenSchema(child, trail.concat(key), acc);
    }

    return acc;
  }

  acc.set(currentPath, typeof value);
  return acc;
}

function compareSchemas(referenceData, candidateData) {
  const referenceSchema = flattenSchema(referenceData);
  const candidateSchema = flattenSchema(candidateData);
  const missing = [];
  const extra = [];
  const typeMismatches = [];

  for (const [schemaPath, schemaType] of referenceSchema.entries()) {
    if (!candidateSchema.has(schemaPath)) {
      missing.push(schemaPath);
      continue;
    }

    const candidateType = candidateSchema.get(schemaPath);
    if (candidateType !== schemaType) {
      typeMismatches.push({ path: schemaPath, expected: schemaType, actual: candidateType });
    }
  }

  for (const schemaPath of candidateSchema.keys()) {
    if (!referenceSchema.has(schemaPath)) {
      extra.push(schemaPath);
    }
  }

  return {
    missing,
    extra,
    typeMismatches,
  };
}

function parseConstArray(filePath, exportName) {
  const source = readText(filePath);
  const pattern = new RegExp(`export const ${exportName} = \\[(.*?)\\] as const;`, 's');
  const match = source.match(pattern);

  if (!match) {
    return [];
  }

  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

function parseTranslationNamespaceUnion(filePath) {
  const source = readText(filePath);
  const match = source.match(/export type TranslationNamespace = ([^;]+);/);

  if (!match) {
    return [];
  }

  return match[1]
    .split('|')
    .map((value) => value.trim().replace(/^'|'$/g, ''))
    .filter(Boolean);
}

function getSourceFiles() {
  const files = [];
  const extensions = new Set(['.ts', '.tsx', '.js', '.jsx']);

  function walk(currentPath) {
    if (!fs.existsSync(currentPath)) {
      return;
    }

    const stats = fs.statSync(currentPath);
    if (stats.isFile()) {
      if (extensions.has(path.extname(currentPath))) {
        files.push(currentPath);
      }
      return;
    }

    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.next' ||
        entry.name === 'dist' ||
        entry.name === 'coverage'
      ) {
        continue;
      }

      walk(path.join(currentPath, entry.name));
    }
  }

  for (const dir of SOURCE_GLOBS) {
    walk(dir);
  }

  return files.sort();
}

function scanHardcodedStringPatterns() {
  const findings = [];
  const patterns = [
    {
      kind: 'defaultValue',
      regex: /defaultValue\s*:\s*(['"`])([\s\S]*?)\1/g,
    },
    {
      kind: 'toast-call',
      regex: /\btoast(?:\.[a-zA-Z]+)?\(\s*(['"`])([\s\S]*?)\1/g,
    },
  ];

  for (const filePath of getSourceFiles()) {
    const source = readText(filePath);
    const lines = source.split(/\r?\n/);

    lines.forEach((line, index) => {
      patterns.forEach(({ kind, regex }) => {
        regex.lastIndex = 0;
        if (!regex.test(line)) {
          return;
        }

        findings.push({
          filePath,
          line: index + 1,
          kind,
          snippet: line.trim(),
        });
      });
    });
  }

  return findings;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

module.exports = {
  ROOT_DIR,
  I18N_DIR,
  LOCALES_DIR,
  PRIMARY_LOCALE,
  SUPPORTED_LOCALES,
  compareSchemas,
  ensureDir,
  flattenSchema,
  getLocaleDir,
  getLocaleFiles,
  getNamespacesForLocale,
  getSourceFiles,
  parseConstArray,
  parseTranslationNamespaceUnion,
  readJson,
  readText,
  scanHardcodedStringPatterns,
};
