#!/usr/bin/env node
/**
 * =============================================================================
 * ADR-744 §23 — Η ΑΠΟΓΡΑΦΗ ΤΟΥ ΚΕΛΥΦΟΥΣ: **ΠΟΙΟΣ ΜΠΗΚΕ, ΚΑΙ ΠΟΙΟΣ ΤΟ ΑΠΟΦΑΣΙΣΕ;**
 * =============================================================================
 *
 * «Κάθε namespace που ταξιδεύει στο κέλυφος — σε **~150 διαδρομές** — υπάρχει επειδή
 *  **κάποιος το αποφάσισε γραπτά**, και ο υπαίτιος **ονομάζεται**.»
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ, ΜΕΤΡΗΜΕΝΟ (2026-09-04). Το κέλυφος κουβαλά **18** namespaces:
 * **10** ταξιδεύουν ΟΛΟΚΛΗΡΑ και τα φυλάει το `guaranteedNamespaces` (§8, `ledger.js`),
 * **8** ταξιδεύουν κομμένα στο κλειδί και **δεν τα φύλαγε ΚΑΝΕΙΣ**. Ένα
 * `import { criterionLabel }` μέσα στο `ListingCard` — που ζει στο κέλυφος επειδή τη
 * χρησιμοποιεί η βιτρίνα της ρίζας — τα έκανε **8 → 10** (`listing-detail`,
 * `properties-enums`). Ο φρουρός `wholeNs.length <= 10` έμεινε **ΠΡΑΣΙΝΟΣ**: φύλαγε το
 * **άλλο μισό**. Φάνηκε **μόνο** επειδή 8 άσχετες διαδρομές έχασαν ταυτόχρονα το
 * `properties-enums:types.*`, αφαιρεμένο ως «το δίνει ήδη το κέλυφος».
 *
 * ⚠️ **ΞΑΝΑΜΕΤΡΗΘΗΚΕ 2026-09-05 ΚΑΙ ΤΑ ΝΟΥΜΕΡΑ ΕΙΝΑΙ ΧΕΙΡΟΤΕΡΑ**: η ίδια εισαγωγή σέρνει
 * σήμερα **ΤΡΙΑ** namespaces (**8 → 11**), γιατί στο μεταξύ γεννήθηκε το `search-filters`.
 * Δηλαδή το κόστος ενός `import` **μεγαλώνει μόνο του** με τον χρόνο, χωρίς κανείς να
 * ξαναγγίξει τη γραμμή — ακριβώς ο λόγος που ο φρουρός δεν μπορεί να είναι στιγμιότυπο.
 *
 * ⇒ **Πύλη που πιάνει το περιστατικό από παρενέργεια δεν είναι πύλη· είναι τύχη.**
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΓΙΑΤΙ **ΠΟΤΕ** BYTES ΕΔΩ — ΚΑΙ ΓΙΑΤΙ ΤΟ ΦΥΛΑΕΙ Η ΔΟΜΗ, ΟΧΙ ΕΝΑ ΣΧΟΛΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το key-sliced μέρος **μεγαλώνει ακριβώς όταν κάποιος διορθώνει ωμό κλειδί**: κάθε
 * θεραπεία ενός hardcoded string προσθέτει κλειδί, άρα bytes. Ένα ratchet σε bytes θα
 * μπλόκαρε **τη θεραπεία** — το αντι-πρότυπο που τα CHECK 3.44 και 3.53 απορρίπτουν
 * ρητά, και που το ίδιο το Group 12 πλήρωσε ήδη μια φορά (κατώφλι 220.000 που
 * κυριαρχούνταν από το ledger αλλά κοκκίνιζε από 10 KB κλειδιών).
 *
 * 🔑 **Η ΔΙΑΚΡΙΣΗ ΠΟΥ ΕΙΝΑΙ ΟΛΗ Η ΟΥΣΙΑ:**
 *
 * | Τι αλλάζει | Τι σημαίνει | Τι κάνει η πύλη |
 * |---|---|---|
 * | **νέο κλειδί** σε υπάρχον ns | θεραπεία ωμού κλειδιού | ✅ **περνά ελεύθερα** |
 * | **νέο namespace** στο κέλυφος | νέα **οικογένεια κειμένου** σε ~150 διαδρομές | 🔴 **απόφαση με γραπτό λόγο** |
 *
 * ⚠️ Γι' αυτό ο κανόνας **δεν ζει στο `ledger.js`**, όσο κι αν είναι αδελφός του: εκείνο
 * το αρχείο **είναι** αριθμητική bytes (`Buffer.byteLength` σε τρία σημεία,
 * `LEDGER_LIMIT_BYTES`, `HEADROOM_PCT`). Εδώ **δεν υπάρχει ΚΑΜΙΑ** — δηλαδή ένα ratchet
 * σε bytes δεν «απαγορεύεται από σχόλιο», **δεν έχει από πού να γραφτεί**. Η απαγόρευση
 * είναι δομική, και οι δομικές απαγορεύσεις είναι οι μόνες που επιβιώνουν.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΔΥΟ ΑΝΕΞΑΡΤΗΤΟΙ ΚΑΝΟΝΕΣ, **ΠΟΤΕ ΕΝΑΣ ΜΕ «Ή»** (μάθημα CHECK 3.41)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   **Κ1 — ΚΛΕΙΣΤΗ ΑΠΟΓΡΑΦΗ** (⛔ zero-tolerance). Τα δύο κατάστιχα είναι **ΔΙΑΜΕΡΙΣΗ**
 *   του κελύφους: κάθε namespace που ταξιδεύει δηλώνεται σε **ΑΚΡΙΒΩΣ ΕΝΑ**
 *   (`guaranteedNamespaces` αν είναι ολόκληρο, `shellNamespaces` αν είναι κομμένο), και
 *   κάθε δήλωση αντιστοιχεί σε namespace που **όντως** ταξιδεύει. Και οι **τέσσερις**
 *   αστοχίες ονομάζονται χωριστά — αδήλωτο · δηλωμένο-απόν · λάθος κατάστιχο ×2 —
 *   γιατί ένα «δεν κλείνει η απογραφή» δεν λέει **ποιο** και ο άνθρωπος ψάχνει.
 *
 *   **Κ2 — ΤΟ ΠΛΗΘΟΣ ΜΟΝΟ ΣΥΡΡΙΚΝΩΝΕΤΑΙ** (🔴 ratchet). Το Κ1 φυλάει «κανείς δεν μπαίνει
 *   σιωπηλά»· **δεν** φυλάει «κανείς δεν μπαίνει». Χωρίς το Κ2 το κέλυφος φτάνει τα 40
 *   namespaces, το καθένα με εύλογο `reason`, και κάθε βήμα είναι νόμιμο.
 *
 * Ένας κανόνας με «ή» θα έμενε **πράσινος πάνω στο ελάττωμα**: ένα αδήλωτο namespace
 * κάτω από το πλήθος περνά το Κ2 ενώ κανείς δεν το αποφάσισε (Κ1)· οκτώ **σωστά
 * δηλωμένα** που έγιναν δώδεκα περνούν το Κ1 ενώ το κέλυφος διπλασιάστηκε (Κ2).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΗΝ ΠΡΑΚΤΙΚΗ — ΕΡΕΥΝΗΜΕΝΟ, ΟΧΙ ΥΠΟΘΕΤΙΚΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   · **i18next / next-intl / locize** — κανένα δεν έχει έννοια «τι επιτρέπεται στη
 *     σύγχρονη διαδρομή». Το ερώτημα δεν υπάρχει στο οικοσύστημα.
 *   · **`size-limit` / `bundlesize` / Lighthouse budgets** — μετρούν **μέγεθος**, άρα
 *     πέφτουν ακριβώς στην παγίδα των bytes: κοκκινίζουν στη θεραπεία.
 *   · **`dependency-cruiser` `forbidden` rules** — φυλάνε **ακμές** («το Α να μη φτάνει
 *     στο Β»), δηλαδή απαιτούν να ξέρεις **εκ των προτέρων** ποιο Β σε πονά. Το
 *     περιστατικό της 04/09 ήταν ακριβώς ένα Β που κανείς δεν είχε φανταστεί.
 *   · **webpack `--stats-reasons`** — ξέρει **ποιος** εισήγαγε τι, αλλά ως **αναφορά**
 *     που τη διαβάζει άνθρωπος όταν ήδη υποψιάζεται. Κανένα συμβόλαιο.
 *
 * 🔑 **ΤΟ ΒΗΜΑ ΠΑΡΑΠΑΝΩ**: η δήλωση δεν είναι πρόζα — ονομάζει τον **`dragger`**, το
 * αρχείο του κελύφους που σέρνει το namespace, και η πύλη **επαληθεύει από το manifest**
 * ότι εκείνο το αρχείο **εξακολουθεί** να το ζητά. Δηλαδή τα `--stats-reasons` του
 * webpack, γραμμένα ως **συμβόλαιο που διαψεύδεται**. Όταν ο υπαίτιος αλλάξει, η πύλη
 * το λέει: «ο δηλωμένος αίτιος δεν το ζητά πια — ονόμασε τον νέο». Ένα μητρώο που
 * λέει **γιατί** χωρίς να ελέγχει **αν ισχύει ακόμη** είναι το «~1,6 KB» του ADR-777 §8.38 με
 * άλλο ρούχο (πρόζα δεν είναι προϋπολογισμός — ούτε αιτιολογία).
 *
 * ⚠️ **Ο `dragger` είναι ΕΝΑΣ, όχι λίστα, και είναι απόφαση**: ένα `common-shared` το
 * ζητούν δεκάδες αρχεία, και μια λίστα που τα απαριθμεί όλα θα άλλαζε σε κάθε άσχετο
 * commit — δηλαδή θόρυβος που γίνεται `SKIP_`. Δηλώνεται **ο αντιπροσωπευτικός**: αυτός
 * που, αν φύγει, αξίζει να ξαναρωτηθεί «γιατί είναι ακόμη εδώ;».
 *
 * @module scripts/lib/i18n-shell-slice/shell-census
 */

'use strict';

const { isRegression, announceSlack } = require('../ratchet-baseline');

/** Τα δύο κατάστιχα, με τα ονόματά τους όπως τα γράφει ο άνθρωπος στο αρχείο ρύθμισης. */
const LEDGERS = Object.freeze({
  WHOLE: 'guaranteedNamespaces',
  SLICED: 'shellNamespaces',
});

/**
 * Οι ρητές καταστάσεις της απογραφής. **Καμία σιωπηλή απόρριψη** — άγνωστη ⇒ `throw`.
 *
 * ⚠️ Οι δύο «λάθος κατάστιχο» είναι **ξεχωριστές** και όχι μία συμμετρική: η θεραπεία
 * τους είναι **αντίθετη** (μετακόμισε τη δήλωση προς τα εκεί ⇄ προς τα εδώ), και μια
 * κοινή κατάσταση θα ανάγκαζε τον άνθρωπο να συμπεράνει την κατεύθυνση.
 */
const CENSUS = Object.freeze({
  DECLARED: 'declared',
  UNDECLARED: 'shipped-but-undeclared',
  ABSENT: 'declared-but-absent',
  SHOULD_BE_WHOLE: 'sliced-ledger-but-ships-whole',
  SHOULD_BE_SLICED: 'whole-ledger-but-ships-sliced',
  STALE_DRAGGER: 'declared-dragger-no-longer-asks',
});

/**
 * Το **σφραγισμένο πλήθος** — μέτρηση, όχι προτίμηση (μάθημα ADR-744 §20).
 *
 * ⚠️ **ΧΩΡΙΣ ΠΕΡΙΘΩΡΙΟ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ.** Το `HEADROOM_PCT` του `ledger.js` υπάρχει
 * για να απορροφά τη **διακύμανση του κειμένου** — μια λέξη παραπάνω σε μια μετάφραση
 * δεν είναι παλινδρόμηση. Εδώ η μονάδα δεν είναι κείμενο, είναι **ακέραιος αποφάσεων**:
 * περιθώριο 25% σε πλήθος 8 σημαίνει «δύο δωρεάν namespaces», δηλαδή **ακριβώς ο
 * αριθμός που ανεβάζεις για να γίνει πράσινο**, με άλλο όνομα.
 */
function parseSeal(seal) {
  const at = `${LEDGERS.SLICED}Seal`;
  if (seal === null || typeof seal !== 'object' || Array.isArray(seal)) {
    throw new Error(`${at}: άγνωστο σχήμα σφράγισης — απαιτείται { "count": <n>, "at": "ΥΥΥΥ-ΜΜ-ΗΗ", "why": "…" }.`);
  }
  if (!Number.isInteger(seal.count) || seal.count < 0) {
    throw new Error(`${at}.count: πρέπει να είναι μη αρνητικός ακέραιος — βρέθηκε «${seal.count}».`);
  }
  if (typeof seal.at !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(seal.at)) {
    throw new Error(`${at}.at: πρέπει να είναι ημερομηνία ΥΥΥΥ-ΜΜ-ΗΗ — ένα «πέρσι» δεν είναι ημερομηνία.`);
  }
  if (typeof seal.why !== 'string' || seal.why.trim().length < 20) {
    throw new Error(`${at}.why: λείπει ο λόγος της σφράγισης — ένας αριθμός χωρίς λόγο δεν μπορεί να κριθεί όταν κοκκινίσει.`);
  }
  return { count: seal.count, at: seal.at, why: seal.why };
}

/**
 * Η δήλωση ενός key-sliced namespace, κανονικοποιημένη.
 *
 * ⚠️ **ΣΧΗΜΑ ΑΝΤΙΚΕΙΜΕΝΟΥ ΥΠΟΧΡΕΩΤΙΚΑ** — σκέτη συμβολοσειρά απορρίπτεται θορυβωδώς,
 * για τον **ίδιο μετρημένο λόγο** με το `parseDeclaration` του αδελφού: πρόζα μέσα σε
 * συμβολοσειρά είναι ανέλεγκτη, και το «~1,6 KB» έζησε ψέμα έντεκα μέρες.
 */
function parseShellDeclaration(namespace, value) {
  const at = `${LEDGERS.SLICED}.${namespace}`;
  if (typeof value === 'string') {
    throw new Error(
      `${at}: η δήλωση είναι συμβολοσειρά. Απαιτείται { "dragger": "<αρχείο κελύφους>", "reason": "…" } — ` +
      'πρόζα δεν είναι αιτιολογία (ADR-744 §23).',
    );
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${at}: άγνωστο σχήμα δήλωσης.`);
  }
  if (typeof value.dragger !== 'string' || value.dragger.trim() === '') {
    throw new Error(`${at}: λείπει ο \`dragger\` — το αρχείο του κελύφους που σέρνει το namespace. Χωρίς αίτιο, η δήλωση δεν διαψεύδεται ποτέ.`);
  }
  if (typeof value.reason !== 'string' || value.reason.trim().length < 20) {
    throw new Error(`${at}: λείπει ο \`reason\` — μια εγγραφή χωρίς λόγο δεν αποσύρεται ποτέ.`);
  }
  return { namespace, dragger: value.dragger, reason: value.reason };
}

/**
 * Η **κλειστή απογραφή** του κελύφους.
 *
 * @param {object} declarations   `config.shellNamespaces`
 * @param {object} guaranteed     `config.guaranteedNamespaces` — το άλλο μισό της διαμέρισης
 * @param {string[]} shipped      τα namespaces που **όντως** ταξιδεύουν (κλειδιά του slice)
 * @param {object} wants          `manifest.wants` — η αυθεντία για `whole` **και** `from`
 * @param {object} seal           `config.shellNamespacesSeal`
 */
function auditShellCensus(declarations, guaranteed, shipped, wants, seal) {
  const declared = new Map(
    Object.entries(declarations).map(([ns, value]) => [ns, parseShellDeclaration(ns, value)]),
  );
  const wholeDeclared = new Set(Object.keys(guaranteed));
  const sealed = parseSeal(seal);
  const shipsWhole = ns => wants[ns] !== undefined && wants[ns].whole === true;
  const entries = [];

  // ── Η κατεύθυνση «τι ταξιδεύει» — πιάνει το αδήλωτο, δηλαδή το περιστατικό της 04/09.
  for (const namespace of [...shipped].sort()) {
    const sliced = !shipsWhole(namespace);
    if (sliced && !declared.has(namespace)) {
      entries.push({
        namespace,
        verdict: wholeDeclared.has(namespace) ? CENSUS.SHOULD_BE_SLICED : CENSUS.UNDECLARED,
        from: (wants[namespace] && wants[namespace].from) || [],
        dragger: null,
      });
      continue;
    }
    if (!sliced && declared.has(namespace)) {
      entries.push({ namespace, verdict: CENSUS.SHOULD_BE_WHOLE, from: [], dragger: declared.get(namespace).dragger });
    }
  }

  // ── Η ΑΛΛΗ κατεύθυνση, και δεν είναι πολυτέλεια: μια δήλωση που έπαψε να αντιστοιχεί
  //    σε πραγματικότητα είναι **νεκρή ρύθμιση** που κρατά ψηλά το ταβάνι του Κ2 — άρα
  //    χαρίζει μια δωρεάν θέση στο επόμενο namespace, σιωπηλά.
  const shippedSet = new Set(shipped);
  for (const [namespace, declaration] of declared) {
    if (!shippedSet.has(namespace)) {
      entries.push({ namespace, verdict: CENSUS.ABSENT, from: [], dragger: declaration.dragger });
      continue;
    }
    if (shipsWhole(namespace)) continue;   // ήδη καταγγέλθηκε ως SHOULD_BE_WHOLE
    const askers = (wants[namespace] && wants[namespace].from) || [];
    entries.push({
      namespace,
      verdict: askers.includes(declaration.dragger) ? CENSUS.DECLARED : CENSUS.STALE_DRAGGER,
      from: askers,
      dragger: declaration.dragger,
    });
  }

  for (const entry of entries) {
    if (!Object.values(CENSUS).includes(entry.verdict)) {
      throw new Error(`shell-census: άγνωστη κατάσταση «${entry.verdict}» για το ${entry.namespace}`);
    }
  }

  // ── Κ2: το πλήθος. Μετριέται σε **ό,τι ταξιδεύει**, ποτέ σε ό,τι δηλώθηκε — αλλιώς
  //    μια ξεχασμένη δήλωση θα κοκκίνιζε το ratchet ενώ το κέλυφος έχει μικρύνει.
  const slicedCount = [...shippedSet].filter(ns => !shipsWhole(ns)).length;
  const failures = entries
    .filter(e => e.verdict !== CENSUS.DECLARED)
    .sort((a, b) => a.namespace.localeCompare(b.namespace));
  const grew = isRegression({ current: slicedCount, baseline: sealed.count, direction: 'down' });

  return {
    entries: entries.sort((a, b) => a.namespace.localeCompare(b.namespace)),
    slicedCount,
    sealed,
    grew,
    failures,
  };
}

/**
 * ADR-744 §23 — **Η ΣΦΡΑΓΙΔΑ ΠΟΥ ΠΑΛΙΩΣΕ ΠΡΟΣ ΤΑ ΚΑΤΩ.**
 *
 * Ένα ταβάνι με τζόγο κρύβει την επόμενη παλινδρόμηση **στο ίδιο σημείο** — και εδώ
 * κάθε μονάδα τζόγου είναι **ένα ολόκληρο namespace** που μπορεί να μπει χωρίς να
 * κοκκινίσει τίποτα. Μάθημα ADR-598: 8× τζόγος επί 40 ημέρες.
 */
function announceCensusSlack(audit) {
  const slack = audit.sealed.count - audit.slicedCount;
  if (slack <= 0) return [];
  return [announceSlack({
    adr: 'ADR-744 §23',
    slack,
    detail: `το κέλυφος κουβαλά ${audit.slicedCount} key-sliced namespaces έναντι σφράγισης ${audit.sealed.count} (${audit.sealed.at}) — ${slack} δωρεάν θέση/θέσεις`,
    command: 'κατέβασε το `shellNamespacesSeal.count` στο .i18n-shell-slice.json',
  })].filter(line => line !== '');
}

/** Ένα ανθρώπινο μήνυμα που **ονομάζει τον υπαίτιο**, ποτέ μόνο το σύμπτωμα. */
function describeCensusFailures(failures) {
  return failures.map(f => {
    const who = f.from.length > 0
      ? `${f.from.slice(0, 3).join(' · ')}${f.from.length > 3 ? ` (+${f.from.length - 3})` : ''}`
      : '';
    switch (f.verdict) {
      case CENSUS.UNDECLARED:
        return `${f.namespace}: ΜΠΗΚΕ ΣΤΟ ΚΕΛΥΦΟΣ χωρίς δήλωση στο ${LEDGERS.SLICED}`
          + `${who === '' ? '' : ` — το σέρνει: ${who}`}`
          + '. Είτε κόψε την εισαγωγή, είτε δήλωσέ το με { dragger, reason } ΚΑΙ σφράγισε ξανά με γραμμένο `why`';
      case CENSUS.ABSENT:
        return `${f.namespace}: δηλωμένο στο ${LEDGERS.SLICED} αλλά ΔΕΝ ταξιδεύει πια — σβήσε τη δήλωση και ΚΑΤΕΒΑΣΕ τη σφράγιση`;
      case CENSUS.SHOULD_BE_WHOLE:
        return `${f.namespace}: δηλωμένο στο ${LEDGERS.SLICED} αλλά ταξιδεύει ΟΛΟΚΛΗΡΟ — ανήκει στο ${LEDGERS.WHOLE}, με προϋπολογισμό bytes`;
      case CENSUS.SHOULD_BE_SLICED:
        return `${f.namespace}: δηλωμένο στο ${LEDGERS.WHOLE} αλλά ταξιδεύει ΚΟΜΜΕΝΟ — ανήκει στο ${LEDGERS.SLICED}`;
      case CENSUS.STALE_DRAGGER:
        return `${f.namespace}: ο δηλωμένος αίτιος «${f.dragger}» ΔΕΝ το ζητά πια`
          + `${who === '' ? ' — και κανείς άλλος δεν φαίνεται να το ζητά' : ` — τώρα το σέρνει: ${who}`}`
          + '. Ονόμασε τον νέο αίτιο ή αφαίρεσε την εγγραφή';
      default:
        return `${f.namespace}: ${f.verdict}`;
    }
  }).join(' · ');
}

/** Το μήνυμα του Κ2. Χωριστό από το Κ1 — **δύο κανόνες, δύο φωνές**. */
function describeCensusGrowth(audit) {
  return `το κέλυφος κουβαλά ${audit.slicedCount} key-sliced namespaces έναντι σφραγισμένων `
    + `${audit.sealed.count} (${audit.sealed.at}) — ΜΟΝΟ ΣΥΡΡΙΚΝΩΝΕΤΑΙ. `
    + 'Ένα νέο namespace στο κέλυφος είναι νέα οικογένεια κειμένου σε ~150 διαδρομές: '
    + 'αν είναι σκόπιμο, σφράγισε ξανά με γραμμένο `why`.';
}

module.exports = {
  LEDGERS,
  CENSUS,
  parseSeal,
  parseShellDeclaration,
  auditShellCensus,
  announceCensusSlack,
  describeCensusFailures,
  describeCensusGrowth,
};
