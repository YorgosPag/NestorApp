const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..', '..');
const I18N_DIR = path.join(ROOT_DIR, 'src', 'i18n');
const LOCALES_DIR = path.join(I18N_DIR, 'locales');
const PRIMARY_LOCALE = 'el';
// ADR-666: «locale με αρχεία» ≠ «επιλέξιμη γλώσσα».
// Το pseudo είναι runtime transform του el (src/i18n/pseudo-post-processor.ts):
// επιλέγεται ως γλώσσα, αλλά δεν έχει —και δεν επιτρέπεται να αποκτήσει— resource αρχεία.
const SUPPORTED_LOCALES = ['el', 'en'];
const RUNTIME_ONLY_LANGUAGES = ['pseudo'];
const SUPPORTED_LANGUAGES = [...SUPPORTED_LOCALES, ...RUNTIME_ONLY_LANGUAGES];
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

// ADR-727: the "which JSON files feed a namespace set" rule lives here alone.
// getLocaleFiles() resolves a locale name; listJsonFiles() takes an arbitrary
// directory so tooling can point at a fixture dir without re-deriving the
// filter+sort (that sort order IS part of the generated-types contract).
function listJsonFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs.readdirSync(dirPath)
    .filter((name) => name.endsWith('.json'))
    .sort();
}

function getLocaleFiles(locale) {
  return listJsonFiles(getLocaleDir(locale));
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

/**
 * Πετά τα `//` σχόλια μιας γραμμής, αφήνοντας άθικτο ό,τι είναι μέσα σε εισαγωγικά.
 *
 * 🔴 ADR-752: χωρίς αυτό, ένα **σχόλιο** μέσα στο μπλοκ ήταν αρκετό για να γεννήσει φάντασμα
 * namespace — ένα παράδειγμα κλειδιού σε μονά εισαγωγικά μετρήθηκε ως καταχώριση και ο
 * validator κοκκίνισε με «Extra: …». Ο parser διάβαζε **κείμενο**, όχι δηλώσεις.
 */
function stripLineComments(block) {
  return block
    .split('\n')
    .map((line) => {
      const commentIndex = line.indexOf('//');
      if (commentIndex === -1) return line;
      const quotesBefore = (line.slice(0, commentIndex).match(/'/g) || []).length;
      return quotesBefore % 2 === 0 ? line.slice(0, commentIndex) : line;
    })
    .join('\n');
}

function parseConstArray(filePath, exportName) {
  const source = readText(filePath);
  const pattern = new RegExp(`export const ${exportName} = \\[(.*?)\\] as const;`, 's');
  const match = source.match(pattern);

  if (!match) {
    return [];
  }

  return [...stripLineComments(match[1]).matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

/** Ποια συνάρτηση του `namespace-loaders.ts` σερβίρει ποια γλώσσα. */
const LOADER_FUNCTIONS = { el: 'getElLoader', en: 'getEnLoader' };

const LOADER_CASE_PATTERN =
  /case\s+'([^']+)':\s*return\s+\(\)\s*=>\s*import\('\.\/locales\/([^/']+)\/([^']+)\.json'\)/g;

/**
 * Διαβάζει το `namespace-loaders.ts` ως **δηλώσεις**: ανά γλώσσα, ποια `case` υπάρχουν και σε
 * ποιο αρχείο δείχνει η καθεμιά.
 *
 * Αυτό είναι το ερώτημα που δεν έκανε ΚΑΝΕΝΑΣ έλεγχος (ADR-752): το CHECK 3.8 ρωτά «υπάρχει το
 * κλειδί;», το 3.33 «είναι φρέσκοι οι τύποι;», ο `validate-i18n-config` «ξέρει ο τύπος το
 * namespace;». Ένα namespace μπορούσε να περάσει και τα τρία και να είναι **αφόρτωτο** στην
 * οθόνη — γιατί το `loadTranslations` γυρίζει σιωπηλά `{}` όταν λείπει το `case`.
 *
 * @returns {{ el: Array<{namespace: string, dir: string, file: string}>, en: Array }}
 */
function parseNamespaceLoaders(filePath) {
  const source = readText(filePath);
  const result = {};

  for (const [language, functionName] of Object.entries(LOADER_FUNCTIONS)) {
    const start = source.indexOf(`function ${functionName}(`);
    const end = start === -1 ? -1 : source.indexOf('\n}', start);
    const block = start === -1 || end === -1 ? '' : source.slice(start, end);

    result[language] = [...block.matchAll(LOADER_CASE_PATTERN)].map(
      ([, namespace, dir, file]) => ({ namespace, dir, file }),
    );
  }

  return result;
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
      const trimmed = line.trimStart();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        return;
      }
      patterns.forEach(({ kind, regex }) => {
        regex.lastIndex = 0;
        const match = regex.exec(line);
        if (!match) {
          return;
        }
        const capturedContent = match[2] ?? '';
        if (capturedContent.trim() === '') {
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
  RUNTIME_ONLY_LANGUAGES,
  SUPPORTED_LANGUAGES,
  compareSchemas,
  ensureDir,
  flattenSchema,
  getLocaleDir,
  getLocaleFiles,
  getNamespacesForLocale,
  getSourceFiles,
  listJsonFiles,
  parseConstArray,
  parseNamespaceLoaders,
  parseTranslationNamespaceUnion,
  stripLineComments,
  LOADER_FUNCTIONS,
  readJson,
  readText,
  scanHardcodedStringPatterns,
};
