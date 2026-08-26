/**
 * ΣΑΡΩΤΗΣ ΛΕΞΙΛΟΓΙΟΥ ΤΟΜΕΑ (ADR-812 / CHECK 3.73)
 *
 * Το ερώτημα ΔΕΝ είναι «σε πόσα αρχεία επαναλαμβάνεται το λεξιλόγιο;» — η
 * επανάληψη είναι συχνά ΝΟΜΙΜΗ: ένα έργο χρειάζεται χάρτη badge variants, χάρτη
 * κανόνων μετάβασης, χάρτη λέξεων-κλειδιών NLU. Καθένας τους απαριθμεί τις ίδιες
 * τιμές για ΑΛΛΟ λόγο, και η συγχώνευσή τους θα ήταν λάθος.
 *
 * Το ερώτημα είναι: **ΕΙΝΑΙ ΔΕΜΕΝΟ ΣΤΗ ΡΙΖΑ;** Δηλαδή έχει τύπο που παράγεται
 * από το SSoT (`Record<ProjectStatus, …>` · `Partial<Record<ProjectStatus, …>>` ·
 * `Extract<ProjectStatus, …>` · `satisfies readonly ProjectStatus[]`), ώστε μια
 * έβδομη κατάσταση — ή ένα typo — να σπάει τη ΜΕΤΑΓΛΩΤΤΙΣΗ αντί να ξεθωριάζει
 * σιωπηλά στην οθόνη.
 *
 * 🏆 ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟ ΟΙΚΟΣΥΣΤΗΜΑ (ερευνήθηκε 2026-08-26): οι δύο σχετικοί
 * κανόνες του typescript-eslint (`no-duplicate-enum-values`,
 * `no-duplicate-type-constituents`) είναι **ΑΝΑ ΑΡΧΕΙΟ** — «σε πόσα αρχεία ζει
 * αυτό το σύνολο τιμών;» δεν είναι εκφράσιμο εκεί. Και το CHECK 3.59 (ADR-792)
 * ρωτά «ένα ΟΝΟΜΑ → ένα σπίτι»: εδώ τα δεκατρία σώματα είχαν **δεκατρία
 * διαφορετικά ονόματα** και ένα κοινό σύνολο τιμών, άρα ήταν δομικά τυφλό.
 * Δεν είναι επέκτασή του — είναι άλλο ερώτημα, με άλλη θεραπεία (CHECK 3.41).
 *
 * ⚠️ ΤΑ ΣΧΟΛΙΑ ΚΟΒΟΝΤΑΙ ΑΠΟ ΤΟ AST ΕΞ ΟΡΙΣΜΟΥ: τα ίδια τα αρχεία που
 * ΔΙΟΡΘΩΘΗΚΑΝ γράφουν τις παλιές τιμές σε σχόλιο ως τεκμηρίωση της βλάβης.
 * Ένας σαρωτής κειμένου θα κοκκίνιζε πάνω στη ΘΕΡΑΠΕΙΑ (σχήμα Κ7β του 3.50).
 */
'use strict';
const path = require('path');
const fs = require('fs');
const ts = require(path.join(process.cwd(), 'node_modules', 'typescript'));

/** Κάθε ρητή κατάσταση. Καμία σιωπηλή απόρριψη. */
const STATES = {
  ROOT: 'root',
  BOUND: 'bound',
  DECLARED_EXEMPT: 'declared-exempt',
  UNTYPED_VOCABULARY: 'untyped-vocabulary',
  ORPHAN_DECLARATION: 'orphan-declaration',
  REASONLESS_DECLARATION: 'reasonless-declaration',
  ROOT_DRIFT: 'root-drift',
  BELOW_THRESHOLD: 'below-threshold',
};
/** ⛔ Οι μπλοκάρουσες. Τυπώνονται ΠΑΝΤΑ, ακόμα και στο μηδέν. */
const BLOCKING = [
  STATES.UNTYPED_VOCABULARY, STATES.ORPHAN_DECLARATION,
  STATES.REASONLESS_DECLARATION, STATES.ROOT_DRIFT,
];
const MIN_REASON = 40;

/** Ταυτοποιητές μέσα σε type annotation. Regex LITERAL — ποτέ χτισμένο από συμβολοσειρά. */
const IDENTIFIER = /[A-Za-z_$][\w$]*/g;

/** Ονόματα τύπων που «δένουν» μια δήλωση στη ρίζα. */
function bindingNames(vocab) {
  return new Set([vocab.typeName, ...(vocab.derivedTypes || [])]);
}

/** Το κείμενο του type annotation + τυχόν `satisfies`, ως ένα string. */
function typeSurfaceOf(node) {
  const parts = [];
  if (node.type) parts.push(node.type.getText());
  let init = node.initializer;
  while (init && (ts.isAsExpression(init) || ts.isSatisfiesExpression(init))) {
    if (init.type) parts.push(init.type.getText());
    init = init.expression;
  }
  return parts.join(' ');
}

function unwrap(expr) {
  let e = expr;
  while (e && (ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isParenthesizedExpression(e))) {
    e = e.expression;
  }
  return e;
}

/** Οι τιμές που απαριθμεί μια δήλωση — κλειδιά αντικειμένου, στοιχεία πίνακα, μέλη union. */
function enumeratedValues(node) {
  if (ts.isTypeAliasDeclaration(node)) {
    // ⚠️ ΟΧΙ μόνο `A | B | C`. Το `Extract<ProjectStatus, 'a' | 'b'>` κρύβει τις
    // τιμές του μέσα σε TypeReference, και ένας έλεγχος `isUnionTypeNode` τις
    // περνούσε ΑΟΡΑΤΕΣ — σιωπηλή απόρριψη ακριβώς στο ιδίωμα που είναι το
    // ΣΩΣΤΟ (δεμένο υποσύνολο). Μαζεύουμε κάθε string literal type του δέντρου.
    const out = [];
    const walk = t => {
      if (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)) out.push(t.literal.text);
      ts.forEachChild(t, walk);
    };
    walk(node.type);
    return out;
  }
  if (!ts.isVariableDeclaration(node) || !node.initializer) return [];
  const init = unwrap(node.initializer);
  if (!init) return [];
  if (ts.isArrayLiteralExpression(init)) {
    return init.elements.filter(ts.isStringLiteral).map(e => e.text);
  }
  if (ts.isObjectLiteralExpression(init)) {
    return init.properties
      .filter(p => p.name && (ts.isStringLiteral(p.name) || ts.isIdentifier(p.name)))
      .map(p => p.name.text);
  }
  return [];
}

/** Σάρωση ενός αρχείου έναντι ενός λεξιλογίου. */
function scanFile(file, text, vocab, relPath) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
    /\.tsx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const values = new Set(vocab.values);
  const binders = bindingNames(vocab);
  const found = [];

  const consider = (node, name) => {
    const enumerated = enumeratedValues(node);
    if (!enumerated.length) return;
    const hits = enumerated.filter(v => values.has(v));
    if (hits.length < vocab.threshold) return;
    // Για type alias η «επιφάνεια τύπου» είναι ΟΛΟΣ ο τύπος — εκεί ζει το
    // `Extract<ProjectStatus, …>` που τον δένει στη ρίζα.
    const surface = ts.isTypeAliasDeclaration(node) ? node.type.getText() : typeSurfaceOf(node);
    // «Δεμένο» = ο τύπος αναφέρει ονομαστικά τη ρίζα ή παράγωγό της.
    // ⚠️ ΧΩΡΙΣ RegExp ΕΠΙΤΗΔΕΣ. Η πρώτη γραφή έχτιζε το pattern μέσα σε
    // **template literal**, όπου το \b είναι ο χαρακτήρας BACKSPACE (U+0008)
    // και ΟΧΙ word boundary — το ίδιο ελάττωμα που τεκμηριώνει το CHECK 3.56,
    // ξαναγραμμένο εδώ. Αποτέλεσμα: η πύλη ανέφερε ως αδέσμευτο ένα
    // Record<ProjectStatus, …> που ΕΙΝΑΙ δεμένο, με τον κάδο των δεμένων ΚΕΝΟ.
    // Το έπιασε ο ΠΑΡΟΝΟΜΑΣΤΗΣ, όχι η ανάγνωση.
    const identifiers = new Set(surface.match(IDENTIFIER) || []);
    const bound = [...binders].some(b => identifiers.has(b));
    found.push({
      file: relPath,
      name,
      line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      hits: hits.length,
      enumerated: enumerated.length,
      values: enumerated,
      typeSurface: surface,
      state: bound ? STATES.BOUND : STATES.UNTYPED_VOCABULARY,
    });
  };

  const visit = node => {
    if (ts.isTypeAliasDeclaration(node)) consider(node, node.name.text);
    else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) consider(node, node.name.text);
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  return found;
}

/** Ορίζει η ρίζα ακόμη το λεξιλόγιο, τιμή προς τιμή; */
function verifyRoot(rootText, rootFile, vocab) {
  const sf = ts.createSourceFile(rootFile, rootText, ts.ScriptTarget.Latest, true);
  let declared = null;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === vocab.rootSymbol) {
      const vals = enumeratedValues(node);
      if (vals.length) declared = vals;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  if (!declared) return { ok: false, reason: `το σύμβολο «${vocab.rootSymbol}» δεν βρέθηκε ως απαρίθμηση` };
  const expected = [...vocab.values].sort().join(',');
  const actual = [...declared].sort().join(',');
  if (expected !== actual) {
    return { ok: false, reason: `η ρίζα δηλώνει [${actual}] ενώ το μητρώο [${expected}]` };
  }
  return { ok: true, declared };
}

module.exports = { STATES, BLOCKING, MIN_REASON, scanFile, verifyRoot, enumeratedValues, typeSurfaceOf };
