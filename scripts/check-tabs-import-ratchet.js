#!/usr/bin/env node
/**
 * CHECK 3.24 — Tabs SSoT Import Ratchet (AST-based, ADR-328)
 *
 * Detects:
 *   A. Direct imports of deprecated `TabsOnlyTriggers` / `TabsContainer` /
 *      `ToolbarTabs` from `@/components/ui/navigation/TabsComponents`.
 *   B. JSX usage of `<TabsNav variant="radix">` (deprecated alias of RouteTabs).
 *
 * New code MUST import `BaseTabs` / `StateTabs` / `RouteTabs` directly
 * from `@/components/ui/navigation/{base,state,route}-tabs`.
 *
 * Why AST, not grep:
 *   - Detecting the import named-specifier set (3 symbols) reliably across
 *     multiline imports requires AST.
 *   - Detecting `variant="radix"` on a specific React component name is an
 *     attribute-value match on a capitalized JSX tag — distinct from
 *     attribute-presence on lowercase HTML tags. Both are AST-trivial.
 *
 * Ratchet semantics:
 *   - Baseline: .tabs-import-baseline.json
 *   - New file with violations → BLOCK (zero tolerance)
 *   - Existing baselined file with MORE violations → BLOCK
 *   - Existing baselined file same or fewer → allow
 *
 * CLI:
 *   node scripts/check-tabs-import-ratchet.js                 # staged files via args
 *   node scripts/check-tabs-import-ratchet.js --all           # full src/ scan
 *   node scripts/check-tabs-import-ratchet.js --write-baseline
 *   node scripts/check-tabs-import-ratchet.js path/a.tsx
 *
 * Exit codes: 0 = pass, 1 = blocked.
 */

'use strict';

const path = require('node:path');
const { walkAst, parseJsx } = require('./lib/jsx-ast');
const ratchet = require('./lib/per-file-ratchet');

// ADR-924: κάθε ανάγνωση από την ΕΙΣΟΔΟ — με `--index` (εκτελεστής) το κείμενο ΤΟΥ COMMIT, όχι του δίσκου.
const ROOT = path.resolve(__dirname, '..');
const BASELINE_FILE = '.tabs-import-baseline.json';

const DEPRECATED_IMPORT_SOURCE = '@/components/ui/navigation/TabsComponents';
const DEPRECATED_IMPORT_SYMBOLS = new Set([
  'TabsOnlyTriggers',
  'TabsContainer',
  'ToolbarTabs',
]);
const DEPRECATED_JSX_TAG = 'TabsNav';
const DEPRECATED_JSX_VARIANT_VALUE = 'radix';

// Files that may legitimately contain the deprecated symbols (alias home + tests).
const ALLOWLIST = [
  'src/components/ui/navigation/TabsComponents.tsx',
  'src/components/ui/navigation/__tests__/',
];

function isAllowlisted(filePath) {
  const norm = filePath.replace(/\\/g, '/');
  return ALLOWLIST.some((p) => norm === p || norm.startsWith(p));
}

const isTsx = (file) => /\.(tsx)$/.test(file);
const inScope = (file) => isTsx(file) && !isAllowlisted(file);

// ─── Detection ───────────────────────────────────────────────────────────────

/** Detector A: deprecated import — κάθε σύμβολο του παλιού μονοπατιού. */
function deprecatedImports(node) {
  return (node.specifiers || [])
    .filter((spec) => spec.type === 'ImportSpecifier'
      && spec.imported?.type === 'Identifier'
      && DEPRECATED_IMPORT_SYMBOLS.has(spec.imported.name))
    .map((spec) => ({ kind: 'import', line: spec.loc?.start?.line ?? '?', symbol: spec.imported.name }));
}

/** Η συμβολοσειρά του `variant=` (κυριολεκτικό ή `{'…'}`)· αλλιώς `null`. */
function variantValue(node) {
  const variantAttr = (node.attributes || []).find(
    (attr) =>
      attr.type === 'JSXAttribute' &&
      attr.name?.type === 'JSXIdentifier' &&
      attr.name.name === 'variant',
  );
  const valueNode = variantAttr?.value;
  if (!valueNode) return null;
  if (valueNode.type === 'Literal' && typeof valueNode.value === 'string') return valueNode.value;
  if (
    valueNode.type === 'JSXExpressionContainer' &&
    valueNode.expression?.type === 'Literal' &&
    typeof valueNode.expression.value === 'string'
  ) {
    return valueNode.expression.value;
  }
  return null;
}

function findViolations(src) {
  const ast = parseJsx(src);
  if (!ast) return [];

  const violations = [];

  walkAst(ast, (node) => {
    if (
      node.type === 'ImportDeclaration' &&
      node.source?.type === 'Literal' &&
      node.source.value === DEPRECATED_IMPORT_SOURCE
    ) {
      violations.push(...deprecatedImports(node));
      return;
    }

    // Detector B: <TabsNav variant="radix">
    if (node.type !== 'JSXOpeningElement') return;
    const nameNode = node.name;
    if (!nameNode || nameNode.type !== 'JSXIdentifier' || nameNode.name !== DEPRECATED_JSX_TAG) return;
    if (variantValue(node) === DEPRECATED_JSX_VARIANT_VALUE) {
      violations.push({
        kind: 'jsx-variant-radix',
        line: node.loc?.start?.line ?? '?',
        symbol: 'TabsNav variant="radix"',
      });
    }
  });

  return violations;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const { yellow: YELLOW, nc: NC } = ratchet.BANNER_COLORS;

/** Η πύλη ως `run(argv, input)` πάνω στο κοινό CLI (ADR-924: `--index` ⇒ η όψη του commit). */
const run = ratchet.defineBannerGate({
  root: ROOT,
  baselineFile: BASELINE_FILE,
  inScope,
  findHits: findViolations,
  collectAll: (scope) => ratchet.scopeFiles(scope, ['src'], isTsx),
  meta: {
    description:
      'Tabs SSoT import ratchet (CHECK 3.24, ADR-328). Deprecated TabsContainer/ToolbarTabs/TabsOnlyTriggers imports + <TabsNav variant="radix">.',
    rule: 'New code must import BaseTabs/StateTabs/RouteTabs directly.',
  },
  banner: {
    downTitle: 'Tabs SSoT violations reduced',
    downCommand: 'tabs-import:baseline',
    blockedTitle: 'Tabs SSoT (CHECK 3.24, ADR-328)',
    blockedSubtitle: 'Use BaseTabs/StateTabs/RouteTabs from @/components/ui/navigation/',
    newNoun: 'deprecated tabs reference(s)',
    describeHit: ({ line, kind, symbol }) => `line ${line} [${kind}]: ${symbol}`,
  },
  printFix() {
    console.log(`  ${YELLOW}Fix: import StateTabs/RouteTabs/BaseTabs from${NC}`);
    console.log(`       @/components/ui/navigation/{state-tabs,route-tabs,base-tabs}\n`);
  },
});

if (require.main === module) process.exit(run());

module.exports = { run, findViolations };
