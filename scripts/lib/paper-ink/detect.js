/**
 * CHECK 3.103 — ο ΑΝΙΧΝΕΥΤΗΣ του μελανιού (ADR-909 §6.9 · Γ2.8). Καθαρή συνάρτηση: κείμενο → αναθέσεις.
 *
 * 🔑 ΤΟ ΚΡΙΤΗΡΙΟ: κάθε ανάθεση `<κάτι>.strokeStyle | .fillStyle | .lineWidth = <τιμή>` είναι **αποδεδειγμένη**
 *    (`proven: true`) μόνο όταν η τιμή **κατάγεται** από εγκεκριμένη συνάρτηση — εκείνες που ρωτούν την πολιτική
 *    εκτύπωσης. Ό,τι δεν αποδεικνύεται, μετρά (συντηρητικά, όπως το CHECK 3.97).
 *
 * ✅ ΑΠΟΔΕΙΞΗ (αναδρομικά, ΜΕΣΑ στο ίδιο αρχείο):
 *    · κλήση εγκεκριμένης συνάρτησης (`liveStrokeInk(…)`)·
 *    · κλήση ΤΟΠΙΚΗΣ συνάρτησης / μεθόδου της οποίας ΚΑΘΕ `return` αποδεικνύεται (`tagInk`, `this.kindStrokeColor`)·
 *    · όνομα `const` / `let` του οποίου ο αρχικοποιητής ΚΑΙ κάθε μεταγενέστερη ανάθεση αποδεικνύονται —
 *      και με αποδόμηση (`const { color } = resolve…(…)`)·
 *    · πεδίο αποδεδειγμένου ονόματος (`_outline.color`, όπου `_outline = resolve…(…)`)·
 *    · ανάγνωση του ίδιου νεροχύτη (`ctx.fillStyle = ctx.strokeStyle` — αντίγραφο, όχι νέα τιμή)·
 *    · `a ?? b` · `a || b` · `c ? a : b` όταν ΟΛΟΙ οι κλάδοι αποδεικνύονται (`null` / `undefined` ουδέτερα).
 * ⛔ ΔΕΝ ΑΠΟΔΕΙΚΝΥΕΤΑΙ: κυριολεκτικό (`'#ff0000'`, `0.8`, template), σταθερά (`ROOF_STROKE`), κλειδί πίνακα
 *    (`KIND_STROKE[k]`), **παράμετρος** συνάρτησης, εισαγόμενο όνομα εκτός καταλόγου, αριθμητική.
 *
 * ⚠️ AST, ΟΧΙ REGEX: το `shared/live-stroke.ts` τεκμηριώνει τη βλάβη γράφοντας `ctx.strokeStyle = …` σε **σχόλιο**
 *    — το regex το μετρούσε ως 133η ανάθεση (μετρημένο 2026-10-12).
 *
 * 🔶 ΔΗΛΩΜΕΝΑ ΟΡΙΑ: (α) η απόδειξη δεν περνά σύνορο αρχείου — τιμή από παράμετρο δηλώνεται ως εξαίρεση `caller`·
 *    (β) `ctx['strokeStyle'] = …`, `Object.assign(ctx, {…})` και `createLinearGradient` δεν κρίνονται·
 *    (γ) δεν ελέγχει ότι το εγκεκριμένο όνομα είναι **η** εισαγόμενη συνάρτηση (τοπικός ομώνυμος κρίνεται από το σώμα του).
 */

'use strict';

const { ts, sourceFileOf, lineOf } = require('../write-authority/ast');

const SINKS = new Set(['strokeStyle', 'fillStyle', 'lineWidth']);
const MODULE_SCOPE = '<module>';

function unwrap(node) {
  let n = node;
  while (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n)
    || ts.isSatisfiesExpression(n)) n = n.expression;
  return n;
}

const isFunctionLike = (n) => ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n) || ts.isArrowFunction(n)
  || ts.isFunctionExpression(n) || ts.isConstructorDeclaration(n) || ts.isGetAccessorDeclaration(n);

/** Τα ονόματα που δένει ένα όνομα δήλωσης (σκέτο ή αποδόμηση). */
function boundNames(name, out = []) {
  if (ts.isIdentifier(name)) out.push(name.text);
  else for (const el of name.elements) if (!ts.isOmittedExpression(el)) boundNames(el.name, out);
  return out;
}

/** Το όνομα της συνάρτησης που περιέχει τον κόμβο (η πλησιέστερη ΜΕ όνομα), αλλιώς `<module>`. */
function enclosingFunctionName(node) {
  for (let n = node.parent; n; n = n.parent) {
    if (!isFunctionLike(n)) continue;
    if (n.name && ts.isIdentifier(n.name)) return n.name.text;
    if (ts.isConstructorDeclaration(n)) return 'constructor';
    const holder = n.parent;
    if (holder && ts.isVariableDeclaration(holder) && ts.isIdentifier(holder.name)) return holder.name.text;
    if (holder && ts.isPropertyAssignment(holder)) return holder.name.getText();
  }
  return MODULE_SCOPE;
}

/** Η δήλωση ενός ονόματος μέσα σε ΜΙΑ λίστα εντολών: `{ kind: 'var' | 'fn', … }` ή `null`. */
function declarationIn(statements, name) {
  for (const st of statements) {
    if (ts.isFunctionDeclaration(st) && st.name && st.name.text === name) return { kind: 'fn', node: st };
    if (!ts.isVariableStatement(st)) continue;
    for (const decl of st.declarationList.declarations) {
      if (boundNames(decl.name).includes(name)) return { kind: 'var', decl };
    }
  }
  return null;
}

/** Πού δένεται το όνομα, ανεβαίνοντας από τον κόμβο: `var` · `fn` · `param` · `null` (εισαγόμενο / καθολικό). */
function bindingOf(name, from) {
  for (let n = from.parent; n; n = n.parent) {
    if (isFunctionLike(n) && n.parameters.some((p) => boundNames(p.name).includes(name))) return { kind: 'param' };
    const statements = n.statements || (ts.isCaseClause(n) ? n.statements : null);
    const found = statements ? declarationIn(statements, name) : null;
    if (found) return { ...found, scope: n };
  }
  return null;
}

/** Κάθε `name = <έκφραση>` κάτω από έναν κόμβο (για `let` που ξαναγράφεται). */
function reassignmentsOf(name, scope) {
  const out = [];
  const visit = (node) => {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isIdentifier(node.left) && node.left.text === name) out.push(node.right);
    ts.forEachChild(node, visit);
  };
  visit(scope);
  return out;
}

/** Οι εκφράσεις που επιστρέφει μια συνάρτηση (όχι των εμφωλευμένων της)· `null` αν δεν επιστρέφει τίποτα. */
function returnedExpressions(fn) {
  if (!fn.body) return null;
  if (!ts.isBlock(fn.body)) return [fn.body];
  const out = [];
  const visit = (node) => {
    if (isFunctionLike(node)) return;
    if (ts.isReturnStatement(node) && node.expression) out.push(node.expression);
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(fn.body, visit);
  return out.length > 0 ? out : null;
}

/** Η μέθοδος `this.<name>` της κλάσης που περιέχει τον κόμβο. */
function methodOfEnclosingClass(name, from) {
  for (let n = from.parent; n; n = n.parent) {
    if (!ts.isClassDeclaration(n) && !ts.isClassExpression(n)) continue;
    return n.members.find((m) => ts.isMethodDeclaration(m) && m.name.getText() === name) || null;
  }
  return null;
}

/**
 * Ο κριτής μιας έκφρασης. `approved` = το κλειστό σύνολο ονομάτων· `visiting` σπάει τους κύκλους
 * (κύκλος ⇒ ΔΕΝ αποδεικνύεται — ποτέ «μάλλον ναι»).
 */
function createProver(approved, aliases) {
  const visiting = new Set();
  const isApproved = (localName) => approved.has(aliases.get(localName) || localName);

  const guarded = (node, judge) => {
    if (visiting.has(node)) return false;
    visiting.add(node);
    try { return judge(); } finally { visiting.delete(node); }
  };

  const functionProven = (fn) => guarded(fn, () => {
    const returned = returnedExpressions(fn);
    return returned !== null && returned.every(proven);
  });

  const variableProven = (binding, name) => guarded(binding.decl, () => {
    const values = reassignmentsOf(name, binding.scope);
    if (binding.decl.initializer) values.push(binding.decl.initializer);
    return values.length > 0 && values.every(proven);
  });

  const identifierProven = (id) => {
    if (id.text === 'undefined') return true;
    const binding = bindingOf(id.text, id);
    return binding !== null && binding.kind === 'var' && variableProven(binding, id.text);
  };

  const callProven = (call) => {
    const callee = unwrap(call.expression);
    if (ts.isIdentifier(callee)) {
      const binding = bindingOf(callee.text, call);
      if (binding && binding.kind === 'fn') return functionProven(binding.node);
      if (binding && binding.kind === 'var' && binding.decl.initializer && isFunctionLike(binding.decl.initializer)) {
        return functionProven(binding.decl.initializer);
      }
      return binding === null && isApproved(callee.text);
    }
    if (ts.isPropertyAccessExpression(callee) && callee.expression.kind === ts.SyntaxKind.ThisKeyword) {
      const method = methodOfEnclosingClass(callee.name.text, call);
      return method !== null && functionProven(method);
    }
    return false;
  };

  const accessProven = (access) => {
    if (SINKS.has(access.name.text)) return true;
    let root = access;
    while (ts.isPropertyAccessExpression(root)) root = unwrap(root.expression);
    return ts.isIdentifier(root) && identifierProven(root);
  };

  function proven(expression) {
    const n = unwrap(expression);
    if (n.kind === ts.SyntaxKind.NullKeyword) return true;
    if (ts.isIdentifier(n)) return identifierProven(n);
    if (ts.isCallExpression(n)) return callProven(n);
    if (ts.isPropertyAccessExpression(n)) return accessProven(n);
    if (ts.isConditionalExpression(n)) return proven(n.whenTrue) && proven(n.whenFalse);
    if (ts.isBinaryExpression(n)) {
      const op = n.operatorToken.kind;
      const isChoice = op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.BarBarToken;
      return isChoice && proven(n.left) && proven(n.right);
    }
    return false;
  }

  return proven;
}

/** `import { liveStrokeInk as tagInk }` ⇒ `tagInk → liveStrokeInk`: το ψευδώνυμο κρίνεται με το ΠΡΑΓΜΑΤΙΚΟ όνομα. */
function importAliasesOf(sf) {
  const aliases = new Map();
  for (const st of sf.statements) {
    const named = ts.isImportDeclaration(st) && st.importClause && st.importClause.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;
    for (const el of named.elements) if (el.propertyName) aliases.set(el.name.text, el.propertyName.text);
  }
  return aliases;
}

const isSinkAssignment = (node) => ts.isBinaryExpression(node)
  && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
  && ts.isPropertyAccessExpression(node.left) && SINKS.has(node.left.name.text);

/**
 * Όλες οι αναθέσεις νεροχύτη ενός αρχείου.
 * @param {string} source  το κείμενο
 * @param {string} fileName  μόνο για να διαλεχτεί TS ή TSX
 * @param {Set<string>} approved  το κλειστό σύνολο εγκεκριμένων συναρτήσεων
 * @returns {{line:number, fn:string, sink:string, text:string, proven:boolean}[]}
 *   `text` = `<νεροχύτης> = <τιμή>` χωρίς τον παραλήπτη, με ενιαία κενά — η ΤΑΥΤΟΤΗΤΑ της ανάθεσης.
 */
function findSinkAssignments(source, fileName, approved) {
  const sf = sourceFileOf(fileName, source);
  const proven = createProver(approved, importAliasesOf(sf));
  const found = [];
  const visit = (node) => {
    if (isSinkAssignment(node)) {
      const sink = node.left.name.text;
      found.push({
        line: lineOf(sf, node),
        fn: enclosingFunctionName(node),
        sink,
        text: `${sink} = ${node.right.getText(sf).replace(/\s+/g, ' ')}`,
        proven: proven(node.right),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

module.exports = { findSinkAssignments, SINKS, MODULE_SCOPE };
