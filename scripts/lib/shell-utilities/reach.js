/**
 * «**Ζωγραφίζει** αυτή η οθόνη τον ιδιοκτήτη των καθολικών δυνατοτήτων;»
 *
 * ADR-809 / CHECK 3.72.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΚΛΕΙΣΤΟΤΗΤΑ ΕΙΣΑΓΩΓΩΝ — ΤΟ ΠΛΗΡΩΣΑ ΓΡΑΦΟΝΤΑΣ ΤΟ ΛΑΘΟΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η πρώτη γραφή ρωτούσε *«είναι **προσιτό** το σύμβολο;»* και έβγαλε **157/157
 * πράσινα, ΜΗΔΕΝ σιωπηλές** — δηλαδή μια πύλη **δομικά ανίκανη να πυροδοτήσει**,
 * το σχήμα «0 = κανείς δεν κοίταξε», γραμμένο μέσα στο όργανο που το κυνηγά.
 *
 * Η αιτία ήταν **barrel**: το ρίζικό `layout.tsx` εισάγει `AuthProvider` από το
 * `@/auth`, και ο barrel επανεξάγει **και** τον `AuthForm` ⇒ αλυσίδα
 * `layout → @/auth → AuthForm → AuthScreenChrome → ShellUtilities`. Δηλαδή
 * **κάθε** σελίδα της εφαρμογής «έφτανε», μέσα από module που **δεν αποδίδεται
 * ποτέ**. Ίδια τύφλωση με το CHECK 3.30.
 *
 * 🔑 **Η ερώτηση δεν ήταν ποτέ «τι είναι προσιτό» — ήταν «τι ΖΩΓΡΑΦΙΖΕΤΑΙ».**
 * Ο περίπατος ακολουθεί **στοιχεία JSX**, όχι εισαγωγές: μια ετικέτα `<Foo/>`
 * χαρτογραφείται στο τοπικό της δέσιμο, το δέσιμο στον ειδικευτή, και ο
 * ειδικευτής στο module που **ΔΗΛΩΝΕΙ** το σύμβολο (`resolveOrigin`, ADR-700 —
 * το ίδιο barrel-aware σώμα που χρησιμοποιεί το CHECK 3.30).
 *
 * ⛔ **ΚΑΜΙΑ ΝΕΑ ΜΗΧΑΝΗ**: ο επιλυτής, ο barrel-walker και ο αναλυτής module
 * είναι του `module-graph`. Νέο μόνο το «ποιες ετικέτες JSX έχει αυτό το
 * αρχείο», που **δεν** εκφράζεται στο υπάρχον `parseModule` (εκείνο διπλώνει
 * ταυτοποιητές ανά αρχείο, χωρίς να ξεχωρίζει απόδοση από αναφορά).
 *
 * ⚠️ **ΥΠΕΡ-ΠΡΟΣΕΓΓΙΣΗ ΠΟΥ ΜΕΝΕΙ**, δηλωμένη: ένα `<Foo/>` πίσω από συνθήκη
 * μετριέται ως «ζωγραφίζεται». Άρα η πύλη μπορεί να **χάσει** ελάττωμα, ποτέ να
 * το **επινοήσει** — η μόνη αποδεκτή κατεύθυνση για πύλη που μπλοκάρει commit
 * (πήχης <10% ψευδώς θετικών). Το κενό το κλείνει ο άνθρωπος στην οθόνη.
 *
 * ⚠️ **ΔΕΝ ακολουθεί `next/dynamic`**: μετρημένο στο ADR-744 ότι η δυναμική
 * εισαγωγή ανοίγει **όλη** την εφαρμογή (7.492 αρχεία / 2,93 MB). Ένα κέλυφος
 * δεν παραδίδεται με `dynamic()` — και αν παραδοθεί, το ωμό κλειδί/η απουσία
 * μετακινείται σε «ένα καρέ» και κρύβεται (ίδια παγίδα με το §14.3 του ADR-744).
 */

'use strict';

const path = require('node:path');
const ts = require('typescript');

const { readTsPathAliases } = require('../module-graph/resolve-specifier');
const { createResolver, resolveOrigin } = require('../module-graph/build-graph');
const { parseModule } = require('../module-graph/parse-module');

const toPosix = (p) => p.split(path.sep).join('/');

/** Η ρίζα μιας ετικέτας: `<Foo.Bar/>` δένεται από το `Foo`. */
function rootOfTagName(node) {
  let n = node;
  while (ts.isPropertyAccessExpression(n)) n = n.expression;
  return ts.isIdentifier(n) ? n.text : null;
}

/**
 * Τα **τοπικά ονόματα** που αποδίδονται ως στοιχεία JSX σε αυτό το αρχείο.
 *
 * ⚠️ **Μόνο κεφαλαίο αρχικό**: το `<div>` δεν είναι component, και ένα κριτήριο
 * που δεν το φιλτράρει θα προσπαθούσε να λύσει «div» ως εισαγωγή σε κάθε αρχείο.
 */
function renderedLocalNames(sourceFile) {
  const names = new Set();
  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const root = rootOfTagName(node.tagName);
      if (root !== null && /^[A-Z]/.test(root)) names.add(root);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return names;
}

/** Τοπικό όνομα → `{ spec, imported }`, από τις **εισαγωγές** του αρχείου. */
function importBindings(mod) {
  const map = new Map();
  for (const imp of mod.imports ?? []) {
    for (const n of imp.names ?? []) map.set(n.local, { spec: imp.spec, imported: n.imported });
  }
  return map;
}

/**
 * **ΤΕΜΠΕΛΗΣ γράφος** — ίδιο σχήμα με του `buildGraph`, αλλά αναλύει module
 * **όταν ρωτηθεί**.
 *
 * 🔴 **ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΑΙΣΘΗΤΙΚΟ**: με πρόθυμο `buildGraph` η πύλη κόστιζε
 * **41s** — αναλύοντας ~15.000 αρχεία για έναν περίπατο που αγγίζει λίγες
 * δεκάδες. *Μια πύλη που κοστίζει τόσο δεν είναι αυστηρότερη, είναι ανενεργή*
 * (CHECK 3.52): μπαίνει στη ζώνη όπου κάποιος γράφει `SKIP_`.
 *
 * ⚠️ Το `resolveOrigin` χρησιμοποιεί **μόνο** `graph.modules.get(file)`, και το
 * `createResolver` μόνο `projectRoot`/`aliases`/`fileSet` — γι' αυτό το τεμπέλικο
 * σχήμα είναι **αντικατάσταση, όχι δεύτερη μηχανή**: ο αναλυτής παραμένει το
 * `parseModule` και ο barrel-walker το `resolveOrigin`, αυτούσια.
 */
function lazyGraph({ projectRoot, aliases, files, readFile }) {
  const cache = new Map();
  const unparsed = new Set();
  const modules = {
    get(file) {
      if (cache.has(file)) return cache.get(file);
      let mod = null;
      try {
        mod = parseModule(file, readFile(file));
      } catch {
        // fail-safe: αδιαφανές, ΠΟΤΕ «κενό» — το `resolveOrigin` διαβάζει το
        // `undefined` ως `{ opaque: true }`, που είναι «υπόθεσε ζωντανό».
        unparsed.add(file);
      }
      cache.set(file, mod ?? undefined);
      return mod ?? undefined;
    },
  };
  return { projectRoot, aliases, fileSet: new Set(files), modules, unparsed };
}

function createReachability({ projectRoot, files, readFile }) {
  const rootPosix = toPosix(projectRoot);
  const aliases = readTsPathAliases(projectRoot);
  const graph = lazyGraph({ projectRoot: rootPosix, aliases, files, readFile });
  const resolve = createResolver(graph);

  const jsxCache = new Map();
  /** Τα ονόματα JSX ενός αρχείου — parse ΜΟΝΟ όσων μπαίνουν στο μονοπάτι. */
  function jsxNamesOf(file) {
    let hit = jsxCache.get(file);
    if (hit === undefined) {
      if (!/\.(tsx|jsx)$/.test(file)) hit = new Set();
      else {
        try {
          hit = renderedLocalNames(
            ts.createSourceFile(file, readFile(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
          );
        } catch {
          // fail-safe: αρχείο που δεν διαβάζεται είναι **αδιαφανές**, ποτέ «κενό».
          hit = null;
        }
      }
      jsxCache.set(file, hit);
    }
    return hit;
  }

  /** Τα αρχεία που **ΔΗΛΩΝΟΥΝ** ό,τι αποδίδει το `file`. */
  function renderedTargetsOf(file) {
    const mod = graph.modules.get(file);
    const names = jsxNamesOf(file);
    if (!mod || names === null || names.size === 0) return [];
    const bindings = importBindings(mod);
    const out = [];
    for (const local of names) {
      const b = bindings.get(local);
      if (b === undefined) continue; // ορίζεται τοπικά — ήδη σε αυτό το αρχείο
      const target = resolve(b.spec, file);
      if (target.kind !== 'internal') continue;
      // 🔑 Ο barrel λύνεται στο module που ΔΗΛΩΝΕΙ, ποτέ στον ίδιο τον barrel.
      const origin = resolveOrigin(graph, resolve, target.file, b.imported);
      out.push(origin.file ?? target.file);
    }
    return out;
  }

  const memo = new Map();

  /**
   * @returns {string[]|null} Η **αλυσίδα απόδοσης** ρίζα→στόχος, ή `null`.
   *   Η αλυσίδα και όχι σκέτο `true`: ένα «δεν φτάνει» χωρίς διαδρομή δεν λέει
   *   τι να διορθώσεις, και ένα «φτάνει» χωρίς διαδρομή δεν αποδεικνύεται.
   */
  function chainTo(root, target) {
    const key = `${root} ${target}`;
    if (memo.has(key)) return memo.get(key);

    const parent = new Map([[root, null]]);
    const queue = [root];
    let found = null;
    while (queue.length > 0) {
      const file = queue.shift();
      if (file === target) {
        const chain = [];
        for (let p = file; p !== null && p !== undefined; p = parent.get(p)) chain.push(p);
        found = chain.reverse();
        break;
      }
      for (const next of renderedTargetsOf(file)) {
        if (!parent.has(next)) {
          parent.set(next, file);
          queue.push(next);
        }
      }
    }
    memo.set(key, found);
    return found;
  }

  return { graph, chainTo, renderedTargetsOf, jsxNamesOf };
}

module.exports = { createReachability, toPosix, renderedLocalNames, importBindings };
