#!/usr/bin/env node
/**
 * CHECK 3.19 — Storage Rules Test Coverage Static Analyzer
 *
 * Zero-tolerance pre-commit gate that ensures every top-level match block
 * in `storage.rules` is covered by either a test suite registered in
 * `tests/storage-rules/_registry/coverage-manifest.ts` or an explicit
 * pending list entry — and that every registered test file actually
 * declares the correct `COVERAGE` export and iterates the matrix.
 *
 * How it works:
 *   1. Parse storage.rules → extract every inner match block as
 *      { pathId, matchPath, lineStart, lineEnd } via the shared identity-based
 *      parser (children of `match /b/{bucket}/o { ... }`).
 *   2. Parse coverage-manifest.ts via TypeScript AST → extract
 *      STORAGE_RULES_COVERAGE (pathId, pattern, testFile, rulesRange) and
 *      STORAGE_RULES_PENDING (exact match-path string array).
 *   3. Validation A — every storage.rules match block must be accounted for
 *      by IDENTITY: its `@pathId` appears in STORAGE_RULES_COVERAGE, or its
 *      full matchPath appears (exactly) in STORAGE_RULES_PENDING. Line numbers
 *      are irrelevant — inserting a line above a block cannot unmoor it.
 *   4. Validation B — every coverage entry must have an existing test file.
 *   5. Validation C — each test file must export `COVERAGE` referencing the
 *      correct pathId (regex scan of the test file source).
 *   6. Validation D — each test file must contain `for (const cell of COVERAGE.matrix)`
 *      so the matrix is iterated rather than hand-copied (drift prevention).
 *   7. Validation E (ratchet) — an inner match block with NO `@pathId`
 *      annotation is a violation: a new storage path cannot ship without an
 *      identity.
 *   8. Validation F — a duplicate `@pathId` across blocks is a violation.
 *
 * `rulesRange` in the manifest is now DOCUMENTATION ONLY. It is no longer read
 * by Validation A; a non-blocking `--verbose` warning is emitted if a range no
 * longer contains its block's parsed start line.
 *
 * CLI:
 *   node scripts/check-storage-rules-test-coverage.js                # staged files
 *   node scripts/check-storage-rules-test-coverage.js --all          # full scan
 *   node scripts/check-storage-rules-test-coverage.js --verbose      # extra output
 *   node scripts/check-storage-rules-test-coverage.js file1 file2    # explicit targets
 *
 * Exit codes:
 *   0 — no violations
 *   1 — one or more violations (commit blocked)
 *
 * See ADR-301 §3.4 and ADR-657 §B (line-shift-proof refactor).
 *
 * @since 2026-04-14 (ADR-301 Phase A)
 * @since 2026-07-15 (ADR-657 — identity-based Validation A + E/F ratchet)
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const {
  parseStorageRules,
  findDuplicatePathIds,
} = require('./_shared/storage-rules-parser');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '..');
const STORAGE_RULES_FILE = path.join(PROJECT_ROOT, 'storage.rules');
const MANIFEST_FILE = path.join(
  PROJECT_ROOT,
  'tests',
  'storage-rules',
  '_registry',
  'coverage-manifest.ts',
);

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const targets = args.filter((a) => !a.startsWith('--'));
const MODE_ALL = flags.has('--all');
const VERBOSE = flags.has('--verbose');

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
};

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

// ---------------------------------------------------------------------------
// Storage rules parser — delegated to the shared identity-based parser
// ---------------------------------------------------------------------------

/**
 * Parse storage.rules into inner-level match blocks, each carrying its
 * `// @pathId:` identity, full match path, and line span. The outer
 * `match /b/{bucket}/o { }` service wrapper is skipped by the shared parser.
 *
 * @returns {import('./_shared/storage-rules-parser').StorageRuleBlock[]}
 */
function parseStorageRulesBlocks() {
  if (!fs.existsSync(STORAGE_RULES_FILE)) {
    throw new Error(`storage.rules not found at: ${STORAGE_RULES_FILE}`);
  }
  const source = fs.readFileSync(STORAGE_RULES_FILE, 'utf8');
  return parseStorageRules(source);
}

// ---------------------------------------------------------------------------
// Manifest parser — TypeScript AST walker
// ---------------------------------------------------------------------------

/**
 * @typedef {{ pathId: string, pattern: string, testFile: string, rulesRange: [number, number] }} ManifestEntry
 * @typedef {{ coverage: ManifestEntry[], pending: string[] }} ParsedManifest
 */

/**
 * @returns {ParsedManifest}
 */
function parseManifest() {
  if (!fs.existsSync(MANIFEST_FILE)) {
    throw new Error(
      `Coverage manifest not found at: ${MANIFEST_FILE}\n` +
        'Run: create tests/storage-rules/_registry/coverage-manifest.ts',
    );
  }

  const source = fs.readFileSync(MANIFEST_FILE, 'utf8');
  const sourceFile = ts.createSourceFile(
    MANIFEST_FILE,
    source,
    ts.ScriptTarget.Latest,
    true,
  );

  /** @type {ManifestEntry[]} */
  const coverage = [];
  /** @type {string[]} */
  const pending = [];

  ts.forEachChild(sourceFile, (node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const decl of node.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name)) continue;
      const name = decl.name.text;
      if (name === 'STORAGE_RULES_COVERAGE') {
        extractCoverageArray(decl.initializer, coverage);
      } else if (name === 'STORAGE_RULES_PENDING') {
        extractPendingArray(decl.initializer, pending);
      }
    }
  });

  return { coverage, pending };
}

/**
 * Walk an array literal of object literals and extract (pathId, pattern,
 * testFile, rulesRange) from each entry.
 *
 * @param {ts.Expression | undefined} init
 * @param {ManifestEntry[]} out
 */
function extractCoverageArray(init, out) {
  if (!init) return;
  const arr = unwrapAsConst(init);
  if (!arr || !ts.isArrayLiteralExpression(arr)) return;

  for (const el of arr.elements) {
    if (!ts.isObjectLiteralExpression(el)) continue;
    const entry = { pathId: '', pattern: '', testFile: '', rulesRange: [0, 0] };
    for (const prop of el.properties) {
      if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) continue;
      const key = prop.name.text;
      if (key === 'pathId' && ts.isStringLiteral(prop.initializer)) {
        entry.pathId = prop.initializer.text;
      } else if (key === 'pattern' && ts.isStringLiteral(prop.initializer)) {
        entry.pattern = prop.initializer.text;
      } else if (key === 'testFile' && ts.isStringLiteral(prop.initializer)) {
        entry.testFile = prop.initializer.text;
      } else if (key === 'rulesRange' && ts.isArrayLiteralExpression(prop.initializer)) {
        const nums = prop.initializer.elements
          .filter(ts.isNumericLiteral)
          .map((n) => Number(n.text));
        if (nums.length === 2) entry.rulesRange = [nums[0], nums[1]];
      }
    }
    if (entry.pathId && entry.testFile) out.push(entry);
  }
}

/**
 * Walk an array literal of string literals and collect values.
 *
 * @param {ts.Expression | undefined} init
 * @param {string[]} out
 */
function extractPendingArray(init, out) {
  if (!init) return;
  const arr = unwrapAsConst(init);
  if (!arr || !ts.isArrayLiteralExpression(arr)) return;
  for (const el of arr.elements) {
    if (ts.isStringLiteral(el)) out.push(el.text);
  }
}

/**
 * Unwrap `... as const` — the manifest uses `as const` assertions which
 * wrap the array in a `SatisfiesExpression` or `AsExpression` node.
 *
 * @param {ts.Expression} expr
 * @returns {ts.Expression}
 */
function unwrapAsConst(expr) {
  if (!expr) return expr;
  if (ts.isSatisfiesExpression && ts.isSatisfiesExpression(expr)) return expr.expression;
  if (ts.isAsExpression(expr)) return expr.expression;
  return expr;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isStorageRulesTouched(fileList) {
  return fileList.some(
    (f) =>
      f === 'storage.rules' ||
      f.startsWith('tests/storage-rules/'),
  );
}

function shouldRun(fileList) {
  if (MODE_ALL || fileList.length === 0) return true;
  return isStorageRulesTouched(fileList);
}

// ---------------------------------------------------------------------------
// Main validation
// ---------------------------------------------------------------------------

function main() {
  if (!shouldRun(targets)) {
    if (VERBOSE) log(`${C.dim}CHECK 3.19: no storage.rules or tests/storage-rules/ files staged — skip${C.reset}`);
    process.exit(0);
  }

  /** @type {string[]} */
  const violations = [];

  // --- parse sources ---
  let blocks;
  try {
    blocks = parseStorageRulesBlocks();
  } catch (e) {
    violations.push(`storage.rules parse error: ${e.message}`);
    printReport(violations);
    process.exit(1);
  }

  let manifest;
  try {
    manifest = parseManifest();
  } catch (e) {
    violations.push(`coverage-manifest.ts parse error: ${e.message}`);
    printReport(violations);
    process.exit(1);
  }

  const { coverage, pending } = manifest;

  if (VERBOSE) {
    log(`${C.cyan}CHECK 3.19 — Storage Rules Coverage${C.reset}`);
    log(`  storage.rules match blocks : ${blocks.length}`);
    log(`  coverage entries           : ${coverage.length}`);
    log(`  pending entries            : ${pending.length}`);
  }

  // Validation B — every coverage entry has an existing test file
  for (const entry of coverage) {
    const absTestFile = path.join(PROJECT_ROOT, entry.testFile);
    if (!fs.existsSync(absTestFile)) {
      violations.push(
        `[B] Missing test file for pathId '${entry.pathId}': ${entry.testFile}`,
      );
    } else {
      const testSource = fs.readFileSync(absTestFile, 'utf8');

      // Validation C — test file exports COVERAGE referencing the pathId
      const exportsCoverage = testSource.includes('export const COVERAGE');
      const referencesPathId = testSource.includes(`pathId === '${entry.pathId}'`);
      if (!exportsCoverage || !referencesPathId) {
        violations.push(
          `[C] Test file for '${entry.pathId}' missing \`export const COVERAGE\` or ` +
            `pathId reference: ${entry.testFile}`,
        );
      }

      // Validation D — matrix is iterated, not hand-copied
      if (!testSource.includes('for (const cell of COVERAGE.matrix)')) {
        violations.push(
          `[D] Test file for '${entry.pathId}' must iterate matrix via ` +
            `\`for (const cell of COVERAGE.matrix)\`: ${entry.testFile}`,
        );
      }
    }
  }

  // Validation E (ratchet) — an inner match block with NO `@pathId` annotation
  // cannot ship: a new storage path must carry a stable identity.
  for (const block of blocks) {
    if (!block.pathId) {
      violations.push(
        `[E] storage.rules match block at line ${block.lineStart} (${block.matchPath}) ` +
          `has no \`// @pathId:\` annotation — every inner match block needs a stable identity.`,
      );
    }
  }

  // Validation F — a duplicate `@pathId` across blocks breaks identity mapping.
  for (const dupId of findDuplicatePathIds(blocks)) {
    violations.push(
      `[F] Duplicate \`@pathId\` '${dupId}' — a pathId must identify exactly one match block.`,
    );
  }

  // Validation A — every match block in storage.rules is accounted for BY
  // IDENTITY: its `@pathId` appears in STORAGE_RULES_COVERAGE, or its full
  // matchPath appears (exactly) in STORAGE_RULES_PENDING. Line numbers are
  // irrelevant, so inserting a line above a block cannot unmoor it. Blocks with
  // a null pathId are skipped here — Validation E already flags them.
  for (const block of blocks) {
    if (!block.pathId) continue;
    const inCoverage = coverage.some((e) => e.pathId === block.pathId);
    const inPending = pending.some((p) => p === block.matchPath);

    if (!inCoverage && !inPending) {
      violations.push(
        `[A] storage.rules match block '${block.pathId}' (${block.matchPath}, line ` +
          `${block.lineStart}) is not covered by any STORAGE_RULES_COVERAGE entry ` +
          `(by pathId) or STORAGE_RULES_PENDING entry (by exact matchPath).`,
      );
    }
  }

  printReport(violations);
  process.exit(violations.length > 0 ? 1 : 0);
}

/**
 * @param {string[]} violations
 */
function printReport(violations) {
  if (violations.length === 0) {
    if (VERBOSE) {
      log(`${C.green}✔ CHECK 3.19 — Storage rules coverage: OK${C.reset}`);
    }
    return;
  }

  log('');
  log(`${C.red}╔════════════════════════════════════════════════════════════════╗${C.reset}`);
  log(`${C.red}║  CHECK 3.19 — Storage Rules Coverage VIOLATIONS               ║${C.reset}`);
  log(`${C.red}╚════════════════════════════════════════════════════════════════╝${C.reset}`);
  log('');

  for (const v of violations) {
    log(`  ${C.red}✖${C.reset}  ${v}`);
  }

  log('');
  log(`  ${C.yellow}Fix: add test suites to tests/storage-rules/suites/ and register${C.reset}`);
  log(`  ${C.yellow}       them in tests/storage-rules/_registry/coverage-manifest.ts${C.reset}`);
  log(`  ${C.yellow}Audit: node scripts/check-storage-rules-test-coverage.js --all --verbose${C.reset}`);
  log('');
}

main();
