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

/** Οι ρητές καταστάσεις **παρουσίας**. Κάθε δήλωση ΚΑΙ κάθε artifact μετριέται ΜΙΑ φορά. */
const ROUTE_PRESENCE = Object.freeze({
  PRESENT: 'present',
  ABSENT: 'declared-but-absent',
  ORPHAN: 'orphan-artifact',
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
  if (present + count(ROUTE_PRESENCE.ABSENT) !== declaredCount
    || present + count(ROUTE_PRESENCE.ORPHAN) !== observedCount) {
    throw new Error(
      `routeLedger: η λογιστική ΔΕΝ κλείνει — ${present} παρόντα, `
      + `${count(ROUTE_PRESENCE.ABSENT)} απόντα, ${count(ROUTE_PRESENCE.ORPHAN)} ορφανά `
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
    budget: declaration ? declaration.budget : 0,
    reason: declaration ? declaration.reason : '',
    presence, budgetVerdict: null, shapeVerdict: null,
  };
}

/** Η κρίση μιας παρούσας διαδρομής στους **δύο** άξονες — ποτέ «ο πρώτος που ταιριάζει». */
function judgeRoute(page, item, declaration, shellBytes) {
  return {
    page,
    id: item.id,
    actual: item.actual,
    budget: declaration.budget,
    reason: declaration.reason,
    presence: ROUTE_PRESENCE.PRESENT,
    budgetVerdict: item.actual > declaration.budget ? ROUTE_BUDGET.OVER : ROUTE_BUDGET.WITHIN,
    shapeVerdict: item.actual >= shellBytes ? ROUTE_SHAPE.SECOND_SHELL : ROUTE_SHAPE.PAGE,
  };
}

/**
 * Η **κλειστή λογιστική** των per-route slices.
 *
 * @param {object}   declarations  `config.routeSlices` — `{ [pageFile]: {budget, reason} }`
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
    Object.entries(declarations).map(([page, value]) => [page, parseDeclaration(page, value, 'routeSlices')]),
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
    else entries.push(judgeRoute(page, item, declaration, shellBytes));
  }

  assertRouteLedgerClosed(entries, declared.size, observed.length);
  const failures = entries.filter(entry => entry.presence !== ROUTE_PRESENCE.PRESENT
    || entry.budgetVerdict === ROUTE_BUDGET.OVER
    || entry.shapeVerdict === ROUTE_SHAPE.SECOND_SHELL);
  return { entries: entries.sort((a, b) => b.actual - a.actual), shellBytes, failures };
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
    if (failure.shapeVerdict === ROUTE_SHAPE.SECOND_SHELL) {
      return `${failure.page}: ${failure.actual} bytes = ${((100 * failure.actual) / shellBytes).toFixed(1)}% `
        + `του κελύφους (${shellBytes}) — ΔΕΥΤΕΡΟ ΚΕΛΥΦΟΣ, όχι αφαίρεση (Κ1)`;
    }
    return `${failure.page}: ${failure.actual} bytes > προϋπολογισμός ${failure.budget} (Κ2)`;
  }).join(' · ');
}

module.exports = {
  LEDGER_LIMIT_BYTES,
  VERDICTS,
  ROUTE_PRESENCE,
  ROUTE_BUDGET,
  ROUTE_SHAPE,
  parseDeclaration,
  auditLedger,
  auditRouteLedger,
  describeFailures,
  describeRouteFailures,
};
