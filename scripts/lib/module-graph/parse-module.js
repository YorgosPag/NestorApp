#!/usr/bin/env node
/**
 * ADR-700 §1 — Single-file parse for the barrel-aware dead-export gate.
 *
 * THE DISTINCTION THIS FILE EXISTS TO MAKE (§10.7.1):
 *   an `import` CONSUMES a symbol · an `export … from` FORWARDS it.
 * knip cannot make it because `src/**\/index.ts` is declared an entry point, so
 * everything a barrel re-exports counts as "used" by definition. Here the
 * statement kind decides, so a chain of barrels adds zero consumers.
 *
 * Parse only — `ts.createSourceFile` builds an AST without a type-checker, so
 * this is NOT a `tsc` run (CLAUDE.md N.17): no program, no diagnostics, no
 * cross-file type resolution, milliseconds per file.
 */

'use strict';

const ts = require('typescript');

const TEST_PATTERN = /(\.test\.|\.spec\.|__tests__|__mocks__|\/test-utils\/|\.stories\.)/;

function scriptKindFor(file) {
  if (file.endsWith('.tsx') || file.endsWith('.jsx')) return ts.ScriptKind.TSX;
  return ts.ScriptKind.TS;
}

function hasModifier(node, kind) {
  return !!(node.modifiers && node.modifiers.some(m => m.kind === kind));
}

const isExported = node => hasModifier(node, ts.SyntaxKind.ExportKeyword);
const isDefault = node => hasModifier(node, ts.SyntaxKind.DefaultKeyword);

function bindingNames(name, out) {
  if (ts.isIdentifier(name)) {
    out.push(name.text);
    return;
  }
  if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const el of name.elements) {
      if (ts.isBindingElement(el)) bindingNames(el.name, out);
    }
  }
}

/**
 * Names a top-level declaration contributes to the export surface, paired with
 * the identifier it is actually written as. They differ for default exports
 * (`export default function Foo` is exported as `default` but *called* `Foo`),
 * and the local name is what the textual safety net must look for — searching
 * for the token "default" would match every switch statement in the repo.
 */
function declaredExportNames(node) {
  if (isDefault(node)) {
    const local = node.name && ts.isIdentifier(node.name) ? node.name.text : null;
    return [{ name: 'default', localName: local }];
  }
  if (ts.isVariableStatement(node)) {
    const names = [];
    for (const decl of node.declarationList.declarations) bindingNames(decl.name, names);
    return names.map(name => ({ name, localName: name }));
  }
  return node.name && ts.isIdentifier(node.name)
    ? [{ name: node.name.text, localName: node.name.text }]
    : [];
}

function readNamedImports(clause, record) {
  if (clause.name) record.names.push({ imported: 'default', local: clause.name.text });
  const bindings = clause.namedBindings;
  if (!bindings) return;
  if (ts.isNamespaceImport(bindings)) {
    record.kind = 'namespace';
    record.names.push({ imported: '*', local: bindings.name.text });
    return;
  }
  for (const el of bindings.elements) {
    record.names.push({
      imported: el.propertyName ? el.propertyName.text : el.name.text,
      local: el.name.text,
    });
  }
}

function parseImportDeclaration(node, mod) {
  if (!ts.isStringLiteral(node.moduleSpecifier)) return;
  const record = { spec: node.moduleSpecifier.text, kind: 'named', names: [] };
  if (!node.importClause) {
    record.kind = 'side-effect';
  } else {
    readNamedImports(node.importClause, record);
  }
  mod.imports.push(record);
}

function parseExportDeclaration(node, mod) {
  const spec = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
    ? node.moduleSpecifier.text
    : null;
  const clause = node.exportClause;

  if (!clause) {
    if (spec) mod.reExports.push({ spec, kind: 'star', names: [] });
    return;
  }
  if (ts.isNamespaceExport(clause)) {
    if (spec) mod.reExports.push({ spec, kind: 'star-as', names: [], as: clause.name.text });
    if (spec) mod.exports.push({ name: clause.name.text, line: lineOf(node, mod), origin: 'star-as' });
    return;
  }
  const names = clause.elements.map(el => ({
    imported: el.propertyName ? el.propertyName.text : el.name.text,
    exported: el.name.text,
  }));
  if (spec) {
    mod.reExports.push({ spec, kind: 'named', names });
    names.forEach(n => mod.exports.push({ name: n.exported, line: lineOf(node, mod), origin: 'reexport' }));
    return;
  }
  // `export { X }` with no `from` — X may be a local declaration OR an imported
  // binding the module is merely passing through. Resolved after the walk.
  names.forEach(n => mod.localReExports.push(n));
  names.forEach(n => mod.exports.push({
    name: n.exported, localName: n.imported, line: lineOf(node, mod), origin: 'local',
  }));
}

function lineOf(node, mod) {
  return mod.sourceFile.getLineAndCharacterOfPosition(node.getStart(mod.sourceFile)).line + 1;
}

const DECLARATION_GUARDS = [
  ts.isFunctionDeclaration, ts.isClassDeclaration, ts.isVariableStatement,
  ts.isInterfaceDeclaration, ts.isTypeAliasDeclaration, ts.isEnumDeclaration,
  ts.isModuleDeclaration,
];

function parseStatement(node, mod) {
  if (ts.isImportDeclaration(node)) return parseImportDeclaration(node, mod);
  if (ts.isExportDeclaration(node)) return parseExportDeclaration(node, mod);
  if (ts.isExportAssignment(node)) {
    const local = ts.isIdentifier(node.expression) ? node.expression.text : null;
    mod.exports.push({ name: 'default', localName: local, line: lineOf(node, mod), origin: 'local' });
    return;
  }
  if (!DECLARATION_GUARDS.some(guard => guard(node)) || !isExported(node)) return;
  for (const declared of declaredExportNames(node)) {
    mod.exports.push({ ...declared, line: lineOf(node, mod), origin: 'local' });
  }
}

/**
 * Collects every identifier that is NOT part of an import/`export … from`
 * statement. This is the safety net: a candidate whose name still appears
 * somewhere in real code is downgraded to `suspect`, never reported dead —
 * it catches string registries, `eval`-ish indirection and our own resolver
 * bugs, all in the direction of under-reporting.
 */
function collectUsage(node, mod) {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
  if (ts.isIdentifier(node)) mod.identifiers.set(node.text, (mod.identifiers.get(node.text) || 0) + 1);
  if (ts.isCallExpression(node)) collectDynamicImport(node, mod);
  ts.forEachChild(node, child => collectUsage(child, mod));
}

function collectDynamicImport(node, mod) {
  const isImportCall = node.expression.kind === ts.SyntaxKind.ImportKeyword;
  const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
  if (!isImportCall && !isRequire) return;
  const arg = node.arguments[0];
  if (arg && ts.isStringLiteral(arg)) {
    mod.imports.push({ spec: arg.text, kind: 'dynamic', names: [] });
  }
}

/** A pure barrel forwards and nothing else — the only shape we let flow through. */
function detectPureBarrel(file, sourceFile) {
  const base = file.slice(file.lastIndexOf('/') + 1);
  if (!/^index\.(ts|tsx)$/.test(base)) return false;
  return sourceFile.statements.every(
    st => ts.isImportDeclaration(st) || ts.isExportDeclaration(st)
  );
}

/**
 * `import { X } from './x'; export { X };` re-exports a symbol this file does
 * NOT declare. Two consequences, and conflating them produces a false "dead":
 * origin attribution must always follow the chain, consumption must not be
 * credited to a pure barrel.
 */
function foldPassThroughExports(mod) {
  if (mod.localReExports.length === 0) return;
  const importedFrom = new Map();
  for (const imp of mod.imports) {
    if (imp.kind !== 'named') continue;
    for (const n of imp.names) importedFrom.set(n.local, { spec: imp.spec, imported: n.imported });
  }
  const forwarded = new Set();
  for (const { imported: localName, exported } of mod.localReExports) {
    const source = importedFrom.get(localName);
    if (!source) continue;
    // ORIGIN correction (always, barrel or not): this file does NOT declare the
    // symbol. Attributing it here would credit a consumer's use to the wrong
    // module and make the real declaration look unreferenced.
    mod.exports = mod.exports.filter(e => !(e.name === exported && e.origin === 'local'));
    mod.exports.push({ name: exported, localName, line: 0, origin: 'reexport' });
    mod.reExports.push({ spec: source.spec, kind: 'named', names: [{ imported: source.imported, exported }] });
    forwarded.add(`${source.spec} ${source.imported}`);
  }
  // CONSUMPTION stripping is barrel-only. A file with real code plausibly uses
  // the binding it re-exports; over-counting keeps a symbol live, which is the
  // safe direction.
  if (!mod.isBarrel) return;
  for (const imp of mod.imports) {
    if (imp.kind !== 'named') continue;
    imp.names = imp.names.filter(n => !forwarded.has(`${imp.spec} ${n.imported}`));
  }
  mod.imports = mod.imports.filter(imp => imp.kind !== 'named' || imp.names.length > 0);
}

function parseModule(file, text) {
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKindFor(file));
  const mod = {
    file,
    sourceFile,
    isTest: TEST_PATTERN.test(file),
    isBarrel: detectPureBarrel(file, sourceFile),
    imports: [],
    reExports: [],
    exports: [],
    localReExports: [],
    identifiers: new Map(),
  };
  for (const st of sourceFile.statements) parseStatement(st, mod);
  ts.forEachChild(sourceFile, node => collectUsage(node, mod));
  foldPassThroughExports(mod);
  annotateLocalUses(mod);
  delete mod.sourceFile;
  return mod;
}

/**
 * `localUses` = how often the symbol's own identifier occurs in this file's real
 * code. Its declaration contributes exactly 1, so >1 means the file uses what it
 * exports. That separates "the export keyword is pointless" from "this code is
 * dead" — knip collapses both under `ignoreExportsUsedInFile`.
 */
function annotateLocalUses(mod) {
  for (const exp of mod.exports) {
    const token = exp.localName || exp.name;
    exp.localUses = token === 'default' ? 0 : (mod.identifiers.get(token) || 0);
  }
}

module.exports = { parseModule, detectPureBarrel, foldPassThroughExports, TEST_PATTERN };
