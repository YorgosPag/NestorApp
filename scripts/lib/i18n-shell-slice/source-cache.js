#!/usr/bin/env node
/**
 * =============================================================================
 * ADR-744 §31 — ΟΙ ΠΗΓΕΣ ΤΟΥ ON-DEMAND ΓΡΑΦΟΥ, ΚΑΙ Η ΜΝΗΜΗ ΤΟΥΣ ΚΑΤΑ ΠΕΡΙΕΧΟΜΕΝΟ
 * =============================================================================
 *
 * «Από πού διαβάζει ο walk — και τι έχει ήδη διαβαστεί;»
 *
 * 🔑 ΔΥΟ ΠΗΓΕΣ, ΕΝΑ ΣΧΗΜΑ `{ root, files, readText, keyOf }`:
 *   · **ευρετήριο** (η πύλη `--index`): σύνολο αρχείων = `git ls-files -s` (με blob sha, δωρεάν)·
 *     κείμενο = ο δίσκος όπου ΔΕΝ αποκλίνει από το ευρετήριο, αλλιώς το blob (`git cat-file --batch`)
 *     σε ΕΝΑ spawn. Ξένη αστάδιοποίητη δουλειά δεν φτάνει ποτέ στην κρίση (μάθημα 2026-09-27).
 *   · **δίσκος** (Layer 1 χωρίς `--index`, tests): `collectSourceFiles`, κλειδί = git blob sha του κειμένου.
 *
 * 🏆 ΤΟ ΣΧΗΜΑ ΤΗΣ ΑΓΟΡΑΣ, ΚΑΙ ΤΙ ΠΑΡΑΠΑΝΩ ΚΑΝΟΥΜΕ: Turborepo/Nx κρατούν τοπική cache με κλειδί το
 * περιεχόμενο των εισόδων από το git index· Buck2 (DICE) κάνει early cutoff. Εδώ η cache κρατά μόνο
 * **ΤΟΠΙΚΑ ΓΕΓΟΝΟΤΑ** ανά αρχείο (module record + ό,τι ονομάζει χωρίς ξένη σταθερά) — ποτέ ενδιάμεσο
 * του walk, ποτέ ετυμηγορία. Το cutoff γίνεται πάνω στη **δεσμευμένη ΕΞΟΔΟ** (`lazy-freshness.js`).
 * Άρα η μνήμη μπορεί να κάνει την πύλη ΓΡΗΓΟΡΗ, ποτέ ΛΑΘΟΣ: ένα record που λείπει ξαναϋπολογίζεται.
 *
 * ⚠️ ΤΟ ΚΛΕΙΔΙ: `blob sha + μονοπάτι` (το parse εξαρτάται από την κατάληξη και το `isTest`) μέσα σε
 * χώρο ονομάτων = digest του **toolchain που τρέχει** + των bundles. Αλλάζει ο κώδικας του walk ⇒
 * νέος χώρος, η παλιά μνήμη σβήνεται. ΠΟΤΕ `mtime` (μάθημα CHECK 3.33).
 * ⚠️ Καμία αποτυχία της μνήμης δεν είναι σφάλμα: αστοχία ⇒ ξαναχτίζουμε (σύμβαση `unbound-identifiers.js`).
 *
 * Env: `I18N_SHELL_SLICE_NO_CACHE=1` — κρύο πέρασμα (μέτρηση, ή υποψία για τη μνήμη).
 *
 * @module scripts/lib/i18n-shell-slice/source-cache
 */

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const MG = require('../module-graph');
const { collectSourceFiles, isAnalysedSourcePath } = require('../module-graph/scan-config');
const { listIndexEntries, listTreeEntries, listWorktreeDivergence, readIndexTexts } = require('../git-index-snapshot');
const { stableStringify, sha256, toLf } = require('./slice-build');

/**
 * Αλλάζει όταν αλλάζει το ΣΧΗΜΑ των records ή όταν μια ΠΗΓΗ αποδείχθηκε λάθος — όχι ο κώδικας του
 * walk (εκείνον τον πιάνει το toolchain digest). 1→2: το `--filters` έδινε σκουπίδια κάτω από
 * σωστό blob sha (βλ. `readIndexTexts`) — records με σωστό κλειδί και λάθος περιεχόμενο.
 */
const CACHE_SCHEMA = 2;
const CACHE_REL = path.join('node_modules', '.cache', 'nestor', 'i18n-shell-slice');
const SOURCE_ROOTS = ['src'];

/** Το git blob sha ενός κειμένου — ίδιο με το `git hash-object` για τα ίδια bytes. */
function gitBlobSha(text) {
  const body = Buffer.from(text, 'utf8');
  return crypto.createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex');
}

function memoize(read) {
  const texts = new Map();
  return abs => {
    if (!texts.has(abs)) texts.set(abs, read(abs));
    return texts.get(abs);
  };
}

/** Η πηγή του **δίσκου**: ό,τι θα έβλεπε το `buildModuleGraph` του γεννήτορα. */
function createDiskSources(root) {
  const prefix = `${MG.toPosix(root)}/`;
  const readText = memoize(abs => (fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null));
  return {
    root,
    files: collectSourceFiles(root, SOURCE_ROOTS),
    readText,
    // ⚠️ hash του κειμένου με EOL σε LF: με `core.autocrlf=true` ο δίσκος έχει CRLF και το blob LF.
    // Χωρίς αυτό, κάθε εναλλαγή δίσκου/ευρετηρίου σάρωνε τα κλειδιά της άλλης (μετρημένο: 1.626 parses
    // σε «ζεστό» πέρασμα). Επιτρέπεται επειδή κανένα record δεν εξαρτάται από το EOL.
    keyOf(abs) {
      const text = readText(abs);
      return text === null ? null : `${gitBlobSha(toLf(text))} ${abs.slice(prefix.length)}`;
    },
    stats: () => ({ source: 'disk' }),
  };
}

/**
 * Η πηγή του **ευρετηρίου**. Τα απόλυτα μονοπάτια ζουν κάτω από το `root` (το στιγμιότυπο της
 * πύλης), ώστε ο γράφος να μιλά την ίδια γλώσσα με config/registries που διαβάζονται από εκεί.
 */
function createIndexSources({ repoRoot, root }) {
  const prefix = `${MG.toPosix(root)}/`;
  const entries = new Map([...listIndexEntries({ repoRoot })].filter(([rel]) => isWalkedSource(rel)));
  const divergent = [...listWorktreeDivergence({ repoRoot })].filter(rel => entries.has(rel));
  const fromIndex = readIndexTexts({ repoRoot, entries: divergent.map(rel => [rel, entries.get(rel)]) });
  const relOf = abs => (abs.startsWith(prefix) ? abs.slice(prefix.length) : null);
  const readText = memoize(abs => {
    const rel = relOf(abs);
    if (rel === null || !entries.has(rel)) return null;
    if (fromIndex.has(rel)) return fromIndex.get(rel);
    const disk = path.join(repoRoot, rel);
    return fs.existsSync(disk) ? fs.readFileSync(disk, 'utf8') : null;
  });
  return {
    root,
    files: [...entries.keys()].sort().map(rel => `${prefix}${rel}`),
    readText,
    keyOf(abs) {
      const rel = relOf(abs);
      return rel !== null && entries.has(rel) ? `${entries.get(rel)} ${rel}` : null;
    },
    stats: () => ({ source: 'index', divergent: divergent.length }),
  };
}

/**
 * Μία «συσκευασία» ανά χώρο ονομάτων: `{ schema, records: { κλειδί: { mod?, facts? } } }`.
 * Ένα αρχείο αντί για χιλιάδες (Windows: το άνοιγμα αρχείου είναι το ακριβό, όχι τα bytes).
 */
function openPack(dir, namespace) {
  const file = dir ? path.join(dir, `${namespace}.json`) : null;
  let records = {};
  if (file) {
    try {
      const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (stored && stored.schema === CACHE_SCHEMA && stored.records) records = stored.records;
    } catch { /* αστοχία μνήμης — ξαναχτίζουμε */ }
  }
  const counts = { hits: 0, misses: 0, records: Object.keys(records).length };
  // Mark-and-sweep: γράφεται ΜΟΝΟ ό,τι άγγιξε αυτό το πέρασμα ⇒ η μνήμη = το σύνολο εργασίας του
  // walk, ποτέ η ιστορία του repo (κάθε commit θα πρόσθετε records που κανείς δεν ξαναζητά).
  const touched = new Set();
  let dirty = false;
  return {
    counts,
    read(key, part) {
      const value = key && records[key] ? records[key][part] : undefined;
      counts[value === undefined ? 'misses' : 'hits'] += 1;
      if (value !== undefined) touched.add(key);
      return value;
    },
    write(key, part, value) {
      if (!key || !file) return;
      records[key] = { ...records[key], [part]: value };
      touched.add(key);
      dirty = true;
    },
    persist() {
      if (!file || (!dirty && touched.size === counts.records)) return;
      try {
        fs.mkdirSync(dir, { recursive: true });
        const tmp = `${file}.${process.pid}.tmp`;
        const kept = Object.fromEntries([...touched].sort().map(key => [key, records[key]]));
        fs.writeFileSync(tmp, JSON.stringify({ schema: CACHE_SCHEMA, records: kept }));
        fs.renameSync(tmp, file);   // ατομικό: παράλληλος πράκτορας βλέπει παλιό ή νέο, ποτέ μισό
        for (const other of fs.readdirSync(dir)) {
          if (other !== path.basename(file) && other.endsWith('.json')) fs.rmSync(path.join(dir, other), { force: true });
        }
      } catch { /* μόνο ταχύτητα — ποτέ ορθότητα */ }
    },
  };
}

/**
 * Ο χώρος ονομάτων: ο κώδικας που ΤΡΕΧΕΙ + ό,τι διαβάζουν τα τοπικά γεγονότα (bundles).
 * ⚠️ ΚΑΙ αυτό εδώ το αρχείο: ΔΕΝ ανήκει στην κλειστότητα του γεννήτορα (το toolchain digest δεν το
 * βλέπει), αλλά ορίζει το σχήμα των records — αλλαγή του χωρίς νέο χώρο θα διάβαζε παλιά μορφή.
 */
function cacheNamespace(root, config) {
  const GI = require('./global-inputs');
  const inputs = GI.GLOBAL_INPUTS.filter(input => input.id === 'toolchain' || input.id === 'namespaceBundles');
  const digest = GI.computeGlobalInputs(root, config, GI.CODE_ROOT, inputs);
  const self = sha256(toLf(fs.readFileSync(__filename, 'utf8')));
  return sha256(stableStringify({ schema: CACHE_SCHEMA, digest, self })).slice(0, 16);
}

/**
 * Συνδέει πηγή + μνήμη σε ό,τι δέχονται ο γράφος (`loadModule`) και οι readers (`facts`).
 *
 * @param {object} args
 * @param {object} args.sources  `createDiskSources` | `createIndexSources`
 * @param {?string} args.cacheDir  `null` ⇒ καμία μνήμη (κρύο πέρασμα)
 */
function createCachedSources({ sources, cacheDir, namespace }) {
  const pack = openPack(process.env.I18N_SHELL_SLICE_NO_CACHE === '1' ? null : cacheDir, namespace);
  return cachedView(sources, pack, { parses: 0 });
}

/**
 * Μία πηγή πάνω σε μία συσκευασία. ADR-744 §32 Β2 — `view(άλλη πηγή)` δίνει **δεύτερη** όψη (ο γονέας)
 * πάνω στην **ΙΔΙΑ** συσκευασία: δύο `openPack` στο ίδιο πέρασμα θα έσβηναν το ένα το άλλο στο
 * `persist` (mark-and-sweep: γράφεται μόνο ό,τι άγγιξε ΑΥΤΟ το αντικείμενο).
 */
function cachedView(sources, pack, counter) {
  const loadModule = (file, readText) => {
    const key = sources.keyOf(file);
    const stored = pack.read(key, 'mod');
    if (stored !== undefined) return { ...stored, file };
    counter.parses += 1;
    const mod = MG.parseGraphModule(file, readText(file));
    const portable = { ...mod };
    delete portable.file;   // το μονοπάτι του στιγμιότυπου αλλάζει σε κάθε τρέξιμο
    pack.write(key, 'mod', portable);
    return mod;
  };
  const facts = {
    get: abs => pack.read(sources.keyOf(abs), 'facts'),
    set: (abs, value) => pack.write(sources.keyOf(abs), 'facts', value),
  };
  return {
    files: sources.files,
    readText: sources.readText,
    loadModule,
    facts,
    persist: () => pack.persist(),
    stats: () => ({ ...sources.stats(), parses: counter.parses, ...pack.counts }),
    view: other => cachedView(other, pack, counter),
  };
}

/** `src/…` module που αναλύει ο walk — το κριτήριο του `collectSourceFiles` για μονοπάτια εκτός δίσκου. */
const isWalkedSource = rel => SOURCE_ROOTS.some(dir => rel.startsWith(`${dir}/`)) && isAnalysedSourcePath(rel);

/**
 * ADR-744 §32 Β2 — **Ο ΓΟΝΕΑΣ ΤΟΥ COMMIT, ΧΩΡΙΣ ΔΕΥΤΕΡΟ ΣΤΙΓΜΙΟΤΥΠΟ.**
 *
 * 🔑 Το δέντρο του `HEAD` είναι το δέντρο του ευρετηρίου **εκτός από τα σταδιοποιημένα**· άρα ο γονέας
 * είναι επικάλυψη της πηγής του commit μόνο σε αυτά (ένα `ls-tree` + ΕΝΑ `cat-file --batch`): όσα
 * προστέθηκαν βγαίνουν, όσα σβήστηκαν ξαναμπαίνουν, κλειδί = το blob του HEAD. Για κάθε άλλο αρχείο
 * τα κλειδιά συμπίπτουν ⇒ η μνήμη απαντά και για τις δύο καταστάσεις χωρίς δεύτερο parse.
 * ⚠️ Repo χωρίς commit (ή φάκελος χωρίς git) ⇒ `null`: ο καλών θεωρεί κάθε σταδιοποιημένο αλλαγμένο.
 *
 * @param {object} args
 * @param {object} args.sources   η πηγή του commit (`createIndexSources` | `createDiskSources`)
 * @param {string} args.repoRoot  από πού ρωτάμε το git
 * @param {string[]} args.staged  σχετικά μονοπάτια — μόνο τα modules του `src` μετράνε
 * @param {string} [args.rev]     ο γονέας· `HEAD` στο hook, `<c>^` στην αναπαραγωγή ιστορικού (§32.11)
 * @returns {?object} ίδιο σχήμα με τις άλλες πηγές
 */
function createParentSources({ sources, repoRoot, staged, rev = 'HEAD' }) {
  const touched = new Set(staged.filter(isWalkedSource));
  const head = listTreeEntries({ repoRoot, rev, paths: touched });
  if (head === null) return null;
  const texts = readIndexTexts({ repoRoot, entries: [...head] });
  const prefix = `${MG.toPosix(sources.root)}/`;
  const relOf = abs => (abs.startsWith(prefix) ? abs.slice(prefix.length) : null);
  const kept = sources.files.filter(abs => !touched.has(relOf(abs)));
  return {
    root: sources.root,
    files: [...kept, ...[...head.keys()].map(rel => `${prefix}${rel}`)].sort(),
    readText: abs => (touched.has(relOf(abs)) ? (texts.get(relOf(abs)) ?? null) : sources.readText(abs)),
    keyOf(abs) {
      const rel = relOf(abs);
      if (!touched.has(rel)) return sources.keyOf(abs);
      return head.has(rel) ? `${head.get(rel)} ${rel}` : null;
    },
    stats: () => ({ source: 'parent', staged: touched.size }),
  };
}

/**
 * ADR-744 §32 Β1 — **ΜΙΑ ανάλυση ανά αρχείο ανά πέρασμα**, κατά περιεχόμενο.
 *
 * 🔴 ΜΕΤΡΗΜΕΝΟ (§32.2): το κέλυφος + 67 διαδρομές ξανάλυναν το ΙΔΙΟ αρχείο σε κάθε κλειστότητα —
 * `extractSurface` 26.307 κλήσεις σε 2.568 αρχεία, τρία `createSourceFile` ανά κλήση. Το κόστος
 * ΔΕΝ ήταν ο γράφος (1–4 s), ήταν η επανάληψη: 184–240 s → ~55–60 s με έξοδο byte-ίδια.
 *
 * 🔑 ΚΛΕΙΔΙ = (αρχείο, μέρος) + **ταυτότητα της εισόδου** (`entry.input === input`): ίδιο κείμενο ⇒ ίδια
 * τιμή, γιατί κάθε μέρος είναι **καθαρή** συνάρτηση του κειμένου του (σχήμα Salsa: memo εισόδου → εξόδου).
 * Άλλο κείμενο ⇒ ξαναϋπολογίζεται· ποτέ μπαγιάτικη τιμή, ακόμη κι αν ο δίσκος αλλάξει μέσα στο πέρασμα.
 * ⚠️ Μόνο στη μνήμη, με διάρκεια ζωής **του γράφου** (`analysisFor`): ASTs δεν σειριοποιούνται, και η
 * μόνιμη μνήμη (`openPack`) κρατά μόνο τοπικά γεγονότα. ⚠️ Οι τιμές είναι κοινές ⇒ **μόνο ανάγνωση**.
 */
function createAnalysisMemo() {
  const entries = new Map();
  const counts = { hits: 0, misses: 0 };
  return {
    counts,
    once(file, part, input, compute) {
      const key = `${part}\0${file}`;
      const entry = entries.get(key);
      if (entry !== undefined && entry.input === input) { counts.hits += 1; return entry.value; }
      counts.misses += 1;
      const value = compute();
      entries.set(key, { input, value });
      return value;
    },
  };
}

/** Χωρίς μνήμη: ο ΙΔΙΟΣ κώδικας, κάθε κλήση υπολογίζει (γράφοι-δοκιμών, γράφος χωρίς ταυτότητα). */
const NO_ANALYSIS_MEMO = Object.freeze({ counts: Object.freeze({ hits: 0, misses: 0 }), once: (file, part, input, compute) => compute() });

const analysisMemos = new WeakMap();

/** Το memo **αυτού** του γράφου — ένα για κέλυφος + όλες τις διαδρομές του ίδιου περάσματος. */
function analysisFor(graph) {
  if (!graph || typeof graph !== 'object') return NO_ANALYSIS_MEMO;
  let memo = analysisMemos.get(graph);
  if (memo === undefined) {
    memo = createAnalysisMemo();
    analysisMemos.set(graph, memo);
  }
  return memo;
}

module.exports = {
  CACHE_SCHEMA,
  CACHE_REL,
  gitBlobSha,
  createDiskSources,
  createIndexSources,
  openPack,
  cacheNamespace,
  createCachedSources,
  createParentSources,
  isWalkedSource,
  createAnalysisMemo,
  NO_ANALYSIS_MEMO,
  analysisFor,
};
