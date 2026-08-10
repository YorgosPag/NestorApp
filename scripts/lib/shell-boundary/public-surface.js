#!/usr/bin/env node
'use strict';

/**
 * ADR-777 §8.12 — CHECK 3.52, ο κανόνας **Κ2**: «τι κάνει μια επιφάνεια δημόσια;»
 *
 * 🔑 **Η ΑΠΑΝΤΗΣΗ ΔΕΝ ΕΙΝΑΙ Ο ΦΑΚΕΛΟΣ — ΕΙΝΑΙ Ο ΚΑΤΑΝΑΛΩΤΗΣ.**
 * Ο Κ1 ρωτά «συμφωνεί η δομή με τη δήλωση;» και είναι, από κατασκευή, **αυτο-συνεπής**:
 * μετακίνησε μια δημόσια σελίδα μέσα στο `(app)` και η δήλωση αλλάζει μαζί της, οπότε
 * ο Κ1 μένει **ΠΡΑΣΙΝΟΣ πάνω στο ίδιο το ελάττωμα**. Γι' αυτό ο Κ2 είναι **ξεχωριστός
 * κανόνας, ποτέ ένας με «ή»** (μάθημα CHECK 3.41): κρίνει από κάτι που **ταξιδεύει μαζί
 * με τον κώδικα** — ότι η σελίδα διαβάζει τη **δημόσια προβολή**.
 *
 * ⚠️ **ΤΟ ΚΡΙΤΗΡΙΟ ΕΙΝΑΙ ΤΑ ΑΝΤΙΔΡΑΣΤΙΚΑ HOOKS, ΟΧΙ ΤΟ MODULE.** Μετρημένο 2026-08-10:
 * το ίδιο module εξάγει και `computeListingLedger`, **καθαρή** συνάρτηση που καταναλώνει
 * το **εσωτερικό** `/test-harness/listing-shapes` — το οποίο νόμιμα φοράει κέλυφος.
 * Κριτήριο «εισάγει από αυτό το module» ⇒ **ψευδώς θετικό**, μετρημένο πριν γραφτεί.
 *
 * ## Κόστος
 * Προφίλτρο `git grep` (ευρετήριο, όχι δίσκος) → ακριβής επαλήθευση με AST **μόνο** στους
 * υποψήφιους. Ωμή ανάγνωση όλου του `src/` μετρήθηκε **20s / 14.836 αρχεία / 90 MB** —
 * απαγορευτικό για pre-commit. Το προφίλτρο είναι ασφαλές **μόνο** επειδή κάθε υποψήφιος
 * επαληθεύεται μετά με `resolveSpecifier`: το κείμενο βρίσκει, ο AST **αποφασίζει**.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const MG = require('../module-graph');
const SC = require('../module-graph/scan-config');
const { toPosix } = require('./tree');

const SOURCE_PATHSPEC = ['src/*.ts', 'src/*.tsx', 'src/*.js', 'src/*.jsx'];
const SOURCE_RE = /\.(tsx?|jsx?)$/;

function git(projectRoot, args) {
  try {
    return execFileSync('git', args, {
      cwd: projectRoot,
      maxBuffer: 1024 * 1024 * 64,
      encoding: 'utf8',
    });
  } catch {
    // `git grep` βγαίνει με 1 όταν δεν βρει τίποτα — αυτό είναι **απάντηση**, όχι βλάβη.
    return '';
  }
}

/**
 * Τα untracked (μη-gitignored) αρχεία πηγής.
 *
 * ⚠️ **ΑΠΟΜΝΗΜΟΝΕΥΜΕΝΟ ΑΝΑ ΔΙΕΡΓΑΣΙΑ**: το `ls-files --others` σαρώνει το working tree,
 * και ο αντίστροφος βρόχος το ζητούσε **σε κάθε γύρο** — ίδια απάντηση, τριπλό κόστος.
 * Ένα working tree δεν αλλάζει μέσα σε μία εκτέλεση της πύλης.
 */
const untrackedCache = new Map();

function untrackedSourceFiles(projectRoot) {
  if (untrackedCache.has(projectRoot)) return untrackedCache.get(projectRoot);
  const files = git(projectRoot, ['ls-files', '--others', '--exclude-standard', '--', ...SOURCE_PATHSPEC])
    .split('\n')
    .map(s => s.trim())
    .filter(f => f && SOURCE_RE.test(f));
  untrackedCache.set(projectRoot, files);
  return files;
}

/**
 * Υποψήφιοι: **tracked** μέσω `git grep` + **untracked** μέσω ρητής ανάγνωσης.
 *
 * 🔴 **Η ΚΑΛΥΨΗ ΤΩΝ UNTRACKED ΕΙΝΑΙ ΜΕΡΟΣ ΤΗΣ ΟΡΘΟΤΗΤΑΣ.** Η πύλη διαβάζει τη **δομή**
 * από τον δίσκο (`enumeratePages`/`enumerateLayouts`)· αν τα **σύμβολα** τα διάβαζε
 * μόνο από το ευρετήριο, θα ήταν **δύο αυθεντίες σε ένα όργανο** (ADR-749). Μετρημένο
 * ζωντανά κατά τη μετακόμιση: ένα ολοκαίνουργιο `(app)/layout.tsx` που **υπάρχει και
 * αποδίδεται** έβγαζε `owner-without-shell` — ψευδώς θετικό. Η αντίστροφη κατεύθυνση
 * είναι **χειρότερη**: untracked `(x)/layout.tsx` που εισάγει `AppSidebar` θα περνούσε
 * **αόρατο** — fail-open ακριβώς εκεί που μετράει.
 *
 * ⚠️ **ΓΙΑΤΙ ΟΧΙ ΣΚΕΤΟ `git grep --untracked`**: **μετρημένο 2026-08-10**, η σημαία
 * αναγκάζει το git να σαρώσει ΟΛΟ το working tree και κοστίζει **8,0s ανά κλήση**
 * έναντι **0,78s** — με 3-4 κλήσεις ανά εκτέλεση, η πύλη πήγαινε στα **43s** στο
 * pre-commit. Η ίδια κάλυψη με `ls-files --others` + ανάγνωση **μιας δεκάδας** αρχείων
 * κοστίζει ~0,1s. Τα gitignored μένουν έξω: δεν είναι κώδικας της εφαρμογής.
 */
function gitGrepFiles(projectRoot, tokens) {
  if (tokens.length === 0) return [];

  const args = ['grep', '-l', '-I', '--fixed-strings'];
  for (const token of tokens) args.push('-e', token);
  args.push('--', ...SOURCE_PATHSPEC);
  const tracked = git(projectRoot, args).split('\n').map(s => s.trim()).filter(Boolean);

  const extra = untrackedSourceFiles(projectRoot).filter(rel => {
    const abs = path.resolve(projectRoot, rel);
    if (!fs.existsSync(abs)) return false;
    const text = fs.readFileSync(abs, 'utf8');
    return tokens.some(token => text.includes(token));
  });

  return [...new Set([...tracked, ...extra])];
}

/** Το περιβάλλον επίλυσης specifier: ένα, μοιρασμένο, χτισμένο μία φορά. */
function createResolveContext(projectRoot) {
  const files = SC.collectSourceFiles(projectRoot, ['src']);
  return {
    projectRoot: toPosix(projectRoot),
    aliases: MG.readTsPathAliases(projectRoot, 'tsconfig.base.json'),
    fileSet: new Set(files.map(toPosix)),
  };
}

/**
 * Τα module που εισάγει το αρχείο, λυμένα σε **απόλυτα posix** μονοπάτια.
 *
 * ⚠️ Ένα `unresolved` **ΔΕΝ** αγνοείται σιωπηλά: επιστρέφεται ως `null` στη λίστα, ώστε
 * ο καλών να το μετρήσει ως **αδιαφανές** (fail-safe) αντί να το διαβάσει ως «απουσία».
 */
function importedModulesOf(absFile, ctx) {
  const text = fs.readFileSync(absFile, 'utf8');
  const mod = MG.parseModule(absFile, text);
  const specs = [
    ...mod.imports.map(i => ({ spec: i.spec, names: namesOf(i) })),
    ...mod.reExports.map(r => ({ spec: r.spec, names: null })),
  ];
  return specs.map(({ spec, names }) => {
    const hit = MG.resolveSpecifier(spec, absFile, ctx);
    return { spec, names, file: hit.kind === 'internal' ? toPosix(hit.file) : null, kind: hit.kind };
  });
}

/** `null` = namespace/default import: δεν ξέρουμε ονόματα, άρα το θεωρούμε «όλα» (fail-safe). */
function namesOf(imp) {
  if (imp.kind !== 'named') return null;
  return (imp.names || []).map(n => n.imported || n.local);
}

/**
 * Τα αρχεία που **ΕΙΣΑΓΟΥΝ ΠΡΑΓΜΑΤΙΚΑ** ένα από τα δηλωμένα module κελύφους.
 *
 * 🔴 **ΓΙΑΤΙ ΔΕΝ ΑΡΚΕΙ ΤΟ `gitGrepFiles` (ADR-777 §8.13, μετρημένο).** Το Κ3 έπαιρνε
 * την έξοδο του grep **ως ετυμηγορία**, ενώ το `git grep --fixed-strings` κοιτάζει
 * **ωμό κείμενο**: ένα αρχείο που απλώς **ονομάζει** το `@/components/app-header`
 * μέσα σε **σχόλιο** —για να εξηγήσει ότι *δεν* το εισάγει— καταγγελλόταν ως
 * `shell-outside-owner`. Πιάστηκε ζωντανά στο `PublicSiteHeader.tsx`, αρχείο που
 * τεκμηριώνει ρητά το σύνορο. **Φρουρός που πυροδοτεί σε σωστό κώδικα είναι ο
 * δρόμος προς το `SKIP_`** (μάθημα CHECK 3.50 `Σ7β`), και το ίδιο σφάλμα έχει
 * όνομα και στην CHECK 3.50 `Κ7β`: *σχόλιο που τεκμηριώνει τη βλάβη δεν είναι η
 * βλάβη*.
 *
 * 🔑 **Καμία νέα μηχανή.** Το grep μένει **προφίλτρο** — ακριβώς ο ρόλος που ήδη
 * παίζει στο {@link seedFiles} μία συνάρτηση παρακάτω — και την απάντηση τη δίνει το
 * **ίδιο** `importedModulesOf` που χρησιμοποιεί το Κ2. Η ασυμμετρία «Κ2 με AST, Κ3 με
 * κείμενο» **μέσα στην ίδια πύλη** ήταν το ελάττωμα.
 *
 * ⚠️ **Fail-closed:** αν το αρχείο δεν αναλύεται, μετριέται **ως** σημείο εισαγωγής.
 * Ένα zero-tolerance σύνορο δεν επιτρέπεται να διαβάσει «δεν μπόρεσα να κοιτάξω» ως
 * «καθαρό» — είναι το σχήμα «0 = κανείς δεν κοίταξε» που κυνηγά όλο το repo.
 */
function shellImportSites(projectRoot, ownerRel, specifiers, ctx) {
  const ownerAbs = toPosix(path.resolve(projectRoot, ownerRel));
  const shellFiles = new Set(
    specifiers
      .map(spec => MG.resolveSpecifier(spec, ownerAbs, ctx))
      .filter(hit => hit.kind === 'internal')
      .map(hit => toPosix(hit.file)),
  );
  const specSet = new Set(specifiers);

  return gitGrepFiles(projectRoot, specifiers).filter(rel => {
    const abs = toPosix(path.resolve(projectRoot, rel));
    try {
      return importedModulesOf(abs, ctx).some(
        imp => specSet.has(imp.spec) || (imp.file !== null && shellFiles.has(imp.file)),
      );
    } catch {
      return true; // αδιαφανές ⇒ μετριέται, ποτέ σιωπηλή απαλλαγή
    }
  });
}

/**
 * Σπόροι: τα αρχεία που εισάγουν **ονομαστικά** ένα από τα δηλωμένα αντιδραστικά hooks
 * από το δηλωμένο module. Επαληθευμένα με AST, όχι με κείμενο.
 */
function seedFiles(projectRoot, hookDecls, ctx) {
  const tokens = hookDecls.flatMap(d => d.names);
  const wanted = new Map(
    hookDecls.map(d => [toPosix(path.resolve(projectRoot, d.module)), new Set(d.names)]),
  );
  const seeds = new Set();

  for (const rel of gitGrepFiles(projectRoot, tokens)) {
    const abs = toPosix(path.resolve(projectRoot, rel));
    if (wanted.has(abs)) continue; // το ίδιο το module δεν είναι καταναλωτής του εαυτού του
    for (const imp of importedModulesOf(abs, ctx)) {
      const want = imp.file ? wanted.get(imp.file) : null;
      if (!want) continue;
      if (imp.names === null || imp.names.some(n => want.has(n))) seeds.add(abs);
    }
  }
  return seeds;
}

/**
 * Αντίστροφη κλειστότητα μέχρι σταθερό σημείο: ποιος εισάγει σημειωμένο αρχείο,
 * άμεσα ή μεταβατικά. Το προφίλτρο ανά γύρο είναι τα **basenames** του μετώπου·
 * ο AST κρίνει.
 */
function reachingFiles(projectRoot, seeds, ctx, maxRounds = 12) {
  const marked = new Set(seeds);
  let frontier = new Set(seeds);
  let rounds = 0;

  while (frontier.size > 0 && rounds < maxRounds) {
    rounds += 1;
    const tokens = [...frontier].map(f => path.basename(f).replace(/\.[jt]sx?$/, ''));
    const next = new Set();
    for (const rel of gitGrepFiles(projectRoot, tokens)) {
      const abs = toPosix(path.resolve(projectRoot, rel));
      if (marked.has(abs)) continue;
      const hits = importedModulesOf(abs, ctx);
      if (hits.some(h => h.file && frontier.has(h.file))) next.add(abs);
    }
    for (const f of next) marked.add(f);
    frontier = next;
  }

  if (rounds >= maxRounds && frontier.size > 0) {
    throw new Error(`CHECK 3.52: η αντίστροφη κλειστότητα δεν συνέκλινε σε ${maxRounds} γύρους`);
  }
  return marked;
}

/** @returns {Set<string>} απόλυτα posix μονοπάτια που φτάνουν σε δημόσια προβολή. */
function computePublicReaching(projectRoot, hookDecls) {
  const ctx = createResolveContext(projectRoot);
  return reachingFiles(projectRoot, seedFiles(projectRoot, hookDecls, ctx), ctx);
}

module.exports = {
  gitGrepFiles,
  shellImportSites,
  createResolveContext,
  importedModulesOf,
  seedFiles,
  reachingFiles,
  computePublicReaching,
};
