/**
 * Κοινά εργαλεία AST για τις πύλες «ΕΝΑΣ γραφέας» (write-authority gates).
 *
 * Κάθε τέτοια πύλη ρωτά το ίδιο πράγμα με άλλο αντικείμενο: «γράφει κάποιος ΑΥΤΟ έξω από τον ΕΝΑ γραφέα;». Η
 * ανάγνωση του δέντρου (αλυσίδες κλήσεων, «είναι γέννηση;», εξαίρεση με λόγο) είναι ίδια για όλες.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-10): οι έξι προηγούμενες πύλες (3.83 · 3.87 · 3.88 · 3.89 · 3.99 · 3.100) κουβαλούν η
 * καθεμία το δικό της αντίγραφο αυτών των συναρτήσεων. Η 3.102 είναι ο πρώτος καταναλωτής της κοινής εκδοχής· η
 * μετανάστευση των έξι είναι καταγεγραμμένη στο `.claude-rules/pending-ratchet-work.md`.
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

/**
 * Εργοστάσιο εξαιρέσεων μιας πύλης: `// <tag>: <λόγος>` στη γραμμή πάνω από τον κόμβο.
 * `reasonAbove` ⇒ `null` αν δεν υπάρχει εξαίρεση, αλλιώς ο λόγος (μπορεί κενός — και τότε είναι εύρημα).
 */
function exemptionsFor(tag) {
  const pattern = new RegExp(`${tag}:\\s*(\\S.*)?$`);
  return {
    reasonAbove(sf, node) {
      const above = sf.text.split(/\r?\n/)[lineOf(sf, node) - 2] || '';
      const match = above.match(pattern);
      return match ? (match[1] || '').trim() : null;
    },
  };
}

module.exports = {
  ts, PROJECT_ROOT, sourceFileOf, lineOf, chainNodes, isCallTo, isCollectionOf, isDocOf,
  refIdentifiersOf, refersTo, isCreation, literalKeys, exemptionsFor,
};
