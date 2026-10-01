/**
 * ΕΠΙΛΥΣΗ ΕΜΒΕΛΕΙΑΣ — «είναι ορατό το όνομα ΑΠΟ ΤΗ ΘΕΣΗ όπου διαβάζεται;» (ADR-808 §11)
 *
 * 🔴 ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ. Το `collectBindings` μαζεύει κάθε δηλωμένο όνομα του αρχείου σε
 * ΕΝΑ επίπεδο σύνολο. Ένα όνομα δηλωμένο σε **εσωτερική** εμβέλεια και διαβασμένο **έξω**
 * από αυτήν ήταν άρα «δεσμευμένο» — μετρημένο ζωντανά: ο refactor `d2534967` έβαλε τις
 * δηλώσεις `renderQuoteRow` + `toolbar` του `QuoteList.tsx` ΜΕΣΑ στον comparator ενός
 * `sort`, και η πύλη απάντησε `unbound: []` πάνω σε σελίδα που έσκαγε στην παραγωγή.
 *
 * 🏆 ΑΥΘΕΝΤΙΑ = Ο ΙΔΙΟΣ Ο BINDER ΤΗΣ TypeScript, μέσω του **δημόσιου** API (`createProgram`
 * + `getSymbolAtLocation`), ποτέ χειρόγραφος κανόνας εμβέλειας: hoisting, TDZ-ορατότητα,
 * ονόματα function expression, παράμετροι τύπων, `catch`, μέλη namespace/enum — τα ξέρει
 * ήδη, και κάθε χειρόγραφη απομίμηση θα απέκλινε σιωπηλά (το μάθημα της regex, 7,7×).
 *
 * ⚠️ ΕΝΑ ΑΡΧΕΙΟ, ΧΩΡΙΣ lib, ΧΩΡΙΣ ΑΝΑΛΥΣΗ ΕΙΣΑΓΩΓΩΝ: η ερώτηση είναι **τοπική**. Ό,τι δεν
 * επιλύεται εδώ ΔΕΝ είναι αυτόματα σφάλμα — ο καλών το διασταυρώνει με τα καθολικά. Και
 * ο host ΕΠΙΣΤΡΕΦΕΙ το ήδη αναλυμένο `SourceFile` (κανένα δεύτερο parse).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const SCOPE_OPTIONS = {
  noLib: true, noResolve: true, types: [], skipLibCheck: true,
  jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.Latest,
};

/** Checker πάνω σε ΕΝΑ ήδη αναλυμένο αρχείο. */
function checkerFor(sf) {
  const host = ts.createCompilerHost(SCOPE_OPTIONS, true);
  const own = path.normalize(sf.fileName);
  host.getSourceFile = (name) => (path.normalize(name) === own ? sf : undefined);
  host.fileExists = (name) => path.normalize(name) === own;
  host.readFile = () => undefined;
  return ts.createProgram({ rootNames: [sf.fileName], options: SCOPE_OPTIONS, host }).getTypeChecker();
}

/**
 * Τα ονόματα που δηλώνονται στο **ανώτατο επίπεδο** είναι ορατά από ΟΛΟ το αρχείο ⇒ δεν
 * χρειάζονται checker. Αν **κάθε** ύποπτη ανάγνωση είναι τέτοια, το αρχείο παρακάμπτει
 * το `createProgram` εντελώς (ταχύτητα — ποτέ ορθότητα).
 */
function topLevelNames(sf) {
  const names = new Set();
  const addPattern = (n) => {
    if (ts.isIdentifier(n)) { names.add(n.text); return; }
    for (const el of n.elements) if (ts.isBindingElement(el)) addPattern(el.name);
  };
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) && st.importClause) {
      const ic = st.importClause;
      if (ic.name) names.add(ic.name.text);
      const nb = ic.namedBindings;
      if (nb && ts.isNamespaceImport(nb)) names.add(nb.name.text);
      if (nb && ts.isNamedImports(nb)) for (const e of nb.elements) names.add(e.name.text);
    } else if (ts.isImportEqualsDeclaration(st)) names.add(st.name.text);
    else if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) addPattern(d.name);
    else if (st.name && ts.isIdentifier(st.name)) names.add(st.name.text);
  }
  return names;
}

/**
 * ⚡ ΦΘΗΝΗ ΘΕΤΙΚΗ ΑΠΟΔΕΙΞΗ — «υπάρχει δήλωση στην ΑΜΕΣΗ εμβέλεια κάποιου προγόνου;»
 *
 * Μετρημένο: checker σε ΚΑΘΕ αρχείο ανέβαζε την πλήρη σάρωση **80s → 301s** — ζώνη
 * «ανενεργή πύλη» (μάθημα CHECK 3.52). Η συντριπτική πλειονότητα των αναγνώσεων είναι
 * παράμετροι και `const` του ίδιου μπλοκ: τα βρίσκει αυτός ο περίπατος χωρίς binder.
 *
 * ⚠️ ΜΟΝΟ ΘΕΤΙΚΗ: «βρέθηκε» ⇒ ορατό (ασφαλές)· «δεν βρέθηκε» ⇒ ΔΕΝ σημαίνει τίποτα,
 * αποφασίζει ο checker. Ό,τι δεν μοντελοποιείται εδώ (hoisting του `var`, μέλη namespace,
 * `infer`, mapped types) απλώς πέφτει στον checker — ποτέ σε λάθος απάντηση.
 */
function declaredDirectlyIn(node, cache) {
  let names = cache.get(node);
  if (names) return names;
  names = new Set();
  const addPattern = (n) => {
    if (!n) return;
    if (ts.isIdentifier(n)) { names.add(n.text); return; }
    if (ts.isObjectBindingPattern(n) || ts.isArrayBindingPattern(n)) {
      for (const el of n.elements) if (ts.isBindingElement(el)) addPattern(el.name);
    }
  };
  const addStatements = (stmts) => {
    for (const st of stmts) {
      if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) addPattern(d.name);
      else if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isEnumDeclaration(st)
        || ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st)) && st.name) names.add(st.name.text);
    }
  };
  if (ts.isBlock(node) || ts.isModuleBlock(node)) addStatements(node.statements);
  else if (ts.isCaseBlock(node)) for (const c of node.clauses) addStatements(c.statements);
  else if (ts.isFunctionLike(node)) {
    for (const p of node.parameters || []) addPattern(p.name);
    for (const tp of node.typeParameters || []) names.add(tp.name.text);
    if ((ts.isFunctionExpression(node)) && node.name) names.add(node.name.text);
  } else if (ts.isClassLike(node)) {
    for (const tp of node.typeParameters || []) names.add(tp.name.text);
    if (ts.isClassExpression(node) && node.name) names.add(node.name.text);
  } else if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.typeParameters) {
    for (const tp of node.typeParameters) names.add(tp.name.text);
  } else if ((ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node))
    && node.initializer && ts.isVariableDeclarationList(node.initializer)) {
    for (const d of node.initializer.declarations) addPattern(d.name);
  } else if (ts.isCatchClause(node) && node.variableDeclaration) addPattern(node.variableDeclaration.name);
  cache.set(node, names);
  return names;
}

function visibleByAncestorWalk(id, cache) {
  for (let n = id.parent; n; n = n.parent) {
    if (declaredDirectlyIn(n, cache).has(id.text)) return true;
  }
  return false;
}

/**
 * @param {ts.SourceFile} sf
 * @param {ts.Identifier[]} reads αναγνώσεις ονομάτων που ΤΟ ΕΠΙΠΕΔΟ ΣΥΝΟΛΟ θεωρεί δεσμευμένα
 * @returns {ts.Identifier[]} όσες ΔΕΝ βλέπουν καμία δήλωση από τη θέση τους
 */
function outOfScopeReads(sf, reads) {
  const top = topLevelNames(sf);
  const cache = new Map();
  const suspects = reads.filter((id) => !top.has(id.text) && !visibleByAncestorWalk(id, cache));
  if (!suspects.length) return [];
  const checker = checkerFor(sf);
  return suspects.filter((id) => {
    const p = id.parent;
    const sym = p && ts.isShorthandPropertyAssignment(p) && p.name === id
      ? checker.getShorthandAssignmentValueSymbol(p)
      : checker.getSymbolAtLocation(id);
    return !sym;
  });
}

/**
 * 🔴 ΟΙ ΙΔΙΟΤΗΤΕΣ ΤΟΥ `window` ΩΣ ΓΥΜΝΑ ΟΝΟΜΑΤΑ — η σιωπηλή εκδοχή του ίδιου λάθους.
 * Το `toolbar` του `QuoteList` **δεν** πέταξε `ReferenceError`: λύθηκε στο `window.toolbar`
 * (`BarProp`) και το React έσκασε με #31 μακριά από την αιτία. Το ίδιο ισχύει για `name`,
 * `status`, `event`, `history`, `top`, `parent`, `length`, `origin`, `close`, `print`…
 *
 * ⚠️ ΑΥΘΕΝΤΙΑ = το `lib.dom.d.ts` του εγκατεστημένου TypeScript (`declare var` /
 * `declare function` του ανώτατου επιπέδου), ΠΟΤΕ χειρόγραφη λίστα (CHECK 3.70 Κ7-Κ9).
 * ⚠️ Τα καθολικά του **jest** (`it`, `jest`…) ΔΕΝ μπαίνουν: μετρημένο, `.find((it) => …)`
 * σε αρχείο test που καλεί και το καθολικό `it(...)` ⇒ **82** ψευδώς θετικά σε 3 αρχεία.
 */
let windowValueCache = null;
function windowValueGlobals() {
  if (windowValueCache) return windowValueCache;
  const names = new Set();
  let src = '';
  try { src = fs.readFileSync(path.join(path.dirname(require.resolve('typescript')), 'lib.dom.d.ts'), 'utf8'); } catch { /* χωρίς lib ⇒ κενό σύνολο, ποτέ σφάλμα */ }
  const sf = ts.createSourceFile('lib.dom.d.ts', src, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  for (const st of sf.statements) {
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) names.add(d.name.text);
    } else if (ts.isFunctionDeclaration(st) && st.name) names.add(st.name.text);
  }
  windowValueCache = names;
  return names;
}

module.exports = { outOfScopeReads, windowValueGlobals, topLevelNames };
