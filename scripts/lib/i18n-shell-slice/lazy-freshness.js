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

const MG = require('../module-graph');
const { isAnalysedSourcePath } = require('../module-graph/scan-config');
const { TS_PATH_ALIAS_CONFIG } = require('./global-inputs');
const { WHOLE_NAME } = require('./plan');
const LR = require('./lazy-routes');
const SC = require('./source-cache');

const isSourceModule = rel => rel.startsWith('src/') && isAnalysedSourcePath(rel);

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
 * Ο χάρτης, από το μηδέν, με τον ΙΔΙΟ walker του γεννήτορα.
 * @returns {{lazy: object, stats: object}}
 */
function rebuildLazyMap({ root, config, sources, cacheDir }) {
  const cached = SC.createCachedSources({ sources, cacheDir, namespace: SC.cacheNamespace(root, config) });
  const graph = MG.createOnDemandGraph({
    projectRoot: root,
    aliases: MG.readTsPathAliases(root, TS_PATH_ALIAS_CONFIG),
    files: cached.files,
    readText: cached.readText,
    loadModule: cached.loadModule,
    onParseError: () => {},
  });
  const lazy = LR.buildLazyRouteNamespaces({ projectRoot: root, config, graph, sources: cached });
  cached.persist();
  return { lazy, stats: { ...cached.stats(), modules: graph.modules.size } };
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
 * @param {object} [args.sources] `createIndexSources` για την πύλη `--index`· προεπιλογή ο δίσκος του `root`
 * @param {?string} [args.cacheDir]
 * @returns {{reasons: string[], stats: ?object}} `stats` = `null` όταν δεν χρειάστηκε επανυπολογισμός
 */
function checkLazyRouteFreshness({ config, stagedFiles, root, sources, cacheDir }) {
  if (config.lazyRouteRegistries.length === 0) return { reasons: [], stats: null };
  const whole = committedWholeNamespaces(root, config);
  if (!stagedFiles.some(isSourceModule)) return { reasons: LR.judgeLazyArtifact(root, config, whole), stats: null };

  const artifact = LR.artifactPath(config);
  const committed = readJson(path.join(root, artifact));
  if (committed.missing) return { reasons: [`${artifact} is missing — οι τεμπέλικες διαδρομές δεν περιμένουν κανένα namespace.`], stats: null };
  if (committed.invalid) return { reasons: [`${artifact} is not valid JSON.`], stats: null };

  const started = Date.now();
  const { lazy, stats } = rebuildLazyMap({
    root, config, sources: sources || SC.createDiskSources(root), cacheDir: cacheDir === undefined ? path.join(root, SC.CACHE_REL) : cacheDir,
  });
  const reasons = [];
  if (LR.renderLazyArtifact(committed.value) !== LR.renderLazyArtifact(lazy.rows)) {
    const drift = describeRowDrift(committed.value, lazy.rows, lazy.provenance);
    reasons.push(`F. ο ${artifact} δεν είναι πια αυτό που παράγει ο κώδικας του commit — ${drift.join(' · ') || 'ίδιες γραμμές, άλλα bytes'}`);
  }
  reasons.push(...LR.judgeLazyRoutes(root, config, lazy, whole).verdicts);
  return { reasons, stats: { ...stats, ms: Date.now() - started } };
}

module.exports = { isSourceModule, committedWholeNamespaces, rebuildLazyMap, describeRowDrift, checkLazyRouteFreshness };
