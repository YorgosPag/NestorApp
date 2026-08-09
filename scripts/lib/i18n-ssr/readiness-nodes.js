#!/usr/bin/env node
/**
 * =============================================================================
 * Κ1 — ΟΙ ΒΟΗΘΟΙ AST  (CHECK 3.51 / ADR-781 §4)
 * =============================================================================
 *
 * Χωρίστηκε από το `readiness-ast.js` για το όριο **500 γραμμών** του N.7.1, και
 * το όριο έπεσε σε **σωστό** σημείο: εδώ ζει το «**πώς διαβάζεται** ο κώδικας»,
 * εκεί το «**τι σημαίνει**». Ο ταξινομητής μπορεί να αλλάξει κριτήριο χωρίς να
 * αγγίξει το AST, και το AST μπορεί να μάθει νέα σχήματα χωρίς να αλλάξει το
 * κριτήριο.
 *
 * Το parsing γίνεται με **`ts.createSourceFile`** — parse-only, **ΠΟΤΕ**
 * `ts.createProgram`: δεν είναι type-check (CLAUDE.md **N.17**), ίδια αιτιολογία
 * με το `key-extract.js` του ADR-744 και το CHECK 3.44.
 * =============================================================================
 */

'use strict';

const ts = require('typescript');

/**
 * Τα ονόματα που κάνουν ένα effect **i18n effect**. Χωρίς αυτό το φίλτρο ο
 * κανόνας μετρήθηκε να πιάνει `loadingCompanies` στο
 * `useNewObligationPage.ts` — σημαία φόρτωσης **δεδομένων**, που παραδίδεται
 * δίπλα στο `t` και της οποίας ο καταναλωτής βάφει
 * `t('basicInfo.loadingCompanies')`, δηλαδή **μεταφρασμένο κείμενο**. Στον
 * server ζωγραφίζει «Φόρτωση…» αντί για λίστα — **σωστό**, όχι ωμό κλειδί.
 * 1 στο 1 των μπλοκαρόντων ευρημάτων ⇒ 100% FP χωρίς αυτόν τον διαχωρισμό.
 */
const I18N_SIGNALS = new Set([
  'i18n', 'i18next', 'namespace', 'namespaces',
  'loadNamespace', 'loadNamespaces', 'loadTranslations',
  'hasResourceBundle', 'addResourceBundle', 'getResourceBundle',
  'isBundleComplete', 'getBundleState', 'recordLoaderInstall', 'recordShellBootstrap',
  'changeLanguage', 'reloadResources', 'loadLanguages',
]);

const EFFECT_HOOKS = new Set(['useEffect', 'useLayoutEffect', 'useInsertionEffect']);
const STATE_HOOKS = new Set(['useState', 'useReducer']);

/** `// ssr-readiness-exempt: <λόγος>` — λόγος ΥΠΟΧΡΕΩΤΙΚΟΣ (πρότυπο CHECK 3.35). */
const EXEMPT_RE = /\/\/\s*ssr-readiness-exempt:\s*(\S.*)$/;

// ---------------------------------------------------------------------------
// Βοηθοί AST
// ---------------------------------------------------------------------------

function calleeName(node) {
  if (!ts.isCallExpression(node)) return null;
  const callee = node.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name)) return callee.name.text;
  return null;
}

/**
 * Κρατάει το module αυτού του αρχείου το `t`;
 * Δύο ανεξάρτητα σχήματα, γιατί ένα wrapper hook δεν λέγεται πάντα
 * `useTranslation` (ακριβώς αυτό ήταν ο `useTranslationLazy`, και ακριβώς
 * γι' αυτό το regex `useTranslation\(` του `i18n-namespace-extract.js` ήταν
 * τυφλό σε αυτά τα 24 αρχεία).
 */
function holdsTranslator(source) {
  let holds = false;
  const visit = (node) => {
    if (holds) return;
    const name = calleeName(node);
    if (name && /^use[A-Z0-9_]?\w*Translation/i.test(name)) holds = true;
    // const { t } = useSomething()
    if (
      !holds &&
      ts.isVariableDeclaration(node) &&
      node.name &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      /^use[A-Z]/.test(calleeName(node.initializer) || '')
    ) {
      for (const element of node.name.elements) {
        const key = element.propertyName || element.name;
        if (ts.isIdentifier(key) && key.text === 't') holds = true;
      }
    }
    if (!holds) ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return holds;
}

/**
 * Είναι ο σπόρος **σταθερά**;
 * @returns {'constant'|'synchronous'|'unanalyzable'}
 */
function classifySeed(argument, moduleLiterals) {
  if (argument === undefined) return 'constant'; // useState() → undefined, για πάντα
  // `useState(x as T)` / `useState(<T>x)` / `useState(x satisfies T)` — ο τύπος
  // δεν αλλάζει την τιμή· ξετυλίγεται πριν κριθεί.
  if (ts.isAsExpression(argument) || ts.isTypeAssertionExpression(argument) || ts.isSatisfiesExpression(argument)) {
    return classifySeed(argument.expression, moduleLiterals);
  }
  if (ts.isParenthesizedExpression(argument)) return classifySeed(argument.expression, moduleLiterals);
  // Ένα literal αντικείμενο/πίνακας είναι **σταθερά**, όσο μεγάλο κι αν είναι.
  // Χωρίς αυτό μετρήθηκαν 4 αρχεία ως «ανάλυτα» για ένα σκέτο `useState({...})`
  // — θόρυβος που κρύβει τα πραγματικά ανάλυτα.
  if (ts.isObjectLiteralExpression(argument) || ts.isArrayLiteralExpression(argument)) {
    const parts = ts.isObjectLiteralExpression(argument) ? argument.properties : argument.elements;
    for (const part of parts) {
      const value = ts.isPropertyAssignment(part) ? part.initializer : ts.isShorthandPropertyAssignment(part) ? part.name : part;
      if (classifySeed(value, moduleLiterals) === 'synchronous') return 'synchronous';
    }
    return 'constant';
  }
  if (
    argument.kind === ts.SyntaxKind.TrueKeyword ||
    argument.kind === ts.SyntaxKind.FalseKeyword ||
    argument.kind === ts.SyntaxKind.NullKeyword ||
    ts.isNumericLiteral(argument) ||
    ts.isStringLiteral(argument) ||
    ts.isNoSubstitutionTemplateLiteral(argument)
  ) {
    return 'constant';
  }
  if (ts.isIdentifier(argument)) {
    if (argument.text === 'undefined') return 'constant';
    if (moduleLiterals.has(argument.text)) return 'constant';
    return 'unanalyzable';
  }
  if (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) {
    // `useState(() => false)` είναι σταθερά με καπέλο. `useState(() => compute())`
    // είναι σύγχρονος υπολογισμός — η ΘΕΡΑΠΕΙΑ, όχι η βλάβη.
    const body = argument.body;
    if (body && !ts.isBlock(body)) return classifySeed(body, moduleLiterals);
    if (body && ts.isBlock(body)) {
      const statements = body.statements;
      if (statements.length === 1 && ts.isReturnStatement(statements[0]) && statements[0].expression) {
        return classifySeed(statements[0].expression, moduleLiterals);
      }
    }
    return 'synchronous';
  }
  // κλήση, τριαδικός, πρόσβαση σε ιδιότητα… → υπολογίζεται στο render, άρα και στον server
  if (ts.isCallExpression(argument) || ts.isConditionalExpression(argument) ||
      ts.isPropertyAccessExpression(argument) || ts.isBinaryExpression(argument) ||
      ts.isPrefixUnaryExpression(argument)) {
    return 'synchronous';
  }
  return 'unanalyzable';
}

/** Ονόματα module-level `const X = <literal>` — για `useState(INITIAL)`. */
function collectModuleLiterals(source) {
  const names = new Set();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      const init = declaration.initializer;
      if (
        init.kind === ts.SyntaxKind.TrueKeyword ||
        init.kind === ts.SyntaxKind.FalseKeyword ||
        init.kind === ts.SyntaxKind.NullKeyword ||
        ts.isNumericLiteral(init) ||
        ts.isStringLiteral(init)
      ) {
        names.add(declaration.name.text);
      }
    }
  }
  return names;
}

/**
 * Οι δηλώσεις `const [X, setX] = useState(...)`, με τον σπόρο ταξινομημένο.
 */
function collectStateDeclarations(source, moduleLiterals) {
  const declarations = [];
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name &&
      ts.isArrayBindingPattern(node.name) &&
      node.name.elements.length >= 2 &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      STATE_HOOKS.has(calleeName(node.initializer) || '')
    ) {
      const [valueElement, setterElement] = node.name.elements;
      const value = ts.isBindingElement(valueElement) && ts.isIdentifier(valueElement.name) ? valueElement.name.text : null;
      const setter = ts.isBindingElement(setterElement) && ts.isIdentifier(setterElement.name) ? setterElement.name.text : null;
      if (value && setter) {
        declarations.push({
          value,
          setter,
          seed: classifySeed(node.initializer.arguments[0], moduleLiterals),
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return declarations;
}

/**
 * Πού γράφεται κάθε setter; Η εμφώλευση σε `.then()` **μέσα** στο effect μετράει
 * ως «μέσα»: λεξικά είναι μέσα, και σε SSR δεν τρέχει κανένα από τα δύο.
 *
 * @returns {Map<string, {writes: number, writesInEffect: number}>}
 */
function referencesI18n(node) {
  let found = false;
  const walk = (child) => {
    if (found) return;
    if (ts.isIdentifier(child) && I18N_SIGNALS.has(child.text)) found = true;
    else ts.forEachChild(child, walk);
  };
  walk(node);
  return found;
}

function analyseWrites(source, setters) {
  const result = new Map();
  for (const name of setters) result.set(name, { writes: 0, writesInEffect: 0, writesInI18nEffect: 0 });
  let effectDepth = 0;
  let i18nEffectDepth = 0;

  const visit = (node) => {
    if (ts.isCallExpression(node) && EFFECT_HOOKS.has(calleeName(node) || '')) {
      const [callback, ...rest] = node.arguments;
      if (callback) {
        const i18nEffect = referencesI18n(callback);
        effectDepth += 1;
        if (i18nEffect) i18nEffectDepth += 1;
        visit(callback);
        if (i18nEffect) i18nEffectDepth -= 1;
        effectDepth -= 1;
      }
      for (const other of rest) visit(other);
      return;
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const stats = result.get(node.expression.text);
      if (stats) {
        stats.writes += 1;
        if (effectDepth > 0) stats.writesInEffect += 1;
        if (i18nEffectDepth > 0) stats.writesInI18nEffect += 1;
      }
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(source, visit);
  return result;
}

/**
 * ΤΟ ΚΡΙΤΗΡΙΟ: βρίσκει κάθε `return { … }` που **παραδίδει `t`**, και για κάθε
 * ΑΛΛΗ ιδιότητά του καταγράφει ποια ονόματα κατάστασης τη συνθέτουν.
 *
 * `return { t, i18n, ready: ready && isNamespaceLoaded, isLoading: !isNamespaceLoaded }`
 *  ⇒ επιφάνεια `t` ✅, εξαρτήσεις { ready: [isNamespaceLoaded], isLoading: [isNamespaceLoaded] }
 *
 * ⚠️ Η ιδιότητα `t` **δεν** μετράει ως εξάρτηση του εαυτού της, αλλιώς κάθε
 * hook που απλώς προωθεί το `t` θα φαινόταν να δηλώνει ετοιμότητα.
 *
 * @returns {Array<{property: string, names: string[], line: number}>}
 */
function collectTranslatorSurfaces(source) {
  const surfaces = [];

  const namesIn = (node) => {
    const found = new Set();
    const walk = (child) => {
      if (ts.isIdentifier(child)) {
        const parent = child.parent;
        const isPropertyName = parent && ts.isPropertyAccessExpression(parent) && parent.name === child;
        if (!isPropertyName) found.add(child.text);
      }
      ts.forEachChild(child, walk);
    };
    walk(node);
    return [...found];
  };

  const visit = (node) => {
    if (ts.isObjectLiteralExpression(node) && node.parent && ts.isReturnStatement(node.parent)) {
      const properties = node.properties.filter(
        (property) => ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)
      );
      const delivers = properties.some(
        (property) => ts.isIdentifier(property.name) && property.name.text === 't'
      );
      if (delivers) {
        for (const property of properties) {
          if (!ts.isIdentifier(property.name) || property.name.text === 't') continue;
          const valueNode = ts.isPropertyAssignment(property) ? property.initializer : property.name;
          surfaces.push({
            property: property.name.text,
            names: namesIn(valueNode),
            line: source.getLineAndCharacterOfPosition(property.getStart(source)).line + 1,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(source, visit);
  return surfaces;
}

function findExemption(lines, line) {
  for (let index = line - 1; index >= Math.max(0, line - 4); index -= 1) {
    const text = lines[index];
    if (text === undefined) continue;
    const match = EXEMPT_RE.exec(text);
    if (match) return match[1].trim();
    if (index < line - 1 && !/^\s*(\/\/|\*|\/\*)/.test(text)) break;
  }
  return null;
}

module.exports = {
  I18N_SIGNALS,
  EFFECT_HOOKS,
  STATE_HOOKS,
  EXEMPT_RE,
  calleeName,
  holdsTranslator,
  classifySeed,
  collectModuleLiterals,
  collectStateDeclarations,
  referencesI18n,
  analyseWrites,
  collectTranslatorSurfaces,
  findExemption,
};
