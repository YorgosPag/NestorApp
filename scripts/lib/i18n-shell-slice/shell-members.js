#!/usr/bin/env node
/**
 * =============================================================================
 * ADR-744 §32.12 — ΤΑ ΜΕΛΗ ΤΟΥ ΚΕΛΥΦΟΥΣ: ΕΡΩΤΗΜΑ, ΟΧΙ ΔΕΣΜΕΥΜΕΝΟ ΑΡΧΕΙΟ — με ΕΠΑΛΗΘΕΥΣΙΜΟ ΙΧΝΟΣ
 * =============================================================================
 *
 * «Ποια modules ζωγραφίζουν στο πρώτο καρέ — για το δέντρο που θα μπει ΣΤΟ COMMIT;»
 *
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΖΕΙ ΠΙΑ ΣΤΟ MANIFEST (μετρημένο, αναπαραγωγή 200 commits): 25 από τα 45 σωστά κόκκινα
 * του CHECK 3.34 G άλλαζαν ΜΟΝΟ μέλη/όρια/μετρητές — τίποτα που ταξιδεύει στον browser. Κάθε ένα
 * = αναγέννηση ~111 s. Ο μόνος καταναλωτής ήταν το CHECK 3.51 Layer 1. Δεσμευμένο παράγωγο που κανείς
 * δεν στέλνει είναι **cache μέσα στο VCS** (Bazel/Buck2: οι έξοδοι ΠΟΤΕ στο VCS· η τοπολογία είναι `query`).
 *
 * 🏆 ΤΟ ΣΧΗΜΑ — «verifying trace» με early cutoff (Shake· Mokhov, Mitchell, Peyton Jones, *Build Systems
 * à la Carte*, 2018), τοπικά, ΕΚΤΟΣ git. Ο walk καταγράφει ΟΛΑ όσα ρώτησε:
 *   · **περιεχόμενο** — το κλειδί (git blob sha) κάθε module που διάβασε (μέλη · barrels · ρίζες)·
 *   · **ύπαρξη** — ΚΑΘΕ `fileSet.has` του resolver, ΚΑΙ τα αρνητικά (αρνητικές εξαρτήσεις: το νέο αρχείο που
 *     λύνει άλυτο specifier, ή σκιάζει `x/index.ts` με `x.ts`, είναι ακριβώς ένα «όχι» που έγινε «ναι»)·
 *   · **ρίζες** — ό,τι βλέπουν τα μοτίβα (`src/app/**\/layout.tsx`): η ΜΟΝΗ εξάρτηση από το ΣΥΝΟΛΟ αρχείων·
 *   · **κλειδί** — toolchain + bundles (χώρος ονομάτων της μνήμης) + config + aliases + αυτό το αρχείο.
 * Ίχνος που απαντά «ίδιο» σε όλα ⇒ τα μέλη του, 0 walk. Αλλιώς walk + νέο ίχνος.
 *
 * ΠΑΡΑΠΑΝΩ ΑΠΟ ΤΟ ΑΠΛΟ ΑΠΟΤΥΠΩΜΑ ΣΥΝΟΛΟΥ ΑΡΧΕΙΩΝ: μετρημένο, 129/200 commits προσθέτουν/σβήνουν/μετονομάζουν
 * module του `src` — αποτύπωμα του συνόλου θα ακύρωνε το ίχνος στα 2/3. Οι καταγεγραμμένοι έλεγχοι ύπαρξης
 * ακυρώνουν ΜΟΝΟ όταν αλλάζει απάντηση που ο walk ΟΝΤΩΣ ρώτησε.
 *
 * ⚠️ Η ΜΝΗΜΗ ΚΑΝΕΙ ΓΡΗΓΟΡΟ, ΠΟΤΕ ΛΑΘΟΣ: ίχνος που λείπει / αλλοιώθηκε / άλλο σχήμα ⇒ walk. `cacheDir = null`
 * ή `I18N_SHELL_SLICE_NO_CACHE=1` ⇒ πάντα walk. Το CHECK 3.51 Layer 2 (CI) ξαναχτίζει από το μηδέν.
 * ⚠️ Δικός του φάκελος (`…-trace`): το `openPack.persist` σκουπίζει κάθε άλλο `.json` στον φάκελο της μνήμης.
 * ⚠️ Η συσκευασία της μνήμης ΔΕΝ γράφεται εδώ: walk μόνο του κελύφους θα τη στένευε (mark-and-sweep) στο
 * κέλυφος και θα έσβηνε τα records των διαδρομών που κρατά ο G.
 *
 * @module scripts/lib/i18n-shell-slice/shell-members
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MG = require('../module-graph');
const GI = require('./global-inputs');
const P = require('./plan');
const SC = require('./source-cache');
const { computeShellClosure } = require('./shell-closure');
const { createLayerOnePass } = require('./layer-one-pass');
const { stableStringify, sha256, toLf } = require('./slice-build');

/** Αλλάζει όταν αλλάζει το σχήμα του ίχνους (ο κώδικας το πιάνει ήδη το `self`). */
const TRACE_SCHEMA = 1;
const TRACE_FILE = 'shell-members.json';
/** Οι καθολικές είσοδοι του walk που ΔΕΝ καλύπτει ήδη ο χώρος ονομάτων της μνήμης (toolchain + bundles). */
const TRACE_INPUTS = Object.freeze(['config', 'tsPathAliases']);

const traceFileOf = cacheDir => path.join(`${cacheDir}-trace`, TRACE_FILE);
const prefixOf = root => `${MG.toPosix(root)}/`;

/** Σχετικό με τη ρίζα· ό,τι είναι ΕΞΩ από αυτήν σημαδεύεται, ώστε να μη συμπέσει ποτέ με αρχείο της. */
function relTo(prefix, abs) {
  return abs.startsWith(prefix) ? abs.slice(prefix.length) : `!${abs}`;
}

function traceKey(root, config) {
  const inputs = GI.computeGlobalInputs(root, config, GI.CODE_ROOT, GI.GLOBAL_INPUTS.filter(input => TRACE_INPUTS.includes(input.id)));
  const self = sha256(toLf(fs.readFileSync(__filename, 'utf8')));
  return sha256(stableStringify({ schema: TRACE_SCHEMA, namespace: SC.cacheNamespace(root, config), inputs, self }));
}

/**
 * Ο ΙΔΙΟΣ γράφος, με όψη που καταγράφει κάθε ερώτηση ύπαρξης και κάθε ανάγνωση module.
 * Ο walk δεν αλλάζει — μόνο παρατηρείται (ίδια τεχνική με το `consulted` του `computeShellClosure`).
 */
function observedGraph(graph, probes, reads) {
  const fileSet = {
    has(file) {
      const present = graph.fileSet.has(file);
      probes.set(file, present);
      return present;
    },
    [Symbol.iterator]: () => graph.fileSet[Symbol.iterator](),
    get size() { return graph.fileSet.size; },
  };
  const get = file => {
    reads.add(file);
    return graph.modules.get(file);
  };
  const modules = { get, has: file => get(file) !== undefined, get size() { return graph.modules.size; } };
  return { ...graph, fileSet, modules };
}

/** Ο walk του γεννήτορα (`resolveRoots` + `computeShellClosure`), παρατηρημένος. */
function walkShell(root, config, graph) {
  const probes = new Map();
  const reads = new Set();
  const observed = observedGraph(graph, probes, reads);
  const roots = P.resolveRoots(root, config, observed);
  const closure = computeShellClosure(observed, roots, { resolve: MG.createResolver(observed) });
  return { members: closure.files, probes, reads };
}

function recordTrace({ key, root, config, sources, walk }) {
  const prefix = prefixOf(root);
  const rel = abs => relTo(prefix, abs);
  const byPresence = want => [...walk.probes].filter(([, present]) => present === want).map(([abs]) => rel(abs)).sort();
  return {
    schema: TRACE_SCHEMA,
    key,
    members: walk.members,
    roots: P.rootPatternCandidates(root, config, sources.files).map(rel),
    present: byPresence(true),
    absent: byPresence(false),
    reads: Object.fromEntries([...walk.reads].map(abs => [rel(abs), sources.keyOf(abs) ?? null]).sort(([a], [b]) => (a < b ? -1 : 1))),
  };
}

/** `null` = το ίχνος ισχύει για αυτό το δέντρο· αλλιώς ο ΠΡΩΤΟΣ λόγος που δεν ισχύει. */
function verifyTrace(trace, { key, root, config, sources }) {
  if (!trace || trace.schema !== TRACE_SCHEMA) return 'κανένα ίχνος';
  if (trace.key !== key) return 'άλλαξε καθολική είσοδος (toolchain · config · aliases)';
  const prefix = prefixOf(root);
  const files = new Set(sources.files);
  const roots = P.rootPatternCandidates(root, config, sources.files).map(abs => relTo(prefix, abs));
  if (stableStringify(roots) !== stableStringify(trace.roots)) return 'άλλαξαν οι υποψήφιες ρίζες';
  const flipped = trace.present.find(rel => !files.has(prefix + rel)) || trace.absent.find(rel => files.has(prefix + rel));
  if (flipped !== undefined) return `άλλαξε η ύπαρξη του ${flipped}`;
  const edited = Object.keys(trace.reads).find(rel => (sources.keyOf(prefix + rel) ?? null) !== trace.reads[rel]);
  return edited === undefined ? null : `άλλαξε το ${edited}`;
}

/** Κλειδί που δεν υπολογίζεται (λείπει bundle/config στο δέντρο) ⇒ καμία μνήμη: ο walk θα πει το γιατί. */
function keyOrNull(root, config) {
  try {
    return traceKey(root, config);
  } catch {
    return null;
  }
}

function readTrace(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;   // αστοχία μνήμης — ξαναπερπατάμε
  }
}

/**
 * @param {object} args
 * @param {string} args.root      από πού διαβάζονται config/aliases/bundles (δίσκος ή στιγμιότυπο ευρετηρίου)
 * @param {object} args.config
 * @param {object} args.sources   `createIndexSources` | `createDiskSources` — το δέντρο που κρίνεται
 * @param {?string} args.cacheDir η μνήμη της πύλης (`<repo>/CACHE_REL`)· `null` ⇒ πάντα walk, κανένα ίχνος
 * @returns {{members: string[], walked: boolean, reason: ?string, ms: number}}
 *   `reason` = γιατί περπατήσαμε (`null` όταν απάντησε το ίχνος)
 */
function shellMembersFor({ root, config, sources, cacheDir }) {
  const started = Date.now();
  const file = cacheDir && process.env.I18N_SHELL_SLICE_NO_CACHE !== '1' ? traceFileOf(cacheDir) : null;
  const key = file === null ? null : keyOrNull(root, config);
  const trace = key === null ? null : readTrace(file);
  const reason = key === null ? 'χωρίς μνήμη' : verifyTrace(trace, { key, root, config, sources });
  if (reason === null) return { members: trace.members, walked: false, reason, ms: Date.now() - started };

  // Χωρίς κλειδί δεν υπάρχει ούτε χώρος ονομάτων για τη συσκευασία ⇒ walk χωρίς μνήμη.
  const pass = createLayerOnePass({ root, config, stagedFiles: [], sources, cacheDir: key === null ? null : cacheDir });
  const walk = walkShell(root, config, pass.commit().graph);
  if (key !== null) {
    try {
      SC.writeFileAtomic(file, JSON.stringify(recordTrace({ key, root, config, sources, walk })));
    } catch { /* μόνο ταχύτητα — ποτέ ορθότητα */ }
  }
  return { members: walk.members, walked: true, reason, ms: Date.now() - started };
}

module.exports = { TRACE_SCHEMA, traceFileOf, walkShell, recordTrace, verifyTrace, shellMembersFor };
