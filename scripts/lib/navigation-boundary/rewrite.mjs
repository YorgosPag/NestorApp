/**
 * Η ΜΗΧΑΝΗ ΞΑΝΑΓΡΑΨΙΜΑΤΟΣ — αλλάζει **μόνο τη γραμμή εισαγωγής**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΑΠΟ ΤΟ CLI
 * ─────────────────────────────────────────────────────────────────────────────
 * Η **κρίση** *(«τι κατάσταση έχει αυτό το αρχείο;»)* είναι άλλη ευθύνη από τη
 * **λογιστική** *(«κλείνει το άθροισμα;»)*. Χωρισμένη, η κρίση δοκιμάζεται σε
 * μίνι-repo χωρίς να τρέξει ποτέ CLI — και η άγκυρα μπορεί να τη μεταλλάξει.
 *
 * ⚠️ **Καμία αλλαγή έξω από τις δηλώσεις εισαγωγής.** Τα σημεία κλήσης
 * (`router.push('/projects')`, `<Link href="/contacts">`) μένουν **αυτούσια**:
 * αυτό είναι όλο το νόημα του συνόρου (ADR-787 §5.3 θ) — τα 276 σημεία
 * πλοήγησης δεν χρειάζεται να θυμούνται τίποτα.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ `imp.remove()` ΣΒΗΝΕΙ ΤΟ DOCBLOCK ΠΟΥ ΚΑΘΕΤΑΙ ΑΠΟ ΠΑΝΩ — ΠΛΗΡΩΜΕΝΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η πρώτη γραφή αφαιρούσε τη δήλωση και έγραφε καινούργια. Το `remove()` του
 * ts-morph παρασύρει τη **leading trivia**, δηλαδή το JSDoc που ανήκει
 * συντακτικά στη δήλωση: το `src/app/not-found.tsx` έχασε **18 γραμμές**
 * τεκμηρίωσης, και η κλειστή λογιστική ήταν **ΠΡΑΣΙΝΗ** — γιατί μετρούσε
 * **σύμβολα**, όχι **γραμμές**. Συνολικά 213 διαγραφές έναντι 149 προσθηκών.
 *
 * ⇒ **ΠΟΤΕ `remove()` σε δήλωση που φέρει δικά της σχόλια.** Η μετατροπή γίνεται
 * **επιτόπου** (`setModuleSpecifier`), που δεν αγγίζει τίποτα γύρω της.
 *
 * ⚠️ Και το μάθημα είναι γενικό: *ένα codemod που υπόσχεται «μόνο η γραμμή
 * εισαγωγής» οφείλει να το **αποδεικνύει**, όχι να το δηλώνει.* Την απόδειξη τη
 * δίνει το {@link nonImportSignature} — ο καλών συγκρίνει πριν/μετά.
 *
 * @module scripts/lib/navigation-boundary/rewrite
 */

import { createRequire } from 'node:module';

// ⚠️ Το συμβόλαιο ζει σε **CommonJS**, όπως τα 103 από τα 105 modules του
//    `scripts/lib/`: το καταναλώνει ΚΑΙ η πύλη (CHECK 3.61, `.js`) ΚΑΙ το codemod
//    (`.mjs`). Δύο αντίγραφα σε δύο συστήματα modules θα ήταν ακριβώς η «δεύτερη
//    διάλεκτος» του ADR-749.
const { BOUNDARY_MODULE, LINK_SYMBOL, STATES, classifySymbol, isRawImportOwner } =
  createRequire(import.meta.url)('./contract.js');

const NEXT_LINK = 'next/link';
const NEXT_NAVIGATION = 'next/navigation';

/** Οι εισαγωγές του αρχείου, χωρισμένες κατά πηγή — μία διάσχιση, όχι τρεις. */
function collectImports(sf) {
  const buckets = { link: [], navigation: [], boundary: [] };
  for (const imp of sf.getImportDeclarations()) {
    const spec = imp.getModuleSpecifierValue();
    if (spec === NEXT_LINK) buckets.link.push(imp);
    else if (spec === NEXT_NAVIGATION) buckets.navigation.push(imp);
    else if (spec === BOUNDARY_MODULE) buckets.boundary.push(imp);
  }
  return buckets;
}

/**
 * **Η ΥΠΟΓΡΑΦΗ ΤΟΥ ΑΡΧΕΙΟΥ ΕΞΩ ΑΠΟ ΤΙΣ ΕΙΣΑΓΩΓΕΣ** — η απόδειξη του συμβολαίου.
 *
 * Επιστρέφει κάθε **μη κενή** γραμμή που **δεν** ανήκει σε δήλωση εισαγωγής. Ο
 * καλών τη μετρά **πριν** και **μετά**: αν διαφέρει, το codemod άγγιξε κάτι που
 * υποσχέθηκε να μην αγγίξει, και η εγγραφή **δεν γίνεται**.
 *
 * ⚠️ Χρησιμοποιείται `getStart()` και **όχι** `getFullStart()`: το `getFullStart`
 * περιλαμβάνει τη leading trivia, δηλαδή θα έκρυβε τα σχόλια **μέσα** στο
 * αγνοούμενο εύρος — ο φρουρός θα ήταν τυφλός **ακριβώς** στο ελάττωμα που
 * υπάρχει για να πιάσει.
 *
 * ⚠️ Οι **κενές** γραμμές εξαιρούνται, και είναι **δηλωμένο όριο**: η αφαίρεση
 * μιας δήλωσης μετακινεί αναπόφευκτα κενές γραμμές, και ένας φρουρός που
 * κοκκινίζει σε αυτό θα ήταν θόρυβος πάνω στη σωστή πράξη.
 */
export function nonImportSignature(sf) {
  const skip = new Set();
  for (const imp of sf.getImportDeclarations()) {
    const from = sf.getLineAndColumnAtPos(imp.getStart()).line;
    const to = sf.getLineAndColumnAtPos(imp.getEnd()).line;
    for (let n = from; n <= to; n += 1) skip.add(n);
  }
  const NEWLINE = new RegExp(String.fromCharCode(13) + '?' + String.fromCharCode(10));
  return sf
    .getFullText()
    .split(NEWLINE)
    .map((line, i) => (skip.has(i + 1) ? null : line.trim()))
    .filter((line) => line !== null && line !== '')
    .join(String.fromCharCode(10));
}

/**
 * Φέρει τα σύμβολα μέσα στη δήλωση και **γυρίζει τον ειδικευτή στο σύνορο**,
 * χωρίς να αφαιρέσει τίποτα.
 *
 * ⚠️ Τα named μπαίνουν **ΠΡΙΝ** αφαιρεθεί το default: ενδιάμεση κατάσταση χωρίς
 * κανένα specifier κάνει τη δήλωση **side-effect import** (`import 'next/link'`),
 * και το ts-morph τη σειριοποιεί έτσι.
 */
function convertInPlace(imp, entries) {
  if (entries.length > 0) imp.addNamedImports(entries);
  if (imp.getDefaultImport()) imp.removeDefaultImport();
  imp.setModuleSpecifier(BOUNDARY_MODULE);
}

/** Φέρει η δήλωση δικά της σχόλια; Αν ναι, **απαγορεύεται** να αφαιρεθεί. */
function carriesComments(imp) {
  return imp.getLeadingCommentRanges().length > 0;
}

/**
 * Το `next/link` — **πάντα** πλήρης μετανάστευση: η προεπιλεγμένη εισαγωγή του
 * είναι το `Link` και τίποτε άλλο.
 *
 * ⚠️ `import NextLink from 'next/link'` ⇒ `{ Link as NextLink }`, **όχι** `{ Link }`.
 * Μια «κανονικοποίηση» του ονόματος θα άλλαζε **κάθε σημείο χρήσης** μέσα στο
 * αρχείο, δηλαδή θα έβγαινε από το συμβόλαιο «μόνο η γραμμή εισαγωγής».
 */
function migrateLink(imp) {
  if (imp.getNamespaceImport() || imp.getNamedImports().length > 0) return 0;
  const def = imp.getDefaultImport();
  if (!def) return 0;
  const local = def.getText();
  convertInPlace(imp, [local === LINK_SYMBOL ? { name: LINK_SYMBOL } : { name: LINK_SYMBOL, alias: local }]);
  return 1;
}

/**
 * Το `next/navigation` — **δύο** δρόμοι, και η διάκριση δεν είναι κοσμητική:
 *
 * * **όλα** μεταναστεύουν ⇒ επιτόπου αλλαγή ειδικευτή, **μηδέν** απώλεια·
 * * **μερικώς** ⇒ η αρχική δήλωση **επιβιώνει** με τα υπόλοιπα σύμβολα *(και με
 *   τα σχόλιά της)*, και το σύνορο παίρνει **νέα** δήλωση από κάτω της.
 */
function migrateNavigation(sf, imp) {
  if (imp.getNamespaceImport() || imp.getDefaultImport() || imp.isTypeOnly()) return 0;

  const named = imp.getNamedImports();
  const moving = named.filter((s) => !s.isTypeOnly() && classifySymbol(s.getName()) === 'migrate');
  if (moving.length === 0) return 0;

  const entries = moving.map((s) => {
    const alias = s.getAliasNode()?.getText();
    return alias ? { name: s.getName(), alias } : { name: s.getName() };
  });

  if (moving.length === named.length) {
    convertInPlace(imp, []);
    return entries.length;
  }

  for (const spec of moving) spec.remove();
  sf.insertImportDeclaration(imp.getChildIndex() + 1, {
    moduleSpecifier: BOUNDARY_MODULE,
    namedImports: entries,
  });
  return entries.length;
}

/**
 * Ενώνει διπλές δηλώσεις του συνόρου — **μόνο** όταν αυτό δεν κοστίζει σχόλια.
 *
 * ⚠️ Αν η πλεονάζουσα δήλωση φέρει δικά της σχόλια, **μένει**. Δύο δηλώσεις από
 * το ίδιο module είναι έγκυρες ES· ένα χαμένο docblock δεν επανέρχεται.
 */
function mergeBoundaryDuplicates(sf) {
  const decls = sf
    .getImportDeclarations()
    .filter((i) => i.getModuleSpecifierValue() === BOUNDARY_MODULE);
  if (decls.length < 2) return;

  const [keep, ...extra] = decls;
  const seen = new Set(keep.getNamedImports().map((s) => s.getAliasNode()?.getText() ?? s.getName()));
  for (const dup of extra) {
    if (carriesComments(dup)) continue;
    const fresh = dup
      .getNamedImports()
      .map((s) => {
        const alias = s.getAliasNode()?.getText();
        return alias ? { name: s.getName(), alias } : { name: s.getName() };
      })
      .filter((e) => !seen.has(e.alias ?? e.name));
    for (const e of fresh) seen.add(e.alias ?? e.name);
    if (fresh.length > 0) keep.addNamedImports(fresh);
    dup.remove();
  }
}

/**
 * Κρίνει **και** ξαναγράφει ένα αρχείο. Επιστρέφει την **κατάσταση** — ποτέ
 * `undefined`: ο καλών κλείνει τη λογιστική πάνω σε αυτήν.
 */
export function rewriteSourceFile(sf, repoRelPath) {
  if (isRawImportOwner(repoRelPath)) return { state: STATES.OWNER, moved: 0 };

  const buckets = collectImports(sf);
  if (buckets.link.length === 0 && buckets.navigation.length === 0) {
    // ⚠️ ΔΥΟ ΞΕΧΩΡΙΣΤΕΣ ΑΠΑΝΤΗΣΕΙΣ, ΟΧΙ ΜΙΑ. «Δεν έχει ωμή εισαγωγή» ισχύει και
    //    για τα ~20.000 αρχεία που δεν πλοηγούν καθόλου· αν έμπαιναν στον ίδιο
    //    κάδο με τα μεταναστευμένα, ο αριθμός «already-at-boundary» θα ήταν
    //    δείκτης ΜΕΓΕΘΟΥΣ ΤΟΥ REPO και θα διαβαζόταν ως πρόοδος.
    return buckets.boundary.length > 0
      ? { state: STATES.ALREADY_AT_BOUNDARY, moved: 0 }
      : { state: STATES.NOT_A_NAVIGATION_FILE, moved: 0 };
  }

  for (const imp of [...buckets.link, ...buckets.navigation]) {
    if (imp.getNamespaceImport()) {
      return {
        state: STATES.UNANALYZABLE_IMPORT,
        moved: 0,
        detail: `namespace import από ${imp.getModuleSpecifierValue()}`,
      };
    }
  }

  const before = nonImportSignature(sf);
  let moved = 0;
  for (const imp of buckets.link) moved += migrateLink(imp);
  for (const imp of buckets.navigation) moved += migrateNavigation(sf, imp);
  if (moved === 0) return { state: STATES.NO_MIGRATABLE_SYMBOL, moved: 0 };

  mergeBoundaryDuplicates(sf);

  // 🔒 Η ΑΠΟΔΕΙΞΗ ΤΟΥ ΣΥΜΒΟΛΑΙΟΥ, ΟΧΙ Η ΔΗΛΩΣΗ ΤΟΥ.
  if (nonImportSignature(sf) !== before) {
    return {
      state: STATES.COLLATERAL_CHANGE,
      moved: 0,
      detail: 'άλλαξε κείμενο ΕΞΩ από τις δηλώσεις εισαγωγής (χαμένο σχόλιο ή κώδικας)',
    };
  }
  return { state: STATES.REWRITTEN, moved };
}
