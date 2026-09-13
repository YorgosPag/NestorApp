/**
 * ΣΑΡΩΤΗΣ ΤΑΥΤΟΤΗΤΑΣ ΠΡΟΪΟΝΤΟΣ (ADR-857 Φ8 / CHECK 3.81)
 *
 * «Λέει κάθε σημείο που ονομάζει το ΠΡΟΪΟΝ το ΙΔΙΟ όνομα — και είναι κάθε ΑΛΛΗ
 * χρήση δηλωμένη, με λόγο;»
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ AST ΚΑΙ ΟΧΙ ΚΕΙΜΕΝΟ — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΠΡΟΤΙΜΗΣΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Στο ΙΔΙΟ δέντρο υπάρχουν ΤΕΣΣΕΡΑ σημεία που γράφουν παλιές γραφές ΜΕΣΑ ΣΕ
 * ΣΧΟΛΙΟ, και κανένα δεν είναι παράβαση — το ένα είναι μάλιστα το σχόλιο που
 * ΤΕΚΜΗΡΙΩΝΕΙ τη διόρθωση (`app/layout.tsx`). Σαρωτής κειμένου θα κοκκίνιζε πάνω
 * στη ΘΕΡΑΠΕΙΑ: σχήμα Κ7β του CHECK 3.50, Κ5 του CHECK 3.73.
 *
 * 🏆 ΚΑΙ ΕΔΩ ΞΕΠΕΡΝΑΜΕ ΤΟ ΟΙΚΟΣΥΣΤΗΜΑ (έρευνα 2026-09-13): το **Vale** — ο prose
 * linter που χρησιμοποιούν Microsoft, GitLab, Mozilla, Red Hat, Linux Foundation —
 * έχει ΑΚΡΙΒΩΣ αυτόν τον κανόνα (`substitution`: «use X instead of Y»), αλλά
 * ανασηκώνει με tree-sitter **μόνο σχόλια και docstrings** και αφήνει ρητά τα
 * string literals ως κώδικα. Δηλαδή κοιτάζει ακριβώς τα τέσσερα αθώα σημεία και
 * είναι **δομικά τυφλό** ακριβώς εκεί όπου έζησαν **και οι έξι** λάθος γραφές.
 * Το typescript-eslint (100+ κανόνες) δεν έχει κανέναν για όρους μέσα σε literals.
 * Το μοντέλο «κανονική + αποσυρμένες γραφές» έχει πρότυπο όνομα (term status του
 * **ISO 30042 TBX**: preferred/admitted/deprecated) — που όμως είναι πρότυπο
 * ΑΝΤΑΛΛΑΓΗΣ ορολογίας, χωρίς κανέναν μηχανισμό επιβολής σε πηγαίο κώδικα.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΔΥΟ ΚΑΝΟΝΕΣ, ΚΑΙ Η ΔΙΑΦΟΡΑ ΕΙΝΑΙ ΔΟΜΙΚΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * ΚΩΔΙΚΑΣ: ΚΑΘΕ γραφή σε literal είναι εύρημα, **ακόμα και η σωστή** — ο κώδικας
 * ΜΠΟΡΕΙ να εισάγει τη ρίζα, άρα ωμό `"Nestor App"` είναι δεύτερη πηγή.
 * LOCALES: εύρημα είναι ΜΟΝΟ γραφή που ΔΕΝ είναι η κανονική — ένα locale ΔΕΝ
 * μπορεί να εισάγει σταθερά, και το ICU `{appName}` απορρίφθηκε ρητά στη Φ4.
 * ⚠️ Το JSON **δεν έχει σύνταξη σχολίου**, άρα εκεί ο κίνδυνος του Vale δεν
 * υπάρχει και η ανάγνωση κειμένου είναι ασφαλής — για τον κώδικα δεν είναι.
 *
 * @module scripts/lib/product-identity/scan
 */
'use strict';

const path = require('path');
const ts = require(path.join(process.cwd(), 'node_modules', 'typescript'));

/** Κάθε ρητή κατάσταση. Καμία σιωπηλή απόρριψη. */
const STATES = {
  ROOT: 'root',
  DECLARED: 'declared',
  CANONICAL: 'canonical',
  UNDECLARED_WRITING: 'undeclared-writing',
  ORPHAN_DECLARATION: 'orphan-declaration',
  REASONLESS_DECLARATION: 'reasonless-declaration',
  ROOT_DRIFT: 'root-drift',
};

/**
 * ⛔ Τα ΤΕΣΣΕΡΑ κριτήρια, ΠΟΤΕ ενωμένα με «ή» (μάθημα CHECK 3.41):
 *   Κ1 `undeclared-writing`      — γραφή που δεν είναι στη ρίζα ούτε δηλωμένη
 *   Κ2 `orphan-declaration`      — δήλωση που δεν προστατεύει τίποτα πια
 *   Κ3 `reasonless-declaration`  — δήλωση χωρίς λόγο ⇒ λίστα, όχι απόφαση
 *   Κ4 `root-drift`              — η ρίζα δεν λέει πια αυτό που υποθέτει το μητρώο
 * Τυπώνονται ΠΑΝΤΑ, ακόμα και στο μηδέν (μάθημα CHECK 3.48).
 */
const BLOCKING = [
  STATES.UNDECLARED_WRITING,
  STATES.ORPHAN_DECLARATION,
  STATES.REASONLESS_DECLARATION,
  STATES.ROOT_DRIFT,
];

const MIN_REASON = 40;

// ============================================================================
// Η ΡΙΖΑ — οι τιμές διαβάζονται ΑΠΟ ΤΟΝ ΚΩΔΙΚΑ, ποτέ από αντίγραφο στο μητρώο
// ============================================================================

/** Η τιμή ενός `export const X = '…'` ή `export const X = ['…', …]`. */
function literalValueOf(node) {
  const init = node.initializer;
  if (!init) return undefined;
  if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) return init.text;
  const unwrapped = ts.isAsExpression(init) || ts.isSatisfiesExpression(init) ? init.expression : init;
  if (ts.isArrayLiteralExpression(unwrapped)) {
    return unwrapped.elements.filter(ts.isStringLiteral).map((e) => e.text);
  }
  return undefined;
}

/**
 * Διαβάζει τη ρίζα. **Κ4**: ό,τι λείπει ή άλλαξε σχήμα είναι `root-drift` —
 * fail-closed, γιατί κάθε άλλη ετυμηγορία θα κρινόταν έναντι άγνωστου συνόλου.
 */
function readRoot(rootText, rootFile, canonical) {
  const sf = ts.createSourceFile(rootFile, rootText, ts.ScriptTarget.Latest, true);
  const found = {};
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const value = literalValueOf(node);
      if (value !== undefined) found[node.name.text] = value;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);

  const product = found[canonical.productSymbol];
  const legal = found[canonical.legalSymbol];
  const past = found[canonical.pastSpellingsSymbol];

  if (typeof product !== 'string') return { ok: false, reason: `το «${canonical.productSymbol}» δεν βρέθηκε ως συμβολοσειρά` };
  if (typeof legal !== 'string') return { ok: false, reason: `το «${canonical.legalSymbol}» δεν βρέθηκε ως συμβολοσειρά` };
  if (!Array.isArray(past) || past.length === 0) return { ok: false, reason: `το «${canonical.pastSpellingsSymbol}» δεν βρέθηκε ως μη κενός πίνακας` };

  // ⚠️ ΤΑΞΙΝΟΜΗΣΗ ΚΑΤΑ ΜΗΚΟΣ, ΦΘΙΝΟΥΣΑ, ΚΑΙ ΕΙΝΑΙ ΑΠΑΡΑΙΤΗΤΗ: το 'Nestor' είναι
  //    ΠΡΟΘΕΜΑ του 'Nestor App' και του 'Nestor Pagonis'. Χωρίς «το μακρύτερο
  //    πρώτα», κάθε σωστή γραφή θα μετριόταν ΚΑΙ ως παλιά — δηλαδή η πύλη θα
  //    κατηγορούσε τη θεραπεία. Η ίδια η ρίζα το προειδοποιεί στο σχόλιό της.
  const spellings = [...new Set([product, legal, ...past])].sort((a, b) => b.length - a.length);
  return { ok: true, product, legal, past, spellings };
}

// ============================================================================
// ΤΑΙΡΙΑΣΜΑ — «το μακρύτερο πρώτα», με ΜΑΣΚΑ ώστε καμία γραφή να μη μετρηθεί δις
// ============================================================================

/**
 * Ποιες γραφές περιέχει αυτό το κείμενο. Κάθε ταίριασμα **μασκάρεται**, ώστε το
 * `'Nestor App'` να μετρηθεί **μία** φορά ως κανονικό και **ΟΧΙ** δεύτερη ως
 * σκέτο `'Nestor'`.
 *
 * ⚠️ Χωρίς RegExp χτισμένη από συμβολοσειρά, ΕΠΙΤΗΔΕΣ: το CHECK 3.73 γεννήθηκε
 * σπασμένο ακριβώς έτσι (`\b` μέσα σε template literal είναι BACKSPACE, U+0008),
 * και το ίδιο ελάττωμα τεκμηριώνει και το CHECK 3.56. Εδώ γίνεται σκέτο
 * `indexOf` σε αντίγραφο που μασκάρεται — καμία κανονική έκφραση.
 */
function spellingsIn(text, spellings) {
  let masked = text;
  const hits = [];
  for (const spelling of spellings) {
    let at = masked.indexOf(spelling);
    while (at !== -1) {
      hits.push(spelling);
      masked = masked.slice(0, at) + ' '.repeat(spelling.length) + masked.slice(at + spelling.length);
      at = masked.indexOf(spelling);
    }
  }
  return hits;
}

// ============================================================================
// ΚΩΔΙΚΑΣ — AST, parse-only (N.17: ΠΟΤΕ `ts.Program`)
// ============================================================================

/**
 * Κάθε κόμβος που κουβαλά κείμενο **το οποίο βλέπει άνθρωπος ή αρχείο**.
 *
 * 🔑 Το `JsxText` μπαίνει ΕΠΙΤΗΔΕΣ: το CLAUDE.md N.11 δηλώνει μετρημένα ότι ο
 * `no-hardcoded-strings` είναι **δομικά τυφλός** σε ωμό κείμενο μέσα σε JSX
 * (`<Button>Αποθήκευση</Button>`). Ένα `<span>Nestor App</span>` είναι ακριβώς
 * το ίδιο σχήμα, και καμία άλλη πύλη δεν το βλέπει.
 */
function textCarryingNodes(sf) {
  const out = [];
  const visit = (node) => {
    if (
      ts.isStringLiteral(node)
      || ts.isNoSubstitutionTemplateLiteral(node)
      || ts.isTemplateHead(node)
      || ts.isTemplateMiddle(node)
      || ts.isTemplateTail(node)
      || ts.isJsxText(node)
    ) {
      out.push(node);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  return out;
}

/** Σάρωση ενός αρχείου κώδικα. Επιστρέφει μία εγγραφή ανά ταίριασμα. */
function scanCodeFile(file, text, spellings, relPath) {
  const sf = ts.createSourceFile(
    file, text, ts.ScriptTarget.Latest, true,
    /\.tsx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found = [];
  for (const node of textCarryingNodes(sf)) {
    for (const spelling of spellingsIn(node.text, spellings)) {
      found.push({
        file: relPath,
        spelling,
        line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        excerpt: node.text.trim().slice(0, 60),
      });
    }
  }
  return found;
}

// ============================================================================
// LOCALES — κείμενο, και είναι ΑΣΦΑΛΕΣ: το JSON δεν έχει σύνταξη σχολίου
// ============================================================================

/**
 * Σάρωση ενός locale JSON. Κοιτάζει **μόνο την τιμή**, ποτέ το κλειδί: ένα
 * κλειδί `nestorApp1` είναι αναγνωριστικό μετάφρασης, όχι γραφή προς άνθρωπο.
 *
 * ⚠️ Εύρημα είναι ΜΟΝΟ γραφή διαφορετική από την κανονική — δες την κεφαλίδα.
 */
function scanLocaleFile(text, spellings, canonicalName, relPath) {
  const found = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const colon = lines[i].indexOf('":');
    const value = colon === -1 ? lines[i] : lines[i].slice(colon + 2);
    for (const spelling of spellingsIn(value, spellings)) {
      if (spelling === canonicalName) continue;
      found.push({ file: relPath, spelling, line: i + 1, excerpt: value.trim().slice(0, 60) });
    }
  }
  return found;
}

module.exports = {
  STATES,
  BLOCKING,
  MIN_REASON,
  readRoot,
  literalValueOf,
  spellingsIn,
  textCarryingNodes,
  scanCodeFile,
  scanLocaleFile,
};
