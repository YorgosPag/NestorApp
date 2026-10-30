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
 *      STORAGE_RULES_COVERAGE (pathId, pattern, testFile) and
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
 * `rulesRange` IS GONE (ADR-841 §7 Α21.14).
 *
 * 🔴 These three lines used to read: "`rulesRange` is now DOCUMENTATION ONLY … a
 * non-blocking `--verbose` warning is emitted if a range no longer contains its block's
 * parsed start line." **The warning was never written.** Nothing in this file ever read
 * `entry.rulesRange` after parsing it — so the sentence described a guard that did not
 * exist, next to a field nobody validated. Measured 2026-08-24: ALL 11 entries had
 * drifted. Same field on the Firestore side, measured 2026-09-08: 124 of 127 wrong (98%),
 * worst drift 1853 lines.
 *
 * The location is now GENERATED on demand (`--map`), from storage.rules itself — so there
 * is no stored value left to rot. This mirrors the industry practice the project already
 * follows for baselines: PHPStan states "No line numbers" as a deliberate trade-off, and
 * ESLint bulk suppressions (v9.24+) store `{file: {rule: {count}}}` with no line at all.
 *
 * CLI:
 *   node scripts/check-storage-rules-test-coverage.js                # staged files
 *   node scripts/check-storage-rules-test-coverage.js --all          # full scan
 *   node scripts/check-storage-rules-test-coverage.js --verbose      # extra output
 *   node scripts/check-storage-rules-test-coverage.js --map          # pathId → rules lines
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

const path = require('node:path');
const ts = require('typescript');
const { commitInput } = require('./lib/gate-input');
const {
  parseStorageRules,
  findDuplicatePathIds,
} = require('./_shared/storage-rules-parser');
const { renderRulesLocationMap } = require('./_shared/rules-location-map');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '..');
// ADR-924: σχετικά με τη ρίζα — κάθε ανάγνωση περνά από την ΕΙΣΟΔΟ (`--index` ⇒ η όψη του commit).
const STORAGE_RULES_FILE = 'storage.rules';
const MANIFEST_FILE = 'tests/storage-rules/_registry/coverage-manifest.ts';

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const targets = args.filter((a) => !a.startsWith('--'));
const MODE_ALL = flags.has('--all');
const VERBOSE = flags.has('--verbose');
/** 🏆 Ο **παραγόμενος** δείκτης προς τους κανόνες — δες ADR-841 §7 Α21.14. */
const MODE_MAP = flags.has('--map');

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
function parseStorageRulesBlocks(input) {
  const source = input.read(STORAGE_RULES_FILE);
  if (source === null) {
    throw new Error(`storage.rules not found at: ${STORAGE_RULES_FILE}`);
  }
  return parseStorageRules(source);
}

// ---------------------------------------------------------------------------
// Manifest parser — TypeScript AST walker
// ---------------------------------------------------------------------------

/**
 * @typedef {{ pathId: string, pattern: string, testFile: string }} ManifestEntry
 * @typedef {{ coverage: ManifestEntry[], pending: string[] }} ParsedManifest
 */

/**
 * @returns {ParsedManifest}
 */
function parseManifest(input) {
  const source = input.read(MANIFEST_FILE);
  if (source === null) {
    throw new Error(
      `Coverage manifest not found at: ${MANIFEST_FILE}\n` +
        'Run: create tests/storage-rules/_registry/coverage-manifest.ts',
    );
  }

  const sourceFile = ts.createSourceFile(
    path.join(PROJECT_ROOT, MANIFEST_FILE),
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
 * testFile) from each entry.
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
    const entry = { pathId: '', pattern: '', testFile: '' };
    for (const prop of el.properties) {
      if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) continue;
      const key = prop.name.text;
      if (key === 'pathId' && ts.isStringLiteral(prop.initializer)) {
        entry.pathId = prop.initializer.text;
      } else if (key === 'pattern' && ts.isStringLiteral(prop.initializer)) {
        entry.pattern = prop.initializer.text;
      } else if (key === 'testFile' && ts.isStringLiteral(prop.initializer)) {
        entry.testFile = prop.initializer.text;
      }
      // ⛔ **No `rulesRange`** — removed in Α21.14. See the header: the field was parsed
      //    here and read nowhere, next to a comment promising a drift warning that was
      //    never implemented. The location is generated by `--map` instead.
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

/**
 * 🏆 **Ο ΠΑΡΑΓΟΜΕΝΟΣ ΔΕΙΚΤΗΣ** — *«σε ποιες γραμμές ζει το path που καλύπτω;»*
 *
 * Αντικατέστησε το χειρόγραφο `rulesRange` *(ADR-841 §7 Α21.14)*. Δεν αποθηκεύεται
 * τίποτα, άρα δεν υπάρχει τιμή να παλιώσει.
 *
 * ⚠️ **Η ταυτότητα είναι το `@pathId`**, όχι η γραμμή — όπως ακριβώς την όρισε το
 * ADR-657 §3.3. Ένα block χωρίς annotation εμφανίζεται με τη διαδρομή του, γιατί αυτό
 * **είναι** το εύρημα: το Validation E το μπλοκάρει ούτως ή άλλως.
 *
 * @param {ReturnType<typeof parseStorageRulesBlocks>} blocks
 * @param {ParsedManifest} manifest
 */
function printLocationMap(blocks, manifest) {
  const covered = blocks.filter((b) => b.pathId && manifest.pending.includes(b.matchPath));
  const rendered = renderRulesLocationMap({
    blocks: blocks.map((b) => ({
      identity: b.pathId ?? `(χωρίς @pathId) ${b.matchPath}`,
      lineStart: b.lineStart,
      lineEnd: b.lineEnd,
    })),
    registered: [...manifest.coverage.map((e) => e.pathId), ...covered.map((b) => b.pathId)],
    rulesFileName: 'storage.rules',
    title: 'CHECK 3.19 — pathId → storage.rules (ΠΑΡΑΓΟΜΕΝΟ)',
    colors: C,
  });
  for (const line of rendered) log(line);
}

function main() {
  if (!shouldRun(targets) && !MODE_MAP) {
    if (VERBOSE) log(`${C.dim}CHECK 3.19: no storage.rules or tests/storage-rules/ files staged — skip${C.reset}`);
    process.exit(0);
  }

  /** @type {string[]} */
  const violations = [];
  const input = commitInput(PROJECT_ROOT);

  // --- parse sources ---
  let blocks;
  try {
    blocks = parseStorageRulesBlocks(input);
  } catch (e) {
    violations.push(`storage.rules parse error: ${e.message}`);
    printReport(violations);
    process.exit(1);
  }

  let manifest;
  try {
    manifest = parseManifest(input);
  } catch (e) {
    violations.push(`coverage-manifest.ts parse error: ${e.message}`);
    printReport(violations);
    process.exit(1);
  }

  if (MODE_MAP) {
    printLocationMap(blocks, manifest);
    process.exit(0);
  }

  const { coverage, pending } = manifest;

  if (VERBOSE) {
    log(`${C.cyan}CHECK 3.19 — Storage Rules Coverage${C.reset}`);
    log(`  storage.rules match blocks : ${blocks.length}`);
    log(`  coverage entries           : ${coverage.length}`);
    log(`  pending entries            : ${pending.length}`);
  }

  violations.push(...validateTestFiles(coverage, input));

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
 * Validations B–D — κάθε εγγραφή κάλυψης έχει σουίτα, η σουίτα εξάγει `COVERAGE` με το pathId της και διατρέχει
 * τον πίνακα. Το κείμενο της σουίτας από την ΕΙΣΟΔΟ (ADR-924 Φ3).
 * @param {ManifestEntry[]} coverage
 * @returns {string[]}
 */
function validateTestFiles(coverage, input) {
  const violations = [];
  for (const entry of coverage) {
    const testSource = input.read(entry.testFile);
    if (testSource === null) {
      violations.push(`[B] Missing test file for pathId '${entry.pathId}': ${entry.testFile}`);
      continue;
    }
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
  return violations;
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

if (require.main === module) main();

module.exports = { parseStorageRulesBlocks, parseManifest, validateTestFiles };
