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
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const BASELINE_FILE = path.join(REPO_ROOT, '.notification-keys-baseline.json');

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
// Full scan (used by --all and the baseline generator)
// ---------------------------------------------------------------------------
function walkSrc(dir, out = []) {
  const abs = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '__tests__'].includes(entry.name)) continue;
      walkSrc(rel, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && isInScope(rel)) {
      out.push(rel);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Baseline handling
// ---------------------------------------------------------------------------
function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) return { files: {} };
  try {
    const data = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    return { files: data.files ?? {} };
  } catch {
    return { files: {} };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const wantAll = args.includes('--all');
const files = wantAll ? walkSrc('src') : args.filter((a) => !a.startsWith('--'));

const baseline = loadBaseline();
let hasBlock = false;
let totalChecked = 0;
let totalViolations = 0;

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  if (!isInScope(file)) continue;
  totalChecked += 1;

  const content = fs.readFileSync(file, 'utf8');
  const hits = countViolations(content);
  if (hits.length === 0) continue;

  const normFile = normalizePath(file);
  const baselineCount = baseline.files[normFile] ?? 0;
  const currentCount = hits.length;
  totalViolations += currentCount;

  if (currentCount <= baselineCount) {
    if (currentCount < baselineCount) {
      console.log(
        `${GREEN}  📉 ${normFile}: ${baselineCount} → ${currentCount} (-${baselineCount - currentCount}) raw notification keys${NC}`,
      );
    }
    continue;
  }

  hasBlock = true;
  const newCount = currentCount - baselineCount;
  console.log(
    `${RED}  🚫 ${normFile}: ${newCount} new raw notification key call(s) (total ${currentCount}, baseline ${baselineCount})${NC}`,
  );
  for (const { method, key, line } of hits.slice(-newCount)) {
    console.log(
      `${YELLOW}     Line ${line}: notifications.${method}('${key}') — replace with domain hook${NC}`,
    );
  }
}

if (hasBlock) {
  console.log('');
  console.log(
    `${RED}  ❌ Notification keys ratchet FAILED — route callers through use{Contact,Project}Notifications${NC}`,
  );
  console.log(
    `${YELLOW}     SSoT: src/config/notification-keys.ts | Dispatchers: src/hooks/notifications/${NC}`,
  );
  process.exit(1);
}

if (wantAll) {
  console.log(
    `${GREEN}  ✅ Notification keys ratchet: ${totalChecked} files scanned, ${totalViolations} grandfathered violations${NC}`,
  );
} else if (totalChecked > 0) {
  console.log(
    `${GREEN}  ✅ Notification keys: no new raw-key violations (${totalChecked} file(s) in scope)${NC}`,
  );
}
process.exit(0);
