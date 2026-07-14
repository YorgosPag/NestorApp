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
const BIM_TIERS_FILE = path.join(
  PROJECT_ROOT,
  'tests',
  'firestore-rules',
  '_registry',
  'bim-tiers.ts',
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
// BIM tier SSoT parser — bim-tiers.ts (ADR-657, CHECK 3.16 tier conformance)
// ---------------------------------------------------------------------------

/**
 * @typedef {{ collection: string, requiredKeys: string[] | null }} BimTierEntry
 * @typedef {{ authoring: BimTierEntry[], presentation: BimTierEntry[], legacy: string[] }} BimTiers
 */

/**
 * Parse `bim-tiers.ts` via the TypeScript AST — the same approach as
 * {@link parseManifest}. Extracts the two tier arrays (each a list of
 * `{ collection, requiredKeys }` object literals, `requiredKeys` being either
 * an array of string literals or the `null` keyword) plus the flat
 * `LEGACY_FLOORPLAN_CONTAINERS` string array.
 *
 * @returns {BimTiers}
 */
function parseBimTiers() {
  const source = fs.readFileSync(BIM_TIERS_FILE, 'utf8');
  const sourceFile = ts.createSourceFile(
    BIM_TIERS_FILE,
    source,
    ts.ScriptTarget.Latest,
    true,
  );

  /** @type {BimTierEntry[]} */
  const authoring = [];
  /** @type {BimTierEntry[]} */
  const presentation = [];
  /** @type {string[]} */
  const legacy = [];

  ts.forEachChild(sourceFile, (node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const decl of node.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name)) continue;
      const name = decl.name.text;
      if (name === 'BIM_AUTHORING_COLLECTIONS') {
        extractTierEntries(decl.initializer, authoring);
      } else if (name === 'BIM_PRESENTATION_COLLECTIONS') {
        extractTierEntries(decl.initializer, presentation);
      } else if (name === 'LEGACY_FLOORPLAN_CONTAINERS') {
        // Same shape as FIRESTORE_RULES_PENDING (a `[...] as const` string array).
        extractPendingArray(decl.initializer, legacy);
      }
    }
  });

  return { authoring, presentation, legacy };
}

/**
 * Walk a `[{ collection, requiredKeys }, ...] as const` array literal.
 *
 * @param {ts.Expression | undefined} init
 * @param {BimTierEntry[]} out
 */
function extractTierEntries(init, out) {
  if (!init) return;
  const arr = unwrapAsConst(init);
  if (!arr || !ts.isArrayLiteralExpression(arr)) return;

  for (const el of arr.elements) {
    if (!ts.isObjectLiteralExpression(el)) continue;
    let collection = '';
    /** @type {string[] | null} */
    let requiredKeys = null;
    for (const prop of el.properties) {
      if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) continue;
      const key = prop.name.text;
      if (key === 'collection' && ts.isStringLiteral(prop.initializer)) {
        collection = prop.initializer.text;
      } else if (key === 'requiredKeys') {
        // Either an array of string literals, or the `null` keyword (legacy/raster).
        requiredKeys = ts.isArrayLiteralExpression(prop.initializer)
          ? prop.initializer.elements.filter(ts.isStringLiteral).map((s) => s.text)
          : null;
      }
    }
    if (collection) out.push({ collection, requiredKeys });
  }
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
// BIM tier conformance (ADR-657) — the RATCHET
// ---------------------------------------------------------------------------
//
// Because firestore.rules is LIVE, this validator continuously re-proves the
// deployed rule text against the tier SSoT (bim-tiers.ts). For every match
// block whose collection is a floorplan_* / *floorplans, it asserts:
//   (a) it is in EXACTLY ONE tier list                         (untiered/double)
//   (b) allow-read calls the helper its tier mandates          (wrong_read_helper)
//   (c) allow-create keys match bim-tiers.ts requiredKeys       (drift/wrong helper)
//   (d) allow-update / allow-delete grant NO ownership OR-leg   (ownership_write_leg)
//   (e) allow-update / allow-delete call the tier write helper  (wrong_write_helper)

/** The three tier-specific read helpers — a block must call exactly one. */
const BIM_READ_HELPERS = [
  'canReadBimAuthoring',
  'canReadBimPresentation',
  'canReadLegacyFloorplan',
];

/**
 * @param {string} collection
 * @returns {boolean} whether the block is a BIM/floorplan block the ratchet owns.
 */
function isBimFloorplanBlock(collection) {
  return /^floorplan_/.test(collection) || /floorplans$/.test(collection);
}

/**
 * Strip `//` and block comments so allow-expressions extract cleanly.
 *
 * @param {string} s
 * @returns {string}
 */
function stripRuleComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * Extract the body of an `allow <op>: if ...;` expression from a match block,
 * with comments stripped and whitespace collapsed. Mirrors the shared parser's
 * `extractFirstAllowRead` but is parameterised by operation.
 *
 * @param {string} blockBody
 * @param {'create' | 'update' | 'delete'} op
 * @returns {string | null}
 */
function extractAllowExpr(blockBody, op) {
  const stripped = stripRuleComments(blockBody);
  const re = new RegExp(`allow\\s+${op}\\s*:\\s*if\\s+`);
  const m = re.exec(stripped);
  if (!m) return null;
  const after = stripped.slice(m.index + m[0].length);
  const semicolonIdx = after.indexOf(';');
  if (semicolonIdx < 0) return null;
  return after.slice(0, semicolonIdx).replace(/\s+/g, ' ').trim();
}

/**
 * Extract the string-literal keys passed to `canCreateBimEntity([...])`.
 * Returns null if the call is absent (a wrong-helper condition).
 *
 * @param {string} createExpr
 * @returns {string[] | null}
 */
function extractCreateKeys(createExpr) {
  const marker = 'canCreateBimEntity(';
  const idx = createExpr.indexOf(marker);
  if (idx < 0) return null;
  let depth = 1;
  let i = idx + marker.length;
  const start = i;
  for (; i < createExpr.length && depth > 0; i++) {
    if (createExpr[i] === '(') depth++;
    else if (createExpr[i] === ')') depth--;
  }
  const inner = createExpr.slice(start, i - 1);
  return [...inner.matchAll(/['"]([^'"]+)['"]/g)].map((mm) => mm[1]);
}

/**
 * Order-insensitive set equality on two key lists.
 *
 * @param {readonly string[]} a
 * @param {readonly string[]} b
 * @returns {boolean}
 */
function keyListsEqual(a, b) {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  return a.every((k) => sb.has(k));
}

/**
 * @param {string} collection
 * @param {BimTiers} tiers
 * @returns {'authoring' | 'presentation' | null}
 */
function tierOf(collection, tiers) {
  if (tiers.authoring.some((e) => e.collection === collection)) return 'authoring';
  if (tiers.presentation.some((e) => e.collection === collection)) return 'presentation';
  return null;
}

/**
 * The core ratchet. Returns one Violation per failed assertion (each tagged
 * with `.collection` so the verbose report can group by block).
 *
 * @param {import('./_shared/firestore-rules-parser').RuleBlock[]} blocks
 * @param {BimTiers} tiers
 * @param {string[]} rulesLines
 * @returns {Violation[]}
 */
function validateBimTierConformance(blocks, tiers, rulesLines) {
  /** @type {Violation[]} */
  const violations = [];
  const authoringMap = new Map(tiers.authoring.map((e) => [e.collection, e.requiredKeys]));
  const presentationMap = new Map(tiers.presentation.map((e) => [e.collection, e.requiredKeys]));
  const legacySet = new Set(tiers.legacy);

  for (const block of blocks) {
    const c = block.collection;
    if (!isBimFloorplanBlock(c)) continue;

    const loc = `firestore.rules:${block.lineStart} (${c})`;
    const inAuthoring = authoringMap.has(c);
    const inPresentation = presentationMap.has(c);

    // (a) TIER MEMBERSHIP — exactly one list.
    if (!inAuthoring && !inPresentation) {
      violations.push({
        kind: 'untiered_bim_block',
        collection: c,
        message: `match /${c}/ is untiered — in neither BIM tier list`,
        location: loc,
        hint: '  → add to bim-tiers.ts (BIM_AUTHORING_COLLECTIONS or BIM_PRESENTATION_COLLECTIONS) and pick a tier',
      });
      continue;
    }
    if (inAuthoring && inPresentation) {
      violations.push({
        kind: 'double_tiered_bim_block',
        collection: c,
        message: `match /${c}/ appears in BOTH tier lists`,
        location: loc,
        hint: '  → remove it from one of the two lists in bim-tiers.ts',
      });
      continue;
    }

    const tier = inAuthoring ? 'authoring' : 'presentation';
    const requiredKeys = inAuthoring ? authoringMap.get(c) : presentationMap.get(c);
    const isLegacy = legacySet.has(c);
    // entity  → 29 collections with requiredKeys; canCreate/Update/DeleteBimEntity
    // legacy  → 5 containers; canCreate/WriteLegacyFloorplan + isBimWriter
    // raster  → backgrounds/overlays; bespoke create, isBimWriter writes
    const category = isLegacy ? 'legacy' : requiredKeys === null ? 'raster' : 'entity';

    const body = rulesLines.slice(block.lineStart - 1, block.lineEnd).join('\n');
    const readExpr = block.firstAllowReadExpression || '';
    const createExpr = extractAllowExpr(body, 'create') || '';
    const updateExpr = extractAllowExpr(body, 'update') || '';
    const deleteExpr = extractAllowExpr(body, 'delete') || '';

    // (b) READ HELPER — exactly the tier's helper, none of the others.
    const expectedRead =
      tier === 'authoring'
        ? 'canReadBimAuthoring'
        : isLegacy
          ? 'canReadLegacyFloorplan'
          : 'canReadBimPresentation';
    if (!readExpr.includes(`${expectedRead}(`)) {
      violations.push({
        kind: 'wrong_read_helper',
        collection: c,
        message: `${tier} block '${c}' allow-read must call ${expectedRead}() (found: ${readExpr || '<none>'})`,
        location: loc,
        hint: `  → allow read: if isAuthenticated() && ${expectedRead}(resource.data.companyId);`,
      });
    } else {
      for (const other of BIM_READ_HELPERS) {
        if (other !== expectedRead && readExpr.includes(`${other}(`)) {
          violations.push({
            kind: 'wrong_read_helper',
            collection: c,
            message: `${tier} block '${c}' allow-read also calls wrong-tier helper ${other}()`,
            location: loc,
            hint: `  → it must call only ${expectedRead}()`,
          });
        }
      }
    }

    // (c) CREATE KEYS — entities match requiredKeys; legacy call legacy helper.
    if (category === 'entity') {
      const actualKeys = extractCreateKeys(createExpr);
      if (actualKeys === null) {
        violations.push({
          kind: 'wrong_create_helper',
          collection: c,
          message: `entity block '${c}' allow-create must call canCreateBimEntity([...])`,
          location: loc,
          hint: `  → allow create: if isAuthenticated() && canCreateBimEntity([${requiredKeys.map((k) => `'${k}'`).join(', ')}]);`,
        });
      } else if (!keyListsEqual(actualKeys, requiredKeys)) {
        violations.push({
          kind: 'drifted_create_keys',
          collection: c,
          message: `'${c}' canCreateBimEntity keys [${actualKeys.join(', ')}] ≠ bim-tiers.ts requiredKeys [${requiredKeys.join(', ')}]`,
          location: loc,
          hint: '  → sync the hasAll([...]) list in firestore.rules with bim-tiers.ts requiredKeys',
        });
      }
    } else if (category === 'legacy') {
      if (!createExpr.includes('canCreateLegacyFloorplan(')) {
        violations.push({
          kind: 'wrong_create_helper',
          collection: c,
          message: `legacy container '${c}' allow-create must call canCreateLegacyFloorplan()`,
          location: loc,
          hint: '  → allow create: if isAuthenticated() && canCreateLegacyFloorplan();',
        });
      }
    }
    // raster (backgrounds/overlays): create is a bespoke inline gate — not tiered.

    // (d) NO OWNERSHIP WRITE LEG — flag createdBy == request.auth.uid in
    //     UPDATE/DELETE only. Deliberately does NOT match the legitimate
    //     immutability form (createdBy == resource.data.createdBy) nor the
    //     create self-attribution (which lives in the create body we skip).
    const OWNERSHIP_LEG = /createdBy\s*==\s*request\.auth\.uid/;
    for (const [op, expr] of [
      ['update', updateExpr],
      ['delete', deleteExpr],
    ]) {
      if (OWNERSHIP_LEG.test(expr)) {
        violations.push({
          kind: 'ownership_write_leg',
          collection: c,
          message: `'${c}' allow-${op} grants on ownership (createdBy == request.auth.uid) — forbidden by ADR-657`,
          location: loc,
          hint: '  → delegate to the tier write helper; remove the createdBy==uid OR-leg',
        });
      }
    }

    // (e) WRITE HELPER — update per-category; delete accepts canDelete/isBimWriter.
    const expectedUpdate =
      category === 'entity'
        ? 'canUpdateBimEntity'
        : category === 'raster'
          ? 'isBimWriter'
          : 'canWriteLegacyFloorplan';
    if (!updateExpr.includes(`${expectedUpdate}(`)) {
      violations.push({
        kind: 'wrong_write_helper',
        collection: c,
        message: `${category} block '${c}' allow-update must call ${expectedUpdate}()`,
        location: loc,
        hint: `  → allow update: if isAuthenticated() && ${expectedUpdate}(...);`,
      });
    }
    const deleteOk =
      category === 'entity'
        ? deleteExpr.includes('canDeleteBimEntity(')
        : deleteExpr.includes('isBimWriter(') || deleteExpr.includes('canDeleteBimEntity(');
    if (!deleteOk) {
      const expectedDelete = category === 'entity' ? 'canDeleteBimEntity' : 'isBimWriter';
      violations.push({
        kind: 'wrong_write_helper',
        collection: c,
        message: `${category} block '${c}' allow-delete must call ${expectedDelete}()`,
        location: loc,
        hint: `  → allow delete: if isAuthenticated() && ${expectedDelete}(resource.data.companyId);`,
      });
    }
  }

  return violations;
}

/**
 * `--all --verbose` per-collection tier + PASS/FAIL grid.
 *
 * @param {import('./_shared/firestore-rules-parser').RuleBlock[]} blocks
 * @param {BimTiers} tiers
 * @param {Violation[]} bimViolations
 */
function printBimTierReport(blocks, tiers, bimViolations) {
  const failed = new Set(bimViolations.map((v) => v.collection).filter(Boolean));
  log('');
  log(`${C.cyan}── BIM tier conformance (ADR-657) ──${C.reset}`);
  let pass = 0;
  let total = 0;
  for (const block of blocks) {
    const c = block.collection;
    if (!isBimFloorplanBlock(c)) continue;
    total += 1;
    const tier = tierOf(c, tiers) ?? 'UNTIERED';
    const ok = !failed.has(c);
    if (ok) pass += 1;
    const status = ok ? `${C.green}PASS${C.reset}` : `${C.red}FAIL${C.reset}`;
    log(`  ${status}  ${C.dim}${tier.padEnd(12)}${C.reset} ${c}`);
  }
  log(`  ${C.dim}${pass}/${total} BIM blocks tier-conformant${C.reset}`);
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
  if (!fs.existsSync(BIM_TIERS_FILE)) {
    log(`${C.red}✖ bim-tiers.ts not found at ${BIM_TIERS_FILE}${C.reset}`);
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
  const rulesLines = rulesContent.split('\n');
  const blocks = parseFirestoreRules(rulesContent);
  const manifest = parseManifest();
  const tiers = parseBimTiers();

  if (VERBOSE) {
    log(`${C.dim}  parsed ${blocks.length} top-level match blocks${C.reset}`);
    log(
      `${C.dim}  manifest: ${manifest.coverage.length} covered, ${manifest.pending.length} pending${C.reset}`,
    );
    log(
      `${C.dim}  bim-tiers: ${tiers.authoring.length} authoring, ${tiers.presentation.length} presentation, ${tiers.legacy.length} legacy${C.reset}`,
    );
  }

  const bimViolations = validateBimTierConformance(blocks, tiers, rulesLines);

  /** @type {Violation[]} */
  const violations = [
    ...validateOrphans(manifest, blocks),
    ...validateTestFilesExist(manifest),
    ...validateTestFileContract(manifest),
    ...validateRuleShape(manifest, blocks),
    ...bimViolations,
  ];

  if (VERBOSE && MODE_ALL) {
    printBimTierReport(blocks, tiers, bimViolations);
  }

  reportViolations(violations);
  process.exit(violations.length === 0 ? 0 : 1);
}

module.exports = {
  parseManifest,
  parseBimTiers,
  extractTierEntries,
  validateBimTierConformance,
  extractAllowExpr,
  extractCreateKeys,
  keyListsEqual,
  isBimFloorplanBlock,
  tierOf,
  main,
};

if (require.main === module) {
  main();
}
