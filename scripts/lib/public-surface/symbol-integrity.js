'use strict';
/**
 * =============================================================================
 * ΑΚΕΡΑΙΟΤΗΤΑ ΣΥΜΒΟΛΩΝ — «ζητά κάποιος σύμβολο που ΔΕΝ ΥΠΑΡΧΕΙ;» (ADR-804)
 * =============================================================================
 *
 * Απαντά **ένα** ερώτημα: *για κάθε ονομαστική εισαγωγή σε ολόκληρο το `src/`,
 * υπάρχει όντως το σύμβολο στο αρχείο-στόχο;*
 *
 * 🔑 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ**: ο κανόνας **N.17** απαγορεύει στον πράκτορα να τρέξει `tsc`
 * (60-90s σε κάθε αλλαγή), και το **jest δεν βλέπει σβησμένο export** — μια
 * μετακίνηση/διαγραφή συμβόλου εμφανίζεται εκεί ως **άσχετη** αποτυχία, ή σε
 * καθόλου αποτυχία αν το αρχείο δεν έχει test. Μετρημένο (ADR-796 handoff §8):
 * στη συνεδρία 23/08 ένα σπάσιμο αναφέρθηκε ως **4 άσχετες** αποτυχίες jest.
 *
 * ⚠️ **ΔΕΝ ΕΙΝΑΙ ΥΠΟΚΑΤΑΣΤΑΤΟ ΤΟΥ `tsc`, ΚΑΙ ΤΟ ΔΗΛΩΝΕΙ**: δεν κρίνει τύπους,
 * υπογραφές, ή συμβατότητα. Κρίνει **ΥΠΑΡΞΗ ΟΝΟΜΑΤΟΣ** — ακριβώς την κλάση
 * βλάβης που γεννά κάθε refactor μετακίνησης, και **μόνο** αυτήν.
 *
 * ⚠️ **fail-closed**: αρχείο που δεν λύνεται ή `export *` που δεν ακολουθείται
 * μετριέται **ΜΕ ΟΝΟΜΑ** ως `unprovable`, ΠΟΤΕ ως «καθαρό». Ένα «0 παραβιάσεις»
 * που κρύβει «δεν κοίταξα» είναι το σχήμα που κυνηγά ολόκληρη η αλυσίδα ADR.
 *
 * ⚠️ **ΚΑΜΙΑ ΝΕΑ ΜΗΧΑΝΗ** (ADR-749): καταναλώνει `resolveSpecifier`/`readTsPathAliases`
 * (ADR-700) και `collectSourceFiles` — τις ΙΔΙΕΣ που καταναλώνει το CHECK 3.62.
 *
 * @module scripts/lib/public-surface/symbol-integrity
 */

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { collectSourceFiles } = require('../module-graph/scan-config');
const { resolveSpecifier, readTsPathAliases, toPosix } = require('../module-graph/resolve-specifier');

/** Οι καταστάσεις. Κλειστή λογιστική· άγνωστη ⇒ `throw` ΜΕ ΟΝΟΜΑ. */
const STATES = Object.freeze({
  MISSING: 'missing-symbol',      // ⛔ ζητά όνομα που δεν εξάγεται
  RESOLVED: 'resolved',           // ✅ βρέθηκε
  VIA_STAR: 'via-star-reexport',  // 🔶 φτάνει μέσω `export *` — δεκτό
  UNPROVABLE: 'unprovable',       // 🔶 δεν μπόρεσε να κριθεί — ΜΕ ΟΝΟΜΑ
});

/** Τα ονόματα που ΕΞΑΓΕΙ ένα αρχείο, + οι `export *` πηγές του. */
function exportsOf(absFile, cache) {
  const key = toPosix(absFile);
  if (cache.has(key)) return cache.get(key);
  const out = { names: new Set(), stars: [], ok: false };
  let src;
  try { src = fs.readFileSync(absFile, 'utf8'); } catch { cache.set(key, out); return out; }
  const sf = ts.createSourceFile(path.basename(absFile), src, ts.ScriptTarget.Latest, true);
  out.ok = true;

  ts.forEachChild(sf, (n) => {
    const mods = ts.canHaveModifiers(n) ? (ts.getModifiers(n) || []) : [];
    const isExported = mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

    if (ts.isExportDeclaration(n)) {
      if (n.exportClause && ts.isNamedExports(n.exportClause)) {
        for (const e of n.exportClause.elements) out.names.add(e.name.text);
      } else if (!n.exportClause && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
        out.stars.push(n.moduleSpecifier.text);
      }
      return;
    }
    // ⚠️ `export default X` / `export = X` — ΞΕΧΩΡΙΣΤΟΣ κόμβος (ExportAssignment),
    // ΔΕΝ φέρει modifier. Χωρίς αυτό ο σαρωτής ανέφερε **78 ψευδώς θετικά**, όλα
    // ονόματι «default» — δηλαδή θα γεννιόταν με θόρυβο 100% στη μία του κλάση.
    if (ts.isExportAssignment(n)) { out.names.add('default'); return; }
    if (!isExported) return;
    // `export default function foo()` — modifier DefaultKeyword δίπλα στο ExportKeyword
    if (mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) out.names.add('default');
    if (ts.isVariableStatement(n)) {
      for (const d of n.declarationList.declarations) {
        if (d.name && ts.isIdentifier(d.name)) out.names.add(d.name.text);
      }
    } else if (n.name && ts.isIdentifier(n.name)) {
      out.names.add(n.name.text);
    }
  });
  cache.set(key, out);
  return out;
}

/** Εξάγει το αρχείο το `name`, ακολουθώντας `export *` σε βάθος; */
function provides(absFile, name, ctx, seen) {
  seen = seen || new Set();
  const key = toPosix(absFile);
  if (seen.has(key)) return 'cycle';
  seen.add(key);
  const e = exportsOf(absFile, ctx.exportCache);
  if (!e.ok) return 'unreadable';
  if (e.names.has(name)) return 'direct';
  for (const star of e.stars) {
    let r;
    try { r = resolveSpecifier(star, absFile, ctx); } catch { return 'star-unresolved'; }
    if (!r || r.kind === 'external') return 'star-external';
    if (!r.file) return 'star-unresolved';
    const deep = provides(r.file, name, ctx, seen);
    if (deep === 'direct' || deep === 'star') return 'star';
    if (deep === 'star-external' || deep === 'star-unresolved') return deep;
  }
  return 'no';
}

/**
 * Σαρώνει το δέντρο. Επιστρέφει κλειστή λογιστική + τα ⛔ ευρήματα.
 * @param {{projectRoot:string, roots?:string[], scope?:RegExp}} opts
 */
function scanSymbolIntegrity({ projectRoot, roots = ['src'], scope = null }) {
  const aliases = readTsPathAliases(projectRoot);
  const files = collectSourceFiles(projectRoot, roots);
  const fileSet = new Set(files.map(toPosix));
  const ctx = { projectRoot, aliases, fileSet, exportCache: new Map() };

  const tally = Object.fromEntries(Object.values(STATES).map((s) => [s, 0]));
  const findings = [];
  let inspected = 0;

  for (const abs of files) {
    const rel = toPosix(path.relative(projectRoot, abs));
    let src;
    try { src = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true);

    ts.forEachChild(sf, (n) => {
      let spec = null;
      let elements = null;
      if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
        spec = n.moduleSpecifier.text;
        const nb = n.importClause && n.importClause.namedBindings;
        if (nb && ts.isNamedImports(nb)) elements = nb.elements;
      } else if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
        spec = n.moduleSpecifier.text;
        if (n.exportClause && ts.isNamedExports(n.exportClause)) elements = n.exportClause.elements;
      }
      if (!spec || !elements || elements.length === 0) return;

      let r;
      try { r = resolveSpecifier(spec, abs, ctx); } catch { r = null; }
      if (!r || r.kind === 'external') return;          // ξένο πακέτο — εκτός ερωτήματος
      if (!r.file) return;                               // ανεπίλυτο — το κρίνει το 3.62
      const target = toPosix(path.relative(projectRoot, r.file));
      if (scope && !scope.test(target) && !scope.test(rel)) return;

      for (const e of elements) {
        const name = e.propertyName ? e.propertyName.text : e.name.text;
        inspected++;
        const verdict = provides(r.file, name, ctx);
        if (verdict === 'direct') { tally[STATES.RESOLVED]++; }
        else if (verdict === 'star') { tally[STATES.VIA_STAR]++; }
        else if (verdict === 'no') {
          tally[STATES.MISSING]++;
          findings.push({
            state: STATES.MISSING, file: rel, symbol: name, target,
            line: sf.getLineAndCharacterOfPosition(e.pos).line + 1,
            detail: `το «${target}» δεν εξάγει «${name}»`,
          });
        } else {
          tally[STATES.UNPROVABLE]++;
          findings.push({ state: STATES.UNPROVABLE, file: rel, symbol: name, target, detail: verdict });
        }
      }
    });
  }

  const sum = Object.values(tally).reduce((a, b) => a + b, 0);
  if (sum !== inspected) {
    throw new Error(`ΣΠΑΣΜΕΝΗ ΛΟΓΙΣΤΙΚΗ ακεραιότητας συμβόλων: ${sum} ≠ ${inspected}`);
  }
  return { tally, inspected, findings, STATES };
}

module.exports = { scanSymbolIntegrity, STATES, exportsOf };
