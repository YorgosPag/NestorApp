#!/usr/bin/env node
/**
 * =============================================================================
 * ENTERPRISE: Runtime i18n resolver reachability — Pre-commit Check 3.13
 * =============================================================================
 * Complements scripts/check-option-i18n-keys.js (CHECK 3.12).
 *
 * Motivation — the 2026-04-11 regression
 * --------------------------------------
 * CHECK 3.8 (`check-i18n-missing-keys.js`) and CHECK 3.12 (`check-option-i18n-keys.js`)
 * both verify that an i18n key exists *somewhere* in `src/i18n/locales/el/*.json`.
 * Neither checks that the key is reachable through the runtime resolver the
 * application actually uses.
 *
 * On 2026-04-11, ServiceFormRenderer / ServiceFormTabRenderer were refactored
 * to call `translateFieldValue` (src/components/generic/i18n/translate-field-value.ts)
 * which hits `i18next.exists(key, { ns: SERVICE_FORM_NAMESPACES })` directly,
 * bypassing the `namespace-compat.ts` LEGACY_NESTED_MAP that classic `t()` calls
 * benefit from. SERVICE_FORM_NAMESPACES was initialized as
 * `['contacts', 'contacts-form', 'forms']` — but ADR-280 namespace splitting
 * had already moved `contacts.service.*` into `contacts-relationships.json`.
 * Result: every service-form section title / field label silently rendered as
 * the raw dotted key in the Δημόσιες Υπηρεσίες form.
 *
 * Root cause class: "key exists in locales, unreachable at runtime". Neither
 * CHECK 3.8 nor CHECK 3.12 flagged it because the keys *did* exist — just in a
 * namespace the resolver did not know about.
 *
 * What this check does
 * --------------------
 * 1. Parses `src/components/generic/i18n/translate-field-value.ts` to extract
 *    the current `SERVICE_FORM_NAMESPACES` array (single source of truth).
 * 2. Loads `src/i18n/locales/el/<ns>.json` for each ns in that array and
 *    flattens every file into a Set of dotted keys scoped to that namespace.
 * 3. Scans every staged file in the config scope (service-config.ts,
 *    individual-config.ts, company-config.ts, persona-config.ts, modal-select
 *    field label tables) for dotted string literals that are candidate i18n
 *    keys (labels, placeholders, helpTexts, section titles).
 * 4. For each candidate key, simulates the runtime resolver:
 *       (a) direct hit in any SERVICE_FORM_NAMESPACES entry
 *       (b) `contacts.` prefix strip fallback (matches resolver line 87)
 *    If neither resolves, the key is reported as *unreachable*.
 *
 * Ratchet semantics
 * -----------------
 *   - Baseline file: `.i18n-resolver-reachability-baseline.json`
 *   - Per-file unreachable counts can only decrease.
 *   - New files start at zero tolerance.
 *   - `npm run resolver-reach:baseline` refreshes after a legitimate cleanup.
 *
 * Usage
 * -----
 *   node scripts/check-i18n-resolver-reachability.js file1.ts file2.ts ...
 *   node scripts/check-i18n-resolver-reachability.js --all          # scan full scope
 *   node scripts/check-i18n-resolver-reachability.js --baseline     # rewrite baseline
 * =============================================================================
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const LOCALE_DIR = path.join(REPO_ROOT, 'src', 'i18n', 'locales', 'el');
const RESOLVER_FILE = path.join(
  REPO_ROOT,
  'src', 'components', 'generic', 'i18n', 'translate-field-value.ts',
);
const BASELINE_FILE = path.join(REPO_ROOT, '.i18n-resolver-reachability-baseline.json');

const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const CYAN = '\x1b[0;36m';
const NC = '\x1b[0m';

// ---------------------------------------------------------------------------
// 1. Parse SERVICE_FORM_NAMESPACES from the resolver module.
// ---------------------------------------------------------------------------
function readServiceFormNamespaces() {
  const src = fs.readFileSync(RESOLVER_FILE, 'utf8');
  const match = src.match(
    /export\s+const\s+SERVICE_FORM_NAMESPACES\s*=\s*\[([\s\S]*?)\]\s*as\s+const/,
  );
  if (!match) {
    throw new Error(
      `Could not locate SERVICE_FORM_NAMESPACES in ${RESOLVER_FILE}`,
    );
  }
  const body = match[1];
  const namespaces = [];
  for (const m of body.matchAll(/['"]([^'"]+)['"]/g)) {
    namespaces.push(m[1]);
  }
  if (namespaces.length === 0) {
    throw new Error('SERVICE_FORM_NAMESPACES array parsed empty');
  }
  return namespaces;
}

// ---------------------------------------------------------------------------
// 2. Load each namespace JSON and flatten to a Set of dotted keys.
//    The resolver calls i18next.exists(key, { ns: [...] }) which, per i18next
//    semantics, walks each namespace in turn and resolves the dotted key path
//    against the namespace's own root object.
// ---------------------------------------------------------------------------
function flatten(obj, prefix, sink) {
  if (obj === null || typeof obj !== 'object') return;
  for (const k of Object.keys(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, key, sink);
    } else {
      sink.add(key);
    }
  }
}

function loadNamespaceIndex(namespaces) {
  const index = new Map(); // ns -> Set of dotted keys
  for (const ns of namespaces) {
    const file = path.join(LOCALE_DIR, `${ns}.json`);
    const set = new Set();
    if (fs.existsSync(file)) {
      try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        flatten(data, '', set);
      } catch {
        // corrupt JSON — other checks will flag; leave this ns empty
      }
    }
    index.set(ns, set);
  }
  return index;
}

// ---------------------------------------------------------------------------
// 3. Simulate translateFieldValue — must mirror the resolution contract in
//    src/components/generic/i18n/translate-field-value.ts exactly.
// ---------------------------------------------------------------------------
function resolves(key, nsIndex) {
  if (!key || typeof key !== 'string') return true; // pass-through
  if (!key.includes('.')) return true;              // literal

  for (const set of nsIndex.values()) {
    if (set.has(key)) return true;
  }

  if (key.startsWith('contacts.')) {
    const stripped = key.slice('contacts.'.length);
    for (const set of nsIndex.values()) {
      if (set.has(stripped)) return true;
    }
  }

  // Phase B (CHECK 3.13 — 2026-04-13): namespace-prefix strip fallback.
  // Mirrors the same logic added to translateFieldValue.  Keys like
  // `common.priority.none`, `projects.status.planning`, `properties.status.available`
  // store the namespace name as the first path component; the actual namespace file
  // holds only the suffix.  Strip the first component and scan all loaded namespace
  // sets for the remainder.
  const prefixDot = key.indexOf('.');
  if (prefixDot > 0) {
    const rest = key.slice(prefixDot + 1);
    for (const set of nsIndex.values()) {
      if (set.has(rest)) return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// 4. Extract candidate i18n keys from config source files.
//    We look at every property that typically carries an i18n key in these
//    config files: label, placeholder, helpText, title, description, empty,
//    info, searchPlaceholder, noResults.
// ---------------------------------------------------------------------------
const KEY_SHAPE = /^[a-z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+){1,}$/;

const FIELD_NAMES = [
  'label',
  'placeholder',
  'helpText',
  'title',
  'description',
  'empty',
  'info',
  'searchPlaceholder',
  'noResults',
];

function extractCandidates(content) {
  const out = [];
  const union = FIELD_NAMES.join('|');
  // Matches `label: 'a.b.c'` / `title: "a.b.c"` etc. Keeps it simple — only
  // same-line literal assignments. Template literals and concatenations are
  // intentionally out of scope (they cannot be statically verified).
  const regex = new RegExp(`\\b(?:${union})\\s*:\\s*['"]([^'"\\n]+)['"]`, 'g');
  for (const m of content.matchAll(regex)) {
    const value = m[1];
    if (KEY_SHAPE.test(value)) {
      out.push({ key: value, index: m.index });
    }
  }
  // Also catch `_LABELS` entries (shape 2 from CHECK 3.12) since labels/fields
  // tables in modal-select use that pattern.
  const labelsBlockRegex =
    /export\s+const\s+[A-Z][A-Z0-9_]*_LABELS\s*=\s*\{([\s\S]*?)\n\}\s*as\s+const;?/g;
  for (const block of content.matchAll(labelsBlockRegex)) {
    const body = block[1];
    const baseIndex = block.index + block[0].indexOf(body);
    const entryRegex = /['"]([^'"]+)['"]\s*,?/g;
    for (const m of body.matchAll(entryRegex)) {
      const value = m[1];
      if (KEY_SHAPE.test(value)) {
        out.push({ key: value, index: baseIndex + m.index });
      }
    }
  }
  return out;
}

function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

function isInScope(file) {
  const norm = normalizePath(file);
  if (!/\.(ts|tsx)$/.test(norm)) return false;
  if (/(__tests__|\.test\.|\.spec\.|\.stories\.|\.d\.ts$)/.test(norm)) {
    return false;
  }
  if (norm.startsWith('scripts/')) return false;
  return (
    norm.startsWith('src/config/') ||
    /src\/subapps\/[^/]+\/config\/modal-select(\/|\.)/.test(norm) ||
    /src\/constants\/domains\/dropdown-[a-z-]+\.ts$/.test(norm)
  );
}

// ---------------------------------------------------------------------------
// 5. Scope discovery for --all / --baseline modes.
// ---------------------------------------------------------------------------
function walk(dir, acc) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      walk(full, acc);
    } else if (entry.isFile()) {
      const rel = normalizePath(path.relative(REPO_ROOT, full));
      if (isInScope(rel)) acc.push(rel);
    }
  }
}

function discoverAllInScope() {
  const acc = [];
  walk(path.join(REPO_ROOT, 'src', 'config'), acc);
  walk(path.join(REPO_ROOT, 'src', 'subapps'), acc);
  walk(path.join(REPO_ROOT, 'src', 'constants', 'domains'), acc);
  return acc;
}

// ---------------------------------------------------------------------------
// 6. Baseline handling
// ---------------------------------------------------------------------------
function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) return { files: {} };
  try {
    const data = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    if (!data.files) data.files = {};
    return data;
  } catch {
    return { files: {} };
  }
}

function writeBaseline(data) {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const args = process.argv.slice(2);
  const rebuildBaseline = args.includes('--baseline');
  const scanAll = args.includes('--all') || rebuildBaseline;
  const fileArgs = args.filter((a) => !a.startsWith('--'));

  let namespaces;
  try {
    namespaces = readServiceFormNamespaces();
  } catch (err) {
    console.error(`${RED}  ❌ ${err.message}${NC}`);
    process.exit(1);
  }
  const nsIndex = loadNamespaceIndex(namespaces);

  const files = scanAll ? discoverAllInScope() : fileArgs;
  const baseline = loadBaseline();
  const report = {}; // normFile -> { count, unreachables: [] }
  let totalChecked = 0;

  for (const file of files) {
    const full = path.isAbsolute(file) ? file : path.join(REPO_ROOT, file);
    if (!fs.existsSync(full)) continue;
    const rel = normalizePath(path.relative(REPO_ROOT, full));
    if (!isInScope(rel)) continue;
    totalChecked += 1;

    const content = fs.readFileSync(full, 'utf8');
    const candidates = extractCandidates(content);
    if (candidates.length === 0) continue;

    const unreachables = [];
    for (const { key, index } of candidates) {
      if (!resolves(key, nsIndex)) {
        unreachables.push({ key, line: getLineNumber(content, index) });
      }
    }
    if (unreachables.length === 0) continue;
    report[rel] = { count: unreachables.length, unreachables };
  }

  if (rebuildBaseline) {
    const newBaseline = { files: {} };
    for (const [f, r] of Object.entries(report)) newBaseline.files[f] = r.count;
    newBaseline.namespaces = namespaces;
    newBaseline.updatedAt = new Date().toISOString();
    writeBaseline(newBaseline);
    console.log(
      `${GREEN}  ✅ Resolver reachability baseline rewritten — ${
        Object.keys(newBaseline.files).length
      } file(s), ${Object.values(newBaseline.files).reduce(
        (s, n) => s + n, 0,
      )} legacy unreachable key(s)${NC}`,
    );
    console.log(
      `${CYAN}  ℹ Namespaces scanned: ${namespaces.join(', ')}${NC}`,
    );
    process.exit(0);
  }

  let hasBlock = false;
  for (const [file, { count, unreachables }] of Object.entries(report)) {
    const baselineCount = baseline.files[file] || 0;
    if (count <= baselineCount) {
      if (count < baselineCount) {
        console.log(
          `${GREEN}  📉 ${file}: ${baselineCount} → ${count} (-${
            baselineCount - count
          }) unreachable i18n key(s)${NC}`,
        );
      }
      continue;
    }
    hasBlock = true;
    const newCount = count - baselineCount;
    console.log(
      `${RED}  🚫 ${file}: ${newCount} new unreachable i18n key(s)${NC}`,
    );
    const showKeys = unreachables.slice(-newCount);
    for (const { key, line } of showKeys) {
      console.log(
        `${YELLOW}     Line ${line}: '${key}' — not resolvable via SERVICE_FORM_NAMESPACES=[${namespaces.join(
          ', ',
        )}]${NC}`,
      );
    }
  }

  if (hasBlock) {
    console.log(
      `${RED}  ❌ i18n resolver reachability FAILED — either move the key into one of the scanned namespaces or add the correct namespace to SERVICE_FORM_NAMESPACES in src/components/generic/i18n/translate-field-value.ts${NC}`,
    );
    process.exit(1);
  }

  if (totalChecked > 0) {
    console.log(
      `${GREEN}  ✅ Resolver reachability: ${totalChecked} config file(s) — all dotted keys resolvable via [${namespaces.join(
        ', ',
      )}]${NC}`,
    );
  }
  process.exit(0);
}

main();
