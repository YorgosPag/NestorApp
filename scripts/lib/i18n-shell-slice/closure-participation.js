#!/usr/bin/env node
/**
 * =============================================================================
 * ADR-744 §32 Β3 — «ΠΟΙΕΣ ΚΛΕΙΣΤΟΤΗΤΕΣ ΑΓΓΙΖΕΙ ΑΥΤΗ Η ΑΛΛΑΓΗ;» — με τον ΙΔΙΟ walk, όχι με πίνακα
 * =============================================================================
 *
 * 🔴 ΓΙΑΤΙ ΟΧΙ ΠΙΝΑΚΑΣ ΜΕΛΩΝ (οι `shellFiles`/`routeFiles` του manifest — αποσύρθηκαν, §32.11): μια κλειστότητα μεγαλώνει χωρίς να αλλάξει η
 * έξοδος, οπότε ο πίνακας μένει πίσω μετά από κάθε πράσινο commit — fail-open (§32.5 #3). Εδώ η
 * συμμετοχή **ξαναϋπολογίζεται** με τον walk του γεννήτορα (`computeShellClosure`) πάνω στον on-demand
 * γράφο, όπου τα records έρχονται από τη μνήμη κατά blob (§31).
 *
 * 🔑 ΔΥΟ ΚΑΤΑΣΤΑΣΕΙΣ, ΟΧΙ ΜΙΑ (σχήμα Salsa: «άλλαξε εξάρτηση **που διαβάστηκε**»). Μια κλειστότητα
 * επηρεάζεται όταν ένα αλλαγμένο αρχείο είναι μέλος της ή διαβάστηκε από αυτήν (`consulted`, barrels)
 * **στον γονέα Ή στο commit**:
 *   · νέο αρχείο / νέα ακμή / αρχείο που λύνει άλυτο specifier ⇒ μέλος μόνο στο commit;
 *   · σβησμένο αρχείο / κομμένη ακμή ⇒ μέλος μόνο στον γονέα;
 *   · re-export που ξαναγράφτηκε σε barrel ⇒ `consulted` σε μία από τις δύο.
 * Αρχείο που ΚΑΜΙΑ κατάσταση δεν διάβασε δεν μπορεί να αλλάξει τον walk: ο walk διαβάζει μόνο ό,τι
 * συναντά, και ό,τι συνάντησε είναι αμετάβλητο. Αυτό κλείνει και την ερώτηση του ελέγχου D.
 *
 * @module scripts/lib/i18n-shell-slice/closure-participation
 */

'use strict';

const path = require('node:path');

const MG = require('../module-graph');
const { computeShellClosure } = require('./shell-closure');
const { resolveRoots } = require('./plan');

const SHELL = 'shell';

/** Οι κλειστότητες που παράγουν artifact: το κέλυφος + κάθε δηλωμένη διαδρομή (`page` = ρίζα της). */
function closureTargets(config) {
  return [
    { id: SHELL, page: null },
    ...Object.keys(config.routeSlices || {}).sort().map(page => ({ id: page, page })),
  ];
}

function rootsFor(root, config, graph, target) {
  if (target.page === null) return resolveRoots(root, config, graph);
  const abs = MG.toPosix(path.join(root, target.page));
  if (!graph.fileSet.has(abs)) throw new Error(`route page not found: ${target.page}`);
  return [abs];
}

/**
 * Τα μέλη + ό,τι διάβασε ο walk, ανά κλειστότητα, σε ΜΙΑ κατάσταση. Ρίζα που δεν λύνεται ⇒ `null`
 * («δεν ξέρω») — ο καλών την κρίνει επηρεαζόμενη και αφήνει τον επανυπολογισμό να πει το γιατί.
 */
function readClosures(root, config, graph, targets) {
  const resolve = MG.createResolver(graph);   // καθαρή συνάρτηση (spec, from) ⇒ κοινή (§31.4)
  const out = new Map();
  for (const target of targets) {
    try {
      const closure = computeShellClosure(graph, rootsFor(root, config, graph, target), { resolve });
      out.set(target.id, new Set([...closure.files, ...closure.consulted]));
    } catch {
      out.set(target.id, null);
    }
  }
  return out;
}

/**
 * @param {object} args
 * @param {string} args.root
 * @param {object} args.config
 * @param {object[]} args.graphs   ο γράφος του commit και (αν υπάρχει) του γονέα
 * @param {string[]} args.changed  σχετικά μονοπάτια των αρχείων που άλλαξαν αποτύπωμα
 * @returns {{shell: boolean, routes: string[], walks: number}} `routes` = σελίδες (κλειδιά `routeSlices`)
 */
function affectedClosures({ root, config, graphs, changed }) {
  const targets = closureTargets(config);
  const touched = new Set(changed);
  const hit = new Set();
  for (const graph of graphs) {
    const closures = readClosures(root, config, graph, targets);
    for (const [id, members] of closures) {
      if (members === null || [...touched].some(rel => members.has(rel))) hit.add(id);
    }
  }
  return {
    shell: hit.has(SHELL),
    routes: targets.filter(target => target.page !== null && hit.has(target.id)).map(target => target.page),
    walks: targets.length * graphs.length,
  };
}

module.exports = { affectedClosures };
