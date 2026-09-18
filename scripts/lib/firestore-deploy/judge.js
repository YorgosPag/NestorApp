/**
 * ADR-865 / CHECK 3.86 — Η ΚΡΙΣΗ: «ό,τι χρειάζεται ο πελάτης για να διαβάσει είναι
 * ΑΝΕΠΤΥΓΜΕΝΟ — ή μόνο γραμμένο;»
 *
 * **Καθαρή**: δέχεται τον «κόσμο» (firebase.json, μητρώο, `HEAD`, αποτυπώματα, ηλικίες) και
 * επιστρέφει ευρήματα. Ο δίσκος και το git ζουν στο `world.js` — έτσι η σουίτα κρίνει **την
 * ίδια** συνάρτηση με την πύλη, με κόσμους φτιαγμένους στο χέρι.
 *
 * | Κανόνας | Ερώτημα | Σοβαρότητα |
 * |---|---|---|
 * | **Κ1** | είναι κάθε κλειδί του `firebase.json` **κριμένο** ή **ρητά εξαιρεμένο με λόγο**; | ⛔ block |
 * | **Κ2** | υπάρχει το αρχείο-πηγή κάθε δηλωμένου στόχου; | ⛔ block |
 * | **Κ3** | έμεινε **αμετάβλητη** κάθε γραμμή μητρώου που υπήρχε στο `HEAD`; | ⛔ block |
 * | **Κ4** | είναι κάθε γραμμή **σχηματικά έγκυρη** (στόχος · αποτύπωμα · ημερομηνία · πηγή); | ⛔ block |
 * | **Κ5** | διαφέρει η πηγή από ό,τι θα κρίνει η γραμμή παραγωγής (`origin/main`); | ⏳ αναφορά |
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔁 ADR-865 §11 (2026-09-18) — Ο Κ5 ΜΕΤΑΚΟΜΙΣΕ ΣΤΗ ΓΡΑΜΜΗ ΠΑΡΑΓΩΓΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 * Ο Κ5 ρωτούσε «ταιριάζει το τρέχον με το **τελευταίο αναπτυγμένο** του μητρώου;» και μπλόκαρε
 * το push. Όταν αναπτύσσει η γραμμή (`docker-build.yml` → `firebase-plan` → έγκριση →
 * `firebase-apply` → `release`), το push **είναι** το αίτημα ανάπτυξης: ένας φύλακας που το
 * μπλόκαρε θα απαγόρευε ακριβώς αυτό που το ενεργοποιεί (αυγό-κότα, μετρημένο στο handoff §5.1).
 * Η ερώτηση «ο κώδικας φεύγει χωρίς τον κανόνα του;» απαντιέται πλέον **εκεί**, και καλύτερα:
 * ρωτιέται ο **πάροχος**, όχι το μητρώο, και ο κώδικας **περιμένει** δείκτες READY. Εδώ μένει η
 * **ενημέρωση**: «αυτό το push θα ζητήσει έγκριση». Το ιστορικό σκεπτικό ακολουθεί.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 (ιστορικό, 2026-09-16) ΓΙΑΤΙ Ο Κ5 ΕΙΧΕ ΔΥΟ ΣΟΒΑΡΟΤΗΤΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Στο **commit** ο άνθρωπος **δουλεύει**: μπορεί να γράψει κανόνα σήμερα και να τον αναπτύξει
 * αύριο, και αυτό είναι **σωστό** — η στιγμή της ανάπτυξης είναι **δική του απόφαση** (N.(-1)).
 * Μια πύλη που μπλόκαρε εκεί θα παρακαμπτόταν την πρώτη μέρα, και μια πύλη που παρακάμπτεται
 * δεν είναι πύλη.
 *
 * Στο **push** ο κώδικας **φεύγει προς την παραγωγή** (GitHub → Netcup → nestorconstruct.gr).
 * **Εκεί** η απόκλιση γίνεται ζημιά: ο κώδικας που χρειάζεται τον κανόνα φτάνει στους χρήστες,
 * ο κανόνας **όχι** — γιατί το push πάει στο Netcup, **ποτέ** στο Firebase.
 *
 * 🏆 Το ίδιο δίδυμο έχει το Argo CD: `OutOfSync` **ορατό** και, **χωρίς `selfHeal`**, αφημένο
 * όπως είναι *«until a human or a Git change acts on it»*. Εμείς το κάνουμε **χωρίς δίκτυο και
 * χωρίς διαπιστευτήρια**, και σε **κάθε** commit αντί για reconciliation κάθε 120s.
 *
 * ⚠️ **Η ΗΛΙΚΙΑ ΜΕΤΡΙΕΤΑΙ ΣΕ COMMITS, ΠΟΤΕ ΣΕ ΜΕΡΕΣ.** Ρολόι σε κρίση πύλης σημαίνει ότι η
 * ίδια είσοδος δίνει άλλη ετυμηγορία αύριο (μάθημα CHECK 3.33: ποτέ `mtime`, ποτέ `new Date()`).
 * Και η ηλικία σε commits είναι **ακριβώς** το μέγεθος που περιγράφει τη βλάβη που γέννησε αυτό
 * το ADR: ο κανόνας γράφτηκε, και **έξι commits** πέρασαν από πάνω του χωρίς να τον δει κανείς.
 *
 * @module scripts/lib/firestore-deploy/judge
 */

'use strict';

const M = require('./model');

const RULES = Object.freeze({
  K1: 'unjudged-firebase-target',
  K2: 'declared-source-missing',
  K3: 'ledger-row-altered',
  K4: 'ledger-row-invalid',
  K5: 'deploy-pending',
});

/** @returns {{rule:string, target:string, severity:'block'|'report', detail:string}} */
const finding = (rule, target, severity, detail) => ({ rule, target, severity, detail });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ============================================================================
// Κ1 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ
// ============================================================================

/**
 * Κάθε κλειδί πρώτου επιπέδου του `firebase.json` είναι είτε **κριμένο** (ανήκει σε στόχο) είτε
 * **ρητά εξαιρεμένο με λόγο**. Τρίτη κατάσταση δεν υπάρχει.
 *
 * 🔴 **fail-closed, και ο λόγος είναι μετρημένος**: η αντίστροφη διάταξη — λίστα «τι φυλάμε» —
 * έχει αποτύχει σε αυτό το δέντρο **τέσσερις** φορές (`.gate-inventory.json` `$whyNotAList`).
 * Νέα βάση, νέος στόχος ή νέο προϊόν στο `firebase.json` **κοκκινίζει** μέχρι να το δει άνθρωπος.
 */
function judgeDenominator(world, out) {
  const judged = new Set(Object.values(M.DEPLOY_TARGETS).map((t) => t.jsonPath[0]));
  for (const key of Object.keys(world.firebaseJson)) {
    if (judged.has(key)) continue;
    if (key in M.NOT_JUDGED) continue;
    out.push(finding(RULES.K1, key, 'block',
      `το firebase.json δηλώνει «${key}» και κανείς δεν λέει αν αναπτύσσεται — πρόσθεσε στόχο στο `
      + `DEPLOY_TARGETS ή γραμμή ΜΕ ΛΟΓΟ στο NOT_JUDGED (scripts/lib/firestore-deploy/model.js)`));
  }
}

// ============================================================================
// Κ2 · Κ5 — ΑΝΑ ΣΤΟΧΟ
// ============================================================================

function judgeTarget(entry, world, out) {
  const { target, source, digest } = entry;

  if (digest === null) {
    out.push(finding(RULES.K2, target, 'block',
      `το firebase.json δηλώνει «${source}» για τον στόχο ${target}, αλλά το αρχείο δεν υπάρχει`));
    return;
  }

  if (entry.published === 'differs') {
    out.push(finding(RULES.K5, target, 'report',
      `το «${source}» διαφέρει από το ${world.publishedRef} — στο push η γραμμή παραγωγής ρωτά την `
      + 'παραγωγή και, αν διαφέρει, ζητά την ΕΓΚΡΙΣΗ σου πριν κυκλοφορήσει ο κώδικας (ADR-865 §11)'));
  }
}

// ============================================================================
// Κ3 · Κ4 — ΤΟ ΜΗΤΡΩΟ
// ============================================================================

/** Κάθε γραμμή που υπήρχε στο `HEAD` μένει **αυτούσια**. Ιστορικό που επεξεργάζεται δεν είναι ιστορικό. */
function judgeAppendOnly(world, out) {
  if (world.headLedger === null) return;
  const now = world.ledger.deployments.map(M.rowKey);
  for (const old of world.headLedger.deployments) {
    if (!now.includes(M.rowKey(old))) {
      out.push(finding(RULES.K3, old.target ?? '*', 'block',
        `γραμμή ανάπτυξης της ${old.at ?? ';'} άλλαξε ή σβήστηκε — το μητρώο είναι APPEND-ONLY· `
        + 'διόρθωση = ΝΕΑ ανάπτυξη (npm run firestore:deploy)'));
    }
  }
}

function judgeRow(row, index, world, out) {
  const where = `γραμμή #${index + 1}`;
  if (!(row.target in M.DEPLOY_TARGETS)) {
    out.push(finding(RULES.K4, row.target ?? '*', 'block', `${where}: άγνωστος στόχος «${row.target}»`));
    return;
  }
  if (!M.DIGEST_RE.test(row.digest ?? '')) {
    out.push(finding(RULES.K4, row.target, 'block', `${where}: το αποτύπωμα «${row.digest}» δεν είναι sha256`));
  }
  if (!DATE_RE.test(row.at ?? '')) {
    out.push(finding(RULES.K4, row.target, 'block', `${where}: η ημερομηνία «${row.at}» δεν είναι YYYY-MM-DD`));
  }
  const expected = world.sourceByTarget[row.target];
  if (expected !== undefined && row.source !== expected) {
    out.push(finding(RULES.K4, row.target, 'block',
      `${where}: η πηγή λέει «${row.source}» ενώ το firebase.json δηλώνει «${expected}» — `
      + 'ο στόχος άλλαξε αρχείο και το μητρώο δείχνει σε άλλο πράγμα'));
  }
}

// ============================================================================
// Η ΚΡΙΣΗ
// ============================================================================

/**
 * @param {object} world βλ. `world.js` — `firebaseJson`, `ledger`, `headLedger`, `targets`,
 *   `sourceByTarget`, `ageOf`.
 * @returns {Array<{rule:string, target:string, severity:'block'|'report', detail:string}>}
 */
function judgeFirestoreDeploy(world) {
  const out = [];
  judgeDenominator(world, out);
  judgeAppendOnly(world, out);
  world.ledger.deployments.forEach((row, i) => judgeRow(row, i, world, out));
  for (const entry of world.targets) judgeTarget(entry, world, out);
  return out;
}

/**
 * Τα ευρήματα που μπλοκάρουν — **ίδια** σε commit και push. Από ADR-865 §11 ο Κ5 είναι μόνο
 * αναφορά: η φύλαξη της σειράς «κανόνας πριν τον κώδικα» ζει στη γραμμή παραγωγής, όπου **δεν**
 * παρακάμπτεται με μεταβλητή περιβάλλοντος και ισχύει από **κάθε** μηχάνημα.
 */
function blocking(findings) {
  return findings.filter((f) => f.severity === 'block');
}

module.exports = { RULES, judgeFirestoreDeploy, blocking };
