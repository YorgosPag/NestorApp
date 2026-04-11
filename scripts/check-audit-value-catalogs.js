#!/usr/bin/env node
/**
 * =============================================================================
 * ENTERPRISE: Audit Value Catalogs parity — Pre-commit Check 3.13
 * =============================================================================
 * Validates that every entry in `src/config/audit-value-catalogs.ts` points at
 * a real, non-empty, el/en-parity catalog inside
 * `src/i18n/locales/{el,en}/<ns>.json`.
 *
 * Motivation
 * ----------
 * Audit trail entries persist raw enum keys (e.g. `category: "region"`). The
 * runtime renderer translates them via the canonical catalog referenced by
 * `AUDIT_VALUE_CATALOGS`. If the catalog path goes stale (renamed, moved,
 * desynced between el/en), the audit timeline silently displays raw keys —
 * exactly the bug we hit on 2026-04-11.
 *
 * What this check does
 * --------------------
 *   1. Parses `audit-value-catalogs.ts` and extracts `{ ns, path }` per field.
 *   2. For every referenced catalog:
 *       - loads `src/i18n/locales/el/<ns>.json` and `src/i18n/locales/en/<ns>.json`
 *       - resolves the dot-path
 *       - verifies it exists in BOTH locales
 *       - verifies it is a non-empty object of string values
 *       - verifies key-level parity between el and en (same enum keys)
 *   3. Any violation aborts the commit. Zero tolerance — no baseline.
 *
 * Usage
 * -----
 *   node scripts/check-audit-value-catalogs.js
 *
 * Exit codes
 * ----------
 *   0 → all catalogs valid
 *   1 → one or more catalogs missing / invalid / out of parity
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const CONFIG_FILE = path.join(
  REPO_ROOT,
  'src',
  'config',
  'audit-value-catalogs.ts',
);
const LOCALES_EL = path.join(REPO_ROOT, 'src', 'i18n', 'locales', 'el');
const LOCALES_EN = path.join(REPO_ROOT, 'src', 'i18n', 'locales', 'en');

const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const NC = '\x1b[0m';

// ---------------------------------------------------------------------------
// Config parser — extracts entries from AUDIT_VALUE_CATALOGS.
// Intentionally avoids ts-node: regex is sufficient for the fixed DSL shape.
// ---------------------------------------------------------------------------
function parseCatalogConfig(source) {
  const entries = [];
  const blockMatch = source.match(
    /AUDIT_VALUE_CATALOGS[^=]*=\s*\{([\s\S]*?)\}\s*as\s+const\s*;/,
  );
  if (!blockMatch) {
    throw new Error(
      'Cannot locate AUDIT_VALUE_CATALOGS object literal in config file.',
    );
  }
  const body = blockMatch[1];
  const entryRe =
    /(^|[\s,])([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*\{\s*ns\s*:\s*['"]([^'"]+)['"]\s*,\s*path\s*:\s*['"]([^'"]+)['"]\s*\}/g;
  let m;
  while ((m = entryRe.exec(body)) !== null) {
    entries.push({ field: m[2], ns: m[3], path: m[4] });
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Locale helpers.
// ---------------------------------------------------------------------------
function loadNamespace(localeDir, ns) {
  const file = path.join(localeDir, `${ns}.json`);
  if (!fs.existsSync(file)) {
    return { error: `file not found: ${path.relative(REPO_ROOT, file)}` };
  }
  try {
    return { data: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (err) {
    return { error: `invalid JSON in ${path.relative(REPO_ROOT, file)}: ${err.message}` };
  }
}

function resolvePath(obj, dotPath) {
  return dotPath.split('.').reduce((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) return acc[key];
    return undefined;
  }, obj);
}

function isStringMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length === 0) return false;
  return keys.every(k => typeof value[k] === 'string');
}

// ---------------------------------------------------------------------------
// Main validation routine.
// ---------------------------------------------------------------------------
function validate() {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error(`${RED}✖ audit-value-catalogs.ts not found at ${CONFIG_FILE}${NC}`);
    return 1;
  }

  const source = fs.readFileSync(CONFIG_FILE, 'utf8');
  let entries;
  try {
    entries = parseCatalogConfig(source);
  } catch (err) {
    console.error(`${RED}✖ Failed to parse AUDIT_VALUE_CATALOGS: ${err.message}${NC}`);
    return 1;
  }

  if (entries.length === 0) {
    console.error(
      `${RED}✖ AUDIT_VALUE_CATALOGS appears empty — at least one entry expected.${NC}`,
    );
    return 1;
  }

  const errors = [];

  for (const entry of entries) {
    const { field, ns, path: dotPath } = entry;
    const elNs = loadNamespace(LOCALES_EL, ns);
    const enNs = loadNamespace(LOCALES_EN, ns);

    if (elNs.error) {
      errors.push(`[${field}] el namespace: ${elNs.error}`);
      continue;
    }
    if (enNs.error) {
      errors.push(`[${field}] en namespace: ${enNs.error}`);
      continue;
    }

    const elCatalog = resolvePath(elNs.data, dotPath);
    const enCatalog = resolvePath(enNs.data, dotPath);

    if (elCatalog === undefined) {
      errors.push(`[${field}] el:${ns}:${dotPath} → path does not exist`);
      continue;
    }
    if (enCatalog === undefined) {
      errors.push(`[${field}] en:${ns}:${dotPath} → path does not exist`);
      continue;
    }
    if (!isStringMap(elCatalog)) {
      errors.push(
        `[${field}] el:${ns}:${dotPath} → expected non-empty { string: string } object`,
      );
      continue;
    }
    if (!isStringMap(enCatalog)) {
      errors.push(
        `[${field}] en:${ns}:${dotPath} → expected non-empty { string: string } object`,
      );
      continue;
    }

    const elKeys = new Set(Object.keys(elCatalog));
    const enKeys = new Set(Object.keys(enCatalog));
    const missingInEn = [...elKeys].filter(k => !enKeys.has(k));
    const missingInEl = [...enKeys].filter(k => !elKeys.has(k));
    if (missingInEn.length > 0) {
      errors.push(
        `[${field}] ${ns}:${dotPath} → keys present in el but missing in en: ${missingInEn.join(', ')}`,
      );
    }
    if (missingInEl.length > 0) {
      errors.push(
        `[${field}] ${ns}:${dotPath} → keys present in en but missing in el: ${missingInEl.join(', ')}`,
      );
    }
  }

  if (errors.length > 0) {
    console.error(`${RED}✖ Audit value catalog validation failed:${NC}`);
    for (const err of errors) console.error(`${RED}   • ${err}${NC}`);
    console.error(
      `${YELLOW}  → Fix: update src/config/audit-value-catalogs.ts or the referenced locale JSONs.${NC}`,
    );
    console.error(
      `${YELLOW}  → See ADR-195 / ADR-279 for the SSoT rationale.${NC}`,
    );
    return 1;
  }

  console.log(
    `${GREEN}✓ Audit value catalogs OK — ${entries.length} field(s) validated against el/en.${NC}`,
  );
  return 0;
}

process.exit(validate());
