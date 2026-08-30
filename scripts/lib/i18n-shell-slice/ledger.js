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
const { isRegression, announceSlack } = require('../ratchet-baseline');

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

/* =============================================================================
 * ADR-777 §8.43 — ΤΟ ΔΕΥΤΕΡΟ ΚΑΤΑΣΤΙΧΟ: «ΣΕΛΙΔΑ, Ή ΔΕΥΤΕΡΟ ΚΕΛΥΦΟΣ;»
 * =============================================================================
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ, ΜΕΤΡΗΜΕΝΟ. Το §8.38 δίδαξε ότι «πρόζα δεν είναι προϋπολογισμός»
 * και έβαλε `{budget, reason}` στο `guaranteedNamespaces`. Ο **αδελφός** του, στο ΙΔΙΟ
 * αρχείο ρύθμισης — το `routeSlices` — έμεινε με **σκέτο `reason`**: έντεκα διαδρομές,
 * καμία δήλωση κόστους, κανένας φρουρός. Ο μόνος έλεγχος που υπήρχε ήταν η **άρνηση**
 * του generator σε ανεπίλυτη δυναμική `t()` — δηλαδή φυλάει το «**δεν ξέρω** τα κλειδιά»,
 * ποτέ το «τα ξέρω, και είναι **240 KB**».
 *
 * Μετρημένο 2026-08-21 στο πραγματικό δέντρο (UTF-8 bytes, compact):
 *   · κέλυφος                            165.649
 *   · τα 11 δηλωμένα route slices          1.842 – 14.911   (μέγιστο = 9,0% του κελύφους)
 *   · `/properties/[id]`, αν δηλωνόταν   240.521 / 48 ns = **145,2% του κελύφους**
 *
 * Ένα «per-route slice» μεγαλύτερο από το κέλυφος **δεν είναι αφαίρεση** — είναι δεύτερο
 * κέλυφος με άλλο όνομα, και αντιστρέφει τον μηχανισμό που το ADR-744 §15 περιγράφει
 * ΚΑΤΑ ΛΕΞΗ ως αφαίρεση («ένωση θα ήταν ΜΕΓΑΛΥΤΕΡΗ από το σημερινό»).
 *
 * 🏆 ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΗΝ ΠΡΑΚΤΙΚΗ — ΕΡΕΥΝΗΜΕΝΟ, ΟΧΙ ΥΠΟΘΕΤΙΚΟ. Τα per-path budgets
 * **υπάρχουν** στον κόσμο του bundling: Lighthouse `budget.json` ανά μονοπάτι, Lighthouse
 * CI `assertMatrix` ανά URL, το RFC #3216 του webpack ανά chunk. **Όλα** όμως εκφράζουν
 * το όριο ως **ΑΠΟΛΥΤΟ ΑΡΙΘΜΟ** — και ένας απόλυτος αριθμός είναι ακριβώς αυτό που
 * ανεβαίνει για να γίνει πράσινο. Κανένα δεν εκφράζει το όριο ως **ΣΧΕΣΗ** με το κοινό
 * chunk. Εδώ υπάρχουν **ΔΥΟ ΑΝΕΞΑΡΤΗΤΟΙ ΚΑΝΟΝΕΣ, ΠΟΤΕ ΕΝΑΣ ΜΕ «Ή»** (μάθημα CHECK 3.41):
 *
 *   **Κ1 — ΔΟΜΙΚΗ ΑΝΤΙΣΤΡΟΦΗ** (⛔ zero-tolerance). `actual >= shellBytes`. Το κατώφλι
 *   **δεν επιλέχθηκε** — **παράγεται** από τον ίδιο τον μηχανισμό, άρα **κανένας αριθμός
 *   δεν μπορεί να το σιωπήσει**: για να γίνει πράσινο πρέπει το slice να μικρύνει ή το
 *   κέλυφος να μεγαλώσει, και το δεύτερο το φυλάει ήδη το `LEDGER_LIMIT_BYTES`.
 *
 *   **Κ2 — ΔΗΛΩΜΕΝΟ ΤΑΒΑΝΙ ΑΝΑ ΕΓΓΡΑΦΗ** (🔴). Η πρακτική των μεγάλων, εφαρμοσμένη στον
 *   αδελφό που την είχε χάσει. Πιάνει τη **σιωπηλή διόγκωση** πολύ πριν φτάσει στο Κ1 —
 *   το `search-results` πήγε 1,6 KB → 47,8 KB **χωρίς** ποτέ να πλησιάσει το κέλυφος.
 *
 * Ένας κανόνας με «ή» θα έμενε **πράσινος πάνω στο ελάττωμα**: slice 100 KB κάτω από
 * δηλωμένο ταβάνι 120 KB περνά το Κ2 ενώ είναι 60% του κελύφους (το Κ1 το πιάνει)· slice
 * 9 KB που δήλωσε 1,6 KB περνά το Κ1 (5% του κελύφους) ενώ έχει πενταπλασιαστεί (Κ2).
 *
 * ⚠️ Η ΑΛΛΗ ΚΑΤΕΥΘΥΝΣΗ, ΚΑΙ ΕΙΝΑΙ ΖΩΝΤΑΝΗ: το `writeArtifacts` **γράφει, δεν κλαδεύει**.
 * Σβήνοντας μια δήλωση, το `routes/<id>.el.json` **μένει στον δίσκο** — και το
 * `import routeSlice from '@/i18n/generated/routes/X.el.json'` εξακολουθεί να
 * μεταγλωττίζεται και να **ταξιδεύει παγωμένο για πάντα**, αόρατο στο
 * `checkArtifactIntegrity` (που διατρέχει το `manifest.artifacts`, όπου πλέον **δεν**
 * υπάρχει). Γι' αυτό η κατάσταση `orphan-artifact` — ίδιο σκεπτικό με το
 * `whole-but-undeclared` του πρώτου καταστίχου.
 * ============================================================================= */

/* =============================================================================
 * ADR-744 §20 — Κ3: **ΤΟ ΤΑΒΑΝΙ ΕΠΑΨΕ ΝΑ ΔΗΛΩΝΕΤΑΙ**
 * =============================================================================
 *
 * 🔴 ΤΟ ΕΛΑΤΤΩΜΑ, ΜΕΤΡΗΜΕΝΟ (2026-08-30). Και οι 24 εγγραφές του `routeSlices`
 * δήλωναν `budget` σπαρμένο ως *«σημερινό +25%, στρογγυλεμένο ανά 500»* — δηλαδή
 * **στιγμιότυπο**. Ένας αριθμός που δεν προκύπτει από κανόνα **δεν μπορεί να κριθεί**:
 * όταν κοκκινίζει, κανείς δεν ξέρει αν φταίει η σελίδα ή ο αριθμός. Και το
 * `/offers/mandate/new` **έζησε σπασμένο** (7.091 έναντι ταβανιού 7.000) χωρίς να το
 * μάθει κανείς.
 *
 * 🏆 Η ΠΡΑΚΤΙΚΗ ΤΩΝ ΜΕΓΑΛΩΝ, ΚΑΙ ΠΟΥ ΤΗΝ ΞΕΠΕΡΝΑΜΕ — ΕΡΕΥΝΗΜΕΝΟ, ΟΧΙ ΥΠΟΘΕΤΙΚΟ:
 *
 *   · **Lighthouse `budget.json`** — απόλυτο ταβάνι ανά μονοπάτι. Το web.dev λέει ρητά
 *     «ratchet **προς τα κάτω**· ανέβασμα επειδή κοκκίνισε είναι αντι-πρότυπο» — αλλά
 *     δίνει **σύσταση**, όχι μηχανισμό: τίποτα δεν εμποδίζει το ανέβασμα.
 *   · **size-limit / bundlesize** — απόλυτο ταβάνι ανά entry, που το γράφει άνθρωπος
 *     και **κανείς δεν ρωτά από πού προέκυψε**. Καμία αυτόματη σύσφιξη.
 *   · **@next/bundle-analyzer** — καμία πύλη· είναι θεατής.
 *   · 🏆 **Chromium `android-binary-size`** — **ΔΕΝ ΕΧΕΙ ΑΠΟΛΥΤΟ ΤΑΒΑΝΙ ΚΑΘΟΛΟΥ.**
 *     Μετρά τη **μεταβολή** ενός commit (ARM32 +16 KiB · ARM64 +64 KiB · +50 dex
 *     methods) και η **μόνη** διέξοδος είναι **γραμμένη αιτιολογία** στο footer
 *     (`Binary-Size: …`, δίπλα στο `Bug:`), ώστε οι μεγάλες αυξήσεις να είναι
 *     «κατανοητές και σκόπιμες». Δεν υπάρχει αριθμός να ανεβάσεις.
 *
 * ⚠️ **ΤΟ ΚΕΝΟ ΤΟΥ CHROMIUM**: το `Binary-Size:` δέχεται **οποιοδήποτε κείμενο** και
 * **κανείς δεν το επαληθεύει**. Είναι η ίδια μορφή που άφησε το «~1,6 KB» να είναι
 * ψέμα για έντεκα μέρες (§8.38): **πρόζα δεν είναι προϋπολογισμός**.
 *
 * 🔑 ΤΙ ΚΑΝΟΥΜΕ ΕΔΩ, ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ ΑΥΣΤΗΡΑ ΠΑΡΑΠΑΝΩ:
 *
 *   1. **Ο άνθρωπος δηλώνει ΜΕΤΡΗΣΗ, όχι προτίμηση** — `sealed` = τα bytes που
 *      μετρήθηκαν τη μέρα της σφράγισης. Μια μέτρηση είναι **διαψεύσιμη**· ένα
 *      ταβάνι δεν είναι.
 *   2. **Το ταβάνι ΥΠΟΛΟΓΙΖΕΤΑΙ** — `sealed × (1 + HEADROOM_PCT/100)`. Δεν γράφεται
 *      πουθενά, άρα **δεν υπάρχει αριθμός να ανεβάσεις**. (Η κίνηση του Chromium,
 *      χωρίς τον αριθμό που εκείνο δεν έχει.)
 *   3. **Η αύξηση απαιτεί ΕΠΑΛΗΘΕΥΣΙΜΗ αιτιολογία** — το `history` είναι αλυσίδα
 *      `{from,to,at,why}` που **οφείλει να κλείνει αριθμητικά** και να καταλήγει
 *      ΑΚΡΙΒΩΣ στο `sealed`. Η αιτιολογία του Chromium, αλλά **ελεγμένη**.
 *   4. **Σύσφιξη προς τα κάτω, ανακοινωμένη** — `announceSlack`, η ίδια που
 *      ανακοινώνει τον τζόγο σε 27 άλλες πύλες. Καμία από τις τέσσερις λύσεις
 *      παραπάνω δεν το κάνει.
 *
 * ⚠️ ΓΙΑΤΙ ΤΟ `guaranteedNamespaces` ΜΕΝΕΙ ΜΕ `budget` — ΑΠΟΦΑΣΗ, ΟΧΙ ΠΑΡΑΛΕΙΨΗ. Τα
 * δύο κατάστιχα απαντούν **διαφορετικό ερώτημα**: εκείνο είναι **μητρώο χρέους που
 * οφείλει να φτάσει στο μηδέν** (μονότονα κάτω· αύξηση δεν είναι ποτέ νόμιμη, άρα
 * `history` δεν έχει τι να καταγράψει), ενώ αυτό είναι **ζωντανό ταβάνι σελίδας** που
 * νόμιμα μεγαλώνει όταν η σελίδα αποκτά λειτουργία. Ίδιο σχήμα δήλωσης σε δύο
 * διαφορετικά ερωτήματα θα ήταν ο «ένας κανόνας με ή» που το §8.43 απέρριψε.
 * ⚠️ Ο **τζόγος** όμως ανακοινώνεται και στα δύο: ένα ταβάνι με 24% αχρησιμοποίητο
 * περιθώριο κρύβει την επόμενη παλινδρόμηση **όπου κι αν ζει** (μάθημα ADR-598: 8×
 * τζόγος επί 40 ημέρες).
 * ============================================================================= */

/**
 * ΤΟ ΠΕΡΙΘΩΡΙΟ — **ΕΝΑΣ** ΑΡΙΘΜΟΣ ΓΙΑ ΟΛΟ ΤΟ ΜΗΤΡΩΟ, ΜΕ ΓΡΑΜΜΕΝΟ ΤΟΝ ΛΟΓΟ ΤΟΥ.
 *
 * 🔑 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΚΑΘΟΛΟΥ: χωρίς περιθώριο, **κάθε** επεξεργασία μετάφρασης — μια
 * λέξη παραπάνω σε ένα μήνυμα — θα κοκκίνιζε την πύλη και θα απαιτούσε νέα σφράγιση.
 * Πύλη που κοκκινίζει σε θόρυβο γίνεται `SKIP_`, δηλαδή διακοσμητική (μάθημα CHECK
 * 3.39, γραμμένο). Το περιθώριο απορροφά τη **διακύμανση του κειμένου**, όχι τη
 * **λειτουργία**: μια νέα ετικέτα πεδίου είναι δεκάδες bytes και χωράει· μια νέα
 * ενότητα οθόνης είναι χιλιάδες και **δεν** χωράει.
 *
 * 🔑 ΓΙΑΤΙ **25** ΚΑΙ ΟΧΙ ΑΛΛΟΣ: είναι ο **ίδιος** συντελεστής που το προηγούμενο
 * καθεστώς χρησιμοποιούσε ήδη σιωπηλά («σημερινό +25%») — άρα η μετανάστευση **δεν
 * αλλάζει την αυστηρότητα καμίας εγγραφής**, αλλάζει **μόνο** το ποιος τον ξέρει και
 * ποιος τον επιβάλλει. Μια μετανάστευση που αλλάζει ταυτόχρονα σχήμα ΚΑΙ αυστηρότητα
 * δεν μπορεί να αποδοθεί σε αιτία όταν κοκκινίσει.
 *
 * ⚠️ ΜΗΝ ΤΟΝ ΚΑΝΕΙΣ ΑΝΑ ΕΓΓΡΑΦΗ. Περιθώριο ανά εγγραφή = ο αυθαίρετος αριθμός που
 * αυτή η ενότητα υπάρχει για να καταργήσει, με άλλο όνομα.
 */
const HEADROOM_PCT = 25;

/**
 * Το **μεγαλύτερο** μέγεθος που περνά. Δεν αποθηκεύεται πουθενά — **παράγεται**.
 *
 * `Math.floor` και όχι `round`/`ceil`: η ετυμηγορία είναι `actual > sealed×(1+h)`, άρα
 * ο μέγιστος ακέραιος που περνά είναι ακριβώς `floor(sealed×(1+h))` — και στις δύο
 * περιπτώσεις (γινόμενο ακέραιο ή όχι). Έτσι ο αριθμός που **τυπώνεται** είναι ο
 * αριθμός που **ισχύει**, χωρίς δεύτερη αριθμητική που μπορεί να αποκλίνει.
 */
function ceilingFor(sealed) {
  return Math.floor(sealed * (1 + HEADROOM_PCT / 100));
}

/** Οι ρητές καταστάσεις **παρουσίας**. Κάθε δήλωση ΚΑΙ κάθε artifact μετριέται ΜΙΑ φορά. */
const ROUTE_PRESENCE = Object.freeze({
  PRESENT: 'present',
  ABSENT: 'declared-but-absent',
  ORPHAN: 'orphan-artifact',
  /**
   * 🔴 ADR-744 §20 (Β2) — Η ΚΑΤΑΣΤΑΣΗ ΠΟΥ ΕΛΕΙΠΕ, ΚΑΙ ΚΟΣΤΙΣΕ.
   *
   * Μια διαδρομή με ανεπίλυτη δυναμική `t()` **χτίζεται** (το `renderComplete`
   * επιστρέφει τα `routes` ακόμη κι όταν αρνείται) — αλλά το slice της είναι
   * **ελλιπές**, άρα τα bytes της είναι **κάτω φράγμα**. Χωρίς αυτή την κατάσταση
   * θα κρινόταν με υποεκτιμημένο αριθμό και θα διαβαζόταν «εντός ταβανιού»:
   * δηλαδή «δεν κρίθηκε» που φοράει τη στολή του «κρίθηκε και πέρασε» — ακριβώς το
   * σχήμα «`0` σημαίνει *κανείς δεν κοίταξε*».
   */
  REFUSED: 'refused-to-emit',
});

/** Άξονας Κ2 — το δηλωμένο ταβάνι. */
const ROUTE_BUDGET = Object.freeze({
  WITHIN: 'within-budget',
  OVER: 'over-budget',
});

/** Άξονας Κ1 — η δομική ερώτηση. */
const ROUTE_SHAPE = Object.freeze({
  PAGE: 'page-shaped',
  SECOND_SHELL: 'second-shell',
});

/** Ημερομηνία σφράγισης: ISO ημέρα. Ένα «πέρσι» δεν είναι ημερομηνία. */
const SEAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

function requireSealDate(at, field, value) {
  if (typeof value !== 'string' || !SEAL_DATE.test(value)) {
    throw new Error(`${at}: το \`${field}\` πρέπει να είναι ημερομηνία ΥΥΥΥ-ΜΜ-ΗΗ (βρέθηκε ${JSON.stringify(value)}).`);
  }
}

function requireByteCount(at, field, value, { allowZero = false } = {}) {
  if (!Number.isInteger(value) || value < 0 || (!allowZero && value === 0)) {
    throw new Error(`${at}: το \`${field}\` πρέπει να είναι ${allowZero ? 'μη αρνητικός' : 'θετικός'} ακέραιος (bytes) — βρέθηκε ${JSON.stringify(value)}.`);
  }
}

/**
 * ADR-744 §20 — Η ΔΗΛΩΣΗ ΜΙΑΣ ΔΙΑΔΡΟΜΗΣ: **ΜΕΤΡΗΣΗ + ΑΛΥΣΙΔΑ ΠΟΥ ΚΛΕΙΝΕΙ.**
 *
 * `{ sealed, sealedAt, reason, history: [{from, to, at, why}, …] }`
 *
 * ⚠️ ΤΟ ΠΑΛΙΟ `budget` ΑΠΟΡΡΙΠΤΕΤΑΙ **ΘΟΡΥΒΩΔΩΣ**, όπως απορρίφθηκε η σκέτη
 * συμβολοσειρά στο §8.38. Δύο σχήματα στο ίδιο μητρώο σημαίνει δύο λίστες που
 * αποκλίνουν — το ακριβές ελάττωμα που γέννησε ολόκληρο το ADR-744 (απόκλιση 63).
 *
 * 🔑 Η ΑΛΥΣΙΔΑ ΕΙΝΑΙ ΤΟ ΟΛΟ ΝΟΗΜΑ. Το `history` δεν είναι ημερολόγιο: είναι
 * **αριθμητική που κλείνει**. Κάθε βήμα ξεκινά εκεί που τελείωσε το προηγούμενο και
 * το τελευταίο καταλήγει **ΑΚΡΙΒΩΣ** στο `sealed`. Έτσι ένα `why` δεν μπορεί να
 * είναι πρόζα κολλημένη πάνω σε αριθμό που άλλαξε αλλού — αν δεν κλείνει, μπλοκάρει.
 * Αυτό είναι το μισό που **λείπει** από το `Binary-Size:` του Chromium.
 */
function parseRouteDeclaration(page, value) {
  const at = `routeSlices.${page}`;
  if (typeof value === 'string') {
    throw new Error(
      `${at}: η δήλωση είναι συμβολοσειρά. Απαιτείται { "sealed": <bytes>, "sealedAt": "ΥΥΥΥ-ΜΜ-ΗΗ", ` +
      '"reason": "…", "history": [ { "from": …, "to": …, "at": "…", "why": "…" } ] }.',
    );
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${at}: άγνωστο σχήμα δήλωσης.`);
  }
  if ('budget' in value) {
    throw new Error(
      `${at}: το \`budget\` καταργήθηκε (ADR-744 §20). Το ταβάνι δεν δηλώνεται πια — ΥΠΟΛΟΓΙΖΕΤΑΙ ` +
      `ως sealed × ${1 + HEADROOM_PCT / 100}. Δήλωσε τη ΜΕΤΡΗΣΗ (\`sealed\`) και την αλυσίδα (\`history\`): ` +
      'ένας αριθμός που μπορείς να ανεβάσεις, θα ανέβει.',
    );
  }
  requireByteCount(at, 'sealed', value.sealed);
  requireSealDate(at, 'sealedAt', value.sealedAt);
  if (typeof value.reason !== 'string' || value.reason.trim() === '') {
    throw new Error(`${at}: λείπει ο \`reason\` — μια εγγραφή χωρίς λόγο δεν αποσύρεται ποτέ.`);
  }
  if (!Array.isArray(value.history) || value.history.length === 0) {
    throw new Error(
      `${at}: λείπει το \`history\` — μια σφράγιση χωρίς καταγεγραμμένη αιτία είναι «bump», ` +
      'και ακριβώς αυτό απαγορεύει η δήλωση του μητρώου.',
    );
  }

  let previous = null;
  value.history.forEach((step, index) => {
    const stepAt = `${at}.history[${index}]`;
    if (step === null || typeof step !== 'object' || Array.isArray(step)) {
      throw new Error(`${stepAt}: άγνωστο σχήμα βήματος.`);
    }
    requireByteCount(stepAt, 'from', step.from, { allowZero: true });
    requireByteCount(stepAt, 'to', step.to);
    requireSealDate(stepAt, 'at', step.at);
    if (typeof step.why !== 'string' || step.why.trim() === '') {
      throw new Error(`${stepAt}: λείπει το \`why\` — η αιτιολογία είναι ΟΛΟΣ ο λόγος που υπάρχει το \`history\`.`);
    }
    if (previous !== null && step.from !== previous) {
      throw new Error(
        `${stepAt}: η αλυσίδα ΔΕΝ κλείνει — ξεκινά από ${step.from} ενώ το προηγούμενο βήμα κατέληξε στα ${previous}. ` +
        'Το `history` είναι αριθμητική, όχι ημερολόγιο.',
      );
    }
    previous = step.to;
  });
  if (previous !== value.sealed) {
    throw new Error(
      `${at}: η αλυσίδα καταλήγει στα ${previous} αλλά το \`sealed\` λέει ${value.sealed}. ` +
      'Η σφράγιση ΕΙΝΑΙ το τελευταίο βήμα — αλλιώς ο αριθμός άλλαξε χωρίς να το πει κανείς.',
    );
  }

  return {
    page,
    sealed: value.sealed,
    sealedAt: value.sealedAt,
    reason: value.reason,
    history: value.history,
    ceiling: ceilingFor(value.sealed),
  };
}

/**
 * Fail-closed: **κάθε** εγγραφή έχει ρητή κατάσταση, το άθροισμα κλείνει, και οι δύο
 * άξονες υπάρχουν **ακριβώς** όταν πρέπει. Άγνωστη κατάσταση ⇒ `throw` **με όνομα**.
 */
function assertRouteLedgerClosed(entries, declaredCount, observedCount) {
  for (const entry of entries) {
    if (!Object.values(ROUTE_PRESENCE).includes(entry.presence)) {
      throw new Error(`routeLedger: άγνωστη κατάσταση παρουσίας «${entry.presence}» για το ${entry.page || entry.id}`);
    }
    const judged = entry.presence === ROUTE_PRESENCE.PRESENT;
    if (judged !== Object.values(ROUTE_BUDGET).includes(entry.budgetVerdict)
      || judged !== Object.values(ROUTE_SHAPE).includes(entry.shapeVerdict)) {
      throw new Error(
        `routeLedger: το ${entry.page || entry.id} είναι «${entry.presence}» αλλά οι άξονες λένε άλλα `
        + `(Κ2=${entry.budgetVerdict}, Κ1=${entry.shapeVerdict})`,
      );
    }
  }
  const count = state => entries.filter(entry => entry.presence === state).length;
  const present = count(ROUTE_PRESENCE.PRESENT);
  const refused = count(ROUTE_PRESENCE.REFUSED);
  // ⚠️ Η ΑΡΝΗΣΗ ΜΕΤΡΑΕΙ **ΚΑΙ ΣΤΙΣ ΔΥΟ** ΠΛΕΥΡΕΣ: μια διαδρομή που αρνήθηκε είναι
  // δηλωμένη (άρα ζυγίζει έναντι του `declaredCount`) ΚΑΙ χτίστηκε (άρα ζυγίζει
  // έναντι του `observedCount`). Αν ζύγιζε μόνο στη μία, η λογιστική θα «έκλεινε»
  // κρύβοντας μια εγγραφή — που είναι το ίδιο το ελάττωμα που η κλάση αυτή φυλάει.
  if (present + refused + count(ROUTE_PRESENCE.ABSENT) !== declaredCount
    || present + refused + count(ROUTE_PRESENCE.ORPHAN) !== observedCount) {
    throw new Error(
      `routeLedger: η λογιστική ΔΕΝ κλείνει — ${present} παρόντα, `
      + `${count(ROUTE_PRESENCE.ABSENT)} απόντα, ${refused} αρνηθέντα, ${count(ROUTE_PRESENCE.ORPHAN)} ορφανά `
      + `έναντι ${declaredCount} δηλώσεων / ${observedCount} artifacts`,
    );
  }
}

/**
 * Εγγραφή που **δεν κρίνεται** στους δύο άξονες, γιατί δεν υπάρχει ζεύγος δήλωσης+artifact.
 * Οι δύο ετυμηγορίες μένουν ρητά `null` — και το `assertRouteLedgerClosed` απαιτεί ακριβώς
 * αυτό, ώστε ένα «δεν κρίθηκε» να μην μπορεί ποτέ να διαβαστεί ως «κρίθηκε και πέρασε».
 */
function unjudged(presence, { page, id, actual }, declaration = null) {
  return {
    page, id, actual,
    sealed: declaration ? declaration.sealed : 0,
    sealedAt: declaration ? declaration.sealedAt : null,
    ceiling: declaration ? declaration.ceiling : 0,
    reason: declaration ? declaration.reason : '',
    presence, budgetVerdict: null, shapeVerdict: null, slack: null,
  };
}

/**
 * Η κρίση μιας παρούσας διαδρομής στους **δύο** άξονες — ποτέ «ο πρώτος που ταιριάζει».
 *
 * 🔑 Το Κ2 δεν συγκρίνει με δηλωμένο αριθμό: ρωτά το **κοινό** `isRegression` αν το
 * τρέχον ξέφυγε από το **σφραγισμένο** πέρα από το περιθώριο. Ίδια αριθμητική με τις
 * 27 άλλες πύλες — μία μηχανή, κανένα δεύτερο κατώφλι να αποκλίνει (ADR-749).
 *
 * 🔑 Το `slack` δεν είναι διακόσμηση: είναι η ερώτηση «**πόσο μπαγιάτικη είναι η
 * σφράγιση;**». Ταβάνι με αχρησιμοποίητο περιθώριο κρύβει την επόμενη παλινδρόμηση
 * στο ίδιο σημείο — το ADR-598 το πλήρωσε με 8× τζόγο επί 40 ημέρες.
 */
function judgeRoute(page, item, declaration, shellBytes) {
  return {
    page,
    id: item.id,
    actual: item.actual,
    sealed: declaration.sealed,
    sealedAt: declaration.sealedAt,
    ceiling: declaration.ceiling,
    reason: declaration.reason,
    presence: ROUTE_PRESENCE.PRESENT,
    budgetVerdict: isRegression({
      current: item.actual,
      baseline: declaration.sealed,
      direction: 'down',
      tolerancePct: HEADROOM_PCT,
    }) ? ROUTE_BUDGET.OVER : ROUTE_BUDGET.WITHIN,
    shapeVerdict: item.actual >= shellBytes ? ROUTE_SHAPE.SECOND_SHELL : ROUTE_SHAPE.PAGE,
    slack: declaration.sealed - item.actual,
  };
}

/**
 * Η **κλειστή λογιστική** των per-route slices.
 *
 * @param {object}   declarations  `config.routeSlices` — `{ [pageFile]: {sealed, sealedAt, reason, history} }`
 * @param {object[]} observed      `[{ id, page, actual }]`· `page` κενό ⇒ artifact χωρίς δήλωση
 * @param {number}   shellBytes    το μέγεθος του κελύφους, στην ΙΔΙΑ μονάδα (UTF-8 bytes)
 * @returns {{entries: object[], shellBytes: number, failures: object[]}}
 */
function auditRouteLedger(declarations, observed, shellBytes) {
  if (!Number.isInteger(shellBytes) || shellBytes <= 0) {
    // Fail-closed: χωρίς παρονομαστή το Κ1 δεν έχει γνώμη — και μια πύλη που δεν έχει
    // γνώμη ΔΕΝ επιτρέπεται να απαντήσει «καθαρό» (το σχήμα «0 = κανείς δεν κοίταξε»).
    throw new Error('routeLedger: το μέγεθος του κελύφους είναι άγνωστο — το Κ1 δεν κρίνεται.');
  }
  const declared = new Map(
    Object.entries(declarations).map(([page, value]) => [page, parseRouteDeclaration(page, value)]),
  );
  const byPage = new Map();
  const entries = [];

  for (const item of observed) {
    if (item.page && declared.has(item.page)) byPage.set(item.page, item);
    else entries.push(unjudged(ROUTE_PRESENCE.ORPHAN, { page: item.page || null, id: item.id, actual: item.actual }));
  }

  for (const [page, declaration] of declared) {
    const item = byPage.get(page);
    if (item === undefined) entries.push(unjudged(ROUTE_PRESENCE.ABSENT, { page, id: null, actual: 0 }, declaration));
    // 🔴 ADR-744 §20 (Β2): αρνήθηκε ⇒ **ΔΕΝ ΚΡΙΝΕΤΑΙ**. Τα bytes του είναι κάτω φράγμα,
    // και ένα κάτω φράγμα κάτω από το ταβάνι ΔΕΝ αποδεικνύει τίποτα.
    else if (item.refused === true) {
      entries.push(unjudged(ROUTE_PRESENCE.REFUSED, { page, id: item.id, actual: item.actual }, declaration));
    } else entries.push(judgeRoute(page, item, declaration, shellBytes));
  }

  assertRouteLedgerClosed(entries, declared.size, observed.length);
  const failures = entries.filter(entry => entry.presence !== ROUTE_PRESENCE.PRESENT
    || entry.budgetVerdict === ROUTE_BUDGET.OVER
    || entry.shapeVerdict === ROUTE_SHAPE.SECOND_SHELL);
  return { entries: entries.sort((a, b) => b.actual - a.actual), shellBytes, failures, headroomPct: HEADROOM_PCT };
}

/**
 * ADR-744 §20 — **ΟΙ ΣΦΡΑΓΙΔΕΣ ΠΟΥ ΠΑΛΙΩΣΑΝ**, ανακοινωμένες όπως σε 27 άλλες πύλες.
 *
 * ⚠️ **ΔΕΝ ΜΠΛΟΚΑΡΕΙ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ** — η ίδια που είναι γραμμένη στο
 * `ratchet-baseline.js`: μπλοκάρισμα στη **βελτίωση** σταματά τον άνθρωπο για κάτι
 * που δεν είναι ελάττωμα ⇒ μονίμως κόκκινο ⇒ `SKIP_` ⇒ διακοσμητική πύλη. Αντ' αυτού
 * η ορατότητα γίνεται αδύνατο να θαφτεί (γραμμή + annotation στο PR).
 *
 * @param {object[]} entries  οι εγγραφές του `auditRouteLedger`
 * @param {number} minBytes   κάτω από πόσα bytes τζόγου δεν αξίζει να μιλήσουμε
 */
function announceRouteSlack(entries, minBytes = 500) {
  return entries
    .filter(entry => entry.presence === ROUTE_PRESENCE.PRESENT && entry.slack >= minBytes)
    .map(entry => announceSlack({
      adr: 'ADR-744 §20',
      slack: entry.slack,
      detail: `${entry.page}: ${entry.slack} bytes κάτω από τη σφράγιση (${entry.sealed}, ${entry.sealedAt}) — τρέχον ${entry.actual}`,
      // ⚠️ ΔΕΝ ΥΠΑΡΧΕΙ ΑΥΤΟΜΑΤΗ ΣΦΡΑΓΙΣΗ, ΕΠΙΤΗΔΕΣ. Το εργαλείο δίνει τη ΜΕΤΡΗΣΗ·
      // το `why` το γράφει **άνθρωπος**, όπως το `Binary-Size:` του Chromium. Εντολή
      // που σφραγίζει μόνη της θα ήταν ακριβώς το «bump» που όλο αυτό καταργεί.
      command: 'npm run generate:i18n-shell-slice -- --measure (και μετά γράψε το `why` με το χέρι)',
    }))
    .filter(line => line !== '');
}

/** Ένα μήνυμα που **ονομάζει τη διαδρομή και τον κανόνα**, ποτέ σκέτο «over budget». */
function describeRouteFailures(failures, shellBytes) {
  return failures.map(failure => {
    if (failure.presence === ROUTE_PRESENCE.ORPHAN) {
      return `${failure.id}: artifact ΧΩΡΙΣ δήλωση στο routeSlices — ταξιδεύει παγωμένο και κανείς δεν το υπογράφει`;
    }
    if (failure.presence === ROUTE_PRESENCE.ABSENT) {
      return `${failure.page}: δηλωμένο στο routeSlices αλλά ΔΕΝ παρήχθη artifact`;
    }
    if (failure.presence === ROUTE_PRESENCE.REFUSED) {
      return `${failure.page}: ΔΕΝ ΚΡΙΘΗΚΕ — το slice αρνήθηκε να εκπεμφθεί (ανεπίλυτη δυναμική t()), `
        + `άρα τα ${failure.actual} bytes είναι ΚΑΤΩ ΦΡΑΓΜΑ και δεν συγκρίνονται με τίποτα`;
    }
    if (failure.shapeVerdict === ROUTE_SHAPE.SECOND_SHELL) {
      return `${failure.page}: ${failure.actual} bytes = ${((100 * failure.actual) / shellBytes).toFixed(1)}% `
        + `του κελύφους (${shellBytes}) — ΔΕΥΤΕΡΟ ΚΕΛΥΦΟΣ, όχι αφαίρεση (Κ1)`;
    }
    return `${failure.page}: ${failure.actual} bytes > ${failure.ceiling} `
      + `(= σφράγιση ${failure.sealed} της ${failure.sealedAt} + ${HEADROOM_PCT}% περιθώριο) — Κ2. `
      + 'Η κλειστότητα μεγάλωσε: είτε βάλε ΟΡΙΟ (next/dynamic), είτε ΣΦΡΑΓΙΣΕ ΞΑΝΑ με γραμμένο `why`';
  }).join(' · ');
}

module.exports = {
  LEDGER_LIMIT_BYTES,
  HEADROOM_PCT,
  VERDICTS,
  ROUTE_PRESENCE,
  ROUTE_BUDGET,
  ROUTE_SHAPE,
  ceilingFor,
  parseDeclaration,
  parseRouteDeclaration,
  auditLedger,
  auditRouteLedger,
  announceLedgerSlack,
  announceRouteSlack,
  describeFailures,
  describeRouteFailures,
};
