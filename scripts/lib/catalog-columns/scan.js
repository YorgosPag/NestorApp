/**
 * **Η ΜΗΧΑΝΗ ΤΟΥ CHECK 3.55** — ADR-784.
 *
 * Ένα ερώτημα: **«ρωτά αυτό το πλέγμα το ΠΑΡΑΘΥΡΟ για κάτι που είναι ΚΑΤΑΛΟΓΟΣ;»**
 *
 * ── ΓΙΑΤΙ ΤΟ ΚΡΙΤΗΡΙΟ ΕΙΝΑΙ ΤΑ ΠΑΙΔΙΑ ΚΑΙ ΟΧΙ ΤΟ ΑΡΧΕΙΟ ──
 *
 * Μια σκάλα breakpoint **δεν είναι λάθος από μόνη της**. Μια σειρά τεσσάρων πλακιδίων KPI
 * θέλει **ακριβώς τέσσερις** στήλες· εκεί ο εγγενής κατάλογος θα ήταν λάθος. Το λάθος
 * γεννιέται όταν το πλήθος των παιδιών είναι **άγνωστο** — δηλαδή όταν προέρχονται από
 * `.map()` πάνω σε συλλογή — και παρ' όλα αυτά το πλήθος στηλών αποφασίζεται από το πλάτος
 * **του παραθύρου**, που δεν έχει καμία σχέση με το πλάτος **του δοχείου**.
 *
 * ⚠️ **ΜΗΝ το κάνεις κριτήριο επιπέδου αρχείου.** Μετρήθηκε: **106** από τα 160 αρχεία
 * έχουν κάπου ένα `.map()`, αλλά ανάμεσά τους το `StorageFormBasicInfo` (φόρμα δύο στηλών)
 * και το `StorageTabFilters` (σειρά πέντε φίλτρων) είναι **νόμιμα** σταθερής αρίτητας. Ένα
 * κριτήριο αρχείου θα τα έβαφε παραβάτες. Είναι **ακριβώς** το μάθημα του CHECK 3.35: το
 * `contacts-query.service.ts` είχε 6 συναρτήσεις, 5 σωστές και 1 όχι, και το κριτήριο
 * αρχείου θα έβαφε πράσινη τη σπασμένη.
 *
 * ── 🏆 ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ ──
 *
 * Το **Fluent 2** της Microsoft ορίζει ρητά container-based responsive («μια Card
 * προσαρμόζεται στο πλάτος **του δοχείου** της, ώστε να δουλεύει σε full-width, σε
 * split-view panel και σε Teams tab **χωρίς media query overrides**») — αλλά το **περιγράφει**.
 * Ο codemod της **Atlassian** «προτείνει μόνο· **απαιτείται χειροκίνητος έλεγχος**».
 * **Κανένας** linter της βιομηχανίας δεν επιβάλλει τη διάκριση (ανοιχτό αίτημα stylelint
 * #7635). Εδώ ο ταξινομητής **αποφασίζει** τα αποφασίσιμα και **ονομάζει** τα υπόλοιπα —
 * αυτό είναι το βήμα πέρα από «απαιτείται χειροκίνητος έλεγχος για όλα».
 *
 * ⚠️ Και το ζητούμενο **δεν** είναι container queries: η Atlassian τα **απαγορεύει**
 * (`no-container-queries`). Ο εγγενής κατάλογος δεν **ρωτά** το δοχείο — το **χωράει**.
 *
 * @module scripts/lib/catalog-columns/scan
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

/** Σκάλα breakpoint: κάθε πρόθεμα οθόνης του Tailwind πάνω σε πλήθος στηλών. */
const LADDER = /\b(?:sm|md|lg|xl|2xl):grid-cols-\d/;

/** Το εγγενές ίχνος — είτε ωμό είτε μέσω του SSoT. */
const INTRINSIC = /repeat\(auto-fill|gridPatterns\.cards\.(?:media|tile)/;

/** Δηλώνει αυτό το className πλέγμα με στήλες; (η **εμβέλεια** της πύλης) */
const DECLARES_COLUMNS = /grid-cols-|gridPatterns\.cards/;

/**
 * Οι καταστάσεις. **Ακριβώς μία** ανά πλέγμα, πάντα.
 *
 * ⚠️ Μόνο η πρώτη μπλοκάρει. Οι υπόλοιπες **δεν** είναι «λιγότερο κακές» — είναι
 * **σωστές**: μια σταθερή αρίτητα που δηλώνει σκάλα κάνει ακριβώς τη δουλειά της.
 */
const RATCHETED_STATES = ['catalog-window-ladder'];
const CLEAN_STATES = [
  'catalog-intrinsic',
  'catalog-single-column',
  'fixed-arity-ladder',
  'fixed-arity-plain',
];
const DECLARED_GAPS = [
  'catalog-unresolved-classname',
  'catalog-imported-collection',
  'catalog-exempt',
];

/**
 * Εξαίρεση **με ΥΠΟΧΡΕΩΤΙΚΟ λόγο** — πρότυπο CHECK 3.35 (`tenant-scope-exempt`) και 3.42
 * (`theme-exempt`).
 *
 * ⚠️ **Γιατί χρειάζεται:** μετρήθηκε ότι το `AdvancedFiltersPanel` κάνει `row.fields.map(…)`
 * — **σειρά πεδίων φίλτρου** μεταβλητού πλήθους. Είναι όντως «άγνωστο πλήθος που ρωτά το
 * παράθυρο», αλλά η θεραπεία του καταλόγου (ελάχιστο πλάτος **κάρτας**) δεν του ταιριάζει:
 * ένα πεδίο φόρμας δεν είναι κάρτα. Χωρίς εξαίρεση, η πύλη θα πίεζε προς **λάθος**
 * θεραπεία — και μια πύλη που πυροδοτεί σε σωστό κώδικα είναι ο δρόμος προς το `SKIP_`.
 *
 * ⚠️ Ο λόγος είναι **υποχρεωτικός**: σκέτο `// catalog-exempt` **δεν** αναγνωρίζεται. Μια
 * εξαίρεση χωρίς λόγο είναι σιωπή με άλλο όνομα.
 */
/**
 * ⚠️ **Ο ΛΟΓΟΣ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΕΙΝΑΙ ΤΟ ΚΛΕΙΣΙΜΟ ΤΟΥ ΣΧΟΛΙΟΥ.** Η πρώτη γραφή ήταν
 * `\s*\S+` και στο `catalog-exempt: *​/` το `\S+` κατανάλωνε το **ίδιο το `*​/`** ως
 * αιτιολογία — δηλαδή η εξαίρεση δεχόταν **κενό λόγο**, ακριβώς η σιωπή που υπάρχει για να
 * απαγορεύει. Το έπιασε η άγκυρα `Μ4`. Ο πρώτος χαρακτήρας του λόγου δεν μπορεί να είναι
 * αστερίσκος.
 */
const EXEMPT = /\/\/\s*catalog-exempt:\s*\S+|\/\*[^*]*catalog-exempt:\s*[^*\s]\S*/;
const ALL_STATES = [...RATCHETED_STATES, ...CLEAN_STATES, ...DECLARED_GAPS];

/** Διάσχιση AST **χωρίς** να μπαίνει σε εμφωλευμένο JSX (δες `hasMappedChildren`). */
function walk(node, visitor, stopAtJsx = false) {
  if (!node || typeof node !== 'object') return;
  visitor(node);
  for (const key of Object.keys(node)) {
    const child = node[key];
    const kids = Array.isArray(child) ? child : [child];
    for (const c of kids) {
      if (!c || typeof c !== 'object' || !c.type) continue;
      if (stopAtJsx && (c.type === 'JSXElement' || c.type === 'JSXFragment')) continue;
      walk(c, visitor, stopAtJsx);
    }
  }
}

/**
 * Το **κείμενο** ενός `className`, με τις εκφράσεις αποδοσμένες ως **πηγαίος κώδικας**.
 *
 * ⚠️ Οι εκφράσεις **δεν** αγνοούνται: ένα `${gridPatterns.cards.media}` είναι ακριβώς η
 * πληροφορία που ψάχνουμε. Αν τις πετούσαμε, κάθε μεταναστευμένο πλέγμα θα έμοιαζε
 * «χωρίς στήλες» και θα έβγαινε σιωπηλά εκτός εμβέλειας — δηλαδή η πύλη θα τύφλωνε
 * ακριβώς εκεί που η δουλειά πέτυχε.
 */
function classNameText(attr, source) {
  if (!attr || !attr.value) return null;
  const v = attr.value;
  if (v.type === 'Literal') return typeof v.value === 'string' ? v.value : null;
  if (v.type !== 'JSXExpressionContainer') return null;

  const slice = (n) => source.slice(n.range[0], n.range[1]);
  const expr = v.expression;
  if (expr.type === 'Literal') return typeof expr.value === 'string' ? expr.value : null;
  if (expr.type === 'TemplateLiteral') {
    return [
      ...expr.quasis.map((q) => q.value.cooked ?? q.value.raw),
      ...expr.expressions.map(slice),
    ].join(' ');
  }
  // `cn(...)`, ταυτότητες, τριαδικοί: ο πηγαίος κώδικας είναι η ειλικρινέστερη αναπαράσταση.
  return slice(expr);
}

/** Ξετύλιγμα `as const`, παρενθέσεων και μη-μηδενικών βεβαιώσεων. */
function unwrap(n) {
  let cur = n;
  while (cur && (cur.type === 'TSAsExpression' || cur.type === 'TSNonNullExpression'
    || cur.type === 'TSSatisfiesExpression')) cur = cur.expression;
  return cur;
}

/** Αλυσίδες που **δεν** αλλάζουν το «γνωστό μήκος»: `X.filter(…).map(…)`. */
const LENGTH_PRESERVING = new Set(['filter', 'slice', 'sort', 'reverse', 'toSorted']);

/**
 * Είναι η συλλογή που περνά από `.map()` **στατικά γνωστού μήκους**;
 *
 * 🔴 **ΑΥΤΟ ΤΟ ΚΡΙΤΗΡΙΟ ΤΟ ΕΠΕΒΑΛΕ Η ΜΕΤΡΗΣΗ, ΟΧΙ Ο ΣΧΕΔΙΑΣΜΟΣ.** Η πρώτη γραφή έλεγε
 * «υπάρχει `.map()` ⇒ κατάλογος» και κατήγγειλε **67** πλέγματα. Ο έλεγχος του δείγματος
 * βρήκε ολόκληρη **κλάση ψευδώς θετικών**: `TILES.map(…)` πάνω σε `const TILES = [...]`
 * τεσσάρων στοιχείων (`AnalyticsKpiTiles`), `Array.from({length: 4}).map(…)` σε σκελετούς
 * φόρτωσης, `[0,1,2,3].map(…)`. Εκεί το πλήθος **είναι** σταθερό και η σκάλα **σωστή** —
 * ένα `auto-fill` θα χάλαγε τη σειρά των KPI.
 *
 * Ένα `.map()` δηλώνει κατάλογο **μόνο** όταν το μήκος της συλλογής είναι άγνωστο στη
 * μεταγλώττιση: δεδομένα από props, state, ερώτημα. Αυτό είναι το ερώτημα που ξεχωρίζει
 * τον κατάλογο από τη σειρά.
 */
function collectionKind(node, root) {
  const n = unwrap(node);
  if (!n) return 'unknown';

  if (n.type === 'ArrayExpression') return 'fixed';

  // `Array.from({ length: N })` — σκελετοί φόρτωσης· το πλήθος είναι κυριολεκτικά γραμμένο.
  if (n.type === 'CallExpression'
    && n.callee?.type === 'MemberExpression'
    && n.callee.object?.name === 'Array'
    && n.callee.property?.name === 'from') return 'fixed';

  // `X.filter(…)` / `X.slice(…)`: το μήκος δεν μεγαλώνει — ρώτα τη βάση.
  if (n.type === 'CallExpression'
    && n.callee?.type === 'MemberExpression'
    && LENGTH_PRESERVING.has(n.callee.property?.name)) {
    return collectionKind(n.callee.object, root);
  }

  // Ταυτότητα: λύνεται **μέσα στο αρχείο**. Ένα `const TILES = [...]` είναι σταθερό μήκος·
  // ένα `properties` που έρχεται από hook δεν λύνεται εδώ και μένει «άγνωστο» — σωστά.
  if (n.type === 'Identifier') {
    let fixed = false;
    let imported = false;
    walk(root, (d) => {
      if (d.type === 'VariableDeclarator'
        && d.id?.type === 'Identifier' && d.id.name === n.name
        && unwrap(d.init)?.type === 'ArrayExpression') fixed = true;
      if (d.type === 'ImportDeclaration'
        && (d.specifiers || []).some((s) => s.local?.name === n.name)) imported = true;
    });
    if (fixed) return 'fixed';
    /**
     * 🔴 **ΕΙΣΑΓΟΜΕΝΗ ΣΥΛΛΟΓΗ — ΟΝΟΜΑΖΕΤΑΙ, ΔΕΝ ΜΑΝΤΕΥΕΤΑΙ.** Το `ALL_CONTACT_TYPES.map(…)`
     * του `ContactTypeSelector` είναι **κλειστό λεξιλόγιο** σταθερού μήκους, και το
     * `sm:grid-cols-3` του είναι **σωστό** — αλλά ο resolver είναι σκόπιμα τοπικός στο
     * αρχείο (μια διάσχιση όλου του γράφου εισαγωγών θα ήταν δεύτερη μηχανή). Το να το
     * βάλουμε στον μπλοκάροντα κάδο θα ήταν **εικασία**· το να το πετάξουμε σιωπηλά θα ήταν
     * χειρότερο. Παίρνει **δική του κατάσταση** και μετριέται.
     */
    if (imported) return 'imported';
    return 'unknown';
  }

  return 'unknown';
}

/**
 * Προέρχονται τα **άμεσα** παιδιά αυτού του στοιχείου από κατάλογο **άγνωστου** μήκους;
 *
 * ⚠️ **ΑΜΕΣΑ, και χωρίς διάσχιση εμφωλευμένου JSX.** Ένα `<div>{items.map(…)}</div>` μέσα
 * στο πλέγμα ανήκει στο **εσωτερικό** div· αν μετρούσαμε κάθε `.map()` του υποδέντρου, ο
 * γονέας κάθε καταλόγου θα γινόταν κι αυτός «κατάλογος» και η ταξινόμηση θα ανέβαινε
 * αυθαίρετα ψηλά.
 */
function mappedChildrenKind(element, root) {
  let best = 'none';
  for (const child of element.children || []) {
    if (child.type !== 'JSXExpressionContainer') continue;
    walk(child.expression, (n) => {
      if (
        n.type !== 'CallExpression'
        || n.callee?.type !== 'MemberExpression'
        || n.callee.property?.name !== 'map'
      ) return;
      const kind = collectionKind(n.callee.object, root);
      // «άγνωστο» κυριαρχεί: ένα πλέγμα με ΕΝΑΝ κατάλογο αγνώστου μήκους **είναι** κατάλογος,
      // ακόμα κι αν δίπλα του υπάρχει σταθερή συλλογή.
      if (kind === 'unknown') best = 'unknown';
      else if (kind === 'imported' && best !== 'unknown') best = 'imported';
      else if (kind === 'fixed' && best === 'none') best = 'fixed';
    }, true);
  }
  return best;
}

/**
 * Η κατάσταση **ενός** πλέγματος.
 *
 * ⚠️ Η **σειρά είναι συμβόλαιο**: το εγγενές ίχνος κρίνεται **πριν** τη σκάλα, γιατί ένα
 * μεταναστευμένο πλέγμα εξακολουθεί να κουβαλά `grid-cols-1` για τη λειτουργία λίστας και
 * θα διαβαζόταν λανθασμένα ως «ακόμη με σκάλα».
 */
function classify(text, kind) {
  if (kind === 'none' || kind === 'fixed') {
    return LADDER.test(text) ? 'fixed-arity-ladder' : 'fixed-arity-plain';
  }
  if (INTRINSIC.test(text)) return 'catalog-intrinsic';
  if (kind === 'imported') return 'catalog-imported-collection';
  if (LADDER.test(text)) return 'catalog-window-ladder';
  return 'catalog-single-column';
}


/** Οι δύο γραμμές πάνω από τη δήλωση + η ίδια — εκεί ζει μια εξαίρεση. */
function lineComment(source, line) {
  const NL = String.fromCharCode(10);
  const lines = source.split(NL);
  return lines.slice(Math.max(0, line - 3), line).join(NL);
}

/** Σαρώνει **ένα** αρχείο. Επιστρέφει τα ευρήματα + τον μετρητή του τυφλού σημείου. */
function scanFile(filePath, source) {
  let parser;
  try {
    parser = require('@typescript-eslint/parser');
  } catch {
    throw new Error('CHECK 3.55: λείπει το @typescript-eslint/parser — fail-closed.');
  }

  let ast;
  try {
    ast = parser.parse(source, { jsx: true, range: true, loc: true });
  } catch {
    return { findings: [], opaque: 0, parseFailed: true };
  }

  const findings = [];
  let opaque = 0;

  walk(ast, (node) => {
    if (node.type !== 'JSXElement') return;
    const open = node.openingElement;
    const attr = (open?.attributes || []).find(
      (a) => a.type === 'JSXAttribute' && a.name?.name === 'className',
    );
    if (!attr) return;

    const text = classNameText(attr, source);
    if (text === null) {
      // className που δεν αποδίδεται σε κείμενο (π.χ. `className={x}` με x εκτός αρχείου).
      // **Μετριέται, δεν απαριθμείται** — πρότυπο `unanalyzable` του CHECK 3.35.
      opaque += 1;
      return;
    }
    if (!DECLARES_COLUMNS.test(text)) return;

    let state = classify(text, mappedChildrenKind(node, ast));
    // Η εξαίρεση κρίνεται ΤΕΛΕΥΤΑΙΑ και ΜΟΝΟ πάνω σε παραβίαση: δεν επιτρέπεται να
    // «καθαρίσει» κατάσταση που ήδη ήταν σωστή — αυτό θα αλλοίωνε τη λογιστική.
    if (state === 'catalog-window-ladder' && EXEMPT.test(lineComment(source, open.loc?.start?.line ?? 0))) {
      state = 'catalog-exempt';
    }
    if (!ALL_STATES.includes(state)) {
      throw new Error(
        `CHECK 3.55: άγνωστη κατάσταση «${state}» στο ${filePath}:${open.loc?.start?.line}. `
        + 'Η λογιστική δεν επιτρέπεται να χάσει πλέγμα σιωπηλά.',
      );
    }
    findings.push({
      state,
      file: filePath,
      line: open.loc?.start?.line ?? 0,
      detail: text.replace(/\s+/g, ' ').trim().slice(0, 120),
    });
  });

  return { findings, opaque, parseFailed: false };
}

/** Κάθε `.tsx` του `src/`, **χωρίς** `subapps` (ξένη περιοχή) και χωρίς tests. */
function collectFiles(root) {
  const out = [];
  const skip = new Set(['node_modules', '.next', 'subapps', '__tests__']);
  (function rec(dir) {
    for (const name of fs.readdirSync(dir)) {
      if (skip.has(name)) continue;
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) rec(full);
      else if (full.endsWith('.tsx')) out.push(full);
    }
  })(path.join(root, 'src'));
  return out;
}

module.exports = {
  LADDER,
  INTRINSIC,
  DECLARES_COLUMNS,
  RATCHETED_STATES,
  CLEAN_STATES,
  DECLARED_GAPS,
  ALL_STATES,
  EXEMPT,
  walk,
  classNameText,
  mappedChildrenKind,
  collectionKind,
  classify,
  scanFile,
  collectFiles,
};
