'use strict';
/**
 * CHECK 3.93 (ADR-874) — read a constant map from its SSoT, by AST, and render the
 * key subset the Cloud Functions build reads.
 *
 * Accepted value shapes (anything else is REFUSED, never guessed):
 *   KEY: 'literal'
 *   KEY: process.env.NAME || 'literal'      (also `??`)
 *
 * ⚠️ The env form: the Next.js app may override the name through `NEXT_PUBLIC_*`,
 * a Cloud Function has no such variable, so the projection carries the DEFAULT and
 * says so in the output. An override that differs from the default is a split
 * brain between app and trigger — the header names every overridable key.
 */

const { ts } = require('./ast');

function unwrap(expr) {
  let e = expr;
  while (e && (ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isParenthesizedExpression(e))) {
    e = e.expression;
  }
  return e;
}

function findExportedObject(sf, exportName) {
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    const exported = (stmt.modifiers || []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.name.text === exportName) {
        const init = unwrap(decl.initializer);
        return init && ts.isObjectLiteralExpression(init) ? init : null;
      }
    }
  }
  return null;
}

function envName(expr) {
  const e = unwrap(expr);
  if (!ts.isPropertyAccessExpression(e)) return null;
  const obj = e.expression;
  const isProcessEnv = ts.isPropertyAccessExpression(obj)
    && ts.isIdentifier(obj.expression) && obj.expression.text === 'process' && obj.name.text === 'env';
  return isProcessEnv ? e.name.text : null;
}

/** `{ value, env }` for an accepted initializer, `{ unsupported }` otherwise. */
function readValue(init) {
  const e = unwrap(init);
  if (ts.isStringLiteralLike(e)) return { value: e.text, env: null };
  const isFallback = ts.isBinaryExpression(e)
    && (e.operatorToken.kind === ts.SyntaxKind.BarBarToken
      || e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken);
  if (isFallback && ts.isStringLiteralLike(unwrap(e.right)) && envName(e.left)) {
    return { value: unwrap(e.right).text, env: envName(e.left) };
  }
  return { unsupported: ts.SyntaxKind[e.kind] };
}

function propertyKey(prop) {
  const n = prop.name;
  return n && (ts.isIdentifier(n) || ts.isStringLiteralLike(n)) ? n.text : null;
}

/**
 * Entries of `export const <exportName> = { … }` in source order.
 * @returns {{ found: boolean, entries: Map<string, {value?:string, env?:string|null, unsupported?:string}>, spreads: number }}
 */
function extractConstants(sf, exportName) {
  const obj = findExportedObject(sf, exportName);
  const entries = new Map();
  if (!obj) return { found: false, entries, spreads: 0 };
  let spreads = 0;
  for (const prop of obj.properties) {
    if (ts.isSpreadAssignment(prop)) { spreads++; continue; }
    const key = ts.isPropertyAssignment(prop) ? propertyKey(prop) : null;
    if (key === null) continue;
    entries.set(key, readValue(prop.initializer));
  }
  return { found: true, entries, spreads };
}

function quote(value) {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** Body of the projected constants module (without the generated header). */
function renderConstants(exportName, rows) {
  const lines = rows.map(({ key, value, env }) => {
    const note = env ? ` // app override: process.env.${env}` : '';
    return `  ${key}: ${quote(value)},${note}`;
  });
  return `export const ${exportName} = {\n${lines.join('\n')}\n} as const;\n`;
}

module.exports = { extractConstants, renderConstants };
