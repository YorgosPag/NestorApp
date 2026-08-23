/**
 * =============================================================================
 * Η ΔΗΜΟΣΙΑ ΕΠΙΦΑΝΕΙΑ ΕΝΟΣ ΥΠΟΣΥΣΤΗΜΑΤΟΣ — ο σαρωτής (ADR-796 / CHECK 3.62)
 * =============================================================================
 *
 * Απαντά **ένα** ερώτημα: *ποια σύμβολα του `src/subapps/dxf-viewer/**` ζητά ο ΕΞΩ
 * κόσμος, και είναι το καθένα **δηλωμένο δημόσιο**;*
 *
 * 🔑 **ΑΝΑ ΣΥΜΒΟΛΟ, ΟΧΙ ΑΝΑ ΑΡΧΕΙΟ — και εκεί ξεπερνάμε το `package.json exports`.**
 * Το `exports` του Node κρίνει **μονοπάτια**: ανοίγεις ένα αρχείο, ανοίγεις **όλα** του
 * τα exports. Ο Revit το κάνει σωστά με `public`/`internal` **ανά σύμβολο** — αλλά η
 * TypeScript **δεν έχει** τέτοια λέξη-κλειδί (το `@internal` + `--stripInternal` αφορά
 * την *παραγωγή δηλώσεων*, δεν εμποδίζει κανέναν καταναλωτή). Εδώ το φτιάχνουμε.
 *
 * 🏆 **ΓΙΑΤΙ ΟΧΙ BARREL — ΜΕΤΡΗΜΕΝΟ ΑΠΟ ΤΗ ΒΙΟΜΗΧΑΝΙΑ, ΟΧΙ ΓΝΩΜΗ.** Το Atlassian
 * **ΑΦΑΙΡΕΣΕ** τα barrel files από το Jira (90.000 αρχεία, codemod) και μέτρησε **75%**
 * ταχύτερα builds, unit tests 1600→200, TS highlighting +30%. Το Next.js έχει
 * `optimizePackageImports` **για να τα παρακάμπτει**. Το τίμημα που πλήρωσε το Atlassian
 * το γράφει το ίδιο: *«Packages can no longer easily control their public API through
 * barrel files, losing a layer of encapsulation»* — **δέχτηκε να χάσει την ενθυλάκωση**.
 *
 * **Εδώ δεν τη χάνουμε**: η ενθυλάκωση γίνεται **ΔΕΔΟΜΕΝΟ** (μανιφέστο) αντί για
 * **MODULE** (barrel). Μηδέν κόμβος στον γράφο ⇒ μηδέν κόστος build/tree-shaking ⇒
 * το όφελος του Atlassian **και** η εγγύηση του Revit. Το ίδιο μοτίβο που ήδη
 * χρησιμοποιεί η Figma: το plugin API ζει σε `plugin-api.d.ts` + `manifest.json`,
 * **δήλωση, όχι re-export**.
 *
 * ⚠️ **ΜΗΝ το «λύσεις» φτιάχνοντας barrel.** Μετρήθηκε: **432** διακριτά σύμβολα
 * ζητιούνται από έξω — ένα barrel θα τα ξαναεξήγαγε **όλα**, δηλαδή ακριβώς το τέρας
 * που κόστισε στο Atlassian το 75%. Και **53% από αυτά είναι μόνο τύποι**, που ένα
 * barrel **ούτε καν ενθυλακώνει** (σβήνονται στη μεταγλώττιση).
 *
 * ⚠️ **ΚΑΜΙΑ ΝΕΑ ΜΗΧΑΝΗ** (ADR-749): καταναλώνει `resolveSpecifier`/`readTsPathAliases`
 * (ADR-700) και `collectSourceFiles`. Δεύτερος resolver μονοπατιών θα ήταν δεύτερη
 * διάλεκτος πάνω στο ίδιο ερώτημα.
 *
 * @module scripts/lib/public-surface/scan
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { collectSourceFiles } = require('../module-graph/scan-config');
const { resolveSpecifier, readTsPathAliases, toPosix } = require('../module-graph/resolve-specifier');

/** Το υποσύστημα που φυλάσσεται. Ζει εδώ ώστε να μην υπάρχει δεύτερη λίστα. */
const GUARDED_PREFIX = 'src/subapps/dxf-viewer/';

/**
 * Οι καταστάσεις. **Κλειστή λογιστική fail-closed**: κάθε εισαγωγή πέφτει σε ΑΚΡΙΒΩΣ
 * μία, το άθροισμα πρέπει να κλείνει, και άγνωστη κατάσταση ⇒ `throw` ΜΕ ΟΝΟΜΑ.
 */
const STATES = Object.freeze({
  UNDECLARED: 'undeclared-import',       // ⛔ ζητά σύμβολο εκτός μανιφέστου
  REASONLESS: 'reasonless-declaration',  // ⛔ δήλωση χωρίς λόγο
  ORPHAN: 'orphan-declaration',          // ⛔ δηλωμένο που κανείς δεν ζητά πια
  DECLARED: 'declared-public',           // ✅ δηλωμένο και σε χρήση
  UNRESOLVABLE: 'unresolvable-specifier', // 🔶 δεν λύνεται — μετριέται ΜΕ ΟΝΟΜΑ
  STYLESHEET: 'stylesheet-import',       // 🎨 side-effect CSS — δεν ζητά σύμβολο
});

const BLOCKING = Object.freeze([STATES.UNDECLARED, STATES.REASONLESS, STATES.ORPHAN]);

/** Ταυτότητα εγγραφής. **ΠΟΤΕ με γραμμή**: η μετακίνηση δεν είναι add+remove. */
const idOf = (file, symbol) => `${file}#${symbol}`;

/**
 * Ποια σύμβολα ζητά ΑΥΤΟ το αρχείο από το φυλασσόμενο υποσύστημα;
 *
 * ⚠️ **AST, ΠΟΤΕ grep**: τα πολυγραμμικά imports λένε ψέματα — μετρημένο στο ADR-794,
 * όπου το grep έδωσε «23 καταναλωτές» ενώ η αλήθεια ήταν **3**.
 */
function importsFrom(absFile, relFile, ctx) {
  const src = fs.readFileSync(absFile, 'utf8');
  const sf = ts.createSourceFile(relFile, src, ts.ScriptTarget.Latest, true);
  const out = [];

  ts.forEachChild(sf, (node) => {
    const isImport = ts.isImportDeclaration(node);
    const isExport = ts.isExportDeclaration(node);
    if (!(isImport || isExport) || !node.moduleSpecifier) return;

    const spec = node.moduleSpecifier.getText(sf).replace(/['"]/g, '');
    // Μόνο εσωτερικά specifiers μπορούν να δείχνουν στο υποσύστημα.
    if (!spec.startsWith('.') && !spec.startsWith('@/')) return;

    // 🎨 Φύλλο ύφους: `import '…/x.css'` ΔΕΝ ζητά σύμβολο — είναι side-effect. Δεν είναι
    // επιφάνεια **API**, άρα δεν κρίνεται εδώ· ταξινομείται **ΡΗΤΑ** ώστε να μη γίνει
    // «unresolvable» (θόρυβος που μοιάζει με τυφλό σημείο) ούτε σιωπηλό `return`.
    if (/\.(css|scss|sass|less)$/.test(spec)) {
      out.push({ state: STATES.STYLESHEET, file: relFile, symbol: spec, target: null });
      return;
    }

    // ⚠️ Το `resolveSpecifier` (ADR-700) θέλει **ΑΠΟΛΥΤΟ** `fromFile` και επιστρέφει
    // `{kind, file}` — ΟΧΙ σκέτη συμβολοσειρά. Η σύμβαση αντιγράφεται από τον υπάρχοντα
    // καταναλωτή (`address-vocabulary/type-index.js:203`), ώστε να μην υπάρξει δεύτερη.
    const hit = resolveSpecifier(spec, ctx.absOf(relFile), ctx);
    if (!hit || hit.kind !== 'internal') {
      // 🔶 fail-closed: αν το specifier ΜΟΙΑΖΕΙ να δείχνει στο υποσύστημα αλλά δεν
      // λύνεται, το λέμε ΜΕ ΟΝΟΜΑ. Ένα σιωπηλό `return` εδώ θα ήταν «0 = δεν κοίταξα».
      if (spec.includes('subapps/dxf-viewer')) {
        out.push({ state: STATES.UNRESOLVABLE, file: relFile, symbol: spec, target: null });
      }
      return;
    }
    const rel = ctx.relOf(hit.file);
    if (!rel.startsWith(GUARDED_PREFIX)) return;

    const clause = isImport ? (node.importClause && node.importClause.namedBindings) : node.exportClause;
    const names = [];
    if (clause && (ts.isNamedImports(clause) || ts.isNamedExports(clause))) {
      for (const el of clause.elements) names.push((el.propertyName || el.name).text);
    } else if (clause && ts.isNamespaceImport(clause)) {
      // `import * as X` ζητά **ΤΑ ΠΑΝΤΑ** — η ευρύτερη δυνατή αξίωση, και δηλώνεται ως τέτοια.
      names.push('*');
    } else if (isImport && node.importClause && node.importClause.name) {
      names.push('default');
    } else if (isImport && !node.importClause) {
      // `import './x'` — side-effect only· δεν ζητά σύμβολο, άρα δεν είναι επιφάνεια API.
      return;
    }
    for (const symbol of names) out.push({ state: null, file: relFile, symbol, target: rel });
  });

  return out;
}

/**
 * Το μανιφέστο → ευρετήριο `file#symbol` → λόγος.
 *
 * ⚠️ Ο λόγος είναι **ΥΠΟΧΡΕΩΤΙΚΟΣ** (πρότυπο CHECK 3.35/3.44/3.58). Μια δημόσια
 * επιφάνεια χωρίς γραμμένο «γιατί» είναι απλώς μια λίστα που κανείς δεν μπορεί να
 * κλαδέψει, επειδή κανείς δεν ξέρει τι θα σπάσει.
 */
function indexManifest(manifest) {
  const byId = new Map();
  const reasonless = [];
  for (const entry of manifest.surface || []) {
    const reason = typeof entry.reason === 'string' ? entry.reason.trim() : '';
    for (const symbol of entry.symbols || []) {
      const id = idOf(entry.file, symbol);
      byId.set(id, reason);
      if (!reason) reasonless.push({ state: STATES.REASONLESS, file: entry.file, symbol, id });
    }
  }
  return { byId, reasonless };
}

/**
 * **Ο φρουρός της λογιστικής — ΞΕΧΩΡΙΣΤΗ ΣΥΝΑΡΤΗΣΗ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΣΗΜΕΙΟ.**
 *
 * 🔴 Ζούσε inline μέσα στο `scanPublicSurface`, και η μοναδική άγκυρά του ρωτούσε αν το
 * **κείμενο** «ΑΝΟΙΧΤΗ ΛΟΓΙΣΤΙΚΗ» υπάρχει στο αρχείο. Μετρημένο με μετάλλαξη: γυρίζοντας
 * το `throw` σε `void`, **καμία άγκυρα δεν κοκκίνισε** (7/8 — το `Μμ8` διέφυγε). Είναι
 * ακριβώς το σφάλμα `Μ6` του CHECK 3.8: *η άγκυρα έκρινε κείμενο, όχι συμπεριφορά*.
 * Ως ξεχωριστή εξαγόμενη συνάρτηση **ασκείται** με τεχνητά δεδομένα.
 *
 * ⚠️ Ο έλεγχος είναι **δύο ανεξάρτητοι**, ποτέ ένας: (α) το άθροισμα των κάδων κλείνει·
 * (β) καμία εγγραφή δεν κουβαλά κατάσταση εκτός του κλειστού συνόλου. Το (α) πιάνει
 * «κάποιος χάθηκε», το (β) πιάνει «κάποιος μπήκε με άγνωστο όνομα».
 */
function assertClosedLedger({ tally, inspected, findings }) {
  const counted = Object.values(tally).reduce((a, b) => a + b, 0);
  const expected = inspected + tally[STATES.ORPHAN] + tally[STATES.REASONLESS];
  if (counted !== expected) {
    throw new Error(`ΑΝΟΙΧΤΗ ΛΟΓΙΣΤΙΚΗ: ${counted} ≠ ${expected} (κάδοι: ${JSON.stringify(tally)})`);
  }
  const known = new Set(Object.values(STATES));
  for (const f of findings) {
    if (!known.has(f.state)) throw new Error(`ΑΓΝΩΣΤΗ ΚΑΤΑΣΤΑΣΗ: ${f.state}`);
  }
  return true;
}

/**
 * Η σάρωση. Επιστρέφει **κλειστή λογιστική** — κάθε εισαγωγή σε ονομασμένο κάδο.
 */
function scanPublicSurface({ projectRoot, manifest }) {
  // ⚠️ Το `readTsPathAliases` διαβάζει `tsconfig.base.json` by default — ΕΚΕΙ ζουν τα
  // `paths` αυτού του έργου. Χειρόγραφο `'tsconfig.json'` εδώ θα έδινε **μηδέν alias**,
  // άρα κάθε `@/…` θα ήταν «unresolved» και η πύλη θα γεννιόταν ΜΟΝΙΜΩΣ ΠΡΑΣΙΝΗ.
  const aliases = readTsPathAliases(projectRoot);
  const files = collectSourceFiles(projectRoot, ['src']);
  const fileSet = new Set(files.map(toPosix));
  const relOf = (absPosix) => toPosix(path.relative(projectRoot, absPosix));
  const absOf = (rel) => toPosix(path.join(projectRoot, rel));
  const ctx = { projectRoot, aliases, fileSet, relOf, absOf };

  const { byId, reasonless } = indexManifest(manifest);
  const used = new Set();
  const findings = [];
  const tally = Object.fromEntries(Object.values(STATES).map((s) => [s, 0]));
  let inspected = 0;

  for (const abs of files) {
    const rel = relOf(abs);
    if (rel.startsWith(GUARDED_PREFIX)) continue; // εσωτερικό — δεν είναι επιφάνεια

    for (const hit of importsFrom(abs, rel, ctx)) {
      inspected++;
      if (hit.state === STATES.STYLESHEET) { tally[STATES.STYLESHEET]++; continue; }
      if (hit.state === STATES.UNRESOLVABLE) {
        tally[STATES.UNRESOLVABLE]++;
        findings.push({ ...hit, id: `${hit.file}#${hit.symbol}`, detail: `δεν λύνεται: ${hit.symbol}` });
        continue;
      }
      const id = idOf(hit.target, hit.symbol);
      if (byId.has(id)) {
        used.add(id);
        tally[STATES.DECLARED]++;
      } else {
        tally[STATES.UNDECLARED]++;
        findings.push({
          state: STATES.UNDECLARED,
          file: hit.file,
          symbol: hit.symbol,
          target: hit.target,
          id,
          detail: `${hit.file} ζητά «${hit.symbol}» από ${hit.target}, που ΔΕΝ είναι δηλωμένο δημόσιο`,
        });
      }
    }
  }

  // ⛔ Ορφανές: το μανιφέστο πρέπει να λέει την αλήθεια, αλλιώς σαπίζει σιωπηλά
  // (το μάθημα του CHECK 3.50 — σβησμένη δήλωση αφήνει artifact που ταξιδεύει παγωμένο).
  for (const id of byId.keys()) {
    if (used.has(id)) continue;
    tally[STATES.ORPHAN]++;
    const [file, symbol] = id.split('#');
    findings.push({ state: STATES.ORPHAN, file, symbol, target: file, id, detail: `κανείς δεν ζητά πια «${symbol}»` });
  }

  for (const r of reasonless) { tally[STATES.REASONLESS]++; findings.push({ ...r, detail: 'δήλωση χωρίς λόγο' }); }

  assertClosedLedger({ tally, inspected, findings });

  return {
    tally,
    inspected,
    findings,
    blocking: findings.filter((f) => BLOCKING.includes(f.state)),
    declarations: [...byId.keys()].sort(),
    usedIds: [...used].sort(),
  };
}

module.exports = {
  scanPublicSurface, indexManifest, importsFrom, idOf, assertClosedLedger,
  STATES, BLOCKING, GUARDED_PREFIX,
};
