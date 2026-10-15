#!/usr/bin/env node
/**
 * =============================================================================
 * ADR-744 §31 — CHECK 3.34 F: Ο ΧΑΡΤΗΣ ΤΕΜΠΕΛΙΚΩΝ ΔΙΑΔΡΟΜΩΝ, ΞΑΝΑΧΤΙΣΜΕΝΟΣ ΣΤΟ LAYER 1
 * =============================================================================
 *
 * «Είναι το δεσμευμένο `lazy-route-namespaces.json` ΑΚΟΜΗ αυτό που παράγει ο κώδικας του commit;»
 *
 * 🔴 ΤΟ ΚΕΝΟ (μετρημένο 2026-10-15): οι κλειστότητες των τεμπέλικων διαδρομών έχουν **8.329** αρχεία,
 * από τα οποία **6.932** δεν είχαν ΚΑΜΙΑ εγγραφή στο Layer 1 (εκτός `shellFiles ∪ routeFiles`). Νέο
 * `useTranslation('x')` σε αυτά ⇒ `✅ OK` στο pre-commit, κόκκινο μόνο στο CI.
 *
 * 🔑 ΓΙΑΤΙ ΟΧΙ ΑΠΟΤΥΠΩΜΑ ΑΝΑ ΑΡΧΕΙΟ (Bazel-στυλ), ΜΕΤΡΗΜΕΝΟ: αναπαραγωγή 200 commits ⇒ το αποτύπωμα
 * θα κοκκίνιζε **88** (44%), ενώ η έξοδος άλλαξε σε **2 στα 246**. Ακρίβεια ~1% ⇒ παραβίαση του πήχη
 * ≤10% ψευδώς θετικά (N.12) — και +54..105% manifest. Ενδιάμεσο καταγεγραμμένο (T/M) παλιώνει μετά από
 * κάθε πράσινο commit χωρίς αναγέννηση (ADR-744 §31.3).
 *
 * 🏆 ΑΡΑ: ακριβής επανυπολογισμός της **ΕΞΟΔΟΥ** με on-demand γράφο (μόνο ό,τι διαβάζει ο walk) πάνω
 * στο ευρετήριο, + τοπική μνήμη κατά blob sha (`source-cache.js`). Κόκκινο **μόνο** όταν αλλάζει η
 * έξοδος. Μηδέν αύξηση manifest, μηδέν απόκλιση από το Layer 2 (ο ΙΔΙΟΣ `buildLazyRouteNamespaces`),
 * ακριβές και για barrels και ονόματα εισαγωγών — γιατί δεν είναι προσέγγιση του walk, ΕΙΝΑΙ ο walk.
 *
 * ⚠️ Η σκανδάλη είναι «σταδιοποιήθηκε module του `src`». Χωρίς αυτό ο χάρτης δεν μπορεί να αλλάξει
 * (οι καθολικές είσοδοι ανήκουν στο E) ⇒ τρέχει μόνο η φθηνή κρίση πάνω στο artifact (`judgeLazyArtifact`).
 *
 * @module scripts/lib/i18n-shell-slice/lazy-freshness
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { WHOLE_NAME } = require('./plan');
const LR = require('./lazy-routes');
const SC = require('./source-cache');
const { createLayerOnePass } = require('./layer-one-pass');

// ADR-744 §32 — ΕΝΑ κατηγόρημα με τις πηγές (ήταν γραμμένο εδώ δεύτερη φορά).
const isSourceModule = SC.isWalkedSource;

function readJson(file) {
  if (!fs.existsSync(file)) return { missing: true };
  try {
    return { value: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    return { invalid: true };
  }
}

/** Ό,τι ταξιδεύει ολόκληρο στο **δεσμευμένο** κέλυφος (η ακεραιότητά του είναι δουλειά του Α). */
function committedWholeNamespaces(root, config) {
  const read = readJson(path.join(root, config.outputDir, WHOLE_NAME));
  return Array.isArray(read.value) ? read.value : [];
}

/**
 * Ο χάρτης, από το μηδέν, με τον ΙΔΙΟ walker του γεννήτορα, πάνω στο ΚΟΙΝΟ πέρασμα (`layer-one-pass.js`).
 * ⚠️ ΔΕΝ κάνει `persist`: η μνήμη ανήκει στο πέρασμα (ο G τη συνεχίζει), και τη γράφει ο ιδιοκτήτης του.
 * @returns {{lazy: object, stats: object}}
 */
function rebuildLazyMap({ root, config, pass }) {
  const { graph, sources } = pass.commit();
  const lazy = LR.buildLazyRouteNamespaces({ projectRoot: root, config, graph, sources });
  return { lazy, stats: pass.stats() };
}

/** Ανά διαδρομή: ποιο namespace μπήκε (και **ποιο αρχείο** το ονομάζει) ή βγήκε. */
function describeRowDrift(committed, fresh, provenance) {
  const lines = [];
  for (const key of [...new Set([...Object.keys(committed), ...Object.keys(fresh)])].sort()) {
    const before = new Set(committed[key] || []);
    const after = new Set(fresh[key] || []);
    const origin = namespace => ((provenance.get(key) || new Map()).get(namespace) || [])[0];
    const added = [...after].filter(ns => !before.has(ns)).map(ns => `+${ns}${origin(ns) ? ` (από ${origin(ns)})` : ''}`);
    const removed = [...before].filter(ns => !after.has(ns)).map(ns => `−${ns}`);
    if (!(key in fresh)) lines.push(`${key}: η γραμμή δεν παράγεται πια`);
    else if (!(key in committed)) lines.push(`${key}: νέα γραμμή [${[...after].join(', ')}]`);
    else if (added.length + removed.length > 0) lines.push(`${key}: ${[...added, ...removed].join(' ')}`);
  }
  return lines;
}

/**
 * @param {object} args
 * @param {string[]} args.stagedFiles
 * @param {string} args.root      από πού διαβάζονται config, registries, artifacts (δίσκος ή στιγμιότυπο)
 * @param {object} [args.pass]    ADR-744 §32 — το ΚΟΙΝΟ πέρασμα του `runLayerOne`· χωρίς αυτό ανοίγει δικό
 *   του από `sources`/`cacheDir` και το γράφει στο τέλος (κλήση εκτός ελεγκτή)
 * @returns {{reasons: string[], stats: ?object}} `stats` = `null` όταν δεν χρειάστηκε επανυπολογισμός
 */
function checkLazyRouteFreshness(args) {
  const pass = args.pass || createLayerOnePass(args);
  try {
    return judgeFreshness({ ...args, pass });
  } catch (error) {
    // Μητρώο που δεν διαβάζεται, λίστα που άλλαξε σχήμα: ΕΥΡΗΜΑ με το μήνυμά του, ποτέ stack trace.
    return { reasons: [`F. ο χάρτης τεμπέλικων διαδρομών δεν μπορεί να κριθεί — ${error.message}`], stats: null };
  } finally {
    if (!args.pass) pass.persist();
  }
}

function judgeFreshness({ config, stagedFiles, root, pass }) {
  if (config.lazyRouteRegistries.length === 0) return { reasons: [], stats: null };
  const whole = committedWholeNamespaces(root, config);
  if (!stagedFiles.some(isSourceModule)) return { reasons: LR.judgeLazyArtifact(root, config, whole), stats: null };

  const artifact = LR.artifactPath(config);
  const committed = readJson(path.join(root, artifact));
  if (committed.missing) return { reasons: [`${artifact} is missing — οι τεμπέλικες διαδρομές δεν περιμένουν κανένα namespace.`], stats: null };
  if (committed.invalid) return { reasons: [`${artifact} is not valid JSON.`], stats: null };

  const started = Date.now();
  const { lazy, stats } = rebuildLazyMap({ root, config, pass });
  const reasons = [];
  if (LR.renderLazyArtifact(committed.value) !== LR.renderLazyArtifact(lazy.rows)) {
    const drift = describeRowDrift(committed.value, lazy.rows, lazy.provenance);
    reasons.push(`F. ο ${artifact} δεν είναι πια αυτό που παράγει ο κώδικας του commit — ${drift.join(' · ') || 'ίδιες γραμμές, άλλα bytes'}`);
  }
  reasons.push(...LR.judgeLazyRoutes(root, config, lazy, whole).verdicts);
  return { reasons, stats: { ...stats, ms: Date.now() - started } };
}

module.exports = { isSourceModule, committedWholeNamespaces, rebuildLazyMap, describeRowDrift, checkLazyRouteFreshness };
