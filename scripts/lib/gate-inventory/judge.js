/**
 * CHECK 3.66 — Η ΚΡΙΣΗ (ADR-802). «Είναι κάθε πύλη που **τρέχει** γραμμένη στον οδηγό, και
 * κάθε γραμμή του οδηγού πύλη που **τρέχει**;»
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ**: μετρημένο 2026-08-25 — **τρεις** λίστες, **τρεις** αριθμοί για το ίδιο
 * δέντρο (εκτελεστής+hook **60** · CLAUDE.md **47** γραμμές · `precommit-checks.md` **33**
 * ενότητες). Το **CHECK 3.62** έτρεχε και **μπλόκαρε commits** χωρίς **καμία** γραμμή σε
 * κανένα από τα δύο έγγραφα. Ένας πράκτορας που το συναντά δεν έχει πού να διαβάσει τι είναι.
 *
 * ⚠️ Είναι το **ίδιο σχήμα** «δύο λίστες που αποκλίνουν» που έχει πληρωθεί **τέσσερις** φορές:
 * 3.34 (63 namespaces) · 3.37 (18 vs 26 workflows) · 3.49 (60 ADR) · 3.57 (19/20 env). Κάθε
 * φορά η θεραπεία ήταν **πύλη**, ποτέ «να θυμάται ο επόμενος».
 *
 * ## ΤΡΕΙΣ ΑΝΕΞΑΡΤΗΤΕΣ ΕΡΩΤΗΣΕΙΣ, ΠΟΤΕ ΜΙΑ ΜΕ «Ή»
 *   Κ1 🔴 τρέχει και **δεν αναφέρεται** πουθενά      → `undocumented-gate` (RATCHET)
 *   Κ2 ⛔ γραμμή **χωρίς εκτέλεση** και **χωρίς δήλωση** → `ghost-row`
 *   Κ3 ⛔ η δήλωση είναι **λάθος** (περιττή/ορφανή/χωρίς λόγο)
 *
 * ⚠️ **ΤΟ «ΜΟΝΟ ΣΕ ΠΡΟΖΑ» ΔΕΝ ΕΙΝΑΙ ΠΑΡΑΒΙΑΣΗ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ**: τα 3.7/3.18/3.28 ζουν
 * μέσα στους κανόνες **N.12** και **N.18**, που είναι η **σωστή** τους θέση. Απαίτηση για
 * γραμμή πίνακα θα ήταν απαίτηση **διπλότυπου** — ακριβώς το πρόβλημα που η πύλη λύνει.
 * Μετρήθηκαν **5** τέτοιες· ως παραβιάσεις θα ήταν **35% ψευδώς θετικά** (πήχης <10%).
 */

'use strict';

const { byGateNumber } = require('./inventory');

const STATES = {
  UNDOCUMENTED: 'undocumented-gate',
  GHOST_ROW: 'ghost-row',
  REDUNDANT_DECLARATION: 'redundant-declaration',
  ORPHAN_DECLARATION: 'orphan-declaration',
  REASONLESS_DECLARATION: 'reasonless-declaration',
  PROSE_ONLY: 'prose-only',
  DOCUMENTED: 'documented-gate',
  DECLARED_CI_ONLY: 'declared-ci-only',
};

/** ⛔ Μπλοκάρουν πάντα — **ΔΕΝ μπαίνουν ΠΟΤΕ σε baseline** (δες `buildPayload`). */
const BLOCKING = [
  STATES.GHOST_ROW,
  STATES.REDUNDANT_DECLARATION,
  STATES.ORPHAN_DECLARATION,
  STATES.REASONLESS_DECLARATION,
];

const MIN_REASON_LENGTH = 40;

/**
 * Κρίνει την απογραφή. Κάθε πύλη και κάθε δήλωση παίρνει **ακριβώς μία** κατάσταση, και το
 * άθροισμα των κάδων **πρέπει** να ισούται με τον πληθυσμό — αλλιώς `throw` **με όνομα**.
 */
function judge(inv) {
  const rows = [];
  const push = (state, id, detail) => rows.push({ state, id, detail });
  const declared = new Set(Object.keys(inv.declarations));

  for (const id of [...inv.runs].sort(byGateNumber)) {
    if (declared.has(id)) { push(STATES.REDUNDANT_DECLARATION, id, 'δηλώθηκε «μόνο CI» αλλά ΤΡΕΧΕΙ — σβήσε τη δήλωση'); continue; }
    if (inv.rows.has(id)) { push(STATES.DOCUMENTED, id, 'τρέχει + γραμμή πίνακα'); continue; }
    if (inv.mentions.has(id)) { push(STATES.PROSE_ONLY, id, 'τρέχει· τεκμηριωμένη σε κανόνα, όχι σε γραμμή πίνακα'); continue; }
    push(STATES.UNDOCUMENTED, id, 'ΤΡΕΧΕΙ και ΜΠΛΟΚΑΡΕΙ χωρίς καμία αναφορά στο CLAUDE.md');
  }

  for (const id of [...inv.rows].sort(byGateNumber)) {
    if (inv.runs.has(id) || declared.has(id)) continue;
    push(STATES.GHOST_ROW, id, 'γραμμή για πύλη που δεν τρέχει πουθενά — ούτε δηλώθηκε ως μόνο-CI');
  }

  for (const id of [...declared].sort(byGateNumber)) {
    if (inv.runs.has(id)) continue; // ήδη REDUNDANT παραπάνω
    const reason = inv.declarations[id] && inv.declarations[id].reason;
    if (typeof reason !== 'string' || reason.trim().length < MIN_REASON_LENGTH) {
      push(STATES.REASONLESS_DECLARATION, id, `ο λόγος είναι ΥΠΟΧΡΕΩΤΙΚΟΣ και >=${MIN_REASON_LENGTH} χαρακτήρες`);
      continue;
    }
    if (!inv.rows.has(id)) { push(STATES.ORPHAN_DECLARATION, id, 'δηλώθηκε μόνο-CI αλλά ΔΕΝ έχει γραμμή — τι τεκμηριώνει;'); continue; }
    push(STATES.DECLARED_CI_ONLY, id, reason);
  }

  return { rows, tally: tallyOf(rows), inv };
}

/** Κλειστή λογιστική fail-closed: άγνωστη κατάσταση ⇒ `throw` **με όνομα**. */
function tallyOf(rows) {
  const known = new Set(Object.values(STATES));
  const tally = Object.fromEntries([...known].map((s) => [s, 0]));
  for (const r of rows) {
    if (!known.has(r.state)) throw new Error(`CHECK 3.66 — άγνωστη κατάσταση «${r.state}»`);
    tally[r.state] += 1;
  }
  return tally;
}

const idsOf = (verdict, state) => verdict.rows.filter((r) => r.state === state).map((r) => r.id);

module.exports = { STATES, BLOCKING, MIN_REASON_LENGTH, judge, tallyOf, idsOf };
