/**
 * CHECK 3.65 — ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΗΣ ΜΙΑΣ ΕΚΔΟΣΗΣ (ADR-800)
 *
 * Καταστάσεις, κριτήριο «διανεμητέο vs εσωτερικό», και ο αναγνώστης του κλειστού
 * συνόλου εξαιρέσεων. **Καμία κρίση εδώ** — η κρίση ζει στο `gate.js`.
 */

'use strict';

const { openGateInput } = require('../gate-input');

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

  // ── ΣΤ · ΕΡΓΑΛΕΙΑ CI (ADR-875 §12) — ό,τι εγκαθίσταται ολικά και ΔΕΝ ζει στο lockfile ──
  /** ⛔ Εγκατάσταση του εργαλείου σε workflow έξω από τον ιδιοκτήτη του. */
  CI_TOOL_BYPASS: 'ci-tool-bypass',
  /** ⛔ Γραμμένη έκδοση (`εργαλείο@1.2.3`) στο `.github/` — δεύτερη αλήθεια. */
  CI_TOOL_VERSION_LITERAL: 'ci-tool-version-literal',
  /** ⛔ Η αυθεντία δεν διαβάζεται, ο ιδιοκτήτης λείπει ή δεν τη διαβάζει, ή η δήλωση δεν έχει λόγο. */
  CI_TOOL_OWNER_BROKEN: 'ci-tool-owner-broken',
  /** ✅ Ο ιδιοκτήτης — το ΕΝΑ σημείο εγκατάστασης. */
  CI_TOOL_OWNER: 'ci-tool-owner',
  /** ✅ Workflow που ζητά τον ιδιοκτήτη. */
  CI_TOOL_VIA_OWNER: 'ci-tool-via-owner',

  // ── Ζ · ΚΑΤΟΧΟΙ ΚΑΘΟΛΙΚΗΣ ΣΤΟΙΒΑΣ (ADR-915 §15) — σε ΟΛΟ τον γράφο, όχι μόνο άμεσες ──
  /** ⛔ Κάτοχος κατάστασης επιπέδου module επιλύθηκε σε >1 έκδοση ⇒ δύο στοίβες. */
  SINGLETON_SPLIT: 'singleton-split',
  /** ⛔ Δηλωμένος κάτοχος που δεν υπάρχει στο lockfile — τυπογραφικό ή νεκρή δήλωση. */
  SINGLETON_ABSENT: 'singleton-absent',
  /** ⛔ Δήλωση κατόχου χωρίς τη μεταβλητή που τον κάνει μοναδικό, ή χωρίς λόγο. */
  SINGLETON_REASONLESS: 'singleton-reasonless',
  /** ✅ Μία επιλυμένη έκδοση. */
  SINGLETON_ONE: 'singleton-one',
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
function loadDeclarations(repoRoot, input = openGateInput({ root: repoRoot })) {
  const text = input.read(DECLARATIONS_FILE);
  if (text === null) {
    throw new Error(`${DECLARATIONS_FILE} λείπει — το κλειστό σύνολο είναι μέρος της πύλης, όχι προαιρετικό.`);
  }
  const raw = JSON.parse(text);
  if (!raw || typeof raw !== 'object' || typeof raw.sharedDependencies !== 'object' || raw.sharedDependencies === null) {
    throw new Error(`${DECLARATIONS_FILE}: περίμενα αντικείμενο "sharedDependencies".`);
  }
  return raw.sharedDependencies;
}

/** Ζ — το κλειστό σύνολο κατόχων καθολικής στοίβας. Fail-closed όπως το `loadDeclarations`. */
function loadSingletons(repoRoot, input = openGateInput({ root: repoRoot })) {
  const raw = input.readJson(DECLARATIONS_FILE);
  if (!raw || typeof raw.singletons !== 'object' || raw.singletons === null || Array.isArray(raw.singletons)) {
    throw new Error(`${DECLARATIONS_FILE}: περίμενα αντικείμενο "singletons" (κάτοχοι καθολικής στοίβας).`);
  }
  return raw.singletons;
}

module.exports = {
  loadSingletons,
  DECLARATIONS_FILE,
  MIN_REASON_LENGTH,
  GATE_STATES,
  isDistributable,
  hasEntryPoint,
  loadDeclarations,
};
