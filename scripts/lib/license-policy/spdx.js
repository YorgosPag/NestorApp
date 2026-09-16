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

// ─── Αναδρομική κάθοδος — `st = { tokens, pos }` ρητά, όχι closure (N.7.1: ≤40 γρ./συνάρτηση) ──

const fail = (msg) => { throw new SyntaxError(msg); };
const peek = (st) => st.tokens[st.pos];
const take = (st) => st.tokens[st.pos++];
const isIdentToken = (tok) => tok !== undefined && tok !== '(' && tok !== ')' && !OPERATORS.has(tok);

function atom(st) {
  const tok = take(st);
  if (tok === undefined) fail('απρόσμενο τέλος έκφρασης');
  if (tok === '(') {
    const inner = orExpr(st);
    if (take(st) !== ')') fail('λείπει «)»');
    return inner;
  }
  if (!isIdentToken(tok)) fail(`απρόσμενο «${tok}»`);
  const plus = tok.endsWith('+');
  return { type: 'license', id: plus ? tok.slice(0, -1) : tok, plus, exception: null };
}

function withExpr(st) {
  const node = atom(st);
  if (peek(st) !== 'WITH') return node;
  take(st);
  const exc = take(st);
  if (node.type !== 'license') fail('το «WITH» εφαρμόζεται μόνο σε αναγνωριστικό άδειας');
  if (!isIdentToken(exc) || exc.endsWith('+')) fail('λείπει αναγνωριστικό εξαίρεσης μετά το «WITH»');
  return { ...node, exception: exc };
}

function chain(st, type, operator, next) {
  const operands = [next(st)];
  while (peek(st) === operator) {
    take(st);
    operands.push(next(st));
  }
  return operands.length === 1 ? operands[0] : { type, operands };
}

function andExpr(st) { return chain(st, 'and', 'AND', withExpr); }
function orExpr(st) { return chain(st, 'or', 'OR', andExpr); }

function parseTokens(tokens) {
  const st = { tokens, pos: 0 };
  const ast = orExpr(st);
  if (st.pos !== tokens.length) fail(`περίσσιο «${tokens[st.pos]}»`);
  return ast;
}

/**
 * @returns {{ok: true, ast: object} | {ok: false, error: string}}
 * Ποτέ δεν πετά: μια άδεια που δεν αναλύεται είναι **δεδομένο** (γίνεται `unknown`), όχι κρασάρισμα.
 */
function parse(text) {
  const t = tokenize(text);
  if (!t.ok) return t;
  try {
    return { ok: true, ast: parseTokens(t.tokens) };
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
