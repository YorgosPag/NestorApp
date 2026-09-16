/**
 * CHECK 3.84 / ADR-863 — Η ΚΡΙΣΗ: ΤΑΞΙΔΕΥΕΙ ΤΟ ΚΕΙΜΕΝΟ ΜΑΖΙ ΜΕ ΤΟ ΑΝΤΙΓΡΑΦΟ;
 *
 * Καθαρό, χωρίς I/O: παίρνει πολιτική + απογραφή + αναλυτή κειμένου, επιστρέφει γραμμές και
 * **κλειστή** λογιστική. Κάθε πακέτο παίρνει **ακριβώς μία** κατάσταση· άγνωστη ⇒ `throw` με
 * όνομα (πρότυπο `tallyOf` του CHECK 3.69 και `tally` του CHECK 12).
 *
 * ## 🔴 Γιατί υπάρχει — το τυφλό σημείο ΔΥΟ πυλών, μετρημένο 2026-09-16
 *
 * Το **CHECK 12** ρωτά «**επιτρέπεται** αυτή η άδεια;» και απαντά για **1.071** πακέτα prod.
 * Το **CHECK 3.69** ρωτά «ταξιδεύει το κείμενο;» αλλά **μόνο** για γραμματοσειρές — **έξι**
 * αρχεία. Ανάμεσά τους υπήρχε κενό που **καμία** πύλη δεν κάλυπτε: τα **npm πακέτα που
 * κατεβαίνουν στον browser**. Η απάντηση ήταν «καμία απόδοση πουθενά στο προϊόν» — όχι
 * παράβαση που κάποιος ανέχτηκε, αλλά **ερώτημα που κανείς δεν είχε κάνει**.
 *
 * ## 🏆 Πού ξεπερνάμε την πρακτική των μεγάλων
 *
 * **Figma** και **Slack** *παράγουν* σελίδα με πλήρη κείμενα· η **Graphisoft** μόνο ονόματα
 * (το κείμενο **δεν** ταξιδεύει). Το **Chromium** φιλτράρει με `Shipped: yes/no` ανά
 * βιβλιοθήκη — αλλά **κανείς από τους τέσσερις δεν φρουρεί το αποτέλεσμα**: παράγουν ένα
 * αρχείο, και αν αύριο μπει εξάρτηση χωρίς απόδοση, τίποτα δεν κοκκινίζει. Εδώ η παραγωγή
 * είναι **πύλη**: κάθε πακέτο που διανέμεται και η άδειά του απαιτεί απόδοση **οφείλει** να
 * υπάρχει στο αρχείο, με κείμενο — αλλιώς το commit σταματά.
 *
 * @module scripts/lib/third-party-notices/judge
 */

'use strict';

const { TEXT_SOURCE } = require('./texts');

/**
 * Πού καταλήγει το πακέτο. ⚠️ Η **διανομή** είναι που γεννά την υποχρέωση (ό,τι κατεβαίνει
 * στον browser είναι αντίγραφο)· ο server **εκτελεί** χωρίς να διανέμει — γι' αυτό η εξαίρεση
 * LGPL του `sharp` γράφει ρητά «server-side». Οι δύο ζουν σε **χωριστές** ενότητες.
 */
const SURFACE = Object.freeze({
  BROWSER: 'browser',
  SERVER: 'server',
  UNKNOWN: 'unknown',
});

const STATES = Object.freeze({
  /** ✅ Διανέμεται, απαιτεί απόδοση, και το κείμενο υπάρχει — από το ίδιο το πακέτο. */
  ATTRIBUTED: 'attributed',
  /** ✅ Το κείμενο ήρθε από το κανονικό `licenses/<id>.txt` — δηλωμένο, όχι σιωπηλό. */
  ATTRIBUTED_CANONICAL: 'attributed-canonical',
  /** ✅ Η άδεια δεν απαιτεί απόδοση (μόνο `unencumbered`: CC0/Unlicense/0BSD). */
  NO_ATTRIBUTION_REQUIRED: 'no-attribution-required',
  /** ✅ Δεν διανέμεται στον browser — καταγράφεται για διαφάνεια, χωρίς υποχρέωση. */
  SERVER_ONLY: 'server-only',
  /** 🔴 Απαιτεί απόδοση, διανέμεται, και **κανένα κείμενο δεν βρέθηκε** (ratchet). */
  NOTICE_TEXT_MISSING: 'notice-text-missing',
  /** ⛔ Το κείμενο δεν διαβάστηκε ή είναι υπερμέγεθες — ποτέ σιωπηλή περικοπή. */
  NOTICE_TEXT_UNUSABLE: 'notice-text-unusable',
  /** ⛔ Κανείς δεν ξέρει αν φτάνει στον browser — fail-closed, ποτέ «μάλλον server». */
  SURFACE_UNKNOWN: 'surface-unknown',
});

/**
 * ⛔ **ΔΕΝ μπαίνουν ΠΟΤΕ σε baseline** — ένα zero-tol που κλειδώνεται με `--write-baseline`
 * δεν είναι zero-tol (πρότυπο CHECK 3.44 / 3.69).
 */
const BLOCKING = Object.freeze([STATES.NOTICE_TEXT_UNUSABLE, STATES.SURFACE_UNKNOWN]);

/** 🔴 Ratchet κατά ταυτότητα — εκστρατεία που τελειώνει στο μηδέν. */
const RATCHETED = Object.freeze([STATES.NOTICE_TEXT_MISSING]);

const UNUSABLE_SOURCES = [TEXT_SOURCE.UNREADABLE, TEXT_SOURCE.OVERSIZE];

/**
 * Η **μία** κατάσταση ενός πακέτου.
 *
 * ⚠️ Η σειρά των ερωτημάτων είναι φέρουσα: «**διανέμεται;**» προηγείται του «**έχει
 * κείμενο;**», γιατί ένα πακέτο που μένει στον server δεν οφείλει τίποτα — και αν ρωτούσαμε
 * ανάποδα, θα μαζεύαμε 1.071 «ελλείψεις» που δεν είναι ελλείψεις (θόρυβος πάνω από το
 * κατώφλι <10% ψευδώς θετικών που η Google θέτει για blocking checks).
 */
function judgePackage({ id, surface, requiresAttribution, text }) {
  if (surface === SURFACE.UNKNOWN) {
    return { id, surface, state: STATES.SURFACE_UNKNOWN,
      detail: 'κανείς δεν δήλωσε ούτε μέτρησε αν φτάνει στον browser — fail-closed' };
  }
  if (surface === SURFACE.SERVER) {
    return { id, surface, state: STATES.SERVER_ONLY, detail: 'εκτελείται στον server· δεν διανέμονται bytes' };
  }
  if (!requiresAttribution) {
    return { id, surface, state: STATES.NO_ATTRIBUTION_REQUIRED, detail: 'η άδεια δεν επιβάλλει διατήρηση ειδοποίησης' };
  }
  if (UNUSABLE_SOURCES.includes(text.source)) {
    return { id, surface, state: STATES.NOTICE_TEXT_UNUSABLE, detail: text.detail };
  }
  if (text.source === TEXT_SOURCE.PACKAGE) {
    return { id, surface, state: STATES.ATTRIBUTED, detail: text.files.map((f) => f.name).join(', ') };
  }
  if (text.source === TEXT_SOURCE.CANONICAL) {
    return { id, surface, state: STATES.ATTRIBUTED_CANONICAL, detail: `${text.files.map((f) => f.name).join(', ')} — ${text.detail}` };
  }
  return { id, surface, state: STATES.NOTICE_TEXT_MISSING, detail: text.detail };
}

/** Κλειστή λογιστική: κάθε κάδος υπάρχει **και στο μηδέν**· άγνωστη κατάσταση ⇒ throw με όνομα. */
function tallyOf(rows) {
  const counts = Object.fromEntries(Object.values(STATES).map((s) => [s, 0]));
  for (const row of rows) {
    if (!(row.state in counts)) throw new Error(`CHECK 3.84 — άγνωστη κατάσταση «${row.state}» (${row.id})`);
    counts[row.state] += 1;
  }
  return counts;
}

/**
 * @param {Array<object>} subjects — `{id, surface, requiresAttribution, text}` ανά πακέτο/στοιχείο
 * @returns {{rows: object[], tally: object, blocking: object[], ratcheted: object[]}}
 */
function judge(subjects) {
  const rows = subjects.map(judgePackage).sort((a, b) => a.id.localeCompare(b.id));
  return {
    rows,
    tally: tallyOf(rows),
    blocking: rows.filter((r) => BLOCKING.includes(r.state)),
    ratcheted: rows.filter((r) => RATCHETED.includes(r.state)),
  };
}

/** Ταυτότητα ratchet = «κατάσταση :: πακέτο» — ώστε η **ανταλλαγή** να μη περνά (ADR-749). */
const violationId = (row) => `${row.state} :: ${row.id}`;

const idsOf = (verdict, state) => verdict.rows.filter((r) => r.state === state).map((r) => r.id);

module.exports = { SURFACE, STATES, BLOCKING, RATCHETED, judgePackage, judge, tallyOf, violationId, idsOf };
