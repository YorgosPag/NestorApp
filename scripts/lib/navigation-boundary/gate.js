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

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const {
  BOUNDARY_MODULE,
  GATE_STATES: STATES,
  MIGRATED_SYMBOLS,
  RAW_IMPORT_OWNERS,
  isRawImportOwner,
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

/** Ελάχιστο μήκος λόγου — «ok» δεν είναι λόγος (πρότυπο CHECK 3.35/3.50/3.58). */
const MIN_REASON = 40;

// ─────────────────────────────────────────────────────────────────────────────
// 1. Η ΣΑΡΩΣΗ
// ─────────────────────────────────────────────────────────────────────────────

/** Κάθε `.ts`/`.tsx` του δέντρου — ο **παρονομαστής**, πριν το προφίλτρο. */
function collectSourceFiles(root) {
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.next') walk(full);
      } else if (/\.tsx?$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
        found.push(full);
      }
    }
  };
  if (fs.existsSync(root)) walk(root);
  return found;
}

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
 */
function rawMigratableImports(sourceFile) {
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
      if (Object.hasOwn(MIGRATED_SYMBOLS, imported)) {
        found.push({ symbol: imported, line: lineOf(sourceFile, element) });
      }
    }
  }
  return found;
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

/** Εισάγει από το σύνορο; */
function importsBoundary(sourceFile) {
  return sourceFile.statements.some(
    (s) =>
      ts.isImportDeclaration(s) &&
      ts.isStringLiteral(s.moduleSpecifier) &&
      s.moduleSpecifier.text === BOUNDARY_MODULE,
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
  const raw = rawMigratableImports(sourceFile);

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
function judgeOwners(root, owners = RAW_IMPORT_OWNERS) {
  const verdicts = [];
  for (const [rel, reason] of Object.entries(owners)) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full) || !mentionsRawNext(fs.readFileSync(full, 'utf8'))) {
      verdicts.push({
        rel,
        state: STATES.ORPHAN_OWNER,
        detail: 'η δήλωση δείχνει σε αρχείο που δεν υπάρχει ή δεν αγγίζει πια ωμό Next',
      });
      continue;
    }
    if (typeof reason !== 'string' || reason.trim().length < MIN_REASON) {
      verdicts.push({ rel, state: STATES.REASONLESS_OWNER, detail: 'δήλωση χωρίς ουσιαστικό λόγο' });
    }
  }
  return verdicts;
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
function sweep(root, owners = RAW_IMPORT_OWNERS) {
  const files = collectSourceFiles(path.join(root, 'src'));
  const fileTally = Object.fromEntries(FILE_STATES.map((s) => [s, 0]));
  const violations = [];

  for (const full of files) {
    const rel = repoRelativePosix(full, root);
    const verdict = judgeFile(rel, fs.readFileSync(full, 'utf8'));
    if (!Object.hasOwn(fileTally, verdict.state)) {
      throw new Error(`[3.61] ΑΓΝΩΣΤΗ κατάσταση αρχείου "${verdict.state}" για ${rel}.`);
    }
    fileTally[verdict.state] += 1;
    if (verdict.state === STATES.BOUNDARY_BYPASS) {
      for (const hit of verdict.hits) {
        violations.push({ rel, state: verdict.state, detail: `ωμό \`${hit.symbol}\` (γρ. ${hit.line})` });
      }
    }
  }

  // 🔑 ΔΕΥΤΕΡΟ ΚΑΤΑΣΤΙΧΟ — ΟΙ ΔΗΛΩΣΕΙΣ, ΟΧΙ ΤΑ ΑΡΧΕΙΑ (πρότυπο CHECK 3.50).
  // ⚠️ Ένα κατάστιχο θα ΔΙΠΛΟΜΕΤΡΟΥΣΕ: ένας ιδιοκτήτης χωρίς λόγο είναι ΚΑΙ
  //    αρχείο `owner` ΚΑΙ δήλωση `reasonless-owner`. Το έπιασε η άγκυρα `Λ1`,
  //    όχι η ανάγνωση.
  const ownerTally = Object.fromEntries(OWNER_STATES.map((s) => [s, 0]));
  const declared = Object.keys(owners);
  const flagged = judgeOwners(root, owners);
  for (const v of flagged) {
    if (!Object.hasOwn(ownerTally, v.state)) {
      throw new Error(`[3.61] ΑΓΝΩΣΤΗ κατάσταση δήλωσης "${v.state}" για ${v.rel}.`);
    }
    ownerTally[v.state] += 1;
    violations.push(v);
  }
  ownerTally[STATES.OWNER] = declared.length - flagged.length;

  const countedFiles = Object.values(fileTally).reduce((a, b) => a + b, 0);
  if (countedFiles !== files.length) {
    throw new Error(`[3.61] Η ΛΟΓΙΣΤΙΚΗ ΑΡΧΕΙΩΝ ΔΕΝ ΚΛΕΙΝΕΙ: ${countedFiles} ≠ ${files.length}.`);
  }
  const countedOwners = Object.values(ownerTally).reduce((a, b) => a + b, 0);
  if (countedOwners !== declared.length) {
    throw new Error(`[3.61] Η ΛΟΓΙΣΤΙΚΗ ΔΗΛΩΣΕΩΝ ΔΕΝ ΚΛΕΙΝΕΙ: ${countedOwners} ≠ ${declared.length}.`);
  }
  return { fileTally, ownerTally, violations, population: files.length, declared: declared.length };
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
