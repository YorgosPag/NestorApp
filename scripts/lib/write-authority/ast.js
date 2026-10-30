/**
 * Κοινά εργαλεία AST για τις πύλες «ΕΝΑΣ γραφέας» (write-authority gates).
 *
 * Κάθε τέτοια πύλη ρωτά το ίδιο πράγμα με άλλο αντικείμενο: «γράφει κάποιος ΑΥΤΟ έξω από τον ΕΝΑ γραφέα;». Η
 * ανάγνωση του δέντρου (αλυσίδες κλήσεων, «είναι γέννηση;», εξαίρεση με λόγο) είναι ίδια για όλες.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-10): οι έξι προηγούμενες πύλες (3.83 · 3.87 · 3.88 · 3.89 · 3.99 · 3.100) κουβαλούσαν η
 * καθεμία το δικό της αντίγραφο αυτών των συναρτήσεων. Η 3.102 ήταν ο πρώτος καταναλωτής της κοινής εκδοχής· οι έξι
 * μετανάστευσαν 2026-10-30 (ADR-924 §8.4) — κανένα τοπικό αντίγραφο δεν μένει. ⚠️ ΜΗΝ ξαναγράψεις `sourceFileOf` /
 * `chainNodes` / εξαίρεση-με-λόγο σε πύλη: εισήγαγέ τα από εδώ (CHECK 3.28 πιάνει τον κλώνο μόνο ΑΝ σταδιοποιηθούν μαζί).
 *
 * ⚠️ AST, ΠΟΤΕ ΚΕΙΜΕΝΟ: τα θεραπευμένα αρχεία κουβαλούν σχόλια που ΟΝΟΜΑΖΟΥΝ τις κλήσεις.
 */

'use strict';

const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const ts = require(path.join(PROJECT_ROOT, 'node_modules', 'typescript'));

function sourceFileOf(absPath, text) {
  return ts.createSourceFile(absPath, text, ts.ScriptTarget.Latest, true,
    /\.tsx$/.test(absPath) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

const lineOf = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;

/** Κάθε κόμβος μιας αλυσίδας κλήσεων/προσβάσεων, από έξω προς τα μέσα. */
function chainNodes(node) {
  const nodes = [];
  for (let current = node; current; ) {
    nodes.push(current);
    if (ts.isCallExpression(current) || ts.isPropertyAccessExpression(current)) current = current.expression;
    else break;
  }
  return nodes;
}

const isCallTo = (node, name) => ts.isCallExpression(node) && ts.isIdentifier(node.expression)
  && node.expression.text === name;

/** Το δεξιότερο όνομα μιας έκφρασης: `f` · `x.f` · `ctx.tourRef` ⇒ `f` · `f` · `tourRef` (αλλιώς `null`). */
function trailingName(expression) {
  if (!expression) return null;
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return null;
}

/** Το όνομα της συνάρτησης που καλείται άμεσα (`f(` ή `x.f(`). */
const calleeName = (call) => trailingName(call.expression);

/** Κάθε κόμβος του δέντρου, από πάνω προς τα κάτω. */
function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

/** Θέση κλήσης `{ name, line }` όταν ο κόμβος είναι κλήση με ονομαστό καλούμενο — αλλιώς `null`. */
function callSiteOf(sf, node) {
  if (!ts.isCallExpression(node)) return null;
  const name = calleeName(node);
  return name ? { name, line: lineOf(sf, node) } : null;
}

/** `X.collection(<key>)` του Admin SDK ή `collection(db, <key>)` του client SDK. */
function isCollectionOf(node, collectionKey) {
  if (!ts.isCallExpression(node)) return false;
  const callee = node.expression;
  const named = (ts.isPropertyAccessExpression(callee) && callee.name.text === 'collection')
    || (ts.isIdentifier(callee) && callee.text === 'collection');
  return named && node.arguments.some((arg) => arg.getText() === collectionKey);
}

/** `doc(db, <key>, …)` του client SDK. */
const isDocOf = (node, collectionKey) => isCallTo(node, 'doc')
  && node.arguments.some((arg) => arg.getText() === collectionKey);

/** Οι μεταβλητές του αρχείου που κρατούν αναφορά εγγράφου/συλλογής αυτής της συλλογής. */
function refIdentifiersOf(sf, collectionKey) {
  const names = new Set();
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
      && chainNodes(node.initializer).some((n) => isCollectionOf(n, collectionKey) || isDocOf(n, collectionKey))) {
      names.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return names;
}

/** Δείχνει αυτή η έκφραση σε έγγραφο της συλλογής (μεταβλητή, αλυσίδα Admin, ή `doc(db, …)`); */
function refersTo(expression, refs, collectionKey) {
  if (!expression) return false;
  if (ts.isIdentifier(expression)) return refs.has(expression.text);
  return chainNodes(expression).some((n) => isCollectionOf(n, collectionKey) || isDocOf(n, collectionKey));
}

/** `.set(x)` χωρίς `{ merge }` ή `.create(x)` ⇒ γέννηση/αντικατάσταση εγγράφου. */
function isCreation(call, method) {
  if (method === 'create') return true;
  if (method !== 'set') return false;
  const options = call.arguments[call.arguments.length - 1];
  const hasMerge = call.arguments.length > 1 && options !== call.arguments[0] && ts.isObjectLiteralExpression(options)
    && options.properties.some((p) => p.name && /merge|mergeFields/.test(p.name.getText()));
  return !hasMerge;
}

/** Τα ονόματα ιδιοτήτων ενός object literal (`null` όταν η έκφραση δεν είναι literal — αδιαφανές περιεχόμενο). */
function literalKeys(expression) {
  if (!expression || !ts.isObjectLiteralExpression(expression)) return null;
  return expression.properties.map((p) => (p.name ? p.name.getText().replace(/^['"]|['"]$/g, '') : ''));
}

/** Οι καταστάσεις εξαίρεσης — ΚΟΙΝΕΣ σε κάθε πύλη «ενός γραφέα» (ίδιες τιμές στο κατάστιχο όλων). */
const EXEMPTION_STATES = Object.freeze({ EXEMPT: 'exempt-with-reason', EXEMPT_NO_REASON: 'exempt-without-reason' });

/**
 * Εργοστάσιο εξαιρέσεων μιας πύλης: `// <tag>: <λόγος>` στη γραμμή πάνω από τον κόμβο.
 * `reasonAbove` ⇒ `null` αν δεν υπάρχει εξαίρεση, αλλιώς ο λόγος (μπορεί κενός — και τότε είναι εύρημα).
 * `classify` ⇒ το εύρημα του κόμβου: η μπλοκάρουσα `state` χωρίς εξαίρεση· `exempt-with-reason` με λόγο·
 * `exempt-without-reason` με κενό λόγο. (Ήταν αντιγραμμένο σε 3.87 · 3.88 · 3.89 · 3.102 · 3.106 — ADR-924 §8.)
 */
function exemptionsFor(tag) {
  const pattern = new RegExp(`${tag}:\\s*(\\S.*)?$`);
  const reasonAbove = (sf, node) => {
    const above = sf.text.split(/\r?\n/)[lineOf(sf, node) - 2] || '';
    const match = above.match(pattern);
    return match ? (match[1] || '').trim() : null;
  };
  return {
    reasonAbove,
    classify(sf, node, rel, state, detail) {
      const reason = reasonAbove(sf, node);
      if (reason === null) return { state, file: rel, line: lineOf(sf, node), detail };
      return reason.length > 0
        ? { state: EXEMPTION_STATES.EXEMPT, file: rel }
        : { state: EXEMPTION_STATES.EXEMPT_NO_REASON, file: rel, line: lineOf(sf, node), detail: 'εξαίρεση ΧΩΡΙΣ λόγο' };
    },
  };
}

module.exports = {
  ts, PROJECT_ROOT, sourceFileOf, lineOf, chainNodes, isCallTo, trailingName, calleeName, walk, callSiteOf, isCollectionOf, isDocOf,
  refIdentifiersOf, refersTo, isCreation, literalKeys, exemptionsFor, EXEMPTION_STATES,
};
