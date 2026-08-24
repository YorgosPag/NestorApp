/**
 * CHECK 3.65 — ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΗΣ ΜΙΑΣ ΕΚΔΟΣΗΣ (ADR-800)
 *
 * Καταστάσεις, κριτήριο «διανεμητέο vs εσωτερικό», και ο αναγνώστης του κλειστού
 * συνόλου εξαιρέσεων. **Καμία κρίση εδώ** — η κρίση ζει στο `gate.js`.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

/** Το κλειστό σύνολο εξαιρέσεων ζει σε JSON στη ρίζα (πρότυπο 3.58/3.60/3.63). */
const DECLARATIONS_FILE = '.one-version.json';

/** Ο λόγος είναι ΥΠΟΧΡΕΩΤΙΚΟΣ και ουσιαστικός (πρότυπο 3.61: ≥40 χαρακτήρες). */
const MIN_REASON_LENGTH = 40;

const GATE_STATES = Object.freeze({
  // ── Α · ΟΝΟΜΑΤΑ ΠΑΚΕΤΩΝ ────────────────────────────────────────────────────
  /** ⛔ Το ίδιο όνομα **εγκαταστάθηκε** σε >1 έκδοση μέσα στο workspace. */
  VERSION_SPLIT: 'version-split',
  /** ⛔ Το ίδιο όνομα **δηλώνεται** από >1 εσωτερικό μέλος, χωρίς δήλωση. */
  REDECLARED: 'redeclared-dependency',
  /** ✅ Κοινή δήλωση, εγκεκριμένη ρητά στο κλειστό σύνολο. */
  DECLARED_SHARED: 'declared-shared',
  /** ✅ Το δηλώνει **διανεμητέο** πακέτο — οφείλει να δηλώνει ό,τι εισάγει. */
  DISTRIBUTABLE_OWNED: 'distributable-owned',
  /** ✅ Ένα σημείο δήλωσης — η υγιής πλειοψηφία. */
  SINGLE_SITE: 'single-site',

  // ── Β · ΔΗΛΩΣΕΙΣ ΜΕΛΩΝ ─────────────────────────────────────────────────────
  /** ⛔ Το manifest λέει άλλο εύρος από αυτό με το οποίο εγκαταστάθηκε. */
  OVERRIDDEN_DECLARATION: 'overridden-declaration',
  /** ✅ Το manifest λέει ακριβώς ό,τι έγινε. */
  HONOURED: 'honoured',

  // ── Γ · ΜΕΛΗ ΤΟΥ WORKSPACE ─────────────────────────────────────────────────
  /** ⛔ `package.json` μέσα στα globs που ΔΕΝ είναι importer του lockfile. */
  UNLISTED_MANIFEST: 'unlisted-manifest',
  /** ⛔ importer του lockfile χωρίς manifest στον δίσκο. */
  ORPHAN_IMPORTER: 'orphan-importer',
  /** ⛔ Το σύνολο ονομάτων manifest ≠ lockfile ⇒ κάποιος ξέχασε `pnpm install`. */
  LOCKFILE_DESYNC: 'lockfile-desync',
  /** ✅ Μέλος με συμφωνημένη απογραφή. */
  IN_CENSUS: 'in-census',

  // ── Δ · ΚΑΤΑΛΟΓΟΣ ──────────────────────────────────────────────────────────
  /** ⛔ Εγγραφή `catalog:` που δεν τη ζητά κανένα manifest = διακοσμητική. */
  UNREFERENCED_CATALOG: 'unreferenced-catalog-entry',
  /** ✅ Εγγραφή καταλόγου με τουλάχιστον έναν καταναλωτή. */
  CATALOG_REFERENCED: 'catalog-referenced',

  // ── Ε · ΕΞΑΙΡΕΣΕΙΣ ─────────────────────────────────────────────────────────
  /** ⛔ Δήλωση που δεν εξαιρεί τίποτα πια — σβήσ' την (πρότυπο 3.50). */
  ORPHAN_DECLARATION: 'orphan-declaration',
  /** ⛔ Δήλωση χωρίς ουσιαστικό λόγο. */
  REASONLESS_DECLARATION: 'reasonless-declaration',
  /** ✅ Δήλωση που όντως εξαιρεί κάτι, με λόγο. */
  DECLARATION_USED: 'declaration-used',
});

/**
 * 🔑 ΤΟ ΚΡΙΤΗΡΙΟ ΕΙΝΑΙ ΠΑΡΑΓΟΜΕΝΟ, ΟΧΙ ΧΕΙΡΟΓΡΑΦΟ.
 *
 * «Διανεμητέο» = ό,τι μπορεί να εγκατασταθεί **μόνο του** από άλλον. Τότε — και
 * μόνο τότε — οφείλει να δηλώνει **ό,τι εισάγει**, αλλιώς σπάει στον καταναλωτή
 * του· αυτό είναι το συμβόλαιο του npm και το επιχείρημα του Rush κατά των
 * *phantom dependencies*.
 *
 * «Εσωτερικό» = `private: true` **και** κανένα σημείο εισόδου. Δεν εγκαθίσταται
 * ποτέ μόνο του: μεταγλωττίζεται **μέσα** στην εφαρμογή της ρίζας. Εκεί ισχύει ο
 * One Version Rule της Google στην αυστηρή του μορφή — **ένα** σημείο δήλωσης.
 *
 * ⚠️ ΠΟΤΕ χειρόγραφη λίστα μελών: το σχήμα απέτυχε μετρημένα σε CHECK 3.34 (**63**
 * απόκλιση) · 3.37 (**18 vs 26**) · 3.49 (**60**) · 3.57 (**19/20**). Εδώ η
 * απάντηση βγαίνει από πεδία που το ίδιο το manifest **ήδη δηλώνει**.
 */
function isDistributable(manifest) {
  return manifest.private !== true || hasEntryPoint(manifest);
}

/**
 * Τα σημεία εισόδου που κάνουν ένα πακέτο χρησιμοποιήσιμο **από τρίτον**.
 *
 * ⚠️ Το `private: true` **μόνο του δεν αρκεί**: ένα ιδιωτικό πακέτο που εξάγει
 * `main`/`exports` καταναλώνεται ως πακέτο μέσα στο workspace (`workspace:*`),
 * άρα οφείλει κι αυτό να δηλώνει ό,τι εισάγει.
 */
function hasEntryPoint(manifest) {
  return Boolean(manifest.main || manifest.module || manifest.exports || manifest.bin || manifest.types);
}

/**
 * Διαβάζει το κλειστό σύνολο. **Fail-closed**: κακοσχηματισμένο αρχείο ⇒ σφάλμα
 * με όνομα, ποτέ σιωπηλό `{}` (μάθημα CHECK 3.57 `Μ0.2`: κενό αντικείμενο κάνει
 * κάθε σύγκριση να περνά και την πύλη **μονίμως πράσινη**).
 */
function loadDeclarations(repoRoot) {
  const file = path.join(repoRoot, DECLARATIONS_FILE);
  if (!fs.existsSync(file)) {
    throw new Error(`${DECLARATIONS_FILE} λείπει — το κλειστό σύνολο είναι μέρος της πύλης, όχι προαιρετικό.`);
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!raw || typeof raw !== 'object' || typeof raw.sharedDependencies !== 'object' || raw.sharedDependencies === null) {
    throw new Error(`${DECLARATIONS_FILE}: περίμενα αντικείμενο "sharedDependencies".`);
  }
  return raw.sharedDependencies;
}

module.exports = {
  DECLARATIONS_FILE,
  MIN_REASON_LENGTH,
  GATE_STATES,
  isDistributable,
  hasEntryPoint,
  loadDeclarations,
};
