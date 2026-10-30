#!/usr/bin/env node
/**
 * =============================================================================
 * Notification Keys Ratchet — Pre-commit Check 3.20
 * =============================================================================
 *
 * Motivation
 * ----------
 * ADR-SSoT-Notifications (commit 175b7d8a) centralized every notification i18n
 * key in `src/config/notification-keys.ts` (NOTIFICATION_KEYS) and routes each
 * caller through a domain hook (`useContactNotifications`, `useProjectNotifications`).
 *
 * Callers should fire INTENT — `contactNotifications.createSuccess()` — not
 * keys. A raw call like `notifications.success('contacts-form.submission.createSuccess')`
 * in application code bypasses the SSoT:
 *   - Typo in the key silently shows nothing.
 *   - Renaming the key requires grep-and-hope across 120+ files.
 *   - The dispatcher cannot bundle analytics, dedup, or rate-limit logic.
 *
 * Complements the existing `notification-keys` module in `.ssot-registry.json`
 * which only blocks *Greek* hardcoded strings. This check targets the *raw-key*
 * pattern that slipped through Phase 2 — a second SSoT violation class.
 *
 * What this check does
 * --------------------
 * For every staged `.ts`/`.tsx` file OUTSIDE the allowlist it counts
 * occurrences of:
 *
 *     notifications.(success|error|info|warning)(' a.b.c ')
 *     notifications.(success|error|info|warning)(" a.b.c ")
 *
 * where the first arg is a dotted-identifier i18n key literal. Every match is
 * a raw key that should be replaced by a domain-hook method call.
 *
 * Allowlist (bypass paths — can legally hardcode keys)
 * ----------------------------------------------------
 *   - src/config/notification-keys.ts       (the SSoT registry itself)
 *   - src/hooks/notifications/               (the dispatchers that fire them)
 *   - src/providers/NotificationProvider.tsx (the toast renderer)
 *
 * Ratchet semantics
 * -----------------
 *   - Baseline file: `.notification-keys-baseline.json`
 *   - Counts can only decrease per-file.
 *   - New files start at zero tolerance.
 *   - `npm run notification-keys:baseline` refreshes after a legitimate cleanup.
 *
 * Usage: node scripts/check-notification-keys-ratchet.js file1.ts file2.ts ...
 *        node scripts/check-notification-keys-ratchet.js --all
 * =============================================================================
 */
const path = require('path');
const { commitInput } = require('./lib/gate-input');
const ratchet = require('./lib/per-file-ratchet');

const REPO_ROOT = path.join(__dirname, '..');
const BASELINE_FILE = '.notification-keys-baseline.json';

const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const NC = '\x1b[0m';

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------
/**
 * Match `<prefix>.success|error|info|warning('a.b.c')` where the first arg is
 * a dotted i18n key literal. Captures the key shape deliberately narrow:
 *   - starts with lowercase letter
 *   - only alphanumerics, `.`, `_`, `:`, `-` after that
 *   - must contain at least one separator (`.` or `:`)
 * This filters out template literals, function calls, and pre-interpolated
 * messages — those would already fail the resolver and surface fast.
 */
const RAW_KEY_REGEX =
  /\bnotifications\.(success|error|info|warning)\(\s*['"]([a-z][a-zA-Z0-9_:-]*(?:[.:][a-zA-Z0-9_:-]+)+)['"]/g;

const ALLOWLIST_PREFIXES = [
  'src/config/notification-keys.ts',
  'src/hooks/notifications/',
  'src/providers/NotificationProvider.tsx',
];

function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

function isAllowlisted(file) {
  const norm = normalizePath(file);
  return ALLOWLIST_PREFIXES.some((prefix) => norm.startsWith(prefix));
}

function isInScope(file) {
  const norm = normalizePath(file);
  if (!/\.(ts|tsx)$/.test(norm)) return false;
  if (/(__tests__|\.test\.|\.spec\.|\.d\.ts$)/.test(norm)) return false;
  if (norm.startsWith('scripts/')) return false;
  if (norm.startsWith('node_modules/')) return false;
  if (isAllowlisted(file)) return false;
  return true;
}

function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

function countViolations(content) {
  const hits = [];
  for (const m of content.matchAll(RAW_KEY_REGEX)) {
    hits.push({
      method: m[1],
      key: m[2],
      line: getLineNumber(content, m.index),
    });
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Main — κάθε ανάγνωση από την ΕΙΣΟΔΟ (ADR-924 Φ3: `--index` ⇒ το κείμενο ΤΟΥ COMMIT, όχι του δίσκου)
// ---------------------------------------------------------------------------
function run(args = process.argv.slice(2), input = commitInput(REPO_ROOT, args)) {
  const wantAll = args.includes('--all');
  const files = wantAll
    ? ratchet.scopeFiles(input, ['src'], isInScope, ratchet.pruneTestDirs)
    : args.filter((a) => !a.startsWith('--'));
  const scanned = ratchet.scanFiles(files, { input, inScope: isInScope, findHits: countViolations });
  const hasBlock = ratchet.printLineVerdict(scanned, ratchet.loadFileCounts(BASELINE_FILE, input), {
    noun: 'raw notification keys',
    newNoun: 'new raw notification key call(s)',
    describeHit: ({ method, key }) => `notifications.${method}('${key}') — replace with domain hook`,
  });

  if (hasBlock) {
    console.log('');
    console.log(
      `${RED}  ❌ Notification keys ratchet FAILED — route callers through use{Contact,Project}Notifications${NC}`,
    );
    console.log(
      `${YELLOW}     SSoT: src/config/notification-keys.ts | Dispatchers: src/hooks/notifications/${NC}`,
    );
    return 1;
  }

  const totalViolations = scanned.reduce((sum, { hits }) => sum + hits.length, 0);
  if (wantAll) {
    console.log(
      `${GREEN}  ✅ Notification keys ratchet: ${scanned.length} files scanned, ${totalViolations} grandfathered violations${NC}`,
    );
  } else if (scanned.length > 0) {
    console.log(
      `${GREEN}  ✅ Notification keys: no new raw-key violations (${scanned.length} file(s) in scope)${NC}`,
    );
  }
  return 0;
}

if (require.main === module) process.exit(run());

module.exports = { run, countViolations, isInScope };
