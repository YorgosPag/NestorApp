#!/usr/bin/env node
/**
 * CHECK 3.17 — Entity Audit Coverage (Ratchet Mode)
 *
 * Enforces that every Firestore *write* to an audit-tracked collection
 * (projects, contacts, buildings, properties, floors, parking, storage,
 * purchase_orders, companies) lives in a file that also calls
 * `EntityAuditService.recordChange(...)` from the ADR-195 SSoT module.
 *
 * Why this exists:
 *   2026-04-11 incident — project creation via /api/projects/list was
 *   writing the new project document but never invoking the centralized
 *   audit service, so the per-project "Ιστορικό" tab was empty even
 *   though the reader side was fully wired (ADR-195 Phase 3). The SSoT
 *   registry already forbids *direct writes* to `entity_audit_trail`
 *   from anywhere but `entity-audit.service.ts`; this check closes the
 *   symmetric gap on the *writer* side — any handler that mutates an
 *   audit-tracked entity must record a matching audit entry.
 *
 * Strategy (v1 — file-level):
 *   For every src/**\/*.{ts,tsx} file:
 *     1. Detect writes to tracked collections. Accepted shapes:
 *          COLLECTIONS.<KEY>                   (anywhere in file)
 *          db.collection(COLLECTIONS.<KEY>)    followed by .set|.update|.delete|.add
 *          adminDb.collection(COLLECTIONS.<KEY>).doc(...).set|update|delete
 *          setDoc / updateDoc / deleteDoc / addDoc referencing COLLECTIONS.<KEY>
 *     2. If (write count > 0) and file does NOT contain
 *        `EntityAuditService.recordChange(` → violation.
 *
 *   File-level scope is deliberately coarse: a file with one covered
 *   write path and one uncovered write path will currently pass. This
 *   is acceptable for v1 because every existing handler we've migrated
 *   so far has been 1-write-per-file, and the baseline ratchet will
 *   force the remainder through on touch. Scope-aware refinement is a
 *   v2 follow-up.
 *
 * Ratchet semantics:
 *   - Baseline: .entity-audit-coverage-baseline.json (array of relative
 *     file paths that are grandfathered in).
 *   - New file with violations → BLOCK.
 *   - Existing baselined file → OK (still listed but allowed).
 *   - Baselined file that has been *fixed* (now covered) → OK; running
 *     `npm run audit-coverage:baseline` will ratchet it out.
 *   - Violations can only decrease.
 *
 * CLI:
 *   node scripts/check-entity-audit-coverage.js              # staged files
 *   node scripts/check-entity-audit-coverage.js --all        # full src/ scan
 *   node scripts/check-entity-audit-coverage.js --write-baseline
 *   node scripts/check-entity-audit-coverage.js path/a.ts    # explicit targets
 *
 * Exit codes:
 *   0 — no blocking violations
 *   1 — at least one new or regressed violation
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

// ---------------------------------------------------------------------------
// Paths & constants
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BASELINE_FILE = path.join(PROJECT_ROOT, '.entity-audit-coverage-baseline.json');
const SRC_ROOT = path.join(PROJECT_ROOT, 'src');

/**
 * COLLECTIONS keys that map to an AuditEntityType (see src/types/audit-trail.ts).
 * Only these trigger the check — unlisted collections are out of scope.
 */
const TRACKED_COLLECTION_KEYS = new Set([
  'CONTACTS',
  'COMPANIES',
  'PROJECTS',
  'BUILDINGS',
  'PROPERTIES',
  'FLOORS',
  'PARKING_SPACES',
  'STORAGE',
  'PURCHASE_ORDERS',
]);

/**
 * Files that are allowed to write to tracked collections without recording
 * an audit entry themselves. These fall into three categories:
 *   - The audit service itself (it IS the SSoT — nothing to record against).
 *   - Read-only query/lookup services (the check is write-focused but some
 *     files reference COLLECTIONS.* in cast/type positions).
 *   - Infrastructure layers that delegate writes upward (e.g. deletion guards
 *     that return metadata but do not themselves mutate).
 *
 * Use sparingly — prefer fixing the handler over exempting it.
 */
const HARD_EXEMPT_PATTERNS = [
  // SSoT audit module — cannot record against itself
  /[\\/]services[\\/]entity-audit\.service\.ts$/,
  // Type/interface files
  /\.d\.ts$/,
  // Test files
  /\.test\.(ts|tsx)$/,
  /\.spec\.(ts|tsx)$/,
  /[\\/]__tests__[\\/]/,
];

/**
 * Write operations to detect. We match the method name anywhere after a
 * `.` on the same or following line as a `COLLECTIONS.<KEY>` reference.
 * This is a regex-level heuristic — a scope-aware AST walker is v2 work.
 */
const WRITE_METHODS = ['set', 'update', 'delete', 'add'];
const MODULE_WRITE_FNS = ['setDoc', 'updateDoc', 'deleteDoc', 'addDoc'];

// ---------------------------------------------------------------------------
// ANSI colours (no-op on non-TTY)
// ---------------------------------------------------------------------------

const useColour = process.stdout.isTTY;
const c = {
  red:    (s) => (useColour ? `\x1b[31m${s}\x1b[0m` : s),
  green:  (s) => (useColour ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s) => (useColour ? `\x1b[33m${s}\x1b[0m` : s),
  cyan:   (s) => (useColour ? `\x1b[36m${s}\x1b[0m` : s),
  bold:   (s) => (useColour ? `\x1b[1m${s}\x1b[0m` : s),
};

// ---------------------------------------------------------------------------
// Target selection
// ---------------------------------------------------------------------------

/** @returns {string[]} absolute paths */
function listStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    });
    return out
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s && /^src[\\/].+\.(ts|tsx)$/.test(s))
      .map((rel) => path.join(PROJECT_ROOT, rel));
  } catch {
    return [];
  }
}

/** @returns {string[]} absolute paths */
function listAllSrcFiles() {
  /** @type {string[]} */
  const out = [];
  /** @param {string} dir */
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
  }
  walk(SRC_ROOT);
  return out;
}

/** @param {string} abs @returns {string} relative POSIX-style path */
function relPosix(abs) {
  return path.relative(PROJECT_ROOT, abs).split(path.sep).join('/');
}

/** @param {string} abs @returns {boolean} */
function isExempt(abs) {
  return HARD_EXEMPT_PATTERNS.some((re) => re.test(abs));
}

// ---------------------------------------------------------------------------
// Detection core
// ---------------------------------------------------------------------------

/**
 * Strip line comments, block comments, and string literals so that their
 * contents cannot trigger false positives on `COLLECTIONS.PROJECTS` etc.
 * Template literals are preserved because they may contain interpolation
 * that includes a real call; tracked keys are single identifiers so the
 * risk is small. Pragmatic v1.
 *
 * @param {string} src
 * @returns {string}
 */
function stripCommentsAndStrings(src) {
  return src
    // Block comments
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    // Line comments
    .replace(/\/\/[^\n]*/g, ' ')
    // Double-quoted strings
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    // Single-quoted strings
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

/**
 * Look for writes to any tracked collection key in the sanitized source.
 *
 * @param {string} src
 * @returns {{hasWrite: boolean, keys: Set<string>}}
 */
function detectTrackedWrites(src) {
  const found = new Set();

  // Pattern A: `COLLECTIONS.<KEY>` anywhere in the file, then within the
  // next ~600 chars we also see one of the write method names. This is
  // coarse but catches the multi-line Admin SDK pattern
  // `adminDb.collection(COLLECTIONS.PROJECTS).doc(id).set({...})`.
  const keyRe = /\bCOLLECTIONS\s*\.\s*([A-Z_]+)\b/g;
  /** @type {RegExpExecArray|null} */
  let m;
  while ((m = keyRe.exec(src)) !== null) {
    const key = m[1];
    if (!TRACKED_COLLECTION_KEYS.has(key)) continue;

    const window = src.slice(m.index, m.index + 600);
    const hasChainedWrite = WRITE_METHODS.some((method) =>
      new RegExp(`\\.\\s*${method}\\s*\\(`).test(window),
    );
    const hasModuleWrite = MODULE_WRITE_FNS.some((fn) =>
      new RegExp(`\\b${fn}\\s*\\(`).test(window),
    );

    if (hasChainedWrite || hasModuleWrite) {
      found.add(key);
    }
  }

  // Pattern B: top-level modular form — `addDoc(collection(db, COLLECTIONS.KEY), ...)`
  // is already caught by Pattern A since the COLLECTIONS.<KEY> ref precedes
  // the write call within the same window. No extra handling needed.

  return { hasWrite: found.size > 0, keys: found };
}

/** @param {string} src @returns {boolean} */
function hasRecordChangeCall(src) {
  return /EntityAuditService\s*\.\s*recordChange\s*\(/.test(src);
}

/**
 * @param {string} abs
 * @returns {{relPath: string, status: 'clean'|'violation'|'covered'|'skipped', keys: string[]}}
 */
function analyzeFile(abs) {
  const relPath = relPosix(abs);
  if (isExempt(abs)) {
    return { relPath, status: 'skipped', keys: [] };
  }
  const raw = fs.readFileSync(abs, 'utf8');
  const src = stripCommentsAndStrings(raw);
  const { hasWrite, keys } = detectTrackedWrites(src);

  if (!hasWrite) return { relPath, status: 'clean', keys: [] };

  if (hasRecordChangeCall(src)) {
    return { relPath, status: 'covered', keys: [...keys] };
  }
  return { relPath, status: 'violation', keys: [...keys] };
}

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------

/** @returns {Set<string>} */
function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) return new Set();
  try {
    const raw = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    const files = Array.isArray(raw) ? raw : Array.isArray(raw.files) ? raw.files : [];
    return new Set(files);
  } catch (err) {
    console.error(c.red(`Failed to parse ${BASELINE_FILE}: ${err.message}`));
    return new Set();
  }
}

/** @param {string[]} files */
function writeBaseline(files) {
  const payload = {
    description:
      'CHECK 3.17 — files with Firestore writes to audit-tracked collections that do not call EntityAuditService.recordChange(). Ratchet down only.',
    generatedAt: new Date().toISOString(),
    count: files.length,
    files: [...files].sort(),
  };
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const flagAll = args.includes('--all');
  const flagWriteBaseline = args.includes('--write-baseline');
  const flagVerbose = args.includes('--verbose');
  const explicit = args.filter((a) => !a.startsWith('--'));

  /** @type {string[]} */
  let targets;
  if (flagAll || flagWriteBaseline) {
    targets = listAllSrcFiles();
  } else if (explicit.length > 0) {
    targets = explicit.map((p) => path.resolve(PROJECT_ROOT, p));
  } else {
    targets = listStagedFiles();
  }

  if (targets.length === 0) {
    console.log(c.green('CHECK 3.17: no targets — nothing to do'));
    return 0;
  }

  const baseline = loadBaseline();
  /** @type {Array<{relPath: string, keys: string[]}>} */
  const violations = [];
  /** @type {string[]} */
  const covered = [];

  for (const abs of targets) {
    const result = analyzeFile(abs);
    if (result.status === 'violation') violations.push({ relPath: result.relPath, keys: result.keys });
    else if (result.status === 'covered') covered.push(result.relPath);
  }

  // --write-baseline mode: persist current violations and exit
  if (flagWriteBaseline) {
    const files = violations.map((v) => v.relPath);
    writeBaseline(files);
    console.log(
      c.green(`CHECK 3.17 baseline written: ${files.length} file(s) grandfathered → ${path.basename(BASELINE_FILE)}`),
    );
    return 0;
  }

  // Ratchet evaluation
  /** @type {Array<{relPath: string, keys: string[]}>} */
  const newViolations = [];
  for (const v of violations) {
    if (!baseline.has(v.relPath)) newViolations.push(v);
  }

  // Also: baselined files that are now covered → suggest ratchet-down
  const fixed = [...baseline].filter((f) => {
    const abs = path.join(PROJECT_ROOT, f);
    if (!fs.existsSync(abs)) return false;
    const result = analyzeFile(abs);
    return result.status !== 'violation';
  });

  // Report
  if (flagVerbose || newViolations.length > 0) {
    console.log(c.cyan(`CHECK 3.17 — Entity Audit Coverage (ratchet mode)`));
    console.log(`  targets:          ${targets.length}`);
    console.log(`  covered writes:   ${covered.length}`);
    console.log(`  baseline size:    ${baseline.size}`);
    console.log(`  current viols:    ${violations.length}`);
    if (fixed.length > 0) {
      console.log(
        c.green(`  ✔ ${fixed.length} baselined file(s) now clean — run: npm run audit-coverage:baseline`),
      );
    }
  }

  if (newViolations.length === 0) {
    if (flagVerbose) console.log(c.green('  ✔ no new violations'));
    return 0;
  }

  console.log('');
  console.log(c.red(c.bold(`✗ CHECK 3.17 failed — ${newViolations.length} new violation(s):`)));
  console.log('');
  for (const v of newViolations) {
    console.log(c.red(`  • ${v.relPath}`));
    console.log(c.yellow(`      writes to: ${v.keys.join(', ')}`));
    console.log(`      fix: add EntityAuditService.recordChange({ entityType, entityId, action, changes, performedBy, performedByName, companyId })`);
    console.log(`           import from '@/services/entity-audit.service' — ADR-195 SSoT`);
  }
  console.log('');
  console.log(c.yellow('Any Firestore write to an audit-tracked collection must be paired with'));
  console.log(c.yellow('a recordChange() call in the same file. Legacy files are grandfathered in'));
  console.log(c.yellow(`${path.basename(BASELINE_FILE)} — counts can only decrease.`));
  return 1;
}

process.exit(main());
