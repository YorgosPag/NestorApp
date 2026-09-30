/**
 * CHECK 3.96 — Η ΔΟΜΗ ΕΝΟΣ ΑΡΧΕΙΟΥ ΚΑΝΟΝΩΝ: συναρτήσεις και `allow`, με τον αριθμό γραμμής του ΠΗΓΑΙΟΥ.
 *
 * 🔑 Τα σχόλια αφαιρούνται με τον ΙΔΙΟ αφαιρέτη που χτίζει το artifact του deploy (`build-firestore-rules.js`
 * `stripComment`) — ανά γραμμή, ώστε οι αριθμοί γραμμών να μένουν του πηγαίου (το `compileRules` σβήνει κενές).
 * ⚠️ Σαρωτής χαρακτήρων με επίγνωση συμβολοσειρών: το `{database}` ενός `match` ΔΕΝ είναι μπλοκ.
 */

'use strict';

const { stripComment } = require('../../build-firestore-rules.js');

/** Κείμενο χωρίς σχόλια, ίδιος αριθμός γραμμών. */
function withoutComments(source) {
  return source.split(/\r?\n/).map(stripComment).join('\n');
}

/** Θέση μετά το κλείσιμο συμβολοσειράς που ανοίγει στο `start`. */
function skipString(text, start) {
  const quote = text[start];
  let i = start + 1;
  while (i < text.length && text[i] !== quote) i += text[i] === '\\' ? 2 : 1;
  return i + 1;
}

/** Το κείμενο ως το πρώτο `stop` σε βάθος 0 (παρενθέσεις/αγκύλες/άγκιστρα), με επίγνωση συμβολοσειρών. */
function readUntil(text, start, stop) {
  let depth = 0;
  let i = start;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "'" || ch === '"') { i = skipString(text, i); continue; }
    if (depth === 0 && ch === stop) break;
    if ('([{'.includes(ch)) depth += 1;
    if (')]}'.includes(ch)) depth -= 1;
    i += 1;
  }
  return { body: text.slice(start, i), end: i };
}

const lineAt = (text, index) => text.slice(0, index).split('\n').length;

function readWord(text, start) {
  const match = /^[A-Za-z_$][\w$]*/.exec(text.slice(start));
  return match ? match[0] : '';
}

/** `function name(params) { … return EXPR; }` ⇒ το EXPR του `return` (ό,τι είναι πριν μένει αδιάβαστο: `let`). */
function readFunction(text, start) {
  const open = text.indexOf('(', start);
  const name = text.slice(start + 'function'.length, open).trim();
  const brace = text.indexOf('{', readUntil(text, open + 1, ')').end);
  const { body, end } = readUntil(text, brace + 1, '}');
  const ret = /\breturn\b([\s\S]*)$/.exec(body);
  const expr = ret ? ret[1].trim().replace(/;\s*$/, '') : '';
  return { fn: { name, expr, line: lineAt(text, start) }, end: end + 1 };
}

/** `allow OPS: if EXPR;` */
function readAllow(text, start, matchPath) {
  const colon = text.indexOf(':', start);
  const ops = text.slice(start + 'allow'.length, colon).split(',').map((s) => s.trim()).join(',');
  const afterIf = text.slice(colon + 1).match(/^\s*if\b/);
  const exprStart = colon + 1 + (afterIf ? afterIf[0].length : 0);
  const { body, end } = readUntil(text, exprStart, ';');
  return { allow: { ops, expr: body.trim(), line: lineAt(text, start), matchPath }, end: end + 1 };
}

/** Βήμα του σαρωτή σε λέξη-κλειδί· `null` = δεν ήταν λέξη-κλειδί. */
function keywordStep(text, i, state) {
  const word = readWord(text, i);
  if (word === 'function') {
    const { fn, end } = readFunction(text, i);
    state.functions.push(fn);
    return end;
  }
  if (word === 'allow') {
    const { allow, end } = readAllow(text, i, state.matches.at(-1) ?? '');
    state.allows.push(allow);
    return end;
  }
  if (word === 'match') {
    const path = /^match\s+(\S+)\s*\{/.exec(text.slice(i));
    if (path) {
      state.stack.push('match');
      state.matches.push(path[1]);
      return i + path[0].length;
    }
  }
  return word ? i + word.length : null;
}

/** Όλες οι συναρτήσεις και όλα τα `allow` ενός αρχείου κανόνων. */
function readRulesStructure(source) {
  const text = withoutComments(source);
  const state = { functions: [], allows: [], stack: [], matches: [] };
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "'" || ch === '"') { i = skipString(text, i); continue; }
    if (ch === '{') { state.stack.push('block'); i += 1; continue; }
    if (ch === '}') {
      if (state.stack.pop() === 'match') state.matches.pop();
      i += 1;
      continue;
    }
    const prev = i === 0 ? ' ' : text[i - 1];
    const next = /[\w$]/.test(prev) ? null : keywordStep(text, i, state);
    i = next ?? i + 1;
  }
  return { functions: state.functions, allows: state.allows };
}

module.exports = { readRulesStructure, readUntil, skipString, withoutComments };
