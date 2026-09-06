/**
 * Η ΚΡΙΣΗ ΤΗΣ ΠΥΛΗΣ 3.75 — «περνά αυτός ο χάρτης από το σύνορο, και κατέχει το
 * σύνορο αυτό που υπόσχεται;» (ADR-777 §8.56)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΡΙΑ ΚΡΙΤΗΡΙΑ, ΚΑΙ ΚΑΝΕΝΑ ΔΕΝ ΑΠΑΝΤΑ ΤΟ ΕΡΩΤΗΜΑ ΤΩΝ ΑΛΛΩΝ
 * ─────────────────────────────────────────────────────────────────────────────
 * **Κ1 — παράκαμψη**: εισάγει κάποιος ωμή **τιμή** από `react-map-gl` / `maplibre-gl`
 *        (ή το φύλλο στυλ τους) χωρίς να είναι δηλωμένος ιδιοκτήτης;
 * **Κ2 — παρονομαστής**: έχει το σύνορο **καταναλωτές**; Χωρίς αυτό, το ευκολότερο
 *        πράσινο είναι να **σβήσεις τον τελευταίο χρήστη** του συνόρου.
 * **Κ3 — κατοχή**: κατέχει το ίδιο το σύνορο **το φύλλο στυλ**; Χωρίς αυτό, το
 *        ευκολότερο πράσινο είναι να **σβήσεις τη μία γραμμή της θεραπείας** — και
 *        κάθε χάρτης της εφαρμογής χάνει τη διάταξή του με την πύλη να λέει «καθαρό».
 *
 * 🔴 Τα Κ2/Κ3 δεν είναι διακόσμηση: το «*0 = κανείς δεν κοίταξε*» έχει μετρηθεί σε
 * αυτό το repo πάνω από πέντε φορές (N.11 · N.12 · N.18 · CHECK 3.18 · 3.74).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ AST, ΟΧΙ REGEX — ΚΑΙ Ο ΛΟΓΟΣ ΕΙΝΑΙ ΓΡΑΜΜΕΝΟΣ ΣΤΟ ΙΔΙΟ ΤΟ ΣΥΝΟΡΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `src/lib/maps/maplibre.ts` **αναφέρει** και τα δύο ωμά modules σε **πρόζα**
 * (εξηγεί γιατί τα τυλίγει), και το ίδιο κάνει ο `AddressMap` στο σχόλιο που
 * κατέγραψε το προηγούμενο περιστατικό. Ένα regex θα κοκκίνιζε πάνω στην
 * **τεκμηρίωση της θεραπείας** — η παγίδα `Κ7β` του CHECK 3.50, ήδη πληρωμένη εδώ.
 * Ο parser τρέχει **parse-only** (`createSourceFile`): καμία επίλυση τύπων, καμία
 * σχέση με `tsc` — **N.17 ακέραιος**.
 *
 * ⚡ Και είναι φθηνό επειδή προηγείται **προφίλτρο κειμένου**: το προφίλτρο είναι
 * ασφαλές **μόνο επειδή ΑΦΑΙΡΕΙ, δεν προσθέτει** — αρχείο που δεν γράφει πουθενά τη
 * συμβολοσειρά δεν μπορεί να την εισάγει (μάθημα `Μμ10` του CHECK 3.59).
 *
 * @module scripts/lib/map-boundary/gate
 */

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const {
  BOUNDARY_FILE,
  BOUNDARY_MODULE,
  BOUNDARY_STATES,
  GATE_STATES: STATES,
  GUARDED_MODULES,
  RAW_IMPORT_OWNERS,
  REQUIRED_STYLESHEET,
  isRawImportOwner,
  repoRelativePosix,
} = require('./contract.js');

/** Οι ρίζες των φυλασσόμενων πακέτων — το κλειδί του συμβολαίου, όχι αντίγραφο. */
const GUARDED_ROOTS = Object.freeze(Object.keys(GUARDED_MODULES));

/** Οι καταστάσεις που μπορεί να πάρει ένα **ΑΡΧΕΙΟ** — κλειστό σύνολο. */
const FILE_STATES = Object.freeze([
  STATES.BOUNDARY_BYPASS,
  STATES.OWNER,
  STATES.AT_BOUNDARY,
  STATES.TYPE_ONLY,
  STATES.NOT_A_MAP_FILE,
]);

/** Οι καταστάσεις που μπορεί να πάρει μια **ΔΗΛΩΣΗ** ιδιοκτήτη. */
const OWNER_STATES = Object.freeze([
  STATES.OWNER,
  STATES.ORPHAN_OWNER,
  STATES.REASONLESS_OWNER,
]);

/** Οι καταστάσεις **του ίδιου του συνόρου** (Κ2 + Κ3). */
const SELF_STATES = Object.freeze([
  BOUNDARY_STATES.BOUNDARY_HEALTHY,
  BOUNDARY_STATES.BOUNDARY_ABANDONED,
  BOUNDARY_STATES.STYLESHEET_MISSING,
  BOUNDARY_STATES.BOUNDARY_ABSENT,
]);

/** Ό,τι **μπλοκάρει** — καμία από αυτές δεν μπαίνει ποτέ σε baseline. */
const BLOCKING = Object.freeze([
  STATES.BOUNDARY_BYPASS,
  STATES.ORPHAN_OWNER,
  STATES.REASONLESS_OWNER,
  BOUNDARY_STATES.BOUNDARY_ABANDONED,
  BOUNDARY_STATES.STYLESHEET_MISSING,
  BOUNDARY_STATES.BOUNDARY_ABSENT,
]);

/** Ελάχιστο μήκος λόγου — «ok» δεν είναι λόγος (πρότυπο 3.35/3.50/3.58/3.61). */
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

/** Αναφέρει καν χάρτη; *(προφίλτρο — αφαιρεί, ποτέ δεν προσθέτει)* */
function mentionsMap(text) {
  return GUARDED_ROOTS.some((root) => text.includes(root)) || text.includes(BOUNDARY_MODULE);
}

/** Είναι αυτός ο ειδικευτής φυλασσόμενος; **Ρίζα ή υποδιαδρομή της** — ποτέ γειτνίαση. */
function guardedRootOf(spec) {
  return GUARDED_ROOTS.find((root) => spec === root || spec.startsWith(`${root}/`)) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Η ΚΡΙΣΗ ΕΝΟΣ ΑΡΧΕΙΟΥ
// ─────────────────────────────────────────────────────────────────────────────

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

/**
 * Οι εισαγωγές **τιμών** από φυλασσόμενο module — δηλαδή ό,τι επιβιώνει στον
 * περιηγητή και άρα μπορεί να ξεχάσει το φύλλο στυλ.
 *
 * ⚠️ Η **εισαγωγή παρενέργειας** (`import 'maplibre-gl/dist/maplibre-gl.css'`,
 * χωρίς clause) μετρά ως τιμή **επίτηδες**: είναι ακριβώς το αντίγραφο που ζούσε σε
 * τέσσερα αρχεία και άφηνε τον κοινό χάρτη ακάλυπτο.
 */
function rawValueImports(sourceFile) {
  const found = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const root = guardedRootOf(statement.moduleSpecifier.text);
    if (root === null) continue;

    const spec = statement.moduleSpecifier.text;
    const clause = statement.importClause;

    if (!clause) {
      found.push({ module: spec, symbol: '(παρενέργεια)', line: lineOf(sourceFile, statement) });
      continue;
    }
    if (clause.isTypeOnly) continue;
    if (clause.name) {
      found.push({ module: spec, symbol: `${clause.name.text} (default)`, line: lineOf(sourceFile, clause.name) });
    }
    const bindings = clause.namedBindings;
    if (!bindings) continue;
    if (ts.isNamespaceImport(bindings)) {
      found.push({ module: spec, symbol: `* as ${bindings.name.text}`, line: lineOf(sourceFile, bindings) });
      continue;
    }
    for (const element of bindings.elements) {
      if (element.isTypeOnly) continue;
      const imported = (element.propertyName ?? element.name).text;
      found.push({ module: spec, symbol: imported, line: lineOf(sourceFile, element) });
    }
  }
  return found;
}

/** Αγγίζει φυλασσόμενο module **μόνο** ως τύπο; */
function hasGuardedTypeImport(sourceFile) {
  return sourceFile.statements.some((s) => {
    if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier)) return false;
    if (guardedRootOf(s.moduleSpecifier.text) === null) return false;
    const clause = s.importClause;
    if (!clause) return false;
    if (clause.isTypeOnly) return true;
    const bindings = clause.namedBindings;
    return Boolean(
      bindings && ts.isNamedImports(bindings) && bindings.elements.some((e) => e.isTypeOnly),
    );
  });
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
 * Κρίνει **ένα** αρχείο. Επιστρέφει **πάντα** κατάσταση — ποτέ `undefined`: ο καλών
 * κλείνει τη λογιστική πάνω σε αυτήν.
 *
 * ⚠️ **Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ, ΟΧΙ ΤΥΧΑΙΑ.** Ένα αρχείο μπαίνει σε **έναν** κάδο,
 * και η προτεραιότητα είναι *παράβαση → ιδιοκτήτης → σύνορο → μόνο-τύποι → τίποτα*.
 * Ο `InteractiveMapPresentation` λ.χ. ζητά **και** το σύνορο **και** έναν τύπο ωμά:
 * είναι `at-boundary`, γιατί αυτό είναι το ερώτημα που κρίνεται.
 */
function judgeFile(repoRelPath, text, owners = RAW_IMPORT_OWNERS) {
  if (!mentionsMap(text)) return { state: STATES.NOT_A_MAP_FILE, hits: [] };

  const sourceFile = ts.createSourceFile(repoRelPath, text, ts.ScriptTarget.Latest, true);
  const raw = rawValueImports(sourceFile);

  // ⚠️ ΤΟ ΚΡΙΤΗΡΙΟ ΟΡΦΑΝΟΤΗΤΑΣ ΕΙΝΑΙ «ΑΝΑΦΕΡΕΙ», ΟΧΙ «ΕΙΣΑΓΕΙ» (μάθημα CHECK 3.61):
  //    ο ιδιοκτήτης κρίνεται εδώ ως ιδιοκτήτης ακόμα κι αν δεν εισάγει τιμή σήμερα.
  if (isRawImportOwner(repoRelPath, owners)) return { state: STATES.OWNER, hits: raw };

  if (raw.length > 0) return { state: STATES.BOUNDARY_BYPASS, hits: raw };
  if (importsBoundary(sourceFile)) return { state: STATES.AT_BOUNDARY, hits: [] };
  if (hasGuardedTypeImport(sourceFile)) return { state: STATES.TYPE_ONLY, hits: [] };
  return { state: STATES.NOT_A_MAP_FILE, hits: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ΤΟ ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ ΤΩΝ ΙΔΙΟΚΤΗΤΩΝ (Κ1′)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Κρίνει τις **δηλώσεις**, όχι τα αρχεία: *ορφανή* (το αρχείο έφυγε ή δεν αγγίζει πια
 * χάρτη) και *χωρίς λόγο*.
 *
 * 🔑 Χωρίς αυτό το κλειστό σύνολο **σαπίζει σιωπηλά** — κάθε νεκρή γραμμή είναι μια
 * πόρτα που μένει ανοιχτή χωρίς να τη θέλει κανείς (πρότυπο CHECK 3.50 · 3.59 · 3.61).
 */
function judgeOwners(root, owners = RAW_IMPORT_OWNERS) {
  const verdicts = [];
  for (const [rel, reason] of Object.entries(owners)) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full) || !mentionsMap(fs.readFileSync(full, 'utf8'))) {
      verdicts.push({
        rel,
        state: STATES.ORPHAN_OWNER,
        detail: 'η δήλωση δείχνει σε αρχείο που δεν υπάρχει ή δεν αγγίζει πια χάρτη',
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
// 4. ΤΟ ΙΔΙΟ ΤΟ ΣΥΝΟΡΟ (Κ2 + Κ3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ρωτά **το σύνορο για τον εαυτό του**: υπάρχει; κατέχει το φύλλο στυλ; το ζητά κόσμος;
 *
 * ⚠️ Ο έλεγχος του φύλλου στυλ γίνεται με **AST**, όχι με `includes`: το ίδιο αρχείο
 * **γράφει τη διαδρομή του σε πρόζα** τρεις φορές, εξηγώντας γιατί υπάρχει. Ένα
 * `text.includes(...)` θα έμενε πράσινο ακόμα κι αν η **εισαγωγή** είχε σβηστεί και
 * είχε μείνει μόνο το σχόλιο — δηλαδή θα φύλαγε την **τεκμηρίωση** της θεραπείας
 * αντί για τη θεραπεία.
 */
function judgeBoundarySelf(root, consumerCount, boundaryFile = BOUNDARY_FILE) {
  const full = path.join(root, boundaryFile);
  if (!fs.existsSync(full)) {
    return [{
      rel: boundaryFile,
      state: BOUNDARY_STATES.BOUNDARY_ABSENT,
      detail: 'το αρχείο του συνόρου δεν υπάρχει',
    }];
  }

  const verdicts = [];
  const sourceFile = ts.createSourceFile(
    boundaryFile,
    fs.readFileSync(full, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const ownsStylesheet = sourceFile.statements.some(
    (s) =>
      ts.isImportDeclaration(s) &&
      !s.importClause &&
      ts.isStringLiteral(s.moduleSpecifier) &&
      s.moduleSpecifier.text === REQUIRED_STYLESHEET,
  );
  if (!ownsStylesheet) {
    verdicts.push({
      rel: boundaryFile,
      state: BOUNDARY_STATES.STYLESHEET_MISSING,
      detail: `λείπει η εισαγωγή \`${REQUIRED_STYLESHEET}\` — το σύνορο δεν κατέχει ό,τι υπόσχεται`,
    });
  }
  if (consumerCount === 0) {
    verdicts.push({
      rel: boundaryFile,
      state: BOUNDARY_STATES.BOUNDARY_ABANDONED,
      detail: 'κανένα αρχείο δεν ζητά τον χάρτη από το σύνορο — πράσινο με μηδέν προστασία',
    });
  }
  return verdicts;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Η ΛΟΓΙΣΤΙΚΗ — fail-closed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Σαρώνει **ΟΛΟ** το δέντρο και κλείνει και τα **τρία** κατάστιχα.
 *
 * ⚠️ **ΠΑΝΤΑ ΠΛΗΡΗΣ, ΠΟΤΕ ΜΟΝΟ ΣΤΑΔΙΟΠΟΙΗΜΕΝΑ**: η αφαίρεση μιας δήλωσης ιδιοκτήτη
 * ή του τελευταίου καταναλωτή **ξανα-ταξινομεί αρχεία που κανείς δεν έστειλε**. Όταν
 * το πλήρες είναι φθηνό, η μερική ανάλυση δεν είναι βελτιστοποίηση — είναι δεύτερη
 * αυθεντία που αποκλίνει σιωπηλά, χωρίς αντάλλαγμα.
 */
function sweep(root, owners = RAW_IMPORT_OWNERS) {
  const files = collectSourceFiles(path.join(root, 'src'));
  const fileTally = Object.fromEntries(FILE_STATES.map((s) => [s, 0]));
  const violations = [];

  for (const full of files) {
    const rel = repoRelativePosix(full, root);
    const verdict = judgeFile(rel, fs.readFileSync(full, 'utf8'), owners);
    if (!Object.hasOwn(fileTally, verdict.state)) {
      throw new Error(`[3.75] ΑΓΝΩΣΤΗ κατάσταση αρχείου "${verdict.state}" για ${rel}.`);
    }
    fileTally[verdict.state] += 1;
    if (verdict.state === STATES.BOUNDARY_BYPASS) {
      for (const hit of verdict.hits) {
        violations.push({
          rel,
          state: verdict.state,
          detail: `ωμό \`${hit.symbol}\` από \`${hit.module}\` (γρ. ${hit.line})`,
        });
      }
    }
  }

  // 🔑 ΔΕΥΤΕΡΟ ΚΑΤΑΣΤΙΧΟ — ΟΙ ΔΗΛΩΣΕΙΣ, ΟΧΙ ΤΑ ΑΡΧΕΙΑ (πρότυπο CHECK 3.50 · 3.61).
  //    Ένα κοινό κατάστιχο θα ΔΙΠΛΟΜΕΤΡΟΥΣΕ: ιδιοκτήτης χωρίς λόγο είναι ΚΑΙ αρχείο
  //    `owner` ΚΑΙ δήλωση `reasonless-owner`.
  const ownerTally = Object.fromEntries(OWNER_STATES.map((s) => [s, 0]));
  const declared = Object.keys(owners);
  const flaggedOwners = judgeOwners(root, owners);
  for (const v of flaggedOwners) {
    if (!Object.hasOwn(ownerTally, v.state)) {
      throw new Error(`[3.75] ΑΓΝΩΣΤΗ κατάσταση δήλωσης "${v.state}" για ${v.rel}.`);
    }
    ownerTally[v.state] += 1;
    violations.push(v);
  }
  ownerTally[STATES.OWNER] = declared.length - flaggedOwners.length;

  // 🔑 ΤΡΙΤΟ ΚΑΤΑΣΤΙΧΟ — ΤΟ ΙΔΙΟ ΤΟ ΣΥΝΟΡΟ (Κ2 + Κ3).
  const selfTally = Object.fromEntries(SELF_STATES.map((s) => [s, 0]));
  const flaggedSelf = judgeBoundarySelf(root, fileTally[STATES.AT_BOUNDARY]);
  for (const v of flaggedSelf) {
    if (!Object.hasOwn(selfTally, v.state)) {
      throw new Error(`[3.75] ΑΓΝΩΣΤΗ κατάσταση συνόρου "${v.state}".`);
    }
    selfTally[v.state] += 1;
    violations.push(v);
  }
  if (flaggedSelf.length === 0) selfTally[BOUNDARY_STATES.BOUNDARY_HEALTHY] = 1;

  const countedFiles = Object.values(fileTally).reduce((a, b) => a + b, 0);
  if (countedFiles !== files.length) {
    throw new Error(`[3.75] Η ΛΟΓΙΣΤΙΚΗ ΑΡΧΕΙΩΝ ΔΕΝ ΚΛΕΙΝΕΙ: ${countedFiles} ≠ ${files.length}.`);
  }
  const countedOwners = Object.values(ownerTally).reduce((a, b) => a + b, 0);
  if (countedOwners !== declared.length) {
    throw new Error(`[3.75] Η ΛΟΓΙΣΤΙΚΗ ΔΗΛΩΣΕΩΝ ΔΕΝ ΚΛΕΙΝΕΙ: ${countedOwners} ≠ ${declared.length}.`);
  }

  return {
    fileTally,
    ownerTally,
    selfTally,
    violations,
    population: files.length,
    declared: declared.length,
    consumers: fileTally[STATES.AT_BOUNDARY],
  };
}

module.exports = {
  BLOCKING,
  FILE_STATES,
  GUARDED_ROOTS,
  MIN_REASON,
  OWNER_STATES,
  SELF_STATES,
  collectSourceFiles,
  guardedRootOf,
  judgeBoundarySelf,
  judgeFile,
  judgeOwners,
  mentionsMap,
  rawValueImports,
  sweep,
};
