/**
 * CHECK 3.96 — «ΑΠΑΙΤΕΙ αυτή η έκφραση το `signInIsLive()`;» — δέντρο `|| / && / !` + σταθερό σημείο συναρτήσεων.
 *
 * 🔑 Ο κανόνας της απαίτησης (συντηρητικός — ό,τι δεν αναγνωρίζεται ΔΕΝ απαιτεί):
 *   κλήση του κατηγορήματος ⇒ ναι · κλήση συνάρτησης ⇒ ό,τι απαιτεί εκείνη · `A && B` ⇒ Α ή Β ·
 *   `A || B` ⇒ Α ΚΑΙ Β (κάθε κλάδος που μπορεί να δώσει `true`) · `!X` ⇒ όχι · οτιδήποτε άλλο ⇒ όχι.
 * Οι συναρτήσεις κρίνονται σε σταθερό σημείο (όλες «όχι» στην αρχή· μονότονο ⇒ τερματίζει).
 * ⚠️ `let` πριν από το `return` δεν διαβάζεται: φρουρός κρυμμένος σε `let` βγαίνει ΑΚΑΛΥΠΤΟΣ (ψευδώς θετικό,
 * προς την ασφαλή πλευρά) — η θεραπεία είναι να κληθεί ο φρουρός στο `return`.
 */

'use strict';

const TOKEN = /\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|&&|\|\||==|!=|<=|>=|[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|\S)/y;

function tokenize(expr) {
  const tokens = [];
  TOKEN.lastIndex = 0;
  let match;
  while (TOKEN.lastIndex < expr.length && (match = TOKEN.exec(expr))) tokens.push(match[1]);
  return tokens;
}

const OPEN = new Set(['(', '[', '{']);
const CLOSE = new Set([')', ']', '}']);

/** Το ταίρι της παρένθεσης που ανοίγει στο `start`. */
function closingOf(tokens, start) {
  let depth = 0;
  for (let i = start; i < tokens.length; i += 1) {
    if (OPEN.has(tokens[i])) depth += 1;
    if (CLOSE.has(tokens[i])) depth -= 1;
    if (depth === 0) return i;
  }
  return tokens.length - 1;
}

/** Ένα άτομο: `( … )` ολόκληρο · `name(…)` ολόκληρο (όχι `a.name(…)`) · αλλιώς αδιαφανές. */
function atomNode(tokens) {
  if (tokens[0] === '(' && closingOf(tokens, 0) === tokens.length - 1) return parse(tokens.slice(1, -1));
  const isName = /^[A-Za-z_$][\w$]*$/.test(tokens[0] ?? '');
  if (isName && tokens[1] === '(' && closingOf(tokens, 1) === tokens.length - 1) return { kind: 'call', name: tokens[0] };
  return { kind: 'opaque' };
}

/** Χωρίζει στο `op` σε βάθος 0. */
function splitTop(tokens, op) {
  const parts = [[]];
  let depth = 0;
  for (const token of tokens) {
    if (OPEN.has(token)) depth += 1;
    if (CLOSE.has(token)) depth -= 1;
    if (depth === 0 && token === op) parts.push([]);
    else parts.at(-1).push(token);
  }
  return parts;
}

/** `||` < `&&` < `!` < άτομο. Ternary/σύγκριση σε βάθος 0 μένουν μέσα στο άτομο ⇒ αδιαφανή. */
function parse(tokens) {
  const ors = splitTop(tokens, '||');
  if (ors.length > 1) return { kind: 'or', items: ors.map(parse) };
  const ands = splitTop(tokens, '&&');
  if (ands.length > 1) return { kind: 'and', items: ands.map(parse) };
  if (tokens[0] === '!') return { kind: 'not' };
  return atomNode(tokens);
}

function requires(node, predicate, guarded) {
  switch (node.kind) {
    case 'call': return node.name === predicate || guarded.get(node.name) === true;
    case 'and': return node.items.some((item) => requires(item, predicate, guarded));
    case 'or': return node.items.every((item) => requires(item, predicate, guarded));
    default: return false;
  }
}

/** Ποιες συναρτήσεις απαιτούν το κατηγόρημα — σταθερό σημείο. */
function guardedFunctions(functions, predicate) {
  const trees = functions.map((fn) => ({ name: fn.name, tree: parse(tokenize(fn.expr)) }));
  const guarded = new Map(trees.map(({ name }) => [name, false]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const { name, tree } of trees) {
      if (!guarded.get(name) && requires(tree, predicate, guarded)) {
        guarded.set(name, true);
        changed = true;
      }
    }
  }
  return guarded;
}

/** Η ετυμηγορία ενός `allow`: `if-false` · `public` · `covered` · `uncovered`. */
function judgeAllow(allow, predicate, guarded) {
  if (allow.expr === 'false') return 'if-false';
  if (allow.expr === 'true') return 'public';
  return requires(parse(tokenize(allow.expr)), predicate, guarded) ? 'covered' : 'uncovered';
}

module.exports = { guardedFunctions, judgeAllow, parse, requires, tokenize };
