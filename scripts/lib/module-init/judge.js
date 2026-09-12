/**
 * ADR-858 Δ4 — Η ΚΡΙΣΗ: **«ΘΑ ΣΚΑΣΕΙ ΑΥΤΟΣ Ο ΚΥΚΛΟΣ;»**
 *
 * 🏆 **ΤΟ ΕΡΩΤΗΜΑ ΠΟΥ ΚΑΝΕΝΑ ΕΡΓΑΛΕΙΟ ΤΗΣ ΑΓΟΡΑΣ ΔΕΝ ΚΑΝΕΙ** (έρευνα 2026-09-12):
 * `madge` · `dpdm` · `skott` · `eslint-plugin-import/no-cycle` · `circular-dependency-plugin` ·
 * `dependency-cruiser` — **όλα** απαντούν *«υπάρχει κύκλος;»*. Γι' αυτό το δέντρο έχει
 * **1159** ευρήματα και **μηδέν σήμα**: τα 1158 είναι αβλαβή και το ένα ρίχνει την παραγωγή.
 *
 * 🔑 **Η ΔΙΑΚΡΙΣΗ ΕΙΝΑΙ ΑΠΛΗ ΚΑΙ ΑΚΡΙΒΗΣ.** Ένας κύκλος είναι αβλαβής όσο κάθε μέλος
 * χρησιμοποιεί τα εισαγόμενα ονόματα **μέσα σε σώμα συνάρτησης** — τότε η ανάγνωση γίνεται
 * όταν κάποιος καλέσει, δηλαδή αφού έχουν αξιολογηθεί όλα. Γίνεται **θανάσιμος** τη στιγμή
 * που κάποιο μέλος διαβάζει εισαγόμενο binding σε **χρόνο αξιολόγησης module** (top-level
 * statement, αρχικοποιητής top-level `const`, decorator, κλήση σε module scope): τότε η
 * σειρά αξιολόγησης — που ο bundler διαλέγει και **αλλάζει ανά build** — αποφασίζει αν
 * βλέπεις τιμή ή `ReferenceError`.
 *
 * Αυτό ακριβώς συνέβη στις 2026-09-12: `table-surface-mode.ts` έγραφε
 * `const store = createExternalStore(sanitize(storageGet(STORAGE_KEYS.…)))` σε module scope,
 * μέσα σε κύκλο με το `storage-utils` ⇒ `Cannot access 'o' before initialization`.
 *
 * ⚠️ **ΔΗΛΩΜΕΝΟ ΟΡΙΟ — ΜΗΝ ΤΟ ΑΝΑΚΑΛΥΨΕΙΣ ΞΑΝΑ.** Η κρίση είναι **συντηρητική προς τη μεριά
 * του θορύβου**: αναφέρει *«μπορεί να σκάσει»*, όχι *«σκάει»*. Η πραγματική έκβαση εξαρτάται
 * από το **ποιο entry** ξεκινά την αλυσίδα, που είναι ιδιότητα του bundle, όχι του κώδικα.
 * Γι' αυτό η πύλη είναι **RATCHET** και όχι zero-tolerance: κλειδώνει το υπάρχον και
 * μπλοκάρει το **νέο**.
 */

'use strict';

const ts = require('typescript');

/**
 * Τα identifiers που το αρχείο **διαβάζει σε χρόνο αξιολόγησης module**.
 *
 * 🔑 Ο κανόνας είναι «**μπαίνω σε σώμα συνάρτησης ⇒ σταματώ να μετράω**». Μια αναφορά μέσα
 * σε function/method/arrow/getter/constructor εκτελείται όταν κάποιος καλέσει — ποτέ κατά
 * την αξιολόγηση. Το ίδιο για τύπους (σβήνονται) και για ονόματα σε θέση δήλωσης.
 *
 * ⚠️ **Οι default τιμές παραμέτρων ΔΕΝ είναι top-level** παρότι γράφονται στην υπογραφή:
 * αποτιμώνται στην κλήση. Το να μετρηθούν θα ήταν ψευδώς θετικό σε κάθε
 * `function f(x = DEFAULT_X)`.
 */
function collectTopLevelReads(file, text) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const reads = new Set();

  const isFunctionLike = (n) =>
    ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) ||
    ts.isMethodDeclaration(n) || ts.isConstructorDeclaration(n) ||
    ts.isGetAccessor(n) || ts.isSetAccessor(n);

  const walk = (node) => {
    // Σώμα συνάρτησης ⇒ αναβαλλόμενη εκτέλεση. Δεν κατεβαίνουμε.
    if (isFunctionLike(node)) return;
    // Τύποι: σβήνονται στη μεταγλώττιση.
    if (ts.isTypeNode(node) || ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) return;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;

    if (ts.isIdentifier(node)) {
      const p = node.parent;
      // Όνομα σε θέση δήλωσης / ιδιότητας — όχι ανάγνωση εισαγόμενου binding.
      const isDeclName =
        (ts.isVariableDeclaration(p) && p.name === node) ||
        (ts.isPropertyAssignment(p) && p.name === node) ||
        (ts.isPropertyAccessExpression(p) && p.name === node) ||
        (ts.isBindingElement(p) && p.name === node) ||
        ts.isPropertySignature(p) || ts.isPropertyDeclaration(p);
      if (!isDeclName) reads.add(node.text);
      return;
    }
    ts.forEachChild(node, walk);
  };

  for (const stmt of sf.statements) {
    // Μια `class` σε top-level: το σώμα της είναι δηλώσεις, αλλά heritage clauses και
    // decorators **εκτελούνται** — το `walk` τα φτάνει, τα σώματα μεθόδων όχι.
    walk(stmt);
  }
  return reads;
}

/**
 * Τα εξαγόμενα ονόματα που **ΑΝΥΨΩΝΟΝΤΑΙ** (hoisted) — δηλαδή **δεν έχουν TDZ**.
 *
 * 🔴 **ΧΩΡΙΣ ΑΥΤΟ Η ΠΥΛΗ ΕΙΝΑΙ 83% ΘΟΡΥΒΟΣ — ΜΕΤΡΗΜΕΝΟ.** Η πρώτη εκτέλεση βρήκε **6**
 * ακμές· ο έλεγχος δήλωσης έδειξε ότι οι **5** αφορούσαν `export function`
 * (`calculateLineBounds`, `hitTestText`, `createLazyRoute`, …). Μια `function` declaration
 * ανυψώνεται **ολόκληρη** στην κορυφή του module scope: είναι διαθέσιμη **πριν** εκτελεστεί
 * οποιαδήποτε γραμμή, άρα ένας κύκλος που περνά μόνο από συναρτήσεις **δεν μπορεί** να
 * παραγάγει `ReferenceError`. Αυτός είναι, μάλιστα, ο **κλασικός τρόπος** που γράφεται
 * νόμιμα ένας αμοιβαία αναδρομικός γράφος — και θα ήταν εξοργιστικό ψευδώς θετικό.
 *
 * ⚠️ **Η `class` ΔΕΝ ανυψώνεται** με την ίδια έννοια: έχει TDZ ακριβώς όπως το `let`/`const`.
 * Ούτε το `export const f = () => …` — είναι `const`, όχι declaration. Η διάκριση είναι
 * **η μορφή της δήλωσης**, όχι «είναι συνάρτηση;».
 */
function collectHoistedExports(file, text) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hoisted = new Set();
  const localFunctions = new Set();

  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      localFunctions.add(stmt.name.text);
      const exported = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      const isDefault = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
      if (exported) hoisted.add(isDefault ? 'default' : stmt.name.text);
    }
  }
  // `function foo() {}` … `export { foo }` — ίδια ανύψωση, άλλη γραφή.
  for (const stmt of sf.statements) {
    if (!ts.isExportDeclaration(stmt) || !stmt.exportClause) continue;
    if (!ts.isNamedExports(stmt.exportClause)) continue;
    if (stmt.moduleSpecifier) continue; // re-export: η δήλωση ζει αλλού, δεν κρίνεται εδώ
    for (const el of stmt.exportClause.elements) {
      const source = (el.propertyName || el.name).text;
      if (localFunctions.has(source)) hoisted.add(el.name.text);
    }
  }
  return hoisted;
}

/**
 * Οι **θανάσιμες ακμές**: μέσα σε κάθε SCC, ποιο αρχείο διαβάζει σε top-level ένα όνομα που
 * εισάγει από **άλλο μέλος του ίδιου SCC** — **και** που δεν ανυψώνεται στην πηγή του.
 */
function judgeSCCs(sccs, graph, sources) {
  const cache = new Map();
  const analyze = (file) => {
    if (!cache.has(file)) {
      const text = sources.get(file) || '';
      let entry;
      try {
        entry = { reads: collectTopLevelReads(file, text), hoisted: collectHoistedExports(file, text) };
      } catch {
        entry = { reads: new Set(), hoisted: new Set() };
      }
      cache.set(file, entry);
    }
    return cache.get(file);
  };

  const findings = [];
  for (const component of sccs) {
    const member = new Set(component);
    for (const from of component) {
      const { reads } = analyze(from);
      if (reads.size === 0) continue;
      for (const edge of graph.get(from) || []) {
        if (!member.has(edge.to)) continue;
        const { hoisted } = analyze(edge.to);
        // Διαβάζεται σε χρόνο αξιολόγησης ΚΑΙ δεν ανυψώνεται ⇒ μπορεί να είναι σε TDZ.
        const dangerous = edge.names.filter((n) => reads.has(n) && !hoisted.has(n));
        if (dangerous.length === 0) continue;
        findings.push({
          from,
          to: edge.to,
          names: dangerous.sort(),
          componentSize: component.length,
        });
      }
    }
  }
  return findings;
}

module.exports = { collectTopLevelReads, collectHoistedExports, judgeSCCs };
