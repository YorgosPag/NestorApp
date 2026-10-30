/**
 * Η ΚΡΙΣΗ ΤΗΣ ΠΥΛΗΣ 3.61 — «περνά αυτό το αρχείο από το σύνορο;»
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΜΙΑ ΑΥΘΕΝΤΙΑ: το {@link module:scripts/lib/navigation-boundary/contract}
 * ─────────────────────────────────────────────────────────────────────────────
 * Ποιο σύμβολο μεταναστεύει, ποιο μένει ωμό, ποιος επιτρέπεται να το εισάγει —
 * όλα ζουν στο συμβόλαιο, που καταναλώνει **και** ο codemod. Δύο αντίγραφα θα
 * ήταν το σχήμα του **ADR-749** και η απόκλιση θα ήταν **αόρατη**: ο codemod θα
 * άφηνε ένα σύμβολο πίσω και η πύλη θα το έλεγε «εντάξει», ή το αντίστροφο.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ AST, ΟΧΙ REGEX — ΚΑΙ Ο ΛΟΓΟΣ ΕΙΝΑΙ ΓΡΑΜΜΕΝΟΣ ΣΤΟ ΙΔΙΟ ΤΟ ΣΥΝΟΡΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `navigation.tsx` **αναφέρει** το `next/link` σε **πρόζα** *(εξηγεί γιατί το
 * τυλίγει)*. Ένα regex θα κοκκίνιζε πάνω στην **τεκμηρίωση της θεραπείας** —
 * ακριβώς η παγίδα `Κ7β` του CHECK 3.50, που στο ίδιο repo έχει πληρωθεί.
 * Ο parser του TypeScript τρέχει **parse-only** *(`createSourceFile`)*: καμία
 * επίλυση τύπων, καμία σχέση με `tsc` — **N.17 ακέραιος**.
 *
 * ⚡ Και είναι φθηνό επειδή προηγείται **προφίλτρο κειμένου**: από **20.127**
 * αρχεία, μόλις **69** αναφέρουν καν το `next/link`/`next/navigation`. Το
 * προφίλτρο είναι ασφαλές **μόνο επειδή ΑΦΑΙΡΕΙ, δεν προσθέτει** — αρχείο που
 * δεν γράφει πουθενά τη συμβολοσειρά δεν μπορεί να την εισάγει *(μάθημα `Μμ10`
 * του CHECK 3.59)*.
 *
 * @module scripts/lib/navigation-boundary/gate
 */

const ts = require('typescript');

const { openGateInput } = require('../gate-input');
const { MIN_REASON, boundaryPopulation, judgeOwnerDeclarations, sweepBoundary } = require('../import-boundary/ledger');

const {
  BOUNDARY_MODULE,
  GATE_STATES: STATES,
  MIGRATED_SYMBOLS,
  RAW_IMPORT_OWNERS,
  SERVER_BOUNDARY_MODULE,
  SERVER_MIGRATED_SYMBOLS,
  isRawImportOwner,
  isWorkspaceRouteFile,
  repoRelativePosix,
} = require('./contract.js');

const NEXT_LINK = 'next/link';
const NEXT_NAVIGATION = 'next/navigation';

/** Οι καταστάσεις που μπορεί να πάρει ένα **ΑΡΧΕΙΟ**. */
const FILE_STATES = Object.freeze([
  STATES.BOUNDARY_BYPASS,
  STATES.OWNER,
  STATES.AT_BOUNDARY,
  STATES.UNMIGRATABLE_ONLY,
  STATES.NOT_A_NAVIGATION_FILE,
]);

/** Οι καταστάσεις που μπορεί να πάρει μια **ΔΗΛΩΣΗ** ιδιοκτήτη. */
const OWNER_STATES = Object.freeze([STATES.OWNER, STATES.ORPHAN_OWNER, STATES.REASONLESS_OWNER]);

/** Οι καταστάσεις που **μπλοκάρουν** — καμία δεν μπαίνει ποτέ σε baseline. */
const BLOCKING = Object.freeze([STATES.BOUNDARY_BYPASS, STATES.ORPHAN_OWNER, STATES.REASONLESS_OWNER]);



// ─────────────────────────────────────────────────────────────────────────────
// 1. Η ΣΑΡΩΣΗ
// ─────────────────────────────────────────────────────────────────────────────

/** Κάθε `.ts`/`.tsx` του δέντρου — ο **παρονομαστής** (SSoT `import-boundary/ledger`, ADR-924 Φ3). */
const collectSourceFiles = boundaryPopulation;

/** Αναφέρει καν το ωμό Next; *(προφίλτρο — αφαιρεί, ποτέ δεν προσθέτει)* */
function mentionsRawNext(text) {
  return text.includes(NEXT_LINK) || text.includes(NEXT_NAVIGATION);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Η ΚΡΙΣΗ ΕΝΟΣ ΑΡΧΕΙΟΥ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Τα **μεταναστεύσιμα** σύμβολα που εισάγονται ωμά, με το τοπικό τους όνομα.
 *
 * ⚠️ Η προεπιλεγμένη εισαγωγή του `next/link` **είναι** το `Link`, όποιο κι αν
 * είναι το τοπικό της όνομα — γι' αυτό κρίνεται χωριστά από τα named.
 *
 * 🔑 **Τα σύμβολα του διακομιστή κρίνονται ΑΝΑ ΘΕΣΗ** (ADR-875 §11): το ίδιο
 * `redirect` είναι σωστό έξω από τον χώρο (το δίχτυ κρίνει με ταυτότητα) και
 * παράκαμψη μέσα (πετά τον χώρο που ήδη υπάρχει στο `params.workspace`).
 */
function rawMigratableImports(sourceFile, repoRelPath) {
  const inWorkspace = isWorkspaceRouteFile(repoRelPath);
  const found = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const spec = statement.moduleSpecifier.text;
    const clause = statement.importClause;
    if (!clause || clause.isTypeOnly) continue;

    if (spec === NEXT_LINK && clause.name) {
      found.push({ symbol: 'Link (default)', line: lineOf(sourceFile, statement) });
      continue;
    }
    if (spec !== NEXT_NAVIGATION) continue;
    const bindings = clause.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      if (element.isTypeOnly) continue;
      const imported = (element.propertyName ?? element.name).text;
      const migrates =
        Object.hasOwn(MIGRATED_SYMBOLS, imported) ||
        (inWorkspace && Object.hasOwn(SERVER_MIGRATED_SYMBOLS, imported));
      if (migrates) {
        found.push({ symbol: imported, line: lineOf(sourceFile, element) });
      }
    }
  }
  return found;
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

/** Εισάγει από κάποιο από τα δύο σύνορα (πελάτη ή διακομιστή); */
function importsBoundary(sourceFile) {
  return sourceFile.statements.some(
    (s) =>
      ts.isImportDeclaration(s) &&
      ts.isStringLiteral(s.moduleSpecifier) &&
      (s.moduleSpecifier.text === BOUNDARY_MODULE ||
        s.moduleSpecifier.text === SERVER_BOUNDARY_MODULE),
  );
}

/**
 * Κρίνει **ένα** αρχείο. Επιστρέφει **πάντα** κατάσταση — ποτέ `undefined`: ο
 * καλών κλείνει τη λογιστική πάνω σε αυτήν.
 */
function judgeFile(repoRelPath, text) {
  if (!mentionsRawNext(text)) {
    return { state: STATES.NOT_A_NAVIGATION_FILE, hits: [] };
  }
  const sourceFile = ts.createSourceFile(repoRelPath, text, ts.ScriptTarget.Latest, true);
  const raw = rawMigratableImports(sourceFile, repoRelPath);

  if (isRawImportOwner(repoRelPath)) {
    // ⚠️ ΤΟ ΚΡΙΤΗΡΙΟ ΟΡΦΑΝΟΤΗΤΑΣ ΕΙΝΑΙ «ΑΝΑΦΕΡΕΙ», ΟΧΙ «ΕΙΣΑΓΕΙ». Η άγκυρα του
    //    συνόρου είναι νόμιμος ιδιοκτήτης και κάνει `jest.mock('next/navigation')`
    //    ΧΩΡΙΣ να εισάγει· κριτήριο «εισάγει» θα την κατήγγελλε ως νεκρή δήλωση —
    //    φρουρός που κοκκινίζει σε σωστό κώδικα είναι ο δρόμος προς το `SKIP_`.
    return { state: STATES.OWNER, hits: raw };
  }
  if (raw.length > 0) return { state: STATES.BOUNDARY_BYPASS, hits: raw };
  if (importsBoundary(sourceFile)) return { state: STATES.AT_BOUNDARY, hits: [] };
  return { state: STATES.UNMIGRATABLE_ONLY, hits: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ΤΟ ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ ΤΩΝ ΙΔΙΟΚΤΗΤΩΝ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ **ΡΑΦΗ ΕΝΕΣΗΣ (`owners`) — ΓΕΝΝΗΘΗΚΕ ΑΠΟ ΜΕΤΑΛΛΑΞΗ ΠΟΥ ΕΜΕΙΝΕ ΠΡΑΣΙΝΗ.**
 * Οι κλάδοι `reasonless-owner` και η αφαίρεση `declared − flagged` **δεν
 * ασκούνται ποτέ** στο πραγματικό δέντρο, επειδή κανένας ιδιοκτήτης δεν έχει
 * ελάττωμα — δηλαδή ήταν **αδρανείς φρουροί** (ADR-749 §5, 606 μετρημένοι σε
 * αυτό το repo), και το «0» τους διαβαζόταν ως «κοίταξα και δεν υπάρχουν».
 * Η παράμετρος επιτρέπει στην άγκυρα να τους **πυροδοτήσει**· η παραγωγή
 * χρησιμοποιεί πάντα την προεπιλογή.
 */
/**
 * Κρίνει τις **δηλώσεις**, όχι τα αρχεία: *ορφανή* (το αρχείο έφυγε ή έπαψε να
 * αγγίζει ωμό Next) και *χωρίς λόγο*.
 *
 * 🔑 Χωρίς αυτό, το κλειστό σύνολο **σαπίζει σιωπηλά** — κάθε νεκρή γραμμή είναι
 * μια πόρτα που μένει ανοιχτή χωρίς να τη θέλει κανείς *(πρότυπο CHECK 3.50 ·
 * 3.59 `Κ2` · 3.60 `Κ2`)*.
 */
function judgeOwners(root, owners = RAW_IMPORT_OWNERS, input = openGateInput({ root })) {
  return judgeOwnerDeclarations({
    owners, input, mentions: mentionsRawNext, states: STATES,
    orphanDetail: 'η δήλωση δείχνει σε αρχείο που δεν υπάρχει ή δεν αγγίζει πια ωμό Next',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Η ΛΟΓΙΣΤΙΚΗ — fail-closed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Σαρώνει **ΟΛΟ** το δέντρο και κλείνει τη λογιστική.
 *
 * ⚠️ **ΠΑΝΤΑ ΠΛΗΡΗΣ, ΠΟΤΕ ΜΟΝΟ ΣΤΑΔΙΟΠΟΙΗΜΕΝΑ**, και είναι **απόφαση με
 * μέτρηση**: κοστίζει κάτω από δευτερόλεπτο *(69 αρχεία περνούν το προφίλτρο)*,
 * ενώ αφαίρεση μιας δήλωσης ιδιοκτήτη **ξανα-ταξινομεί αρχείο που κανείς δεν
 * έστειλε**. Όταν το πλήρες είναι φθηνό, η μερική ανάλυση δεν είναι
 * βελτιστοποίηση — είναι δεύτερη αυθεντία που αποκλίνει σιωπηλά, χωρίς αντάλλαγμα.
 */
function sweep(root, owners = RAW_IMPORT_OWNERS, input = openGateInput({ root })) {
  // 🔑 Ο πυρήνας ζει ΜΙΑ φορά (`import-boundary/ledger`): δύο κατάστιχα (αρχεία · δηλώσεις) — ένα θα ΔΙΠΛΟΜΕΤΡΟΥΣΕ
  //    (ιδιοκτήτης χωρίς λόγο = ΚΑΙ αρχείο `owner` ΚΑΙ δήλωση `reasonless-owner` — το έπιασε η άγκυρα `Λ1`).
  return sweepBoundary({
    check: '3.61', root, owners, input, states: STATES, fileStates: FILE_STATES, ownerStates: OWNER_STATES,
    relOf: (full) => repoRelativePosix(full, root),
    judgeFile: (rel, text) => judgeFile(rel, text),
    bypassDetail: (hit) => `ωμό \`${hit.symbol}\` (γρ. ${hit.line})`,
    judgeOwners: () => judgeOwners(root, owners, input),
  });
}

module.exports = {
  BLOCKING,
  FILE_STATES,
  MIN_REASON,
  OWNER_STATES,
  collectSourceFiles,
  judgeFile,
  judgeOwners,
  sweep,
};
