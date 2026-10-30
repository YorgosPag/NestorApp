/**
 * **Η ΕΙΣΟΔΟΣ ΤΗΣ ΠΥΛΗΣ** (ADR-924 Ε1) — ΤΟ ΕΝΑ σημείο από το οποίο μια πύλη pre-commit βλέπει το repo:
 * ποια αρχεία υπάρχουν και τι λένε. Το πρότυπο είναι το `input_api` του Chromium presubmit — οι έλεγχοι
 * ΔΕΝ ανοίγουν το σύστημα αρχείων· ρωτούν την είσοδο, κι εκείνη ξέρει **ποια** όψη κρίνεται.
 *
 *   · `disk`  (προεπιλογή — σουίτες, `npm run`, fixtures): ο δίσκος, όπως πάντα.
 *   · `index` (`--index` από τον εκτελεστή): η **όψη του commit** (`createCommitView`) — αρχεία = το
 *     ευρετήριο (untracked λείπουν), κείμενο = ο δίσκος εκτός από ό,τι αποκλίνει, που διαβάζεται ως blob.
 *     Κόστος ανάλογο των **διαφορών**, όχι του δέντρου: καμία αντιγραφή αρχείων.
 *
 * 🔴 ΓΙΑΤΙ (μετρημένο 2026-10-29): 84 από 90 πύλες έκριναν τον δίσκο, όπου ζει και η ξένη αστάδιοποίητη
 * δουλειά — ~45 από αυτές σε ΚΑΘΕ commit. Και ~9 πύλες «ενός γραφέα» κουβαλούσαν το ΙΔΙΟ αντίγραφο
 * `collectSourceFiles → φίλτρο tests → φρουρός 1000 → fs.readFileSync`. Μία είσοδος λύνει την ΚΛΑΣΗ.
 *
 * ⚠️ Μονοπάτια: δέχεται απόλυτα ή σχετικά με τη ρίζα· επιστρέφει **απόλυτα posix** (ό,τι έδινε πάντα
 * το `collectSourceFiles`), ώστε οι πύλες να μην αλλάξουν λογιστική.
 * ⚠️ EOL: στην όψη `index` τα αποκλίνοντα έρχονται με LF (blob), τα υπόλοιπα με το EOL του δίσκου —
 * δες `readIndexBlobs`. Δυαδικά (γραμματοσειρές): `readBytes`. Πύλη που συγκρίνει bytes **κειμένου** ανεξάρτητα
 * από το checkout θέλει `materializeIndex({ rawBytes: true })`, όχι αυτό.
 *
 * @module scripts/lib/gate-input
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { collectSourceFiles, isAnalysedSourcePath, listFiles, underToolDir } = require('./module-graph/scan-config');
const { toPosix } = require('./posix-path');
const { createCommitView, listIndexEntries, grepFiles, listStagedPaths } = require('./git-index-snapshot');

const INDEX_FLAG = '--index';
const TEST_SOURCE = /__tests__|\.test\.|\.spec\./;
/** Κάτω από αυτό, η σάρωση του `src/` «δεν κοίταξε» (λάθος ρίζα, άδεια όψη) — ποτέ σιωπηλό πράσινο. */
const MIN_PRODUCTION_SOURCES = 1000;

/** Ζήτησε ο εκτελεστής την όψη του commit; */
function indexRequested(argv = process.argv) {
  return argv.includes(INDEX_FLAG);
}

/** Αρχείο δοκιμών — ό,τι δεν κρίνουν οι πύλες παραγωγής. */
function isTestSource(file) {
  return TEST_SOURCE.test(file);
}

/** Κάποιος πρόγονος του `rel` κλαδεύεται; (`pruneDir` δέχεται `φάκελος/`, όπως στον περιπατητή του δίσκου) */
function prunedAncestor(rel, pruneDir) {
  const segments = rel.split('/');
  for (let i = 1; i < segments.length; i += 1) if (pruneDir(`${segments.slice(0, i).join('/')}/`)) return true;
  return false;
}

function diskReader(root) {
  const abs = rel => path.join(root, rel);
  return {
    sources: roots => collectSourceFiles(root, roots),
    files: (roots, accept, pruneDir) => listFiles(root, roots, accept, pruneDir),
    read(rel) {
      try {
        return fs.readFileSync(abs(rel), 'utf8');
      } catch {
        return null;
      }
    },
    readBytes(rel) {
      try {
        return fs.readFileSync(abs(rel));
      } catch {
        return null;
      }
    },
    exists(rel) {
      try {
        return fs.statSync(abs(rel)).isFile();
      } catch {
        return false;
      }
    },
    children(rel) {
      const out = { files: [], dirs: [] };
      try {
        for (const entry of fs.readdirSync(abs(rel), { withFileTypes: true })) {
          if (entry.isDirectory()) out.dirs.push(entry.name);
          else if (entry.isFile()) out.files.push(entry.name);
        }
      } catch {
        return null;
      }
      return { files: out.files.sort(), dirs: out.dirs.sort() };
    },
  };
}

/**
 * Ο χάρτης φακέλων του ευρετηρίου — `φάκελος → { files, dirs }` (άμεσα παιδιά), χτισμένος ΜΙΑ φορά. Ένας φάκελος
 * υπάρχει στην όψη του commit μόνο αν έχει tracked αρχείο (το git δεν κρατά κενούς φακέλους).
 */
function directoryTree(files) {
  const tree = new Map();
  const nodeOf = dir => {
    if (!tree.has(dir)) tree.set(dir, { files: new Set(), dirs: new Set() });
    return tree.get(dir);
  };
  for (const rel of files) {
    const segments = rel.split('/');
    for (let i = 0; i < segments.length; i += 1) {
      const parent = segments.slice(0, i).join('/');
      if (i === segments.length - 1) nodeOf(parent).files.add(segments[i]);
      else nodeOf(parent).dirs.add(segments[i]);
    }
  }
  return tree;
}

/**
 * ADR-924 Φ4 — **ΤΟ ΣΤΙΓΜΙΟΤΥΠΟ ΤΗΣ ΕΚΤΕΛΕΣΗΣ**: ο εκτελεστής παίρνει ΜΙΑ όψη (`takeCommitSnapshot`) και ο worker την
 * υιοθετεί ρητά εδώ, πριν τρέξει η πύλη. Κάθε είσοδος ευρετηρίου της ίδιας ρίζας χτίζεται πάνω της — καμία δεύτερη
 * ερώτηση στο git, μία απάντηση για όλες τις πύλες. Χωρίς υιοθέτηση (σουίτες, `npm run`): η όψη χτίζεται όπως πάντα.
 */
let adoptedSnapshot = null;
function adoptCommitSnapshot(snapshot) {
  adoptedSnapshot = snapshot || null;
}
const samePath = (a, b) => toPosix(path.resolve(a)).toLowerCase() === toPosix(path.resolve(b)).toLowerCase();

/**
 * ADR-924 Φ4 — **ΤΟ ΚΑΤΑΣΤΙΧΟ ΤΗΣ ΔΙΕΡΓΑΣΙΑΣ** (η δυναμική απόδειξη): κάθε είσοδος που ανοίγει, με τη ρίζα και την όψη
 * της, και πόσες αναγνώσεις έκανε. Ο worker το γράφει δίπλα στην έξοδο της πύλης· ο εκτελεστής ελέγχει ότι πύλη που
 * ζήτησε `--index` ΔΕΝ άνοιξε είσοδο δίσκου στη ρίζα του repo — η κλάση του Ω6 (σημαία που δεν έφτασε σε βιβλιοθήκη,
 * προεπιλογή «δίσκος» σε παράμετρο που κανείς δεν πέρασε), που η στατική απογραφή ΔΕΝ βλέπει. Ένας worker = μία πύλη.
 */
const ledger = { opened: [] };
function inputLedger() {
  return { opened: ledger.opened.map(entry => ({ ...entry })) };
}

function indexReader(root) {
  // ⚡ νωχελική (ADR-924 Φ3, μετρημένο ~1,2s): πύλη που δεν ρωτά τίποτα (π.χ. σκανδάλη χωρίς σταδιοποιημένο αρχείο της)
  //    δεν πληρώνει την όψη. Χτίζεται στην πρώτη ερώτηση, μία φορά — πάνω στο στιγμιότυπο της εκτέλεσης, αν υπάρχει.
  let cached = null;
  const snapshot = () => (adoptedSnapshot && samePath(adoptedSnapshot.repoRoot, root) ? adoptedSnapshot : null);
  const view = () => (cached = cached || createCommitView({ repoRoot: root, snapshot: snapshot() }));
  let tree = null;
  return {
    children(rel) {
      tree = tree || directoryTree(view().files);
      const node = tree.get(rel.replace(/\/+$/, ''));
      return node ? { files: [...node.files].sort(), dirs: [...node.dirs].sort() } : null;
    },
    sources: roots => view().files
      .filter(rel => roots.some(r => rel.startsWith(`${r}/`)) && isAnalysedSourcePath(rel))
      .map(rel => toPosix(path.join(root, rel))),
    files: (roots, accept, pruneDir) => view().files
      .filter(rel => roots.some(r => rel.startsWith(`${r}/`)) && !underToolDir(rel)
        && !(pruneDir && prunedAncestor(rel, pruneDir)) && accept(rel))
      .map(rel => toPosix(path.join(root, rel)))
      .sort(),
    get view() {
      return view();
    },
    read: rel => view().readText(rel),
    readBytes: rel => view().readBytes(rel),
    exists: rel => view().has(rel),
  };
}

/** Pathspec του git (`*` περνά και το `/`) ⇒ κριτήριο μονοπατιού. Κενό ⇒ όλα. */
function pathspecMatcher(pathspecs) {
  if (pathspecs.length === 0) return () => true;
  const patterns = pathspecs.map(spec => new RegExp(`^${spec.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`));
  return rel => patterns.some(re => re.test(rel));
}

/**
 * `git grep --cached` με το κόστος του δίσκου (ΜΕΤΡΗΜΕΝΟ: 3,7s έναντι 1,5s ανά αναζήτηση — το `--cached` αποσυμπιέζει
 * ΚΑΘΕ blob). Η αρχή του `createCommitView`: ο δίσκος ΕΙΝΑΙ το ευρετήριο, εκτός από τα αποκλίνοντα — εκείνα κρίνονται
 * από το κείμενο της όψης. Ίδια απάντηση με το `--cached` (άγκυρα Ε7).
 */
function indexGrep(root, view, needle, pathspecs) {
  const divergent = view.divergentFiles;
  const matches = pathspecMatcher(pathspecs);
  const clean = grepFiles({ repoRoot: root, needle, pathspecs }).filter(rel => !divergent.has(rel));
  const needles = Array.isArray(needle) ? needle : [needle];
  const changed = [...divergent].filter(rel => matches(rel) && needles.some(n => (view.readText(rel) || '').includes(n)));
  return [...clean, ...changed].sort();
}

/** Σάρωση με λιγότερα από `minimum` αρχεία «δεν κοίταξε» ⇒ σφάλμα. */
function guarded(files, minimum) {
  if (files.length < minimum) throw new Error(`ΦΡΟΥΡΟΣ: μόνο ${files.length} αρχεία — η σάρωση δεν κοίταξε`);
  return files;
}

/**
 * @param {{root: string, index?: boolean}} options `index` = η όψη του commit (συνήθως `indexRequested()`).
 * @returns {{mode: 'disk'|'index', root: string, sources: (roots?: string[], options?: {minimum?: number}) => string[],
 *            files: (roots: string[], options: {accept: (rel: string) => boolean, pruneDir?: (dir: string) => boolean,
 *            minimum?: number}) => string[], rel: (file: string) => string,
 *            productionSources: (roots?: string[]) => string[], read: (file: string) => ?string,
 *            readBytes: (file: string) => ?Buffer,
 *            exists: (file: string) => boolean, readJson: (file: string) => object}}
 */
function openGateInput({ root, index = false }) {
  const reader = index ? indexReader(root) : diskReader(root);
  ledger.opened.push({ mode: index ? 'index' : 'disk', root: toPosix(path.resolve(root)) });
  const relOf = file => toPosix(path.isAbsolute(file) ? path.relative(root, file) : file);
  /** Κάθε πηγαίο αρχείο των ριζών (και tests)· `minimum` = φρουρός «δεν κοίταξε». */
  const sources = (roots = ['src', 'packages'], { minimum = 0 } = {}) => guarded(reader.sources(roots), minimum);
  /** Κείμενο που η πύλη ΧΡΕΙΑΖΕΤΑΙ (μέρος της, ή ο γράφος της) — λείπει ⇒ σφάλμα ΜΕ ΟΝΟΜΑ, ποτέ σιωπηλό `''`. */
  const readRequired = (file) => {
    const text = reader.read(relOf(file));
    if (text === null) throw new Error(`${relOf(file)} λείπει από την όψη (${index ? 'index' : 'disk'}) — είναι μέρος της πύλης`);
    return text;
  };
  return {
    mode: index ? 'index' : 'disk',
    root,
    sources,
    /**
     * Κάθε αρχείο των ριζών που δέχεται το `accept(rel)` — για πύλες με ΔΙΚΟ τους κριτήριο αρχείου (όχι «πηγαίο»).
     * Κλαδεύονται πάντα οι φάκελοι εργαλείων· `pruneDir('φάκελος/')` κλαδεύει κι άλλους. `minimum` = φρουρός.
     */
    files(roots, { accept, pruneDir, minimum = 0 }) {
      // ρίζες σχετικές ή απόλυτες (όπως `read`/`exists`) — η λογιστική μένει σε απόλυτα posix
      return guarded(reader.files(roots.map(relOf), accept, pruneDir), minimum);
    },
    /** Το μονοπάτι σχετικό με τη ρίζα, posix — η μορφή των κατάστιχων και των baselines. */
    rel: relOf,
    /**
     * Τα σταδιοποιημένα αρχεία (όχι σβησμένα) που δέχεται το `accept(rel)` — **απόλυτα posix**, ΚΑΙ στις δύο όψεις:
     * η σκανδάλη είναι πάντα «τι αγγίζει το commit»· ό,τι ΔΙΑΒΑΖΕΤΑΙ από αυτά περνά από το `read` της όψης.
     */
    staged: (accept = () => true) => listStagedPaths({ repoRoot: root }).filter(accept)
      .map(rel => toPosix(path.join(root, rel))),
    /** Τα αρχεία του ευρετηρίου (σχετικά posix) — ό,τι λέει το `git ls-files`, ΚΑΙ στις δύο όψεις. */
    tracked: () => (index ? reader.view.files : [...listIndexEntries({ repoRoot: root }).keys()].sort()),
    /** Tracked αρχεία που περιέχουν `needle` — το κείμενο της ΟΨΗΣ (`git grep` / `git grep --cached`). */
    grep: (needle, pathspecs = []) => (index
      ? indexGrep(root, reader.view, needle, pathspecs)
      : grepFiles({ repoRoot: root, needle, pathspecs })),
    /** Τα πηγαία αρχεία ΠΑΡΑΓΩΓΗΣ (χωρίς tests), με φρουρό. */
    productionSources(roots = ['src']) {
      return guarded(sources(roots).filter(file => !isTestSource(file)), MIN_PRODUCTION_SOURCES);
    },
    read: file => reader.read(relOf(file)),
    /** Τα bytes (δυαδικά: γραμματοσειρές, εικόνες)· λείπει ⇒ `null`. */
    readBytes: file => reader.readBytes(relOf(file)),
    exists: file => reader.exists(relOf(file)),
    /**
     * **Ζώνη ασφαλείας** (ADR-924 §8.5): ο καλών θα διαβάσει/ΕΚΤΕΛΕΣΕΙ τα `files` από τον ΔΙΣΚΟ (π.χ. config που φορτώνει
     * εξωτερικό εργαλείο — jiti, `require`). Στην όψη του commit αυτό είναι σωστό ΜΟΝΟ αν δεν αποκλίνουν: αλλιώς σφάλμα
     * ΜΕ ΟΝΟΜΑ — ποτέ σιωπηλή κρίση του λάθος αρχείου. Στον δίσκο: πάντα σωστό.
     */
    assertUndivergent(files, why) {
      if (!index) return;
      const divergent = files.map(relOf).filter(rel => reader.view.divergentFiles.has(rel));
      if (divergent.length > 0) {
        throw new Error(`${divergent.join(', ')}: ο δίσκος ΑΠΟΚΛΙΝΕΙ από το ευρετήριο και ${why} — `
          + 'σταδιοποίησε ή άφησε την αλλαγή, ώστε να κριθεί το commit (ADR-924 §8.5)');
      }
    },
    /** Τα άμεσα παιδιά ενός φακέλου — `{ files, dirs }` (ονόματα, ταξινομημένα)· ο φάκελος λείπει ⇒ `null`. */
    children: dir => reader.children(relOf(dir) === '.' ? '' : relOf(dir)),
    readRequired,
    /** Μητρώο/config της πύλης — λείπει ⇒ σφάλμα, ποτέ σιωπηλό «κενό μητρώο». */
    readJson: file => JSON.parse(readRequired(file)),
  };
}

/** Η είσοδος του `main` μιας πύλης: η όψη του commit όταν τη ζητά ο εκτελεστής (`--index`), αλλιώς ο δίσκος. */
function commitInput(root, argv = process.argv) {
  return openGateInput({ root, index: indexRequested(argv) });
}

/**
 * Το πεδίο μιας σάρωσης: ρίζα · είσοδος · αρχεία. `opts` = `{ root, input, codeFiles }` — `input` = η είσοδος της πύλης
 * (προεπιλογή ο δίσκος· το `main` δίνει την όψη του commit), `codeFiles` = fixtures/δείγμα των αγκυρών.
 * `select(input)` = ποια αρχεία κρίνει η πύλη (προεπιλογή: τα αρχεία παραγωγής του `src/`, με φρουρό).
 */
function scanScope(opts, projectRoot, select = (input) => input.productionSources()) {
  const root = opts.root || projectRoot;
  const input = opts.input || openGateInput({ root });
  return { root, input, files: opts.codeFiles || select(input) };
}

/**
 * Η μέτρηση μιας πύλης, ΜΙΑ φορά ανά είσοδο: `measure({ input })` — ο φρουρός zero-tolerance και το ratchet της ίδιας
 * εκτέλεσης καλούν και οι δύο το `measure` (3.66: 246ms → 137ms). Χωρίς `input` ⇒ ο δίσκος της `root`, μία φορά.
 * @param {string} root
 * @param {(input: object) => object} measureFresh
 */
function perInput(root, measureFresh) {
  const cache = new WeakMap();
  let disk = null;
  return (opts = {}) => {
    const input = opts.input || (disk = disk || openGateInput({ root }));
    if (!cache.has(input)) cache.set(input, measureFresh(input));
    return cache.get(input);
  };
}

module.exports = {
  openGateInput, commitInput, scanScope, perInput, indexRequested, isTestSource, INDEX_FLAG, MIN_PRODUCTION_SOURCES,
  adoptCommitSnapshot, inputLedger,
};
