/**
 * CHECK 12 / ADR-598 G13 — ΑΝΑΛΥΤΗΣ ΕΚΦΡΑΣΕΩΝ ΑΔΕΙΑΣ SPDX.
 *
 * Γραμματική (SPDX Specification v2.3, Annex D), με προτεραιότητα `WITH` > `AND` > `OR`:
 *
 *   expr     := andExpr ( "OR" andExpr )*
 *   andExpr  := withExpr ( "AND" withExpr )*
 *   withExpr := atom ( "WITH" exceptionId )?
 *   atom     := "(" expr ")" | licenseId [ "+" ]
 *
 * 🔑 **ΓΙΑΤΙ ΔΙΚΟΣ ΜΑΣ ΚΑΙ ΟΧΙ `spdx-expression-parse`**: υπάρχει στο δέντρο μόνο μεταβατικά
 * (phantom — δεν είναι άμεση εξάρτηση)· η προσθήκη του θέλει `pnpm install` στο κοινό
 * `node_modules`. Η γραμματική είναι μικρή και κλειστή, και εδώ **κάθε κλάδος εκτελείται**
 * από την άγκυρα `license-policy.test.js`.
 *
 * ⚠️ **ΑΥΣΤΗΡΟΣ ΕΠΙΤΗΔΕΣ**: οι τελεστές είναι κεφαλαίοι (όπως ορίζει η προδιαγραφή) και
 * χαρακτήρες εκτός SPDX (`/`, κενά μέσα σε όνομα) είναι **σφάλμα σύνταξης**. Το «MIT/X11» ή το
 * «Public Domain» **δεν** μαντεύονται: ο αναλυτής αποτυγχάνει, και η πολιτική αποφασίζει με
 * ρητή αντιστοίχιση ή επιμέλεια **με τεκμήριο** (πρότυπο ORT `declared_license_mapping`).
 */

'use strict';

const OPERATORS = new Set(['AND', 'OR', 'WITH']);
const IDENT = /^(?:DocumentRef-[A-Za-z0-9.-]+:)?[A-Za-z0-9][A-Za-z0-9.-]*\+?$/;

/** @returns {{ok: true, tokens: string[]} | {ok: false, error: string}} */
function tokenize(text) {
  const raw = String(text ?? '').replace(/([()])/g, ' $1 ').trim();
  if (!raw) return { ok: false, error: 'κενή έκφραση' };
  const tokens = raw.split(/\s+/);
  const bad = tokens.find((t) => t !== '(' && t !== ')' && !OPERATORS.has(t) && !IDENT.test(t));
  if (bad !== undefined) return { ok: false, error: `μη έγκυρο σύμβολο «${bad}»` };
  return { ok: true, tokens };
}

function makeParser(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const take = () => tokens[pos++];
  const fail = (msg) => { throw new SyntaxError(msg); };

  function atom() {
    const tok = take();
    if (tok === undefined) fail('απρόσμενο τέλος έκφρασης');
    if (tok === '(') {
      const inner = orExpr();
      if (take() !== ')') fail('λείπει «)»');
      return inner;
    }
    if (tok === ')' || OPERATORS.has(tok)) fail(`απρόσμενο «${tok}»`);
    const plus = tok.endsWith('+');
    return { type: 'license', id: plus ? tok.slice(0, -1) : tok, plus, exception: null };
  }

  function withExpr() {
    const node = atom();
    if (peek() !== 'WITH') return node;
    take();
    const exc = take();
    if (node.type !== 'license') fail('το «WITH» εφαρμόζεται μόνο σε αναγνωριστικό άδειας');
    if (exc === undefined || exc === '(' || exc === ')' || OPERATORS.has(exc) || exc.endsWith('+')) {
      fail('λείπει αναγνωριστικό εξαίρεσης μετά το «WITH»');
    }
    return { ...node, exception: exc };
  }

  function chain(type, operator, next) {
    const operands = [next()];
    while (peek() === operator) {
      take();
      operands.push(next());
    }
    return operands.length === 1 ? operands[0] : { type, operands };
  }

  function andExpr() { return chain('and', 'AND', withExpr); }
  function orExpr() { return chain('or', 'OR', andExpr); }

  return {
    parse() {
      const ast = orExpr();
      if (pos !== tokens.length) fail(`περίσσιο «${tokens[pos]}»`);
      return ast;
    },
  };
}

/**
 * @returns {{ok: true, ast: object} | {ok: false, error: string}}
 * Ποτέ δεν πετά: μια άδεια που δεν αναλύεται είναι **δεδομένο** (γίνεται `unknown`), όχι κρασάρισμα.
 */
function parse(text) {
  const t = tokenize(text);
  if (!t.ok) return t;
  try {
    return { ok: true, ast: makeParser(t.tokens).parse() };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/** Φύλλο σε κείμενο: `GPL-2.0+ WITH Classpath-exception-2.0`. */
function leafText(leaf) {
  return `${leaf.id}${leaf.plus ? '+' : ''}${leaf.exception ? ` WITH ${leaf.exception}` : ''}`;
}

/**
 * Κανονική μορφή για σύγκριση drift: οι τελεσταίοι ταξινομούνται (το `A AND B` είναι η ίδια
 * υποχρέωση με το `B AND A`), οι σύνθετοι τελεσταίοι παίρνουν παρενθέσεις, οι εξωτερικές
 * περιττές παρενθέσεις φεύγουν. Δύο εκφράσεις με ίδια κανονική μορφή είναι η ίδια άδεια.
 */
function canonical(ast) {
  if (ast.type === 'license') return leafText(ast);
  const parts = ast.operands
    .map((op) => (op.type === 'license' ? canonical(op) : `(${canonical(op)})`))
    .sort();
  return parts.join(ast.type === 'and' ? ' AND ' : ' OR ');
}

/** Κανονική μορφή κειμένου, ή `null` αν δεν αναλύεται. */
function canonicalText(text) {
  const p = parse(text);
  return p.ok ? canonical(p.ast) : null;
}

/** Όλα τα φύλλα, με τη σειρά εμφάνισης. */
function leaves(ast) {
  return ast.type === 'license' ? [ast] : ast.operands.flatMap(leaves);
}

/**
 * Αποτίμηση κατηγορίας: **OR ⇒ η ευνοϊκότερη** (ο καταναλωτής διαλέγει), **AND ⇒ η
 * αυστηρότερη** (ισχύουν όλες οι υποχρεώσεις). `rankOf(category)`: μεγαλύτερο = αυστηρότερο.
 *
 * @param {object} ast
 * @param {(leaf: object) => string} categoryOfLeaf
 * @param {(category: string) => number} rankOf
 * @returns {string}
 */
function evaluate(ast, categoryOfLeaf, rankOf) {
  if (ast.type === 'license') return categoryOfLeaf(ast);
  const categories = ast.operands.map((op) => evaluate(op, categoryOfLeaf, rankOf));
  const pick = ast.type === 'or'
    ? (a, b) => (rankOf(b) < rankOf(a) ? b : a)
    : (a, b) => (rankOf(b) > rankOf(a) ? b : a);
  return categories.reduce(pick);
}

module.exports = { parse, canonical, canonicalText, leaves, leafText, evaluate, tokenize };
