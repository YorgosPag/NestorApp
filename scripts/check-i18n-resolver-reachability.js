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
// ADR-781 §3 — το ισοπέδωμα κλειδιών είναι SSoT. Ήταν ιδιωτικό εδώ· η ταυτότητα
// των δύο υλοποιήσεων αποδείχθηκε σε 101 namespaces / 31.361 κλειδιά, 0 διαφορές.
const { flattenAnswerableKeys } = require('./lib/i18n/locale-keys');
const { commitInput } = require('./lib/gate-input');
const labels = require('./lib/i18n/config-label-keys');

const REPO_ROOT = path.join(__dirname, '..');
// ADR-924: σχετικά με τη ρίζα — κάθε ανάγνωση από την ΕΙΣΟΔΟ (`--index` ⇒ resolver, locale, baseline ΤΟΥ COMMIT).
const RESOLVER_FILE = 'src/components/generic/i18n/translate-field-value.ts';
const BASELINE_FILE = '.i18n-resolver-reachability-baseline.json';

const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const CYAN = '\x1b[0;36m';
const NC = '\x1b[0m';

// ---------------------------------------------------------------------------
// 1. Parse SERVICE_FORM_NAMESPACES from the resolver module.
// ---------------------------------------------------------------------------
function readServiceFormNamespaces(input) {
  const src = input.readRequired(RESOLVER_FILE);
  const match = src.match(
    /export\s+const\s+SERVICE_FORM_NAMESPACES\s*=\s*\[([\s\S]*?)\]\s*as\s+const/,
  );
  if (!match) {
    throw new Error(
      `Could not locate SERVICE_FORM_NAMESPACES in ${path.join(REPO_ROOT, RESOLVER_FILE)}`,
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
function loadNamespaceIndex(namespaces, input) {
  const index = new Map(); // ns -> Set of dotted keys
  for (const ns of namespaces) {
    const text = input.read(`${labels.EL_LOCALE_DIR}/${ns}.json`);
    const set = new Set();
    if (text !== null) {
      try {
        flattenAnswerableKeys(JSON.parse(text), set);
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
    if (labels.KEY_SHAPE.test(value)) {
      out.push({ key: value, index: m.index });
    }
  }
  // Also catch `_LABELS` entries (shape 2 from CHECK 3.12) since labels/fields
  // tables in modal-select use that pattern.
  out.push(...labels.labelsBlockCandidates(content));
  return out;
}

/** Τα κλειδιά ενός αρχείου που ο resolver ΔΕΝ φτάνει — `[{ key, line }]`. */
function unreachablesOf(content, nsIndex) {
  return extractCandidates(content)
    .filter(({ key }) => !resolves(key, nsIndex))
    .map(({ key, index }) => ({ key, line: labels.lineOf(content, index) }));
}

// ---------------------------------------------------------------------------
// 5. Baseline rewrite (γεννήτορας: πάντα ο δίσκος)
// ---------------------------------------------------------------------------
function writeBaseline(scanned, namespaces) {
  const newBaseline = { files: {} };
  for (const { file, hits } of scanned) if (hits.length > 0) newBaseline.files[file] = hits.length;
  newBaseline.namespaces = namespaces;
  newBaseline.updatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(REPO_ROOT, BASELINE_FILE), JSON.stringify(newBaseline, null, 2) + '\n', 'utf8');
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
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
/** `input` = η είσοδος (ADR-924): με `--index` (εκτελεστής) κρίνεται το COMMIT, όχι ο δίσκος. */
function run(args = process.argv.slice(2), input = commitInput(REPO_ROOT, args)) {
  const rebuildBaseline = args.includes('--baseline');
  const scanAll = args.includes('--all') || rebuildBaseline;

  let namespaces;
  try {
    namespaces = readServiceFormNamespaces(input);
  } catch (err) {
    console.error(`${RED}  ❌ ${err.message}${NC}`);
    return 1;
  }
  const nsIndex = loadNamespaceIndex(namespaces, input);
  const files = scanAll ? labels.configLabelFiles(input) : args.filter((a) => !a.startsWith('--'));
  const scanned = labels.scanConfigLabels(files, input, (content) => unreachablesOf(content, nsIndex));

  if (rebuildBaseline) {
    writeBaseline(scanned, namespaces);
    return 0;
  }

  const hasBlock = labels.judgeConfigLabels(scanned, input, {
    baselineFile: BASELINE_FILE,
    noun: 'unreachable i18n key(s)',
    newNoun: 'new unreachable i18n key(s)',
    describeHit: ({ key }) => `'${key}' — not resolvable via SERVICE_FORM_NAMESPACES=[${namespaces.join(', ')}]`,
  });

  if (hasBlock) {
    console.log(
      `${RED}  ❌ i18n resolver reachability FAILED — either move the key into one of the scanned namespaces or add the correct namespace to SERVICE_FORM_NAMESPACES in src/components/generic/i18n/translate-field-value.ts${NC}`,
    );
    return 1;
  }

  if (scanned.length > 0) {
    console.log(
      `${GREEN}  ✅ Resolver reachability: ${scanned.length} config file(s) — all dotted keys resolvable via [${namespaces.join(
        ', ',
      )}]${NC}`,
    );
  }
  return 0;
}

if (require.main === module) process.exit(run());

module.exports = { run, extractCandidates, resolves };
