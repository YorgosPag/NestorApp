#!/usr/bin/env node
/**
 * =============================================================================
 * ADR-280 §11.8 Β4.2 · ADR-279 §9 — Ο ΚΑΝΟΝΑΣ ΕΙΣΔΟΧΗΣ, ΠΑΡΑΓΟΜΕΝΟΣ ΚΑΙ ΚΡΙΝΟΜΕΝΟΣ
 * =============================================================================
 *
 * «Ό,τι μοντάρεται ΧΩΡΙΣ αλλαγή διαδρομής φέρνει τα κείμενά του;»
 *
 * Ως εδώ η απάντηση ήταν **χειρόγραφη** (ADR-279 §9: «βάλ' το στο `CRITICAL_NAMESPACES`»), άρα
 * κανείς δεν μπορούσε να βγάλει namespace από την εκκίνηση χωρίς να μαντέψει πού θα ζωγραφιστεί
 * ωμό κλειδί. Εδώ **παράγεται**, με την ΙΔΙΑ μηχανή του χάρτη τεμπέλικων διαδρομών:
 *
 *   για κάθε ρίζα R (σελίδα · layout · εγγραφή μητρώου) και κάθε όριο B που φτάνει από την R χωρίς
 *   αλλαγή διαδρομής (η ίδια η R + μεταβατικά κάθε `import()` που ΔΕΝ είναι εγγραφή μητρώου):
 *       ονόματα(B) ∖ εκκίνηση ⊆ γραμμή(R)
 *   όπου γραμμή(εγγραφής) = ό,τι περιμένει το chunk της, γραμμή(σελίδας/layout) = ∅.
 *
 * 🏆 Η πρακτική Google Closure / Meta fbt («τα κείμενα ταξιδεύουν με το chunk») γίνεται εδώ σε χρόνο
 * εκτέλεσης· το Lingui v4 την κάνει ανά **σελίδα** χωρίς πύλη. Εδώ: ανά **όριο chunk**, με πύλη.
 *
 * ⛔ **ΤΑΥΤΟΤΗΤΑ, ΠΟΤΕ BYTES.** Το υπάρχον χρέος είναι κλειστή απογραφή `(ρίζα ⟵ όριο) → [ns]` με
 * σφράγιση πλήθους που μόνο μειώνεται — η ΙΔΙΑ μηχανή απογραφής με το §27 (`lazy-route-census.js`).
 * 🔑 Το «μηδέν για μια οικογένεια που βγαίνει από την εκκίνηση» **δεν** χρειάζεται λίστα: όσο είναι
 * στην εκκίνηση δεν έχει χρέος, άρα μετά την έξοδο κάθε τριάδα της είναι **νέα** ⇒ κόκκινο.
 *
 * ⚠️ Θέλει **πρόθυμο** γράφο (απαρίθμηση σελίδων): τρέχει στον γεννήτορα και στο CI (Layer 2), ποτέ στο
 * hook — πρότυπο presubmit (ADR-280 §11.8 Β4.2, απόφαση Giorgio).
 *
 * @module scripts/lib/i18n-shell-slice/surface-coverage
 */

'use strict';

const path = require('node:path');

const MG = require('../module-graph');
const { ROUTE_BOUNDARY } = require('./shell-closure');
const {
  auditMountCensus,
  describeMountFailures,
  describeMountGrowth,
  announceMountSlack,
} = require('./lazy-route-census');

const ADMISSION_LEDGER = 'lazyAdmissionDebt';
const ADMISSION_SEAL = 'lazyAdmissionSeal';
const LABELS = Object.freeze({
  ledger: ADMISSION_LEDGER,
  seal: ADMISSION_SEAL,
  adr: 'ADR-280 §11.8 Β4.2',
  unit: 'τριάδες χρέους εισδοχής (ρίζα, όριο, namespace εκτός εκκίνησης)',
});
/** Το όριο που είναι η ίδια η ρίζα: η στατική της κλειστότητα. */
const STATIC = '(στατική)';
const SEPARATOR = ' ⟵ ';
const LAYOUT = /\/layout\.tsx?$/;

/** Αρχείο του `src/app` που αποδίδει χωρίς να το εισαγάγει κανείς: οι συμβάσεις του ROUTE_BOUNDARY + layout. */
const isRenderRoot = rel => rel.startsWith('src/app/') && (ROUTE_BOUNDARY.test(rel) || LAYOUT.test(rel));

const admissionKey = (rootId, boundary) => `${rootId}${SEPARATOR}${boundary}`;

/**
 * Οι ρίζες, και ποια αρχεία είναι στόχοι εγγραφών (εκείνα περιμένουν τη ΔΙΚΗ τους γραμμή — η διάσχιση σταματά εκεί).
 * @returns {{roots: {id: string, file: string, row: Set<string>}[], entryTargets: Set<string>}}
 */
function admissionRoots(projectRoot, graph, lazy) {
  const rel = file => MG.toPosix(path.relative(projectRoot, file));
  const routes = [...graph.fileSet].map(rel).filter(isRenderRoot).sort()
    .map(file => ({ id: file, file, row: new Set() }));
  const entries = [];
  const entryTargets = new Set();
  for (const entry of lazy.entries) {
    const target = lazy.tools.resolve(entry.spec, MG.toPosix(path.join(projectRoot, entry.registry)));
    if (target.kind !== 'internal') continue;   // το αναφέρει ήδη το `unresolved` του χάρτη
    const file = rel(target.file);
    entryTargets.add(file);
    entries.push({ id: `entry:${entry.key}`, file, row: new Set(lazy.rows[entry.key] || []) });
  }
  return { roots: [...routes, ...entries], entryTargets };
}

/** Η ρίζα και κάθε δυναμικό όριο που φτάνει χωρίς αλλαγή διαδρομής — μεταβατικά, σταματώντας στις εγγραφές. */
function boundariesOf(root, closureOf, entryTargets, projectRoot) {
  const abs = rel => MG.toPosix(path.join(projectRoot, rel));
  const out = [root.file];
  const seen = new Set(out);
  const pending = [...closureOf(abs(root.file)).dynamicBoundaries];
  while (pending.length > 0) {
    const boundary = pending.pop();
    if (seen.has(boundary) || entryTargets.has(boundary)) continue;
    seen.add(boundary);
    out.push(boundary);
    pending.push(...closureOf(abs(boundary)).dynamicBoundaries);
  }
  return out;
}

/**
 * Το **παρατηρούμενο** χρέος: `(ρίζα ⟵ όριο) → [ns εκτός εκκίνησης και εκτός γραμμής]`, + ποιο αρχείο ονομάζει το καθένα.
 * Καθαρή συνάρτηση του `boot`: με άλλο σύνολο εκκίνησης απαντά «τι θα έβλεπε η πύλη αν…» (Β4.3 → Β5).
 */
function admissionDebt({ projectRoot, graph, lazy, boot }) {
  const { closureOf, readFile, compat, supported, namespacesOfClosure } = lazy.tools;
  const { roots, entryTargets } = admissionRoots(projectRoot, graph, lazy);
  const debt = {};
  const provenance = new Map();
  for (const root of roots) {
    for (const boundary of boundariesOf(root, closureOf, entryTargets, projectRoot)) {
      const files = closureOf(MG.toPosix(path.join(projectRoot, boundary))).files;
      const from = namespacesOfClosure(files, readFile, compat, supported);
      const late = [...from.keys()].filter(ns => !boot.has(ns) && !root.row.has(ns)).sort();
      if (late.length === 0) continue;
      const key = admissionKey(root.id, boundary === root.file ? STATIC : boundary);
      debt[key] = late;
      provenance.set(key, from);
    }
  }
  return { debt, provenance };
}

/** Η κρίση: ίδια απογραφή Κ1 (ταυτότητα, και οι δύο κατευθύνσεις) + Κ2 (σφράγιση) με το §27. */
function judgeAdmission({ projectRoot, config, graph, lazy, boot }) {
  const { debt, provenance } = admissionDebt({ projectRoot, graph, lazy, boot });
  const audit = auditMountCensus(config[ADMISSION_LEDGER], debt, config[ADMISSION_SEAL]);
  const verdicts = [];
  if (audit.failures.length > 0) {
    verdicts.push(`ο κανόνας εισδοχής δεν κλείνει (ό,τι μοντάρεται χωρίς αλλαγή διαδρομής πρέπει να φέρνει τα κείμενά του — `
      + `εγγραφή μητρώου/επιφάνειας, ή γραμμή της ρίζας) — ${describeMountFailures(audit.failures, provenance, LABELS)}`);
  }
  if (audit.grew) verdicts.push(describeMountGrowth(audit, LABELS));
  return { debt, audit, verdicts, slack: announceMountSlack(audit, LABELS) };
}

module.exports = {
  ADMISSION_LEDGER,
  ADMISSION_SEAL,
  STATIC,
  admissionKey,
  isRenderRoot,
  admissionDebt,
  judgeAdmission,
};
