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

const fs = require('node:fs');
const path = require('node:path');

process.chdir(path.resolve(__dirname, '..'));

const BASELINE_FILE = '.tabs-import-baseline.json';
const WRITE_BASELINE = process.argv.includes('--write-baseline');
const SCAN_ALL = process.argv.includes('--all');

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

// ─── AST walker ──────────────────────────────────────────────────────────────

function walk(node, visitor) {
  if (!node || typeof node !== 'object') return;
  visitor(node);
  for (const key of Object.keys(node)) {
    const child = node[key];
    if (Array.isArray(child)) {
      child.forEach((c) => walk(c, visitor));
    } else if (child && typeof child === 'object' && child.type) {
      walk(child, visitor);
    }
  }
}

function findViolations(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  let parser;
  try {
    parser = require('@typescript-eslint/parser');
  } catch {
    return [];
  }

  let ast;
  try {
    ast = parser.parse(src, {
      jsx: true,
      range: true,
      loc: true,
      errorOnUnknownASTType: false,
    });
  } catch {
    return [];
  }

  const violations = [];

  walk(ast, (node) => {
    // Detector A: deprecated import
    if (
      node.type === 'ImportDeclaration' &&
      node.source?.type === 'Literal' &&
      node.source.value === DEPRECATED_IMPORT_SOURCE
    ) {
      for (const spec of node.specifiers || []) {
        if (
          spec.type === 'ImportSpecifier' &&
          spec.imported?.type === 'Identifier' &&
          DEPRECATED_IMPORT_SYMBOLS.has(spec.imported.name)
        ) {
          violations.push({
            kind: 'import',
            line: spec.loc?.start?.line ?? '?',
            symbol: spec.imported.name,
          });
        }
      }
      return;
    }

    // Detector B: <TabsNav variant="radix">
    if (node.type !== 'JSXOpeningElement') return;
    const nameNode = node.name;
    if (
      !nameNode ||
      nameNode.type !== 'JSXIdentifier' ||
      nameNode.name !== DEPRECATED_JSX_TAG
    ) {
      return;
    }
    const variantAttr = (node.attributes || []).find(
      (attr) =>
        attr.type === 'JSXAttribute' &&
        attr.name?.type === 'JSXIdentifier' &&
        attr.name.name === 'variant',
    );
    if (!variantAttr || !variantAttr.value) return;
    const valueNode = variantAttr.value;
    let stringValue = null;
    if (valueNode.type === 'Literal' && typeof valueNode.value === 'string') {
      stringValue = valueNode.value;
    } else if (
      valueNode.type === 'JSXExpressionContainer' &&
      valueNode.expression?.type === 'Literal' &&
      typeof valueNode.expression.value === 'string'
    ) {
      stringValue = valueNode.expression.value;
    }
    if (stringValue === DEPRECATED_JSX_VARIANT_VALUE) {
      violations.push({
        kind: 'jsx-variant-radix',
        line: node.loc?.start?.line ?? '?',
        symbol: 'TabsNav variant="radix"',
      });
    }
  });

  return violations;
}

// ─── File collection ─────────────────────────────────────────────────────────

function collectAllFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      out.push(...collectAllFiles(full));
    } else if (/\.(tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function collectFiles() {
  if (SCAN_ALL || WRITE_BASELINE) {
    return collectAllFiles('src');
  }
  const explicit = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  return explicit.length ? explicit : [];
}

// ─── Baseline helpers ────────────────────────────────────────────────────────

function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')).files ?? {};
  } catch {
    return {};
  }
}

function writeBaseline(files) {
  const baseline = {};
  let totalViolations = 0;
  let totalFiles = 0;
  for (const f of files) {
    if (isAllowlisted(f)) continue;
    const v = findViolations(f);
    if (v.length > 0) {
      baseline[f] = v.length;
      totalViolations += v.length;
      totalFiles++;
    }
  }
  const out = {
    _meta: {
      description:
        'Tabs SSoT import ratchet (CHECK 3.24, ADR-328). Deprecated TabsContainer/ToolbarTabs/TabsOnlyTriggers imports + <TabsNav variant="radix">.',
      generated: new Date().toISOString(),
      totalViolations,
      totalFiles,
      rule: 'New code must import BaseTabs/StateTabs/RouteTabs directly.',
    },
    files: baseline,
  };
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(out, null, 2) + '\n');
  console.log(`✅ Baseline written: ${BASELINE_FILE}`);
  console.log(`   Files: ${totalFiles} | Violations: ${totalViolations}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const NC = '\x1b[0m';

const files = collectFiles();

if (WRITE_BASELINE) {
  writeBaseline(files.length ? files : collectAllFiles('src'));
  process.exit(0);
}

if (!files.length) process.exit(0);

const baseline = loadBaseline();
let hasBlock = false;
const blocked = [];
const improved = [];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  if (!/\.(tsx)$/.test(file)) continue;
  if (isAllowlisted(file)) continue;

  const violations = findViolations(file);
  const current = violations.length;
  const base = baseline[file] ?? 0;

  if (current === 0 && base === 0) continue;
  if (current < base) {
    improved.push({ file, from: base, to: current });
    continue;
  }
  if (current === base) continue;

  hasBlock = true;
  const isNew = base === 0;
  blocked.push({ file, current, base, isNew, violations });
}

if (improved.length) {
  console.log(`\n${GREEN}═══════════════════════════════════════════════════════════════${NC}`);
  console.log(`${GREEN}  🎯 RATCHET DOWN — Tabs SSoT violations reduced${NC}`);
  console.log(`${GREEN}═══════════════════════════════════════════════════════════════${NC}`);
  for (const { file, from, to } of improved) {
    console.log(`  ✅ ${file}: ${from} → ${to} (-${from - to})`);
  }
  console.log(`\n  ${YELLOW}Run after commit: npm run tabs-import:baseline${NC}\n`);
}

if (hasBlock) {
  console.log(`\n${RED}═══════════════════════════════════════════════════════════════${NC}`);
  console.log(`${RED}  🚫 COMMIT BLOCKED — Tabs SSoT (CHECK 3.24, ADR-328)${NC}`);
  console.log(`${RED}  Use BaseTabs/StateTabs/RouteTabs from @/components/ui/navigation/${NC}`);
  console.log(`${RED}═══════════════════════════════════════════════════════════════${NC}\n`);
  for (const { file, current, base, isNew, violations } of blocked) {
    if (isNew) {
      console.log(`  ❌ ${file} (NEW FILE — zero tolerance)`);
      console.log(`     Found ${current} deprecated tabs reference(s)`);
    } else {
      console.log(`  ❌ ${file}`);
      console.log(`     Baseline: ${base} → Current: ${current} (+${current - base})`);
    }
    for (const { line, kind, symbol } of violations) {
      console.log(`     line ${line} [${kind}]: ${symbol}`);
    }
    console.log();
  }
  console.log(`  ${YELLOW}Fix: import StateTabs/RouteTabs/BaseTabs from${NC}`);
  console.log(`       @/components/ui/navigation/{state-tabs,route-tabs,base-tabs}\n`);
  process.exit(1);
}

process.exit(0);
