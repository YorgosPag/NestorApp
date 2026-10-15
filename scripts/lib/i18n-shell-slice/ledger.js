#!/usr/bin/env node
/**
 * =============================================================================
 * ADR-744 §8 / ADR-777 §8.38 — ΤΟ ΜΗΤΡΩΟ ΜΕΤΑΝΑΣΤΕΥΣΗΣ, ΜΕ ΠΡΟΫΠΟΛΟΓΙΣΜΟ
 * =============================================================================
 *
 * «Κάθε namespace που ταξιδεύει **ΟΛΟΚΛΗΡΟ** σε **141 διαδρομές** δηλώνει πόσο
 *  κοστίζει — και ο αριθμός **ελέγχεται**.»
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ, ΜΕΤΡΗΜΕΝΟ. Μέχρι τις 2026-08-21 ο μόνος φρουρός ήταν ένα test
 * που έλεγχε το **ΑΘΡΟΙΣΜΑ** (< 185.000). Το `search-results` μπήκε στο μητρώο
 * (2026-08-10) με δηλωμένο κόστος **«~1,6 KB»** και τον ρητό λόγο *«το namespace έχει
 * ΕΝΑΝ καταναλωτή»*. Έντεκα μέρες αργότερα κόστιζε **47.837 bytes** — **30×** τον λόγο
 * του — και **κανείς δεν το είδε**, γιατί:
 *
 *   · η δηλωμένη τιμή ήταν **ΠΡΟΖΑ** μέσα σε συμβολοσειρά, άρα ανέλεγκτη·
 *   · το άθροισμα **έκλεινε** μέχρι που δεν έκλεισε, και τότε κατηγόρησε **όλες** τις
 *     εγγραφές εξίσου — ένα σύνολο που ξεχειλίζει δεν λέει **ποια** εγγραφή φούσκωσε.
 *
 * 🏆 ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΗΝ ΠΡΑΚΤΙΚΗ. Ο κόσμος του bundling **έχει** τη λύση εδώ και χρόνια
 * (`size-limit`, `bundlesize`, Lighthouse budgets): **όριο ΑΝΑ ΕΓΓΡΑΦΗ**, δηλωμένο από
 * άνθρωπο, που σπάει το build όταν ξεπεραστεί. Κανένα εργαλείο i18n δεν το κάνει — ούτε
 * το i18next, ούτε το locize, ούτε το next-intl: όλα μετρούν «ποια namespaces φορτώνω»,
 * κανένα «πόσο κοστίζει **αυτό** το namespace στη σύγχρονη διαδρομή, και ποιο είναι το
 * συμφωνημένο ταβάνι του». Εδώ το i18n payload κρίνεται σαν bundle, γιατί **είναι**.
 *
 * ⚠️ Ο ΠΡΟΫΠΟΛΟΓΙΣΜΟΣ ΔΕΝ ΕΙΝΑΙ ΣΤΟΧΟΣ — ΕΙΝΑΙ ΤΑΒΑΝΙ. Μια εγγραφή που τον αγγίζει δεν
 * «πέτυχε»: το μητρώο οφείλει να φτάσει στο **μηδέν** με per-route slices (ADR-744 §8 Φ4).
 * Ο προϋπολογισμός υπάρχει για να μη μεγαλώνει **σιωπηλά** στο μεταξύ.
 *
 * ⚠️ ΜΗΝ ΑΝΕΒΑΣΕΙΣ ΑΡΙΘΜΟ ΓΙΑ ΝΑ ΓΙΝΕΙ ΠΡΑΣΙΝΟ. Μια εγγραφή που ξεπερνά το ταβάνι της
 * λέει ότι **κάτι μπήκε σε λάθος namespace** — αυτό ακριβώς έδειξε το `search-results`,
 * όπου η θεραπεία ήταν **μετακόμιση** (§8.38), όχι μεγαλύτερος αριθμός.
 *
 * @module scripts/lib/i18n-shell-slice/ledger
 */

'use strict';

// 🔑 ΜΙΑ ΜΗΧΑΝΗ (ADR-749). Η αριθμητική «τρέχον έναντι σφραγισμένου, με περιθώριο»
// είναι ΑΚΡΙΒΩΣ το `isRegression({direction:'down', tolerancePct})` που μοιράζονται
// ήδη 27 πύλες αυτού του δέντρου· η ανακοίνωση «το ταβάνι σου έχει τζόγο» είναι
// ΑΚΡΙΒΩΣ το `announceSlack` (πρότυπο PHPStan `reportUnmatchedIgnoredErrors`).
// Γραμμένα ξανά εδώ θα ήταν το sibling clone που μετρά το CHECK 3.28 (N.18).
// (Το `isRegression` το καλεί πλέον μόνο το κατάστιχο διαδρομών, `route-ledger.js`.)
const { announceSlack } = require('../ratchet-baseline');

/**
 * Το ταβάνι του **αθροίσματος**, σε bytes.
 *
 * 🔴 ΖΕΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟ TEST, ΚΑΙ ΕΙΝΑΙ ΔΙΟΡΘΩΣΗ: μέχρι σήμερα ο αριθμός υπήρχε **μόνο**
 * μέσα στο `i18n-shell-slice.test.js`, δηλαδή τον έβλεπε μόνο όποιος έτρεχε τη σουίτα —
 * και ήταν **κόκκινος επί έντεκα μέρες** χωρίς να το μάθει κανείς. Τώρα τον επιβάλλουν
 * **και** ο generator **και** το CHECK 3.34, δηλαδή κάθε commit (CHECK 3.36: *ένα anchor
 * χωρίς πύλη είναι σχόλιο*).
 */
const LEDGER_LIMIT_BYTES = 185_000;

/** Οι ρητές καταστάσεις. Καμία σιωπηλή απόρριψη — άγνωστη ⇒ `throw` με όνομα. */
const VERDICTS = Object.freeze({
  WITHIN: 'within-budget',
  OVER: 'over-budget',
  MISSING: 'declared-but-absent',
  UNDECLARED: 'whole-but-undeclared',
});

/**
 * Η δήλωση μιας εγγραφής, κανονικοποιημένη.
 *
 * ⚠️ ΤΟ ΣΧΗΜΑ ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΑ ΑΝΤΙΚΕΙΜΕΝΟ. Μια σκέτη συμβολοσειρά (το παλιό σχήμα)
 * απορρίπτεται **θορυβωδώς**: ήταν ακριβώς η μορφή που επέτρεψε στο «~1,6 KB» να είναι
 * ψέμα για έντεκα μέρες. Πρόζα δεν είναι προϋπολογισμός.
 */
function parseDeclaration(namespace, value, ledgerName = 'guaranteedNamespaces') {
  const at = `${ledgerName}.${namespace}`;
  if (typeof value === 'string') {
    throw new Error(
      `${at}: η δήλωση είναι συμβολοσειρά. ` +
      'Απαιτείται { "budget": <bytes>, "reason": "…" } — πρόζα δεν είναι προϋπολογισμός ' +
      '(ADR-777 §8.38: το «~1,6 KB» έγινε 47.837 χωρίς να το δει κανείς).',
    );
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${at}: άγνωστο σχήμα δήλωσης.`);
  }
  if (!Number.isInteger(value.budget) || value.budget <= 0) {
    throw new Error(`${at}: το \`budget\` πρέπει να είναι θετικός ακέραιος (bytes).`);
  }
  if (typeof value.reason !== 'string' || value.reason.trim() === '') {
    throw new Error(`${at}: λείπει ο \`reason\` — μια εγγραφή χωρίς λόγο δεν αποσύρεται ποτέ.`);
  }
  return { namespace, budget: value.budget, reason: value.reason };
}

/**
 * Η **κλειστή λογιστική** του μητρώου για μία γλώσσα.
 *
 * @param {object} guaranteedNamespaces  `config.guaranteedNamespaces`
 * @param {object} sliceResources        `{ ns: {…κλειδιά} }` της γλώσσας
 * @param {string[]} wholeNamespaces     όσα ταξιδεύουν ΟΛΟΚΛΗΡΑ κατά το `wants[ns].whole`
 * @returns {{entries: object[], total: number, limit: number, failures: object[]}}
 */
function auditLedger(guaranteedNamespaces, sliceResources, wholeNamespaces) {
  const declared = new Map(
    Object.entries(guaranteedNamespaces).map(([ns, value]) => [ns, parseDeclaration(ns, value)]),
  );
  const shippedWhole = new Set(wholeNamespaces);
  const entries = [];
  let total = 0;

  for (const [namespace, declaration] of declared) {
    const tree = sliceResources[namespace];
    const actual = tree === undefined ? 0 : Buffer.byteLength(JSON.stringify(tree), 'utf8');
    total += actual;
    let verdict;
    if (tree === undefined) verdict = VERDICTS.MISSING;
    else if (actual > declaration.budget) verdict = VERDICTS.OVER;
    else verdict = VERDICTS.WITHIN;
    entries.push({ ...declaration, actual, verdict });
  }

  // ⚠️ Η ΑΛΛΗ ΚΑΤΕΥΘΥΝΣΗ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΠΟΛΥΤΕΛΕΙΑ: ένα namespace μπορεί να γίνει
  // `whole` και από ΔΕΥΤΕΡΟ μονοπάτι (`wants[ns].whole`), οπότε θα ταξίδευε ολόκληρο
  // χωρίς καμία δήλωση — αόρατο σε λογιστική που ρωτά μόνο τις δηλώσεις.
  for (const namespace of shippedWhole) {
    if (declared.has(namespace)) continue;
    const tree = sliceResources[namespace];
    const actual = tree === undefined ? 0 : Buffer.byteLength(JSON.stringify(tree), 'utf8');
    total += actual;
    entries.push({ namespace, budget: 0, reason: '', actual, verdict: VERDICTS.UNDECLARED });
  }

  for (const entry of entries) {
    if (!Object.values(VERDICTS).includes(entry.verdict)) {
      throw new Error(`ledger: άγνωστη κατάσταση «${entry.verdict}» για το ${entry.namespace}`);
    }
  }

  const failures = entries.filter(e => e.verdict === VERDICTS.OVER || e.verdict === VERDICTS.UNDECLARED);
  if (total > LEDGER_LIMIT_BYTES) {
    failures.push({ namespace: '(σύνολο)', budget: LEDGER_LIMIT_BYTES, actual: total, verdict: VERDICTS.OVER, reason: '' });
  }
  return { entries: entries.sort((a, b) => b.actual - a.actual), total, limit: LEDGER_LIMIT_BYTES, failures };
}

/**
 * ADR-744 §20 — **ΤΑ ΤΑΒΑΝΙΑ ΤΟΥ ΜΗΤΡΩΟΥ ΠΟΥ ΠΑΛΙΩΣΑΝ**.
 *
 * 🔑 ΓΙΑΤΙ ΚΑΙ ΕΔΩ, ΕΝΩ ΤΟ ΣΧΗΜΑ `{budget, reason}` ΜΕΝΕΙ: το ερώτημα «από πού
 * προέκυψε ο αριθμός;» είναι διαφορετικό από το «είναι ακόμη σφιχτός;». Το πρώτο
 * αφορά μόνο τα route slices (βλ. §20)· το δεύτερο αφορά **κάθε** ταβάνι — μετρημένο
 * την ίδια μέρα: `common` 40.608 / 53.500 (**24% αχρησιμοποίητο**), `admin` 60.863 /
 * 67.000. Τζόγος τέτοιου μεγέθους κρύβει την επόμενη παλινδρόμηση **στο ίδιο σημείο**,
 * που είναι ακριβώς το επιχείρημα των PHPStan/ESLint για τις άχρηστες καταστολές —
 * και το ADR-598 το πλήρωσε με **8× τζόγο επί 40 ημέρες**.
 */
function announceLedgerSlack(entries, minBytes = 2000) {
  return entries
    .filter(entry => entry.verdict === VERDICTS.WITHIN && entry.budget - entry.actual >= minBytes)
    .map(entry => announceSlack({
      adr: 'ADR-744 §20',
      slack: entry.budget - entry.actual,
      detail: `${entry.namespace}: ${entry.budget - entry.actual} bytes κάτω από το ταβάνι (${entry.budget}, τρέχον ${entry.actual})`,
      command: 'σφίξε το `budget` στο .i18n-shell-slice.json → guaranteedNamespaces',
    }))
    .filter(line => line !== '');
}

/** Ένα ανθρώπινο μήνυμα αποτυχίας που **ονομάζει την εγγραφή**, όχι το άθροισμα. */
function describeFailures(failures) {
  return failures.map(f => {
    if (f.verdict === VERDICTS.UNDECLARED) {
      return `${f.namespace}: ταξιδεύει ΟΛΟΚΛΗΡΟ (${f.actual} bytes) χωρίς δήλωση στο guaranteedNamespaces`;
    }
    return `${f.namespace}: ${f.actual} bytes > προϋπολογισμός ${f.budget}`;
  }).join(' · ');
}

// N.7.1 — το κατάστιχο των διαδρομών (ADR-777 §8.43 · ADR-744 §20) ζει στο `route-ledger.js`·
// επανεξάγεται εδώ, ώστε οι καταναλωτές του `ledger` να μην αλλάξουν.
const RouteLedger = require('./route-ledger');

module.exports = {
  LEDGER_LIMIT_BYTES,
  VERDICTS,
  parseDeclaration,
  auditLedger,
  announceLedgerSlack,
  describeFailures,
  ...RouteLedger,
};
