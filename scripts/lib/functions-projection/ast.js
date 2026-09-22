'use strict';
/**
 * CHECK 3.93 (ADR-874) — the two AST questions the projection asks.
 *
 *   1. «Where does this module reach?» — every static module specifier.
 *   2. «Which KEYS of this object does this file read?» — `NAME.KEY` reads of a binding.
 *
 * Both use the TypeScript parser (the same one `tsc` uses), never a regex: the old
 * mirror check stripped comments with `/\/\/[^\n]*\/` and would have eaten a `//`
 * inside a string (ADR-873 Ε-873.2).
 */

const ts = require('typescript');

function parse(fileName, text) {
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function stringArg(call) {
  const [arg] = call.arguments;
  return arg && ts.isStringLiteralLike(arg) ? arg.text : null;
}

/** Specifier of an import/export/require/import() node, or null when the node is none of those. */
function specifierOf(node) {
  if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
    return ts.isStringLiteralLike(node.moduleSpecifier) ? node.moduleSpecifier.text : null;
  }
  if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
    const expr = node.moduleReference.expression;
    return expr && ts.isStringLiteralLike(expr) ? expr.text : null;
  }
  if (ts.isCallExpression(node)) {
    const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
    const isDynamic = node.expression.kind === ts.SyntaxKind.ImportKeyword;
    return isRequire || isDynamic ? stringArg(node) : null;
  }
  if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
    const lit = node.argument.literal;
    return ts.isStringLiteralLike(lit) ? lit.text : null;
  }
  return null;
}

/** Every module specifier the file reaches, statically — including `import type` and `import()`. */
function moduleSpecifiers(sf) {
  const found = [];
  const visit = (node) => {
    const spec = specifierOf(node);
    if (spec !== null) found.push(spec);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** Local names bound by `import { exportName [as local] } from '…'` (any source). */
function importedBindings(sf, exportName) {
  const locals = [];
  for (const stmt of sf.statements) {
    const bindings = ts.isImportDeclaration(stmt) && stmt.importClause && stmt.importClause.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const el of bindings.elements) {
      const imported = (el.propertyName || el.name).text;
      if (imported === exportName) locals.push({ local: el.name.text, source: stmt.moduleSpecifier.text });
    }
  }
  return locals;
}

const DECLARATION_PARENTS = new Set([
  ts.SyntaxKind.ImportSpecifier,
  ts.SyntaxKind.ExportSpecifier,
  ts.SyntaxKind.ImportClause,
  ts.SyntaxKind.NamespaceImport,
]);

/** Classify one identifier occurrence: a key read, a declaration, or a whole-object use. */
function classify(node) {
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.expression === node) {
    return { key: parent.name.text };
  }
  if (ts.isElementAccessExpression(parent) && parent.expression === node) {
    const arg = parent.argumentExpression;
    return ts.isStringLiteralLike(arg) ? { key: arg.text } : { whole: true };
  }
  if (DECLARATION_PARENTS.has(parent.kind)) return { skip: true };
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return { skip: true };
  if (ts.isPropertyAssignment(parent) && parent.name === node) return { skip: true };
  return { whole: true };
}

/**
 * Keys read through `local.KEY` / `local['KEY']`. Any other use of the binding
 * (`Object.keys(local)`, spread, `typeof local`, passing it around) makes the key
 * set UNKNOWABLE — reported as `wholeUses` so the caller can refuse to guess.
 */
function memberReads(sf, local) {
  const keys = new Set();
  const wholeUses = [];
  const visit = (node) => {
    if (ts.isIdentifier(node) && node.text === local) {
      const verdict = classify(node);
      if (verdict.key) keys.add(verdict.key);
      else if (verdict.whole) wholeUses.push(sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { keys, wholeUses };
}

module.exports = { ts, parse, moduleSpecifiers, importedBindings, memberReads };
