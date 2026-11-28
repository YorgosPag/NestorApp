/**
 * =============================================================================
 * ΟΙ ΑΞΙΩΣΕΙΣ ΤΟΥ ΧΡΟΝΟΥ ΕΚΤΕΛΕΣΗΣ — `import()` και `import('x').T` (ADR-796 / CHECK 3.62)
 * =============================================================================
 *
 * Απαντά: *ποια σύμβολα ζητά ΑΥΤΟ το `import(…)` (ή αυτή η αναφορά τύπου `import('x').T`);*
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΜΕΤΡΗΜΕΝΟ 2026-11-28 (ADR-954 §2).** Η πύλη κοίταζε μόνο τις δηλώσεις
 * πρώτου επιπέδου (`import … from` / `export … from`). Η ερώτησή της όμως είναι **ποιος** ζητά
 * ένα σύμβολο, όχι **πότε** φορτώνεται. Μετρημένα: **15** κλήσεις `import()` και **3** αναφορές
 * τύπου από έξω προς το `dxf-viewer` ήταν **αόρατες** — ανάμεσά τους ο `CADProcessor` και η
 * ίδια η σελίδα του viewer (`DxfViewerApp`). Και όταν ο `BuildingFloorplanService` πέρασε από
 * στατικό σε `await import()` (για να μη φέρνει 360 αρχεία στη σελίδα), η πύλη είπε «κανείς
 * δεν ζητά πια `DxfFirestoreService`» — **ψέμα**· η θεραπεία που πρότεινε («σβήσε τη γραμμή»)
 * θα άφηνε σε χρήση σύμβολο που κανείς δεν φυλάει. Όσο μεγαλώνουν τα όρια φόρτωσης στη χρήση
 * (ADR-954), τόσο μεγαλύτερο κομμάτι της επιφάνειας θα έμενε στο σκοτάδι.
 *
 * 🏆 **ΙΔΙΑ ΣΗΜΑΣΙΑ ΜΕ ΤΟΥΣ BUNDLERS** (webpack 5 / Rollup tree-shaking του `import()`):
 *   - `const { A } = await import(x)`            ⇒ `A`
 *   - `(await import(x)).A`                      ⇒ `A`
 *   - `const m = await import(x); … m.A`         ⇒ `A`
 *   - `import(x).then((m) => m.A)` / `({ A }) =>`⇒ `A`
 *   - ολόκληρο το module **διαφεύγει** (lazy loader, `return`, όρισμα) ⇒ `*`
 *     — όπως το `import * as X`: η ευρύτερη αξίωση, γιατί ο παραλήπτης μπορεί να διαβάσει τα πάντα.
 *   - `import('x').A.B` (θέση τύπου) ⇒ `A` · `typeof import('x')` χωρίς όνομα ⇒ `*`
 *
 * ⚠️ **ΜΗΝ το κάνεις «καμία αξίωση» όταν δεν καταλαβαίνεις το σχήμα** — άγνωστο σχήμα ⇒ `*`
 * (fail-closed). Μια αξίωση που λείπει είναι το ίδιο τυφλό σημείο που κλείνει αυτό το αρχείο.
 * ⚠️ Η επισκίαση ονομάτων **δεν** αναλύεται: στη χειρότερη περίπτωση δίνει **περισσότερες**
 * αξιώσεις (ψευδώς θετικό, ορατό), ποτέ λιγότερες.
 *
 * @module scripts/lib/public-surface/dynamic-claims
 */

'use strict';

const ts = require('typescript');

/** Η ευρύτερη αξίωση: «ολόκληρο το module». Ίδιο σύμβολο με το `import * as X` του σαρωτή. */
const WHOLE = '*';

/** Είναι αυτός ο κόμβος `import(…)` σε χρόνο εκτέλεσης; */
function isImportCall(node) {
  return ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword;
}

/**
 * Το specifier ενός `import(…)` ή `import('x').T`.
 * `{ spec, literal }` — μη κυριολεκτικό (μεταβλητή/πρότυπο) ⇒ `literal: false` και το κείμενό του,
 * ώστε ο σαρωτής να το μετρήσει ΜΕ ΟΝΟΜΑ αν μοιάζει να δείχνει στο υποσύστημα.
 */
function specifierOf(node, sf) {
  const arg = isImportCall(node) ? node.arguments[0] : node.argument && node.argument.literal;
  if (!arg) return null;
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) return { spec: arg.text, literal: true };
  return { spec: arg.getText(sf), literal: false };
}

/** `{ A, B: c }` ⇒ `['A', 'B']` · `...rest` ή υπολογισμένο κλειδί ⇒ ολόκληρο. */
function bindingNames(pattern) {
  if (!ts.isObjectBindingPattern(pattern)) return [WHOLE];
  const names = [];
  for (const el of pattern.elements) {
    if (el.dotDotDotToken) return [WHOLE];
    const key = el.propertyName || el.name;
    if (!(ts.isIdentifier(key) || ts.isStringLiteral(key))) return [WHOLE];
    names.push(key.text);
  }
  return names;
}

/** Το πλησιέστερο σώμα όπου ζει μια δήλωση μεταβλητής. */
function enclosingScope(node) {
  let n = node.parent;
  while (n && !ts.isBlock(n) && !ts.isSourceFile(n) && !ts.isModuleBlock(n)) n = n.parent;
  return n || node;
}

/**
 * Κάθε χρήση του ονόματος του module μέσα στο `scope`: `m.A` ή `m['A']` ⇒ `A`·
 * οτιδήποτε άλλο (όρισμα, `return m`, spread) ⇒ το module διαφεύγει ⇒ ολόκληρο.
 */
function memberClaims(binding, scope) {
  const names = new Set();
  let escapes = false;
  const visit = (n) => {
    if (escapes) return;
    if (ts.isIdentifier(n) && n !== binding && n.text === binding.text) {
      const p = n.parent;
      const isKey = (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n);
      if (ts.isPropertyAccessExpression(p) && p.expression === n) names.add(p.name.text);
      else if (ts.isElementAccessExpression(p) && p.expression === n && ts.isStringLiteralLike(p.argumentExpression)) {
        names.add(p.argumentExpression.text);
      } else if (!isKey) escapes = true;
    }
    ts.forEachChild(n, visit);
  };
  visit(scope);
  return escapes ? [WHOLE] : [...names];
}

/** `import(x).then(cb)` ⇒ ό,τι διαβάζει το `cb` από το module. */
function thenClaims(thenCall) {
  const cb = thenCall.arguments[0];
  if (!cb || !(ts.isArrowFunction(cb) || ts.isFunctionExpression(cb))) return [WHOLE];
  const param = cb.parameters[0];
  if (!param) return []; // `.then(() => …)` — φορτώνει, δεν διαβάζει: όπως το `import './x'`
  if (ts.isIdentifier(param.name)) return memberClaims(param.name, cb.body);
  return bindingNames(param.name);
}

/** Τα σύμβολα που ζητά ένα `import(…)` σε χρόνο εκτέλεσης. */
function importCallClaims(call) {
  let node = call;
  let p = call.parent;
  let awaited = false;
  while (ts.isParenthesizedExpression(p) || ts.isAwaitExpression(p)) {
    if (ts.isAwaitExpression(p)) awaited = true;
    node = p;
    p = p.parent;
  }
  if (ts.isVariableDeclaration(p) && p.initializer === node) {
    if (!awaited) return [WHOLE]; // `const pending = import(x)` — η υπόσχεση διαφεύγει
    return ts.isIdentifier(p.name) ? memberClaims(p.name, enclosingScope(p)) : bindingNames(p.name);
  }
  if (ts.isPropertyAccessExpression(p) && p.expression === node) {
    if (awaited) return [p.name.text];
    const isThen = p.name.text === 'then' && ts.isCallExpression(p.parent) && p.parent.expression === p;
    return isThen ? thenClaims(p.parent) : [WHOLE];
  }
  return [WHOLE];
}

/** `import('x').A.B` ⇒ `A` · `typeof import('x')` ⇒ ολόκληρο. */
function importTypeClaims(node) {
  let q = node.qualifier;
  if (!q) return [WHOLE];
  while (ts.isQualifiedName(q)) q = q.left;
  return [q.text];
}

/**
 * Όλες οι αξιώσεις χρόνου εκτέλεσης και θέσης τύπου ενός αρχείου.
 * `[{ spec, literal, names, via }]` — `via` ∈ `dynamic` · `type-query`.
 */
function runtimeClaims(sf) {
  const out = [];
  const visit = (node) => {
    if (isImportCall(node) || ts.isImportTypeNode(node)) {
      const s = specifierOf(node, sf);
      if (s) {
        const dynamic = isImportCall(node);
        out.push({
          ...s,
          names: dynamic ? importCallClaims(node) : importTypeClaims(node),
          via: dynamic ? 'dynamic' : 'type-query',
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

module.exports = { runtimeClaims, importCallClaims, importTypeClaims, WHOLE };
