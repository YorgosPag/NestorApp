#!/usr/bin/env node
/**
 * ΤΟ ΔΕΥΤΕΡΟ ΚΑΤΑΣΤΙΧΟ ΤΟΥ CHECK 3.66 — «η ΠΗΓΗ και η ΠΡΟΒΟΛΗ συμφωνούν;» (ADR-8xx).
 *
 * Το πρώτο κατάστιχο ρωτά «τρέχει κάθε πύλη που είναι γραμμένη, και γράφεται κάθε πύλη που
 * τρέχει;». Αυτό ρωτά κάτι που ΚΑΝΕΝΑ εργαλείο της αγοράς δεν ρωτά:
 *
 *   🏆 Ο **rustc** εγγυάται ότι κάθε κωδικός σφάλματος έχει αρχείο (το `register_diagnostics!`
 *      κάνει `include_str!`, άρα λείπον αρχείο = σφάλμα μεταγλώττισης) — αλλά ΔΕΝ ρωτά αν το
 *      παραγόμενο ευρετήριο είναι ΦΡΕΣΚΟ ως προς τα αρχεία.
 *   🏆 Το **ESLint** (`require-meta-docs-url`) επιβάλλει ότι ο κανόνας ΔΗΛΩΝΕΙ URL — ποτέ ότι
 *      το URL ΛΥΝΕΤΑΙ σε υπαρκτό έγγραφο.
 *   ⇒ Εδώ επιβάλλονται **και τα τρία**: υπάρχει · λύνεται · είναι φρέσκο.
 *
 * ⚠️ ΞΕΧΩΡΙΣΤΟ ΚΑΤΑΣΤΙΧΟ, ΟΧΙ ΝΕΕΣ ΚΑΤΑΣΤΑΣΕΙΣ ΣΤΟ ΠΡΩΤΟ — και είναι απόφαση: η λογιστική του
 *    πρώτου κλείνει πάνω στον πληθυσμό «πύλες», ενώ εδώ ο πληθυσμός είναι «αρχεία πηγής».
 *    Ανάμειξη θα έσπαγε το `counted !== emitted` του πρώτου (πρότυπο ΔΥΟ ΚΑΤΑΣΤΙΧΩΝ, CHECK 3.50).
 *
 * ⚠️ ΟΛΕΣ ΟΙ ΚΑΤΑΣΤΑΣΕΙΣ ΕΙΝΑΙ ⛔ ZERO-TOL ΚΑΙ ΔΕΝ ΜΠΑΙΝΟΥΝ ΠΟΤΕ ΣΕ BASELINE: δεν υπάρχει
 *    «λιγότερο μπαγιάτικη τεκμηρίωση από χθες» — ένα μπαγιάτικο αρχείο αρκεί για να διαβάσει ο
 *    επόμενος κανόνα που δεν ισχύει. Το CHECK 3.33 έπιασε ακριβώς αυτό, μπαγιάτικο ΤΕΣΣΕΡΙΣ ΜΗΝΕΣ.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { readGateSources, GATES_DIR } = require('./source');

const STATES = {
  FRESH: 'source-fresh',
  STALE: 'stale-projection',
  MISSING: 'source-missing',
  ORPHAN: 'source-orphan',
  UNREADABLE: 'source-unreadable',
};

/** Κάθε κατάσταση εκτός της ✅ μπλοκάρει. Καμία baseline, ποτέ. */
const BLOCKING = [STATES.STALE, STATES.MISSING, STATES.ORPHAN, STATES.UNREADABLE];

/**
 * @param {{runs:Set<string>, rows:Set<string>}} inventory  η απογραφή του πρώτου καταστίχου
 * @returns {{tally:object, violations:Array, fingerprint:string|null}}
 */
function judgeFreshness(inventory, root = process.cwd()) {
  const tally = Object.fromEntries(Object.values(STATES).map((s) => [s, 0]));
  const violations = [];

  let sources, fingerprint = null;
  try {
    const read = readGateSources(root);
    sources = new Map(read.gates.map((g) => [g.gate, g]));
    fingerprint = read.fingerprint;
  } catch (e) {
    tally[STATES.UNREADABLE] = 1;
    violations.push({ state: STATES.UNREADABLE, id: GATES_DIR, detail: e.message });
    return { tally, violations, fingerprint };
  }

  // (α) Κάθε πύλη με γραμμή στον οδηγό ΟΦΕΙΛΕΙ πηγή — αλλιώς ο δείκτης 📘 δεν λύνεται.
  for (const gate of inventory.rows) {
    if (!sources.has(gate)) {
      tally[STATES.MISSING]++;
      violations.push({ state: STATES.MISSING, id: gate, detail: `γραμμή στον οδηγό χωρίς ${GATES_DIR}/${gate}.md` });
    }
  }

  // (β) Κάθε πηγή ΟΦΕΙΛΕΙ πύλη που τρέχει. Το μάθημα είναι του ADR-744: το `writeArtifacts`
  //     γράφει αλλά δεν κλαδεύει, οπότε σβησμένη δήλωση άφηνε αρχείο που ταξίδευε ΠΑΓΩΜΕΝΟ.
  for (const gate of sources.keys()) {
    if (!inventory.runs.has(gate) && !inventory.rows.has(gate)) {
      tally[STATES.ORPHAN]++;
      violations.push({ state: STATES.ORPHAN, id: gate, detail: `${GATES_DIR}/${gate}.md για πύλη που δεν τρέχει και δεν γράφεται` });
    } else {
      tally[STATES.FRESH]++;
    }
  }

  // (γ) Η ΠΡΟΒΟΛΗ συμφωνεί με την ΠΗΓΗ; Το αποτύπωμα ζει σε HTML σχόλιο μέσα στον οδηγό —
  //     τα block-level HTML σχόλια αφαιρούνται πριν φτάσουν στο context, άρα ο έλεγχος
  //     κοστίζει ΜΗΔΕΝ tokens. ⚠️ sha256 των ΕΙΣΟΔΩΝ, ΠΟΤΕ `mtime` (μάθημα CHECK 3.33).
  const guide = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
  const stamped = guide.match(/fingerprint:\s*sha256:([0-9a-f]{64})/);
  if (!stamped) {
    tally[STATES.STALE]++;
    violations.push({ state: STATES.STALE, id: 'CLAUDE.md', detail: 'λείπει το αποτύπωμα — ο πίνακας δεν είναι παραγόμενος' });
  } else if (stamped[1] !== fingerprint) {
    tally[STATES.STALE]++;
    violations.push({
      state: STATES.STALE,
      id: 'CLAUDE.md',
      detail: `αποτύπωμα ${stamped[1].slice(0, 12)}… ≠ πηγή ${fingerprint.slice(0, 12)}… — τρέξε: npm run gate-index:generate`,
    });
  }

  return { tally, violations, fingerprint };
}

module.exports = { judgeFreshness, STATES, BLOCKING };
