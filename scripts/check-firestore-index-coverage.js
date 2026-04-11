#!/usr/bin/env node
/**
 * CHECK 3.15 — Firestore Index Coverage Static Analyzer
 *
 * Zero-tolerance pre-commit gate that ensures every Firestore query routed
 * through the `firestoreQueryService` SSoT has a matching composite index
 * declared in `firestore.indexes.json`.
 *
 * Why this exists:
 *   2026-04-11 incident — a rule fix shipped with the super_admin read path
 *   expecting a 3-field composite index (entityType + entityId + timestamp
 *   DESC) on `entity_audit_trail` that did not exist. The query worked for
 *   company_admin (auto-injected companyId covered a different index) but
 *   failed with FAILED_PRECONDITION under super_admin. A static gate that
 *   derives both tenant variants from the SSoT call site and checks them
 *   against the committed index manifest would have caught it pre-push.
 *
 * How it works:
 *   1. Load firestore.indexes.json → build per-collection index catalog.
 *   2. Load src/config/firestore-collections.ts → KEY → collection name map.
 *   3. Load src/services/firestore/tenant-config.ts → KEY → tenant field
 *      (so we know which queries have companyId auto-injected).
 *   4. Walk the TypeScript AST of every staged (or, under --all, every)
 *      src/**\/*.{ts,tsx} file and pick out calls of the form:
 *          <ident>.subscribe(KEY, onData, onError, { constraints: [...] })
 *          <ident>.getAll(KEY, { constraints: [...] })
 *      where <ident> is a binding imported from the firestoreQueryService
 *      SSoT module (firestore-query.service / barrel re-export).
 *   5. Extract the constraints array — literal where()/orderBy() calls
 *      either inline or referenced via a local `const foo: QueryConstraint[]
 *      = [...]` declaration in the same file.
 *   6. Derive up to two QueryShapes per call: the default (tenant-injected)
 *      variant and, when the collection has auto-injected tenant, the
 *      super_admin variant (no tenant prefix). Both must be served by a
 *      matching index.
 *   7. Fail the commit if any required shape has no matching index.
 *
 * Scope / limitations (v1):
 *   - Only analyses `firestoreQueryService.subscribe` and `.getAll`.
 *     Direct `query()` + `getDocs()` usage is covered by CHECK 3.10
 *     (firestore companyId) and its future follow-up.
 *   - Constraint arrays built via spread, conditional, or cross-file import
 *     are flagged as "unanalyzable" and reported for human review — they
 *     do NOT block the commit (the block is for *analyzable-but-uncovered*).
 *   - Array-contains queries are marked analyzable-but-unverified for now.
 *
 * CLI:
 *   node scripts/check-firestore-index-coverage.js                  # staged files
 *   node scripts/check-firestore-index-coverage.js --all            # full src/ scan
 *   node scripts/check-firestore-index-coverage.js path/to/file.ts  # explicit targets
 *
 * Exit codes:
 *   0 — no blocking violations
 *   1 — one or more queries lack a covering composite index
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ts = require('typescript');

const {
  loadIndexCatalog,
  requiresCompositeIndex,
  findMatchingIndex,
  suggestIndexJson,
} = require('./_shared/firestore-index-matcher');

// ---------------------------------------------------------------------------
// Paths & constants
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '..');
const INDEXES_FILE = path.join(PROJECT_ROOT, 'firestore.indexes.json');
const COLLECTIONS_FILE = path.join(PROJECT_ROOT, 'src', 'config', 'firestore-collections.ts');
const TENANT_CONFIG_FILE = path.join(PROJECT_ROOT, 'src', 'services', 'firestore', 'tenant-config.ts');

const SSOT_METHOD_NAMES = new Set(['subscribe', 'subscribeSubcollection', 'getAll']);
const SSOT_IMPORT_HINTS = [
  'firestoreQueryService',
  'firestore-query.service',
  '@/services/firestore',
];

// ANSI colours (fallback to no-op on non-TTY)
const useColour = process.stdout.isTTY;
const c = {
  red:    (s) => (useColour ? `\x1b[31m${s}\x1b[0m` : s),
  green:  (s) => (useColour ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s) => (useColour ? `\x1b[33m${s}\x1b[0m` : s),
  cyan:   (s) => (useColour ? `\x1b[36m${s}\x1b[0m` : s),
  bold:   (s) => (useColour ? `\x1b[1m${s}\x1b[0m` : s),
};

// ---------------------------------------------------------------------------
// Loaders — collection name map + tenant config
// ---------------------------------------------------------------------------

/**
 * Parse COLLECTIONS object literal from firestore-collections.ts to extract
 * the KEY → physical collection name mapping. We only need the string
 * fallback in `process.env.X || 'collection_name'` (prod default).
 *
 * @returns {Map<string, string>} key → collection name
 */
function loadCollectionsMap() {
  const src = fs.readFileSync(COLLECTIONS_FILE, 'utf8');
  const sf = ts.createSourceFile(COLLECTIONS_FILE, src, ts.ScriptTarget.Latest, true);
  /** @type {Map<string, string>} */
  const map = new Map();

  /** @param {ts.Node} node */
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText() === 'COLLECTIONS' &&
      node.initializer &&
      (ts.isObjectLiteralExpression(node.initializer) ||
       (ts.isAsExpression(node.initializer) && ts.isObjectLiteralExpression(node.initializer.expression)))
    ) {
      const obj = ts.isAsExpression(node.initializer)
        ? node.initializer.expression
        : node.initializer;
      for (const prop of obj.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const key = prop.name.getText();
        const literal = extractFallbackString(prop.initializer);
        if (literal) map.set(key, literal);
      }
    }
    ts.forEachChild(node, visit);
  }

  /**
   * Given an initializer like `process.env.X || 'name'` or `'name'`, return 'name'.
   * @param {ts.Expression} expr
   * @returns {string|null}
   */
  function extractFallbackString(expr) {
    if (ts.isStringLiteral(expr)) return expr.text;
    if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
      const right = expr.right;
      if (ts.isStringLiteral(right)) return right.text;
    }
    return null;
  }

  visit(sf);
  return map;
}

/**
 * Parse TENANT_OVERRIDES from tenant-config.ts to learn which collections
 * use companyId auto-injection (default), tenantId, userId, or none.
 *
 * @returns {Map<string, {mode: string, fieldName: string}>}
 */
function loadTenantOverrides() {
  const src = fs.readFileSync(TENANT_CONFIG_FILE, 'utf8');
  const sf = ts.createSourceFile(TENANT_CONFIG_FILE, src, ts.ScriptTarget.Latest, true);
  /** @type {Map<string, {mode: string, fieldName: string}>} */
  const map = new Map();

  /** @param {ts.Node} node */
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText() === 'TENANT_OVERRIDES' &&
      node.initializer
    ) {
      const obj = ts.isAsExpression(node.initializer)
        ? node.initializer.expression
        : node.initializer;
      if (obj && ts.isObjectLiteralExpression(obj)) {
        for (const prop of obj.properties) {
          if (!ts.isPropertyAssignment(prop)) continue;
          const key = prop.name.getText();
          if (!ts.isObjectLiteralExpression(prop.initializer)) continue;
          const entry = { mode: 'companyId', fieldName: 'companyId' };
          for (const sub of prop.initializer.properties) {
            if (!ts.isPropertyAssignment(sub)) continue;
            const subKey = sub.name.getText();
            if (ts.isStringLiteral(sub.initializer)) {
              if (subKey === 'mode') entry.mode = sub.initializer.text;
              else if (subKey === 'fieldName') entry.fieldName = sub.initializer.text;
            }
          }
          map.set(key, entry);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return map;
}

/**
 * Default tenant config matches firestoreQueryService — every collection key
 * NOT in TENANT_OVERRIDES is treated as `{ mode: 'companyId', fieldName: 'companyId' }`.
 *
 * @param {Map<string, {mode: string, fieldName: string}>} overrides
 * @param {string} key
 * @returns {{mode: string, fieldName: string}}
 */
function resolveTenantFor(overrides, key) {
  return overrides.get(key) || { mode: 'companyId', fieldName: 'companyId' };
}

// ---------------------------------------------------------------------------
// AST walker — find subscribe/getAll calls on the SSoT
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} CallSite
 * @property {string}      file
 * @property {number}      line
 * @property {number}      column
 * @property {string}      methodName
 * @property {string}      collectionKey           CollectionKey enum name (e.g., 'ENTITY_AUDIT_TRAIL')
 * @property {string[]}    equalityFields
 * @property {{field: string, direction: 'ASCENDING'|'DESCENDING'}[]} orderBy
 * @property {string|null} arrayContainsField
 * @property {boolean}     tenantSkipped
 * @property {string[]}    warnings
 */

/**
 * Scan a single file for SSoT call sites and return zero or more extracted
 * CallSites. Unresolvable calls (dynamic collection key, non-literal
 * constraints) are recorded with a warnings[] entry.
 *
 * @param {string} filePath
 * @returns {CallSite[]}
 */
function extractCallSitesFromFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');

  // Fast skip: files that don't reference the SSoT at all.
  if (!SSOT_IMPORT_HINTS.some((hint) => src.includes(hint))) return [];
  if (!/\.(subscribe|subscribeSubcollection|getAll)\b/.test(src)) return [];

  const sf = ts.createSourceFile(filePath, src, ts.ScriptTarget.Latest, true);

  /** @type {Set<string>} Imported bindings that resolve to firestoreQueryService. */
  const ssotBindings = new Set();

  // Collect imports first
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    const mod = stmt.moduleSpecifier;
    if (!ts.isStringLiteral(mod)) continue;
    if (!SSOT_IMPORT_HINTS.some((hint) => mod.text.includes(hint))) continue;
    const clause = stmt.importClause;
    if (!clause || !clause.namedBindings) continue;
    if (ts.isNamedImports(clause.namedBindings)) {
      for (const el of clause.namedBindings.elements) {
        const name = el.name.getText();
        // Accept `firestoreQueryService` and anything aliased from it.
        if (name === 'firestoreQueryService' || (el.propertyName && el.propertyName.getText() === 'firestoreQueryService')) {
          ssotBindings.add(name);
        }
      }
    }
  }

  if (ssotBindings.size === 0) return [];

  /** @type {CallSite[]} */
  const results = [];

  /** @param {ts.Node} node */
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const receiver = node.expression.expression.getText();
      const method = node.expression.name.getText();
      if (ssotBindings.has(receiver) && SSOT_METHOD_NAMES.has(method)) {
        const site = parseCallExpression(node, method, filePath, sf);
        if (site) results.push(site);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return results;
}

/**
 * Resolve a `const <name> = [...]` array literal by walking up the AST from
 * the call site to the nearest enclosing function/block. This is the only
 * way to disambiguate shorthand `{ constraints }` references across
 * multiple functions in the same module (e.g. subscribeGlobal vs
 * subscribeEntity) — a module-level Map keyed by identifier would collapse
 * them into one.
 *
 * @param {ts.Node}   fromNode
 * @param {string}    identifierName
 * @returns {ts.ArrayLiteralExpression|null}
 */
function resolveLocalConstArray(fromNode, identifierName) {
  let parent = fromNode.parent;
  while (parent) {
    const isFnLike =
      ts.isFunctionDeclaration(parent) ||
      ts.isFunctionExpression(parent) ||
      ts.isArrowFunction(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isConstructorDeclaration(parent) ||
      ts.isGetAccessorDeclaration(parent) ||
      ts.isSetAccessorDeclaration(parent) ||
      ts.isSourceFile(parent);

    if (isFnLike) {
      const searchRoot = ts.isSourceFile(parent) ? parent : parent.body;
      if (searchRoot) {
        let found = null;
        /** @param {ts.Node} n */
        function scan(n) {
          if (found) return;
          if (
            ts.isVariableDeclaration(n) &&
            ts.isIdentifier(n.name) &&
            n.name.text === identifierName &&
            n.initializer &&
            ts.isArrayLiteralExpression(n.initializer)
          ) {
            found = n.initializer;
            return;
          }
          ts.forEachChild(n, scan);
        }
        scan(searchRoot);
        if (found) return found;
      }
      // Stop climbing once we've checked a function scope; the source-file
      // pass at the end is handled by the isSourceFile branch above.
      if (!ts.isSourceFile(parent)) {
        parent = parent.parent;
        continue;
      }
      return null;
    }
    parent = parent.parent;
  }
  return null;
}

/**
 * Parse one SSoT CallExpression into a CallSite, or return null if the
 * call does not match the expected SSoT shape.
 *
 * @param {ts.CallExpression} call
 * @param {string}            methodName
 * @param {string}            filePath
 * @param {ts.SourceFile}     sf
 * @returns {CallSite|null}
 */
function parseCallExpression(call, methodName, filePath, sf) {
  const args = call.arguments;
  if (args.length === 0) return null;

  // First argument = CollectionKey (string literal or identifier). We only
  // support string literal ("'ENTITY_AUDIT_TRAIL'") for precise mapping.
  const keyArg = args[0];
  let collectionKey = null;
  if (ts.isStringLiteral(keyArg)) {
    collectionKey = keyArg.text;
  }

  // Options object — last argument for all supported SSoT methods.
  const optionsArg = args[args.length - 1];
  const { constraintsNode, tenantSkipped, warnings } = extractOptionsDetails(
    optionsArg,
    call,
  );

  const { line, character } = sf.getLineAndCharacterOfPosition(call.getStart(sf));
  /** @type {CallSite} */
  const site = {
    file: filePath,
    line: line + 1,
    column: character + 1,
    methodName,
    collectionKey: collectionKey || '',
    equalityFields: [],
    orderBy: [],
    arrayContainsField: null,
    tenantSkipped,
    warnings: [...warnings],
  };

  if (!collectionKey) {
    site.warnings.push('collection key is not a string literal — unanalyzable');
    return site;
  }

  if (!constraintsNode) {
    // No constraints at all → empty query, nothing to verify.
    return site;
  }

  for (const el of constraintsNode.elements) {
    if (!ts.isCallExpression(el)) {
      site.warnings.push(`non-call element in constraints[] — unanalyzable (${el.getText()})`);
      continue;
    }
    const callee = el.expression.getText();
    const firstArg = el.arguments[0];
    if (!firstArg || !ts.isStringLiteral(firstArg)) {
      site.warnings.push(`dynamic field in ${callee}() — unanalyzable`);
      continue;
    }
    const field = firstArg.text;

    if (callee === 'where') {
      const opArg = el.arguments[1];
      const op = opArg && ts.isStringLiteral(opArg) ? opArg.text : '==';
      if (op === '==' || op === 'in') {
        if (!site.equalityFields.includes(field)) site.equalityFields.push(field);
      } else if (op === 'array-contains' || op === 'array-contains-any') {
        site.arrayContainsField = field;
      } else {
        site.warnings.push(`where() uses inequality operator "${op}" on ${field} — composite coverage uncertain`);
      }
    } else if (callee === 'orderBy') {
      const dirArg = el.arguments[1];
      const dir = dirArg && ts.isStringLiteral(dirArg) && dirArg.text === 'desc'
        ? 'DESCENDING'
        : 'ASCENDING';
      site.orderBy.push({ field, direction: dir });
    } else {
      site.warnings.push(`unknown constraint helper "${callee}" — unanalyzable`);
    }
  }

  return site;
}

/**
 * Parse the `options` object passed to subscribe/getAll: pull the
 * constraints array literal (resolving identifier references to local
 * const arrays) and detect `tenantOverride: 'skip'`.
 *
 * @param {ts.Expression}     optionsArg
 * @param {ts.CallExpression} callNode  Used as the origin for scope-aware identifier resolution.
 * @returns {{constraintsNode: ts.ArrayLiteralExpression|null, tenantSkipped: boolean, warnings: string[]}}
 */
function extractOptionsDetails(optionsArg, callNode) {
  const result = { constraintsNode: null, tenantSkipped: false, warnings: [] };
  if (!optionsArg || !ts.isObjectLiteralExpression(optionsArg)) return result;

  for (const prop of optionsArg.properties) {
    if (ts.isPropertyAssignment(prop)) {
      const name = prop.name.getText();
      if (name === 'constraints') {
        if (ts.isArrayLiteralExpression(prop.initializer)) {
          result.constraintsNode = prop.initializer;
        } else if (ts.isIdentifier(prop.initializer)) {
          const resolved = resolveLocalConstArray(callNode, prop.initializer.text);
          if (resolved) result.constraintsNode = resolved;
          else result.warnings.push(`constraints references "${prop.initializer.text}" (cross-file/runtime-built) — unanalyzable`);
        } else {
          result.warnings.push('constraints is not a literal array — unanalyzable');
        }
      } else if (name === 'tenantOverride') {
        if (ts.isStringLiteral(prop.initializer) && prop.initializer.text === 'skip') {
          result.tenantSkipped = true;
        }
      }
    } else if (ts.isShorthandPropertyAssignment(prop)) {
      if (prop.name.text === 'constraints') {
        const resolved = resolveLocalConstArray(callNode, prop.name.text);
        if (resolved) result.constraintsNode = resolved;
        else result.warnings.push('shorthand `constraints` identifier not resolvable in enclosing scope — unanalyzable');
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Shape derivation — build default + super_admin variants from a CallSite
// ---------------------------------------------------------------------------

/**
 * @param {CallSite}                                       site
 * @param {Map<string, string>}                            collectionsMap
 * @param {Map<string, {mode: string, fieldName: string}>} tenantOverrides
 * @returns {import('./_shared/firestore-index-matcher').QueryShape[]}
 */
function deriveShapes(site, collectionsMap, tenantOverrides) {
  const collectionName = collectionsMap.get(site.collectionKey);
  if (!collectionName) return [];

  const tenant = resolveTenantFor(tenantOverrides, site.collectionKey);

  /** @type {import('./_shared/firestore-index-matcher').QueryShape[]} */
  const shapes = [];

  // Super-admin variant — no tenant prefix. Only relevant if the service
  // auto-injects a tenant field AND the caller didn't opt out already.
  const tenantInjected = tenant.mode !== 'none' && !site.tenantSkipped;

  // Default variant — with tenant field (if applicable).
  const defaultEq = tenantInjected
    ? [tenant.fieldName, ...site.equalityFields.filter((f) => f !== tenant.fieldName)]
    : [...site.equalityFields];

  shapes.push({
    collection: collectionName,
    equalityFields: defaultEq,
    orderBy: site.orderBy,
    arrayContainsField: site.arrayContainsField,
    variant: 'default',
  });

  if (tenantInjected) {
    shapes.push({
      collection: collectionName,
      equalityFields: [...site.equalityFields],
      orderBy: site.orderBy,
      arrayContainsField: site.arrayContainsField,
      variant: 'super_admin',
    });
  }

  return shapes;
}

// ---------------------------------------------------------------------------
// File discovery (staged / explicit / all)
// ---------------------------------------------------------------------------

function listStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    });
    return out
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

function listAllSrcFiles() {
  /** @type {string[]} */
  const out = [];
  /** @param {string} dir */
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        if (name === 'node_modules' || name === '__tests__' || name.startsWith('.')) continue;
        walk(full);
      } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec|d)\.tsx?$/.test(name)) {
        out.push(full);
      }
    }
  }
  walk(path.join(PROJECT_ROOT, 'src'));
  return out;
}

function resolveTargetFiles(argv) {
  const explicit = argv.filter((a) => !a.startsWith('--'));
  if (argv.includes('--all')) return listAllSrcFiles();
  if (explicit.length > 0) {
    return explicit.map((p) => path.resolve(PROJECT_ROOT, p));
  }
  const staged = listStagedFiles().map((p) => path.resolve(PROJECT_ROOT, p));
  return staged.filter((p) => fs.existsSync(p) && /\.(ts|tsx)$/.test(p));
}

// ---------------------------------------------------------------------------
// Reporter
// ---------------------------------------------------------------------------

function formatCallSiteLocation(site) {
  const rel = path.relative(PROJECT_ROOT, site.file).replace(/\\/g, '/');
  return `${rel}:${site.line}:${site.column}`;
}

/**
 * Stable canonical signature of a shape — equality fields are sorted so
 * that variant orderings collapse when the underlying query is identical.
 * @param {import('./_shared/firestore-index-matcher').QueryShape} shape
 */
function fingerprintShape(shape) {
  const eq = [...shape.equalityFields].sort().join(',');
  const ob = shape.orderBy.map((o) => `${o.field}:${o.direction}`).join(',');
  const ac = shape.arrayContainsField || '';
  return `${shape.collection}|${eq}|${ob}|${ac}`;
}

function formatShape(shape) {
  const eq = shape.equalityFields.map((f) => `where('${f}','==')`).join(' + ');
  const ob = shape.orderBy.map((o) => `orderBy('${o.field}','${o.direction === 'DESCENDING' ? 'desc' : 'asc'}')`).join(' + ');
  return [eq, ob].filter(Boolean).join(' + ') || '(empty)';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  const verbose = argv.includes('--verbose');

  let catalog;
  try {
    catalog = loadIndexCatalog(INDEXES_FILE);
  } catch (err) {
    console.error(c.red(`✖ Failed to load ${INDEXES_FILE}: ${err.message}`));
    process.exit(1);
  }

  const collectionsMap = loadCollectionsMap();
  const tenantOverrides = loadTenantOverrides();

  const targetFiles = resolveTargetFiles(argv).filter((p) => {
    const rel = path.relative(PROJECT_ROOT, p).replace(/\\/g, '/');
    return rel.startsWith('src/');
  });

  if (targetFiles.length === 0) {
    // Nothing to scan — exit clean.
    process.exit(0);
  }

  /** @type {{site: CallSite, shape: import('./_shared/firestore-index-matcher').QueryShape}[]} */
  const missing = [];
  /** @type {CallSite[]} */
  const unanalyzable = [];
  let analyzed = 0;

  for (const file of targetFiles) {
    let sites;
    try {
      sites = extractCallSitesFromFile(file);
    } catch (err) {
      console.error(c.yellow(`⚠ Failed to parse ${file}: ${err.message}`));
      continue;
    }
    for (const site of sites) {
      if (site.warnings.length > 0) unanalyzable.push(site);
      if (!site.collectionKey || !collectionsMap.has(site.collectionKey)) continue;

      const shapes = deriveShapes(site, collectionsMap, tenantOverrides);
      /** @type {Set<string>} Dedupe key per call-site: avoids double-reporting when default and super_admin variants happen to collapse to the same fingerprint. */
      const seenFingerprints = new Set();
      for (const shape of shapes) {
        if (!requiresCompositeIndex(shape)) continue;
        const fingerprint = fingerprintShape(shape);
        if (seenFingerprints.has(fingerprint)) continue;
        seenFingerprints.add(fingerprint);
        analyzed++;
        const match = findMatchingIndex(catalog, shape);
        if (!match) missing.push({ site, shape });
      }
    }
  }

  // ---- Report ------------------------------------------------------------
  if (missing.length === 0) {
    if (verbose) {
      console.log(c.green(`✔ Firestore index coverage OK — analysed ${analyzed} composite query shape(s) across ${targetFiles.length} file(s).`));
      if (unanalyzable.length > 0) {
        console.log(c.yellow(`  ℹ ${unanalyzable.length} call-site(s) skipped as unanalyzable (dynamic constraints or cross-file refs).`));
      }
    }
    process.exit(0);
  }

  console.error('');
  console.error(c.red(c.bold(`✖ CHECK 3.15 — Firestore Index Coverage: ${missing.length} missing composite index(es)`)));
  console.error('');

  for (const { site, shape } of missing) {
    console.error(c.bold(`  ${formatCallSiteLocation(site)}`));
    console.error(`    ${c.cyan('call:')}       ${site.methodName}('${site.collectionKey}', …)`);
    console.error(`    ${c.cyan('variant:')}    ${shape.variant}`);
    console.error(`    ${c.cyan('shape:')}      ${formatShape(shape)}`);
    console.error(`    ${c.cyan('collection:')} ${shape.collection}`);
    console.error(c.yellow('    → add this entry to firestore.indexes.json:'));
    const suggestion = suggestIndexJson(shape);
    const lines = JSON.stringify(suggestion, null, 2).split('\n').map((l) => '      ' + l);
    console.error(lines.join('\n'));
    console.error('');
  }

  console.error(c.red('  ℹ Every Firestore query routed through firestoreQueryService must have a'));
  console.error(c.red('    matching composite index BEFORE commit. Super-admin reads bypass the tenant'));
  console.error(c.red('    filter, so both variants (default + super_admin) must be covered.'));
  console.error('');

  process.exit(1);
}

main();
