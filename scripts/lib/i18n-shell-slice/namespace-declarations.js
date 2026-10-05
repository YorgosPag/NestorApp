#!/usr/bin/env node
/**
 * =============================================================================
 * ADR-744 §27 — «ΠΟΙΑ NAMESPACES ΟΝΟΜΑΖΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ;» ΚΑΙ ΟΤΑΝ ΤΑ ΛΕΕΙ ΜΕ ΣΤΑΘΕΡΑ
 * =============================================================================
 *
 * 🔴 ΤΟ ΤΥΦΛΟ ΣΗΜΕΙΟ, ΜΕΤΡΗΜΕΝΟ (2026-10-05). Ο κοινός εξαγωγέας
 * (`i18n-namespace-extract.js` → `extractNamespaces`) βλέπει **κυριολεκτικά** και τα
 * bundles του `namespace-bundles.ts`. Κάθε άλλο αναγνωριστικό το αγνοεί — και το λέει:
 * «a runtime variable the static checker cannot resolve». Στο δέντρο όμως **167** από
 * τις 355 μη-κυριολεκτικές κλήσεις είναι **σταθερές module**, όχι μεταβλητές:
 *
 *     useTranslation(SPATIAL_TOUR_NS)      110   →  export const SPATIAL_TOUR_NS = 'spatial-tour'
 *     useTranslation(LANDING_HEROES_NS)     17
 *     useTranslation(NAMESPACES)            12   …
 *
 * Η πρώτη εκτέλεση του χάρτη τεμπέλικων διαδρομών το έδειξε αμέσως: το `SharedFile`
 * βγήκε **χωρίς** `spatial-tour` (η μία από τις 4 χειρόγραφες δηλώσεις που ο χάρτης
 * ήρθε να αντικαταστήσει) και το `AdminLandingHeroes` με **μηδέν** namespaces. Ένας
 * χάρτης που χάνει σιωπηλά ό,τι δεν ξέρει να διαβάσει είναι το «`0` = κανείς δεν κοίταξε».
 *
 * 🔑 ΤΙ ΚΑΝΕΙ: ακολουθεί το αναγνωριστικό ως τη **δήλωσή** του — τοπικό `const`, ή
 * εισαγωγή (με τον γράφο, μέσα από αλυσίδες re-export) — και το αποτιμά αν είναι
 * κυριολεκτικό, πίνακας κυριολεκτικών, ή σύνθεση τέτοιων. Ό,τι **δεν** αποτιμάται
 * (prop, παράμετρος, μέλος αντικειμένου) επιστρέφεται ως **`opaque`** — ποτέ σιωπή.
 *
 * ⚠️ **ΣΥΜΠΛΗΡΩΝΕΙ, ΔΕΝ ΑΝΤΙΚΑΘΙΣΤΑ** τον κοινό εξαγωγέα: εκείνος μένει η αυθεντία για
 * ό,τι βλέπει (το CHECK 3.8 έχει baseline κομμένη στα μέτρα του). Εδώ ζει μόνο το
 * κομμάτι που εκείνος δηλώνει ότι δεν κάνει.
 *
 * @module scripts/lib/i18n-shell-slice/namespace-declarations
 */

'use strict';

const fs = require('node:fs');
const ts = require('typescript');

const MG = require('../module-graph');
const { extractNamespaces, stripComments } = require('../i18n-namespace-extract');
const { parseSource } = require('./key-extract');

const HOOK = 'useTranslation';
const ANY_CALL = /\buseTranslation\s*(?:<[^>]*>)?\(/g;
/** Οι μορφές που ο κοινός εξαγωγέας διαβάζει **ολόκληρες** — ό,τι περισσεύει θέλει AST. */
const PLAIN_CALLS = [
  /useTranslation\(\s*['"][a-zA-Z0-9_-]+['"]\s*\)/g,
  /useTranslation\(\s*\[(?:\s*['"][a-zA-Z0-9_-]+['"]\s*,?)+\s*\]\s*\)/g,
];

const count = (text, pattern) => (text.match(pattern) || []).length;

function unwrap(node) {
  let current = node;
  while (current && (ts.isAsExpression(current) || ts.isSatisfiesExpression(current)
    || ts.isParenthesizedExpression(current) || ts.isNonNullExpression(current)
    || ts.isTypeAssertionExpression(current))) {
    current = current.expression;
  }
  return current;
}

/** Το πρώτο `const <name> = …` του αρχείου (οπουδήποτε — και μέσα σε hook). */
function findInitializer(source, name) {
  let initializer = null;
  const visit = node => {
    if (initializer !== null) return;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer) {
      initializer = node.initializer;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return initializer;
}

/** Η **τιμή** ενός αναγνωριστικού: τοπικό `const`, αλλιώς η δήλωση πίσω από την εισαγωγή του. */
function resolveConst(ctx, abs, name, seen) {
  const guard = `${abs}\u0000${name}`;
  if (seen.has(guard)) return null;
  seen.add(guard);

  const source = ctx.parse(abs);
  if (source === null) return null;
  const initializer = findInitializer(source, name);
  if (initializer !== null) return evaluate(ctx, initializer, abs, seen);

  const mod = ctx.graph.modules.get(abs);
  for (const imp of (mod ? mod.imports : [])) {
    const binding = (imp.names || []).find(candidate => candidate.local === name);
    if (!binding) continue;
    const target = ctx.resolve(imp.spec, abs);
    if (target.kind !== 'internal') return null;
    const origin = MG.resolveOrigin(ctx.graph, ctx.resolve, target.file, binding.imported);
    return origin.file ? resolveConst(ctx, origin.file, origin.name, seen) : null;
  }
  return null;
}

/** @returns {?string[]} `null` = δεν αποτιμάται στατικά (μισή τιμή είναι μαντεψιά ⇒ όλη `null`). */
function evaluate(ctx, expression, abs, seen) {
  const node = unwrap(expression);
  if (!node) return null;
  if (ts.isStringLiteralLike(node)) return [node.text];
  if (ts.isIdentifier(node)) return resolveConst(ctx, abs, node.text, seen);
  if (!ts.isArrayLiteralExpression(node)) return null;
  const out = [];
  for (const element of node.elements) {
    const value = evaluate(ctx, ts.isSpreadElement(element) ? element.expression : element, abs, seen);
    if (value === null) return null;
    out.push(...value);
  }
  return out;
}

/** Κάθε `useTranslation(<όρισμα>)` του αρχείου: αποτιμημένο, ή δηλωμένο αδιαφανές. */
function readCalls(ctx, abs) {
  const source = ctx.parse(abs);
  const namespaces = [];
  const opaque = [];
  const visit = node => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === HOOK
      && node.arguments.length > 0) {
      const value = evaluate(ctx, node.arguments[0], abs, new Set());
      if (value !== null) namespaces.push(...value);
      else {
        opaque.push({
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          text: node.getText(source).slice(0, 80),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { namespaces, opaque };
}

/**
 * @param {object} args
 * @param {object} args.graph  ο γράφος module — για τις εισαγωγές και τις αλυσίδες re-export
 * @param {Map<string,string[]>} args.bundles  `loadNamespaceBundles()` (ό,τι ξέρει ήδη ο κοινός εξαγωγέας)
 * @returns {(absFile: string) => {namespaces: string[], opaque: Array<{line: number, text: string}>}}
 */
function createNamespaceDeclarationReader({ graph, bundles }) {
  const sources = new Map();
  const ctx = {
    graph,
    resolve: MG.createResolver(graph),
    parse(abs) {
      if (!sources.has(abs)) {
        sources.set(abs, fs.existsSync(abs) ? parseSource(abs, fs.readFileSync(abs, 'utf8')) : null);
      }
      return sources.get(abs);
    },
  };

  return absFile => {
    const text = stripComments(fs.readFileSync(absFile, 'utf8'));
    const plain = extractNamespaces(text, bundles);
    const seenByExtractor = PLAIN_CALLS.reduce((sum, pattern) => sum + count(text, pattern), 0);
    // Όλες οι κλήσεις είναι μορφές που ο κοινός εξαγωγέας διαβάζει ολόκληρες ⇒ καμία
    // ανάγκη για AST (η συντριπτική πλειονότητα των ~8.000 αρχείων μιας κλειστότητας).
    if (count(text, ANY_CALL) === seenByExtractor) return { namespaces: plain, opaque: [] };
    const resolved = readCalls(ctx, absFile);
    return { namespaces: [...new Set([...plain, ...resolved.namespaces])], opaque: resolved.opaque };
  };
}

module.exports = { createNamespaceDeclarationReader };
