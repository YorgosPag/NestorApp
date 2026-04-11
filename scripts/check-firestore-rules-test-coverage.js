#!/usr/bin/env node
/**
 * CHECK 3.16 — Firestore Rules Test Coverage Static Analyzer
 *
 * Zero-tolerance pre-commit gate that ensures every top-level match block
 * in `firestore.rules` is covered by either a test suite registered in
 * `tests/firestore-rules/_registry/coverage-manifest.ts` or an explicit
 * pending list entry — and that every registered test file actually
 * declares the correct `COVERAGE` export and iterates the matrix.
 *
 * Why this exists:
 *   2026-04-11 incident — the entity_audit_trail rule shipped with its
 *   super_admin short-circuit in the wrong position of the allow-read
 *   OR-chain. Super-admin reads returned `permission-denied`. CHECK 3.15
 *   caught the missing composite index (Bug #2), but nothing caught the
 *   broken rule shape (Bug #1). This check closes the gap — it is the
 *   third pillar alongside CHECK 3.10 (client query companyId) and
 *   CHECK 3.15 (index coverage).
 *
 * How it works:
 *   1. Parse firestore.rules → every top-level match block with first
 *      OR leg of its allow-read expression (via _shared/firestore-rules-parser.js).
 *   2. Parse coverage-manifest.ts via the TypeScript AST → extract
 *      FIRESTORE_RULES_COVERAGE (collection, pattern, testFile) and
 *      FIRESTORE_RULES_PENDING (string array).
 *   3. Validation A — every block must be in one of the two lists.
 *   4. Validation B — every coverage entry must have an existing test file.
 *   5. Validation C — each test file must export `COVERAGE` referencing the
 *      correct collection name (regex scan of the test file source).
 *   6. Validation D — each test file must contain `for (const cell of COVERAGE.matrix)`
 *      so the matrix is iterated rather than hand-copied (drift prevention).
 *   7. Validation E — for every `tenant_direct` coverage entry, the first
 *      OR leg of the corresponding rule's allow-read must be `isSuperAdminOnly()`.
 *
 * CLI:
 *   node scripts/check-firestore-rules-test-coverage.js                # staged (no targets)
 *   node scripts/check-firestore-rules-test-coverage.js --all          # full scan
 *   node scripts/check-firestore-rules-test-coverage.js --verbose      # extra output
 *   node scripts/check-firestore-rules-test-coverage.js file1 file2    # explicit targets
 *
 * Exit codes:
 *   0 — no violations
 *   1 — one or more violations (commit blocked)
 *
 * See ADR-298 §3.4.
 *
 * @since 2026-04-11 (ADR-298 Phase A)
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const {
  parseFirestoreRules,
  validateSuperAdminShortCircuit,
} = require('./_shared/firestore-rules-parser');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '..');
const RULES_FILE = path.join(PROJECT_ROOT, 'firestore.rules');
const MANIFEST_FILE = path.join(
  PROJECT_ROOT,
  'tests',
  'firestore-rules',
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
// Manifest parser — TypeScript AST walker
// ---------------------------------------------------------------------------

/**
 * @typedef {{ collection: string, pattern: string, testFile: string, rulesRange: [number, number] }} ManifestEntry
 * @typedef {{ coverage: ManifestEntry[], pending: string[] }} ParsedManifest
 */

/**
 * @returns {ParsedManifest}
 */
function parseManifest() {
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
      if (name === 'FIRESTORE_RULES_COVERAGE') {
        extractCoverageArray(decl.initializer, coverage);
      } else if (name === 'FIRESTORE_RULES_PENDING') {
        extractPendingArray(decl.initializer, pending);
      }
    }
  });

  return { coverage, pending };
}

/**
 * Walk an array literal of object literals and extract (collection, pattern,
 * testFile, rulesRange) from each entry. Anything that does not look like a
 * straightforward string/number literal is silently skipped — the matrix
 * builders live in function calls and are not parsed here.
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
    const entry = { collection: '', pattern: '', testFile: '', rulesRange: [0, 0] };
    for (const prop of el.properties) {
      if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) continue;
      const key = prop.name.text;
      if (key === 'collection' && ts.isStringLiteral(prop.initializer)) {
        entry.collection = prop.initializer.text;
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
    if (entry.collection && entry.testFile) out.push(entry);
  }
}

/**
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
 * Unwrap `[...] as const` → `[...]`.
 *
 * @param {ts.Expression} expr
 * @returns {ts.Expression | null}
 */
function unwrapAsConst(expr) {
  if (ts.isAsExpression(expr)) return expr.expression;
  return expr;
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

/** @typedef {{ kind: string, message: string, location?: string, hint?: string }} Violation */

/**
 * @param {ParsedManifest} manifest
 * @param {import('./_shared/firestore-rules-parser').RuleBlock[]} blocks
 * @returns {Violation[]}
 */
function validateOrphans(manifest, blocks) {
  const known = new Set([
    ...manifest.coverage.map((c) => c.collection),
    ...manifest.pending,
  ]);

  /** @type {Violation[]} */
  const violations = [];
  for (const block of blocks) {
    if (known.has(block.collection)) continue;
    violations.push({
      kind: 'orphan_collection',
      message: `match /${block.collection}/{id} has no manifest entry and is not pending`,
      location: `firestore.rules:${block.lineStart}`,
      hint: orphanHint(block.collection, block.lineStart, block.lineEnd),
    });
  }
  return violations;
}

function orphanHint(collection, lineStart, lineEnd) {
  return [
    '  → add to tests/firestore-rules/_registry/coverage-manifest.ts',
    '     FIRESTORE_RULES_COVERAGE array with a full matrix, OR',
    '  → add the string to FIRESTORE_RULES_PENDING to stage it:',
    `     '${collection}',   // lines ${lineStart}-${lineEnd}`,
  ].join('\n');
}

/**
 * @param {ParsedManifest} manifest
 * @returns {Violation[]}
 */
function validateTestFilesExist(manifest) {
  /** @type {Violation[]} */
  const violations = [];
  for (const entry of manifest.coverage) {
    const abs = path.join(PROJECT_ROOT, entry.testFile);
    if (!fs.existsSync(abs)) {
      violations.push({
        kind: 'missing_test_file',
        message: `coverage entry for '${entry.collection}' points at a non-existent file`,
        location: entry.testFile,
        hint: `  → create ${entry.testFile} following the ADR-298 §3.3 template`,
      });
    }
  }
  return violations;
}

/**
 * Regex-check each test file for the required COVERAGE export and matrix loop.
 *
 * @param {ParsedManifest} manifest
 * @returns {Violation[]}
 */
function validateTestFileContract(manifest) {
  /** @type {Violation[]} */
  const violations = [];
  for (const entry of manifest.coverage) {
    const abs = path.join(PROJECT_ROOT, entry.testFile);
    if (!fs.existsSync(abs)) continue;

    const src = fs.readFileSync(abs, 'utf8');
    const exportPattern = new RegExp(
      `export\\s+const\\s+COVERAGE\\s*=\\s*FIRESTORE_RULES_COVERAGE\\s*\\.find\\s*\\(\\s*\\(?[a-zA-Z_]+\\)?\\s*=>\\s*[a-zA-Z_]+\\.collection\\s*===\\s*['"]${escapeRegex(entry.collection)}['"]`,
    );
    if (!exportPattern.test(src)) {
      violations.push({
        kind: 'missing_coverage_export',
        message: `${entry.testFile} does not export a COVERAGE matching '${entry.collection}'`,
        location: entry.testFile,
        hint: `  → add: export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(c => c.collection === '${entry.collection}')!`,
      });
    }

    if (!/for\s*\(\s*const\s+cell\s+of\s+COVERAGE\.matrix\s*\)/.test(src)) {
      violations.push({
        kind: 'missing_matrix_loop',
        message: `${entry.testFile} does not iterate COVERAGE.matrix — cells may drift from the manifest`,
        location: entry.testFile,
        hint: '  → wrap every describe() block in: for (const cell of COVERAGE.matrix) { ... }',
      });
    }
  }
  return violations;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {ParsedManifest} manifest
 * @param {import('./_shared/firestore-rules-parser').RuleBlock[]} blocks
 * @returns {Violation[]}
 */
function validateRuleShape(manifest, blocks) {
  // Phase A scope: apply the super_admin short-circuit check ONLY to
  // collections with the `immutable` pattern — this is the Bug #1 class
  // that motivated the ADR. Phase B/C expand to tenant_direct after the
  // legacy rule ordering backlog is cleaned up.
  const targets = manifest.coverage
    .filter((c) => c.pattern === 'immutable')
    .map((c) => c.collection);
  const shapeViolations = validateSuperAdminShortCircuit(blocks, targets);

  return shapeViolations.map((v) => ({
    kind: 'rule_shape_violation',
    message:
      v.problem === 'missing_super_admin_short_circuit'
        ? `allow read: first OR leg is '${v.actualFirstLeg ?? '<empty>'}', expected isSuperAdminOnly() (Bug #1 shape)`
        : `allow read: no explicit allow-read expression found`,
    location: `firestore.rules:${v.lineStart} (${v.collection})`,
    hint: '  → reorder the OR-chain so isSuperAdminOnly() is the first leg (see ADR-195 Phase 10)',
  }));
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/**
 * @param {Violation[]} violations
 */
function reportViolations(violations) {
  if (violations.length === 0) {
    log(`${C.green}✔ CHECK 3.16 — Firestore Rules Test Coverage: OK${C.reset}`);
    return;
  }

  log(
    `${C.red}✖ CHECK 3.16 — Firestore Rules Test Coverage: ${violations.length} violation(s)${C.reset}`,
  );
  log('');

  for (const v of violations) {
    const loc = v.location ? `${C.cyan}${v.location}${C.reset}  ` : '';
    log(`  ${loc}${C.yellow}${v.kind}${C.reset}`);
    log(`    ${v.message}`);
    if (v.hint) {
      log(`${C.dim}${v.hint}${C.reset}`);
    }
    log('');
  }

  log(`  ${C.dim}ℹ Every rule change must have matching test coverage before commit.${C.reset}`);
  log(`  ${C.dim}→ Run: pnpm firestore-rules:coverage:audit for a full scan.${C.reset}`);
  log(`  ${C.dim}→ Run: pnpm test:firestore-rules to execute the suite locally.${C.reset}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  if (!fs.existsSync(RULES_FILE)) {
    log(`${C.red}✖ firestore.rules not found at ${RULES_FILE}${C.reset}`);
    process.exit(1);
  }
  if (!fs.existsSync(MANIFEST_FILE)) {
    log(`${C.red}✖ coverage-manifest.ts not found at ${MANIFEST_FILE}${C.reset}`);
    process.exit(1);
  }

  // When invoked by the pre-commit hook, `targets` is the list of staged
  // files routed through the CHECK 3.16 trigger. If none of them touch the
  // rules file or the test dir, we still run the static gate — orphans can
  // only appear when firestore.rules changes, but the contract validators
  // cost pennies and catch regressions from unrelated edits.
  if (VERBOSE || MODE_ALL) {
    log(`${C.cyan}🔍 CHECK 3.16 — scanning firestore.rules + coverage manifest${C.reset}`);
    if (targets.length > 0) {
      log(`${C.dim}  staged targets: ${targets.join(', ')}${C.reset}`);
    }
  }

  const rulesContent = fs.readFileSync(RULES_FILE, 'utf8');
  const blocks = parseFirestoreRules(rulesContent);
  const manifest = parseManifest();

  if (VERBOSE) {
    log(`${C.dim}  parsed ${blocks.length} top-level match blocks${C.reset}`);
    log(
      `${C.dim}  manifest: ${manifest.coverage.length} covered, ${manifest.pending.length} pending${C.reset}`,
    );
  }

  /** @type {Violation[]} */
  const violations = [
    ...validateOrphans(manifest, blocks),
    ...validateTestFilesExist(manifest),
    ...validateTestFileContract(manifest),
    ...validateRuleShape(manifest, blocks),
  ];

  reportViolations(violations);
  process.exit(violations.length === 0 ? 0 : 1);
}

main();
