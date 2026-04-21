#!/usr/bin/env node
/**
 * =============================================================================
 * Notification Keys Locale Integrity — Pre-commit Check 3.21
 * =============================================================================
 *
 * Motivation
 * ----------
 * `src/config/notification-keys.ts` (NOTIFICATION_KEYS) is the SSoT registry
 * of i18n keys used by the notification system. Every leaf value is a dotted
 * key (`ns.path.to.leaf`) or a prefixed one (`ns:path.to.leaf`).
 *
 * If a leaf references a key that does not exist in `src/i18n/locales/el/`
 * OR `src/i18n/locales/en/`, the toast will render the raw key string. This
 * is the same failure mode as CHECK 3.8 but at the REGISTRY level — catches
 * drift the moment a key is renamed in one locale but not the other.
 *
 * Zero tolerance — NO baseline. The registry is small (~20 leaves); any miss
 * is a bug.
 *
 * Scope
 * -----
 * Runs only when one of the following is staged:
 *   - src/config/notification-keys.ts
 *   - src/i18n/locales/el/**.json
 *   - src/i18n/locales/en/**.json
 * Or via `--all` / `npm run notification-keys-locale:check`.
 *
 * Key format
 * ----------
 * Two namespace conventions are accepted:
 *   1. `ns:path.to.leaf` — explicit `:` separator (e.g. `projects:messages.created`)
 *   2. `ns.path.to.leaf` — implicit — first segment before first `.` is the ns
 *
 * For (2), the namespace must match a `src/i18n/locales/<lang>/<ns>.json` file.
 * If no such file exists, the check reports the miss.
 * =============================================================================
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const REGISTRY_FILE = path.join(REPO_ROOT, 'src/config/notification-keys.ts');
const LOCALE_ROOT = path.join(REPO_ROOT, 'src/i18n/locales');
const LANGS = ['el', 'en'];

const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const NC = '\x1b[0m';

// ---------------------------------------------------------------------------
// Extract leaf values from the registry TS file.
// ---------------------------------------------------------------------------
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * Collect every string literal used as a value in the NOTIFICATION_KEYS object
 * tree. Filters out non-key literals by requiring the value to contain at
 * least one separator (`.` or `:`) and to match the i18next key shape.
 */
const KEY_SHAPE = /^[a-z][a-zA-Z0-9_-]*(?:[:.][a-zA-Z0-9_-]+)+$/;

function extractLeafKeys(source) {
  const stripped = stripComments(source);
  const matches = stripped.matchAll(/:\s*['"]([^'"]+)['"]/g);
  const keys = new Set();
  for (const m of matches) {
    const value = m[1];
    if (KEY_SHAPE.test(value)) keys.add(value);
  }
  return Array.from(keys);
}

// ---------------------------------------------------------------------------
// Key resolution against locale files.
// ---------------------------------------------------------------------------
const localeCache = new Map();

function loadLocaleFile(lang, ns) {
  const cacheKey = `${lang}:${ns}`;
  if (localeCache.has(cacheKey)) return localeCache.get(cacheKey);
  const filePath = path.join(LOCALE_ROOT, lang, `${ns}.json`);
  if (!fs.existsSync(filePath)) {
    localeCache.set(cacheKey, null);
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    localeCache.set(cacheKey, parsed);
    return parsed;
  } catch (err) {
    localeCache.set(cacheKey, null);
    return null;
  }
}

function splitKey(fullKey) {
  if (fullKey.includes(':')) {
    const colonIdx = fullKey.indexOf(':');
    return {
      ns: fullKey.slice(0, colonIdx),
      path: fullKey.slice(colonIdx + 1),
    };
  }
  const dotIdx = fullKey.indexOf('.');
  return {
    ns: fullKey.slice(0, dotIdx),
    path: fullKey.slice(dotIdx + 1),
  };
}

function resolvePath(obj, dottedPath) {
  if (!obj) return undefined;
  const segments = dottedPath.split('.');
  let node = obj;
  for (const seg of segments) {
    if (node == null || typeof node !== 'object' || !(seg in node)) return undefined;
    node = node[seg];
  }
  return node;
}

function verifyKey(fullKey) {
  const { ns, path: subpath } = splitKey(fullKey);
  const errors = [];
  for (const lang of LANGS) {
    const locale = loadLocaleFile(lang, ns);
    if (locale === null) {
      errors.push({ lang, kind: 'missing-file', ns });
      continue;
    }
    const value = resolvePath(locale, subpath);
    if (value === undefined) {
      errors.push({ lang, kind: 'missing-key', ns, subpath });
    } else if (typeof value !== 'string') {
      errors.push({ lang, kind: 'not-a-string', ns, subpath });
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
if (!fs.existsSync(REGISTRY_FILE)) {
  console.log(`${YELLOW}  ⏭  notification-keys.ts not found — skipping${NC}`);
  process.exit(0);
}

const source = fs.readFileSync(REGISTRY_FILE, 'utf8');
const keys = extractLeafKeys(source);

if (keys.length === 0) {
  console.log(`${YELLOW}  ⏭  NOTIFICATION_KEYS has no leaves — nothing to verify${NC}`);
  process.exit(0);
}

let problems = 0;
for (const fullKey of keys.sort()) {
  const errors = verifyKey(fullKey);
  if (errors.length === 0) continue;
  problems += errors.length;
  for (const err of errors) {
    if (err.kind === 'missing-file') {
      console.log(
        `${RED}  🚫 '${fullKey}' — locale file missing: src/i18n/locales/${err.lang}/${err.ns}.json${NC}`,
      );
    } else if (err.kind === 'missing-key') {
      console.log(
        `${RED}  🚫 '${fullKey}' — key not found in ${err.lang}/${err.ns}.json (path: ${err.subpath})${NC}`,
      );
    } else if (err.kind === 'not-a-string') {
      console.log(
        `${RED}  🚫 '${fullKey}' — ${err.lang}/${err.ns}.json: ${err.subpath} is not a string leaf${NC}`,
      );
    }
  }
}

if (problems > 0) {
  console.log('');
  console.log(
    `${RED}  ❌ Notification keys locale integrity FAILED — ${problems} problem(s) across ${keys.length} registered keys${NC}`,
  );
  console.log(
    `${YELLOW}     Fix: add the missing keys to the affected locale JSON files (el AND en).${NC}`,
  );
  process.exit(1);
}

console.log(
  `${GREEN}  ✅ Notification keys locale integrity: ${keys.length} key(s) resolve in both el+en locales${NC}`,
);
process.exit(0);
