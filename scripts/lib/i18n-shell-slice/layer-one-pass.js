#!/usr/bin/env node
/**
 * =============================================================================
 * ADR-744 §32 — ΕΝΑ ΠΕΡΑΣΜΑ ΤΟΥ LAYER 1: πηγές + μνήμη + γράφοι, ΜΙΑ φορά, για τους F και G
 * =============================================================================
 *
 * «Ποιος ανοίγει τον γράφο του commit — και του γονέα του;»
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ο F (§31) άνοιγε μόνος του πηγές, συσκευασία μνήμης και on-demand γράφο. Ο G
 * χρειάζεται τον ΙΔΙΟ γράφο (και τον γονέα του). Δύο `openPack` στο ίδιο πέρασμα δεν είναι απλώς
 * διπλό κόστος — είναι **λάθος**: το `persist` κάνει mark-and-sweep με ό,τι άγγιξε το ΔΙΚΟ του
 * αντικείμενο, άρα το δεύτερο θα έσβηνε τη δουλειά του πρώτου και κάθε επόμενο commit θα πλήρωνε κρύο F.
 *
 * 🔑 ΤΕΜΠΕΛΙΚΟ ΚΑΙ ΚΟΙΝΟ: τίποτα δεν ανοίγει αν κανείς δεν το ζητήσει (commit μόνο με locales ⇒ 0 ms)·
 * ό,τι ανοίξει, το μοιράζονται όλοι. Ο γονέας ζει πάνω στην ΙΔΙΑ συσκευασία (`cached.view`), οπότε
 * κάθε αρχείο που ΔΕΝ σταδιοποιήθηκε έχει το ίδιο κλειδί και στις δύο καταστάσεις — μηδέν δεύτερο parse.
 * Σχήμα Buck2 DICE: ένας γράφος υπολογισμών ανά «έκδοση» (εδώ: γονέας / commit), κοινή μνήμη από κάτω.
 *
 * @module scripts/lib/i18n-shell-slice/layer-one-pass
 */

'use strict';

const path = require('node:path');

const MG = require('../module-graph');
const { TS_PATH_ALIAS_CONFIG } = require('./global-inputs');
const SC = require('./source-cache');

function openGraph(root, cached) {
  return MG.createOnDemandGraph({
    projectRoot: root,
    aliases: MG.readTsPathAliases(root, TS_PATH_ALIAS_CONFIG),
    files: cached.files,
    readText: cached.readText,
    loadModule: cached.loadModule,
    onParseError: () => {},
  });
}

/**
 * @param {object} args
 * @param {string} args.root        από πού διαβάζονται config/registries/artifacts (δίσκος ή στιγμιότυπο)
 * @param {object} args.config
 * @param {string[]} args.stagedFiles
 * @param {object} [args.sources]   `createIndexSources` (η πύλη `--index`)· προεπιλογή ο δίσκος του `root`
 * @param {?string} [args.cacheDir] `null` ⇒ καμία μνήμη· προεπιλογή `<root>/node_modules/.cache/…`
 * @param {string} [args.repoRoot]  από πού ρωτάμε το git για τον γονέα· προεπιλογή το `root`
 */
function createLayerOnePass({ root, config, stagedFiles, sources, cacheDir, repoRoot }) {
  let opened = null;
  const open = () => {
    if (opened === null) {
      const base = sources || SC.createDiskSources(root);
      const dir = cacheDir === undefined ? path.join(root, SC.CACHE_REL) : cacheDir;
      const cached = SC.createCachedSources({ sources: base, cacheDir: dir, namespace: SC.cacheNamespace(root, config) });
      opened = { base, cached, graph: openGraph(root, cached), parent: undefined };
    }
    return opened;
  };
  return {
    root,
    config,
    stagedFiles,
    /** Ο γράφος του **commit** και η μνήμη του (`sources` για τους readers του F). */
    commit() {
      const { graph, cached } = open();
      return { graph, sources: cached };
    },
    /** Ο γράφος του **γονέα** (`HEAD`), ή `null` όταν δεν υπάρχει γονέας. */
    parent() {
      const state = open();
      if (state.parent === undefined) {
        const parentSources = SC.createParentSources({ sources: state.base, repoRoot: repoRoot || root, staged: stagedFiles });
        state.parent = parentSources === null ? null : openGraph(root, state.cached.view(parentSources));
      }
      return state.parent;
    },
    opened: () => opened !== null,
    stats: () => (opened === null ? null : { ...opened.cached.stats(), modules: opened.graph.modules.size }),
    persist() { if (opened !== null) opened.cached.persist(); },
  };
}

module.exports = { createLayerOnePass };
