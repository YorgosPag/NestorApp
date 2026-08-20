#!/usr/bin/env node
/**
 * =============================================================================
 * CHECK 3.55 (ADR-785) — Η ΑΝΑΓΝΩΣΗ ΕΝΟΣ ΑΡΧΕΙΟΥ
 * =============================================================================
 *
 * Απαντά **τρία** πράγματα για ένα module, και τίποτε άλλο:
 *
 *   1. ποιες τοπικές συναρτήσεις **καλούν** εχθρικό προς την προαπόδοση hook·
 *   2. ποιες τοπικές συναρτήσεις **ζωγραφίζουν** τι, και **αν** η κάθε χρήση
 *      κάθεται κάτω από `<Suspense>`·
 *   3. ποιο τοπικό όνομα είναι το **default export**.
 *
 * 🔑 **ΓΙΑΤΙ ΔΥΟ ΞΕΧΩΡΙΣΤΕΣ ΣΧΕΣΕΙΣ ΚΑΙ ΟΧΙ ΜΙΑ.** Ένα hook τρέχει **ΜΕΣΑ** στο
 * σώμα του component που το καλεί — δεν υπάρχει `<Suspense>` που να μπορεί να
 * μπει ανάμεσα. Ένα παιδί JSX, αντίθετα, μπορεί να τυλιχτεί. Άρα η κλήση
 * **διαδίδει** την εχθρότητα προς τα πάνω, ενώ η απόδοση **μπορεί να φρουρηθεί**.
 * Μια ενιαία σχέση «εξαρτάται από» θα ισοπέδωνε ακριβώς τη διαφορά που κρίνεται.
 *
 * ⚠️ **ΤΟ `next/dynamic` ΧΩΡΙΣ `ssr: false` ΔΕΝ ΕΙΝΑΙ ΦΡΟΥΡΟΣ.** Κόβει το
 * **bundle**, όχι την **απόδοση** — το component βάφεται στον server, στο ίδιο
 * καρέ. Αυτό είναι μετρημένο μάθημα αυτού του repo (ADR-744 §14.2, όπου τέσσερα
 * ωμά i18n κλειδιά έζησαν ακριβώς πάνω σε αυτή την παρανόηση), όχι θεωρία.
 * Με `ssr: false` το υποδέντρο **δεν προαποδίδεται καθόλου** ⇒ φρουρός.
 *
 * ⚠️ **ΤΟ `fallback` ΔΕΝ ΕΙΝΑΙ ΜΕΣΑ ΣΤΟ ΟΡΙΟ.** Το `<Suspense fallback={<X/>}>`
 * ζωγραφίζει το `X` **όταν** το όριο κρεμάσει· ένα εχθρικό hook εκεί μέσα θα
 * ζητούσε από το ίδιο όριο να φρουρήσει τον εαυτό του. Fail-closed: αφρούρητο.
 * =============================================================================
 */

'use strict';

const ts = require('typescript');

/** Τα API που **ακυρώνουν** τη στατική προαπόδοση όταν τρέχουν αφρούρητα. */
const HOSTILE_IMPORTS = Object.freeze({ 'next/navigation': ['useSearchParams'] });

const SUSPENSE_NAMES = Object.freeze(new Set(['Suspense']));

function scriptKindFor(file) {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (file.endsWith('.js')) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

/** `<Suspense>` · `<React.Suspense>` · τοπικό ψευδώνυμο εισαγμένο από το react. */
function isSuspenseTag(node, suspenseAliases) {
  const tag = node.tagName;
  if (!tag) return false;
  if (ts.isIdentifier(tag)) return suspenseAliases.has(tag.text);
  if (ts.isPropertyAccessExpression(tag)) return SUSPENSE_NAMES.has(tag.name.text);
  return false;
}

/** Το όνομα ετικέτας ως τοπικό αναγνωριστικό (`<Foo.Bar/>` → `Foo`). */
function tagIdentifier(node) {
  const tag = node.tagName;
  if (!tag) return null;
  if (ts.isIdentifier(tag)) return tag.text;
  let cur = tag;
  while (ts.isPropertyAccessExpression(cur)) cur = cur.expression;
  return ts.isIdentifier(cur) ? cur.text : null;
}

/**
 * Οι εισαγωγές, ως τρεις χάρτες: τοπικό όνομα → προέλευση · ψευδώνυμα Suspense ·
 * τοπικά ονόματα που δείχνουν σε εχθρικό API.
 */
function collectImports(sourceFile) {
  const bindings = new Map();
  const suspenseAliases = new Set(SUSPENSE_NAMES);
  const hostileLocals = new Set();

  for (const st of sourceFile.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    const spec = st.moduleSpecifier.text;
    const clause = st.importClause;
    if (!clause) continue;
    const hostileNames = HOSTILE_IMPORTS[spec] || [];

    if (clause.name) bindings.set(clause.name.text, { spec, imported: 'default' });
    const named = clause.namedBindings;
    if (named && ts.isNamedImports(named)) {
      for (const el of named.elements) {
        const imported = el.propertyName ? el.propertyName.text : el.name.text;
        bindings.set(el.name.text, { spec, imported });
        if (hostileNames.includes(imported)) hostileLocals.add(el.name.text);
        if (spec === 'react' && SUSPENSE_NAMES.has(imported)) suspenseAliases.add(el.name.text);
      }
    }
    if (named && ts.isNamespaceImport(named)) bindings.set(named.name.text, { spec, imported: '*' });
  }
  return { bindings, suspenseAliases, hostileLocals };
}

/** `dynamic(() => import('x'), { ssr: false })` → `{ spec, guarded }`. */
function readDynamicImport(node, dynamicLocals) {
  if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return null;
  if (!dynamicLocals.has(node.expression.text)) return null;
  const spec = findImportSpecifier(node.arguments[0]);
  if (!spec) return null;
  return { spec, guarded: hasSsrFalse(node.arguments[1]) };
}

function findImportSpecifier(arg) {
  let found = null;
  const visit = node => {
    if (found) return;
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [first] = node.arguments;
      if (first && ts.isStringLiteral(first)) found = first.text;
      return;
    }
    ts.forEachChild(node, visit);
  };
  if (arg) visit(arg);
  return found;
}

function hasSsrFalse(options) {
  if (!options || !ts.isObjectLiteralExpression(options)) return false;
  return options.properties.some(
    prop =>
      ts.isPropertyAssignment(prop) &&
      ts.isIdentifier(prop.name) &&
      prop.name.text === 'ssr' &&
      prop.initializer.kind === ts.SyntaxKind.FalseKeyword
  );
}

/** Ο ένας περίπατος: κλήσεις + ακμές απόδοσης, με βάθος `<Suspense>`. */
function walkBody(body, ctx) {
  const state = { calls: new Set(), renders: [], childrenGuarded: false };
  const visit = (node, depth) => {
    collectCallee(node, state.calls);
    if (isChildrenSlot(node) && depth > 0) state.childrenGuarded = true;
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      visitJsx(node, depth, state, ctx, visit);
      return;
    }
    ts.forEachChild(node, child => visit(child, depth));
  };
  visit(body, ctx.depth || 0);
  return state;
}

function visitJsx(node, depth, state, ctx, visit) {
  const opening = ts.isJsxElement(node) ? node.openingElement : node;
  const name = tagIdentifier(opening);
  if (name) state.renders.push({ name, guarded: depth > 0 });
  const inner = depth + (isSuspenseTag(opening, ctx.suspenseAliases) ? 1 : 0);
  // ⚠️ Τα attributes (μαζί με το `fallback`) κρίνονται στο ΕΞΩΤΕΡΙΚΟ βάθος:
  // ένα `fallback` δεν μπορεί να φρουρηθεί από το όριο που το ζωγραφίζει.
  for (const attr of opening.attributes.properties) visit(attr, depth);
  if (ts.isJsxElement(node)) for (const child of node.children) visit(child, inner);
}

function collectCallee(node, calls) {
  if (!ts.isCallExpression(node)) return;
  if (ts.isIdentifier(node.expression)) calls.add(node.expression.text);
  else if (ts.isPropertyAccessExpression(node.expression)) {
    const root = node.expression.expression;
    if (ts.isIdentifier(root)) calls.add(`${root.text}.${node.expression.name.text}`);
  }
}

/**
 * `{children}` μέσα σε JSX. Ένα layout που το γράφει κάτω από `<Suspense>`
 * φρουρεί **ΤΗ ΣΕΛΙΔΑ ΟΛΟΚΛΗΡΗ**, όσο βαθιά κι αν ζει το ελάττωμα μέσα της.
 */
function isChildrenSlot(node) {
  return (
    ts.isJsxExpression(node) &&
    !!node.expression &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'children'
  );
}

function declaredName(node) {
  if (ts.isFunctionDeclaration(node) && node.name) return node.name.text;
  if (ts.isVariableStatement(node)) {
    const [decl] = node.declarationList.declarations;
    if (decl && ts.isIdentifier(decl.name)) return decl.name.text;
  }
  return null;
}

function bodyOf(node) {
  if (ts.isFunctionDeclaration(node)) return node.body || null;
  if (ts.isVariableStatement(node)) {
    const [decl] = node.declarationList.declarations;
    return decl && decl.initializer ? decl.initializer : null;
  }
  return null;
}

function readDefaultExportName(sourceFile) {
  for (const st of sourceFile.statements) {
    const modifiers = ts.canHaveModifiers(st) ? ts.getModifiers(st) || [] : [];
    const isDefault = modifiers.some(m => m.kind === ts.SyntaxKind.DefaultKeyword);
    if (isDefault && ts.isFunctionDeclaration(st)) return st.name ? st.name.text : '__default__';
    if (ts.isExportAssignment(st) && !st.isExportEquals && ts.isIdentifier(st.expression)) {
      return st.expression.text;
    }
  }
  return null;
}

/** `export const dynamic = 'force-dynamic'` — ρητή αποχώρηση από την προαπόδοση. */
function readDynamicOptOut(sourceFile) {
  for (const st of sourceFile.statements) {
    if (!ts.isVariableStatement(st)) continue;
    for (const decl of st.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || decl.name.text !== 'dynamic') continue;
      if (decl.initializer && ts.isStringLiteral(decl.initializer)) {
        if (decl.initializer.text === 'force-dynamic') return true;
      }
    }
  }
  return false;
}

/**
 * @returns {{locals: Map<string, {calls: Set<string>, renders: object[]}>,
 *            bindings: Map<string, {spec: string, imported: string}>,
 *            hostileLocals: Set<string>, dynamicEdges: Map<string, object>,
 *            defaultExport: ?string, dynamicOptOut: boolean, topLevel: object}}
 */
function analyzeModule(file, text) {
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKindFor(file));
  const { bindings, suspenseAliases, hostileLocals } = collectImports(sourceFile);
  const dynamicLocals = new Set(
    [...bindings].filter(([, v]) => v.spec === 'next/dynamic').map(([k]) => k)
  );

  const locals = new Map();
  const dynamicEdges = new Map();
  const ctx = { suspenseAliases, depth: 0 };

  for (const st of sourceFile.statements) {
    const name = declaredName(st);
    const body = bodyOf(st);
    if (!name || !body) continue;
    const edge = readDynamicImport(body, dynamicLocals);
    if (edge) {
      dynamicEdges.set(name, edge);
      continue;
    }
    locals.set(name, walkBody(body, ctx));
  }

  return {
    file,
    locals,
    bindings,
    hostileLocals,
    dynamicEdges,
    defaultExport: readDefaultExportName(sourceFile),
    dynamicOptOut: readDynamicOptOut(sourceFile),
  };
}

module.exports = { analyzeModule, HOSTILE_IMPORTS, SUSPENSE_NAMES, walkBody, collectImports, readDynamicOptOut };
