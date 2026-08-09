#!/usr/bin/env node
/**
 * =============================================================================
 * Κ2 — ΜΠΟΡΕΙ ΤΟ ΑΠΟΣΤΕΛΛΟΜΕΝΟ SLICE ΝΑ ΑΠΑΝΤΗΣΕΙ Ο,ΤΙ ΖΩΓΡΑΦΙΖΕΙ ΠΑΝΤΑ;
 * (CHECK 3.51 / ADR-781 §5)
 * =============================================================================
 *
 * ΤΟ ΕΡΩΤΗΜΑ: για **κάθε σημείο κλήσης `t()`** μέσα στην κλειστότητα των
 * layouts — δηλαδή το κομμάτι της εφαρμογής που ζωγραφίζεται σε **κάθε μία**
 * από τις 141 διαδρομές — υπάρχει **έστω ΕΝΑ** υποψήφιο namespace που το
 * `src/i18n/generated/shell-slice.el.json` μπορεί να απαντήσει;
 *
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΤΟ ΡΩΤΑΕΙ ΗΔΗ ΚΑΠΟΙΟΣ — ΕΛΕΓΧΘΗΚΕ ΔΙΑΒΑΖΟΝΤΑΣ ΤΟΥΣ ΚΩΔΙΚΕΣ
 * -------------------------------------------------------------------------
 *  • **CHECK 3.34** ρωτά «είναι το artifact **αυτό που θα παρήγαγε** ο
 *    generator;» (ακεραιότητα · locale drift · shell drift · resolution drift).
 *    Αν ο generator παράγει slice που **δεν μπορεί να απαντήσει** ένα σημείο
 *    κλήσης του shell, το 3.34 είναι **πράσινο** — το artifact είναι σωστό,
 *    απλώς ανεπαρκές. Το `pruneNamespace` ρίχνει σιωπηλά ό,τι δεν έχει τιμή.
 *  • **CHECK 3.8** ρωτά «υπάρχει το κλειδί στο **locale**;» — άλλη πηγή — και
 *    **παραλείπει ρητά** `t('ns:key')` και δυναμικά κλειδιά, και είναι
 *    **ratchet** με baseline. Ένα κλειδί μπορεί να υπάρχει στο locale και να
 *    **μην ταξιδεύει** στο slice.
 *  • **CHECK 3.36** ρωτά «έχει το ns loader;» — τρίτη πηγή.
 * Κανένα δεν ρωτά **«απαντά το αρχείο που ΣΤΕΛΝΕΤΑΙ σε αυτό εδώ το `t()`;»**.
 *
 * 🔑 ΤΟ ΚΡΙΤΗΡΙΟ ΕΙΝΑΙ **ΑΝΑ ΣΗΜΕΙΟ ΚΛΗΣΗΣ**, ΟΧΙ ΑΝΑ (ns, key) — ΜΕΤΡΗΜΕΝΟ
 * ----------------------------------------------------------------------------
 * Το `plan.addEntry` κάνει **fan-out** ενός implicit κλειδιού σε **κάθε**
 * namespace που δήλωσε το αρχείο, γιατί για το **χτίσιμο** του slice αυτό είναι
 * σωστό (κόβεις από όποιο το έχει, τα υπόλοιπα πέφτουν δωρεάν). Για **έλεγχο**
 * είναι καταστροφικό: μετρήθηκαν **27.466** ζεύγη «αναπάντητα» ενώ το i18next
 * δοκιμάζει τα ns **με σειρά** και αρκεί **ΕΝΑ** να απαντήσει.
 *
 * 🔴 ΚΑΙ ΓΙΑΤΙ ΟΙ ΡΙΖΕΣ ΕΙΝΑΙ ΤΑ LAYOUTS, ΟΧΙ ΟΙ ΣΕΛΙΔΕΣ — ΕΠΙΣΗΣ ΜΕΤΡΗΜΕΝΟ
 * ------------------------------------------------------------------------
 * Η προφανής επιθυμία είναι «κάθε διαδρομή ⊆ όσα απαντά ο server». Μετρήθηκε,
 * με τον χρησμό δίπλα, στο **ίδιο** δέντρο:
 *
 *     διαδρομή              στατικά    ζωντανά
 *     /                          0          0
 *     /settings                  0          0
 *     /spaces/parking        3.224          4     ⇒ 99,88% ψευδώς θετικά
 *
 * Η στατική κλειστότητα μιας **σελίδας** είναι υπερ-προσέγγιση: περιέχει
 * modals, tabs, lazy τμήματα που **δεν ζωγραφίζονται** στο πρώτο πέρασμα του
 * server. Η κλειστότητα των **layouts** δεν είναι: **ζωγραφίζεται πάντα**.
 * Άρα ο Κ2 απαντά με **βεβαιότητα** για το κομμάτι που είναι κοινό σε **141**
 * διαδρομές — ακριβώς εκεί που ζούσε η βλάβη των 17 κλειδιών — και τις σελίδες
 * τις αναλαμβάνει ο **χρησμός Χ**, που δεν μαντεύει.
 *
 * ⚠️ ΔΗΛΩΜΕΝΟ ΟΡΙΟ, με όνομα: ο per-route στατικός έλεγχος **απορρίφθηκε με
 * μέτρηση**, δεν παραλείφθηκε. Αν κάποιος τον ξαναπροτείνει, το νούμερο είναι
 * παραπάνω.
 * =============================================================================
 */

'use strict';

const path = require('node:path');

const P = require('../i18n-shell-slice/plan');
const SC = require('../i18n-shell-slice/shell-closure');
const KE = require('../i18n-shell-slice/key-extract');
const { policyFor } = require('../i18n-shell-slice/config');
const { loadNamespaceBundles, extractTCalls } = require('../i18n-namespace-extract');
const { answersKey, lookupKey } = require('../i18n/locale-keys');
const { assertClosedLedger } = require('./ledger');

/** Το `defaultNS` του `src/i18n/config.ts`. Ένα `t('x')` σε αρχείο χωρίς
 *  `useTranslation(...)` πέφτει εδώ — και το i18next το ίδιο. */
const DEFAULT_NS = 'common';

const K2_STATES = Object.freeze({
  UNANSWERABLE: 'unanswerable',
  UNRESOLVED_NO_POLICY: 'unresolved-no-policy',
  KEY_NOT_AT_CALL_SITE: 'key-not-at-call-site',
  NAMESPACE_INJECTED: 'namespace-injected',
  POLICY_UNFALSIFIABLE: 'policy-unfalsifiable',
  POLICY_COVERED: 'policy-covered',
  ANSWERABLE: 'answerable',
  EXCLUDED: 'excluded',
});

const K2_BLOCKING = Object.freeze([K2_STATES.UNANSWERABLE, K2_STATES.UNRESOLVED_NO_POLICY]);
const K2_DECLARED_GAPS = Object.freeze([
  K2_STATES.KEY_NOT_AT_CALL_SITE,
  K2_STATES.NAMESPACE_INJECTED,
  K2_STATES.POLICY_UNFALSIFIABLE,
  K2_STATES.POLICY_COVERED,
]);

/**
 * 🔑 ΒΑΣΙΜΟΤΗΤΑ ΑΠΟΔΟΣΗΣ NAMESPACE — ΤΟ ΚΡΙΤΗΡΙΟ ΠΟΥ ΚΑΝΕΙ ΤΟΝ Κ2 ZERO-TOL
 * ======================================================================
 * Ένα σημείο κλήσης κρίνεται **μόνο** αν ξέρουμε με **βεβαιότητα** σε ποια
 * namespaces θα ψάξει το i18next. Δύο μονοπάτια δίνουν βεβαιότητα:
 *   (α) το κλειδί φέρει **ρητό** ns  (`t('files:upload.ok')`), ή
 *   (β) το κλειδί είναι **κυριολεκτικό όρισμα του `t()` σε ΑΥΤΟ το αρχείο**
 *       ΚΑΙ το αρχείο δηλώνει το ίδιο τα ns του με `useTranslation(...)`.
 *
 * ⚠️ ΤΟ ΚΡΙΤΗΡΙΟ ΠΡΟΕΚΥΨΕ ΑΠΟ ΜΕΤΡΗΣΗ, ΣΕ ΤΡΙΑ ΒΗΜΑΤΑ — ΚΑΘΕ ΕΝΑ ΔΙΟΡΘΩΝΕΙ
 * ΕΝΑ ΨΕΥΔΩΣ ΘΕΤΙΚΟ ΠΟΥ ΕΙΧΕ ΗΔΗ ΠΑΡΑΧΘΕΙ:
 *
 *   ωμό «όλα τα σημεία κλήσης»            → **211** αναπάντητα
 *   − όσα το κλειδί τους δεν είναι όρισμα
 *     του `t()` εδώ (το `plan.resolveFileKeys`
 *     λύνει και τιμές **συγκομισμένες από
 *     ΑΛΛΑ modules** — ADR-744: «τα κλειδιά
 *     ενός generic renderer ζουν στο module
 *     που τον ΡΥΘΜΙΖΕΙ»)                  → **357** σε δηλωμένο κενό
 *   − όσα το αρχείο **δεν δηλώνει ns**
 *     (το `t` έρχεται ως **παράμετρος**, άρα
 *     τα ns είναι του **καλούντος** και το
 *     `defaultNS` είναι **μαντεψιά**)      → **30** σε δηλωμένο κενό
 *   ────────────────────────────────────────────────────────────────
 *   ⇒ **606 βάσιμα κρινόμενα, 0 αναπάντητα**
 *
 * 🔴 Ο ΧΡΗΣΜΟΣ ΕΠΙΒΕΒΑΙΩΣΕ ΚΑΘΕ ΒΗΜΑ. Τα `account.nav.*` «αναπάντητα στο
 * `navigation`» ζουν στο `common-photos`/`common-account` και το `/account`
 * μετρήθηκε **ζωντανά καθαρό**. Τα `photoPreview.*` του
 * `core/modals/photo-preview-helpers.ts` δείχνουν «αναπάντητα στο `common`»
 * μόνο επειδή εκείνο το αρχείο **δέχεται το `t` ως παράμετρο**. Και το `setup`
 * του `ModuleBreadcrumb.tsx` δεν είναι κλειδί — είναι **κλειδί χάρτη**, και η
 * μόνη κλήση εκεί είναι `t(config.labelKey)`.
 *
 * ⚠️ Ένα «δηλωμένο κενό» ΔΕΝ είναι «καθαρό»: είναι «δεν μπορώ να αποφανθώ
 * στατικά». Το αναλαμβάνει ο **ΧΡΗΣΜΟΣ Χ**, που δεν μαντεύει. Μετριούνται και
 * τυπώνονται ώστε να μη γίνουν σιωπηλή απώλεια κάλυψης.
 */

/**
 * Απαντά το slice αυτό το (υποψήφιο ns, κλειδί);
 *
 * 🔴 ΠΡΟΣΟΧΗ — ΕΔΩ ΓΡΑΦΤΗΚΕ ΤΟ ΙΔΙΟ ΕΛΑΤΤΩΜΑ ΠΟΥ Η ΠΥΛΗ ΚΥΝΗΓΑ, ΚΑΙ ΤΟ ΕΠΙΑΣΕ
 * ΤΟ TEST Μ8.
 * Η πρώτη γραφή έλεγε: «είναι `whole` το namespace; ⇒ **απαντά οτιδήποτε**,
 * χωρίς lookup». Ακούγεται σωστό — «ταξιδεύει ολόκληρο» — και είναι **λάθος**:
 * «ολόκληρο» σημαίνει ότι το slice περιέχει **όλο το locale namespace**, όχι
 * ότι υπάρχει κάθε συλλαβή που μπορεί να γράψει κάποιος. Ένα κλειδί που
 * **λείπει από το locale** λείπει και από το slice, και βάφεται ωμό.
 *
 * ⚠️ Το ελάττωμα ήταν **ακριβώς το σχήμα** του `if (want.whole) continue` στο
 * `shell-slice-no-raw-keys.test.ts` — το `continue` που έκανε την «απόδειξη
 * χρόνου εκτέλεσης» τυφλή στα **9** namespaces όπου ζούσε το `navigation`, και
 * που είναι ο λόγος που η βλάβη των 17 κλειδιών επέζησε μήνες με όλες τις
 * πύλες πράσινες. Το ίδιο σφάλμα, ξαναγραμμένο **μέσα στην πύλη που το κυνηγά**.
 *
 * Η θεραπεία είναι να ΜΗΝ υπάρχει ειδική περίπτωση: κοίταξε στο slice.
 * Αν το ns ταξιδεύει ολόκληρο, το lookup **ήδη** το βρίσκει.
 */
function sliceAnswers(slice, namespace, key) {
  const bundle = slice[namespace];
  if (bundle === undefined) return false;
  return answersKey(bundle, key);
}

/** Ένα prefix απαντιέται αν υπάρχει το υποδέντρο του — ίδιος κανόνας, καμία εξαίρεση. */
function sliceAnswersPrefix(slice, namespace, prefix) {
  const bundle = slice[namespace];
  if (bundle === undefined) return false;
  return lookupKey(bundle, prefix) !== undefined;
}

/**
 * Οι υποψήφιοι namespaces ενός σημείου κλήσης — **η σειρά του i18next**.
 * `t('ns:key')` ⇒ ακριβώς ένας. `t('key')` ⇒ όσοι δήλωσε το αρχείο.
 * Κανένας ⇒ `defaultNS`.
 */
function candidatesFor(entryNamespace, declaredNamespaces) {
  if (entryNamespace !== null && entryNamespace !== undefined) return [entryNamespace];
  return declaredNamespaces.length > 0 ? declaredNamespaces : [DEFAULT_NS];
}

/**
 * Η μέτρηση.
 *
 * @param {object} options
 * @param {string} options.projectRoot           απόλυτο posix
 * @param {object} options.config                από `loadConfig`
 * @param {object} options.slice                 το ΑΠΟΣΤΕΛΛΟΜΕΝΟ `shell-slice.<lang>.json`
 * @param {string[]} [options.closureFiles]      αν δοθεί, ΔΕΝ χτίζεται γράφος (Layer 1)
 * @param {object} [options.graph]               αν δοθεί, χτίζεται η κλειστότητα (Layer 2)
 * @returns {{records: Array, files: number, callSites: number}}
 */
function measureAnswerability(options) {
  const { projectRoot, config, slice } = options;

  let closureFiles = options.closureFiles;
  if (!closureFiles) {
    if (!options.graph) throw new Error('CHECK 3.51 Κ2: χρειάζεται είτε closureFiles είτε graph');
    // Ρίζες = ΜΟΝΟ τα layouts. Βλ. κεφαλίδα: αυτό είναι το κομμάτι που
    // ζωγραφίζεται σε κάθε διαδρομή, και μόνο γι' αυτό η στατική ανάλυση
    // απαντά χωρίς υπερ-προσέγγιση.
    const layoutConfig = { ...config, shellRoots: ['src/app/**/layout.tsx'], extraShellRoots: [] };
    const roots = P.resolveRoots(projectRoot, layoutConfig, options.graph);
    closureFiles = SC.computeShellClosure(options.graph, roots).files;
  }

  const context = {
    bundles: loadNamespaceBundles(projectRoot),
    keyConstants: KE.loadKeyConstants(projectRoot, config.keyConstants),
    excludeConsumers: config.excludeConsumers,
  };
  const graphForSurfaces = options.graph || { modules: new Map(), projectRoot };
  const surfaces = P.collectSurfaces(projectRoot, { files: closureFiles }, graphForSurfaces, context);

  const records = [];
  const usedPolicy = new Set();
  let callSites = 0;

  for (const [relFile, surface] of surfaces) {
    if (surface.excluded) {
      records.push({ state: K2_STATES.EXCLUDED, file: relFile });
      continue;
    }
    const resolved = P.resolveFileKeys(surface, context);
    const policy = policyFor(config, relFile);

    // Τα κλειδιά που είναι **κυριολεκτικά ορίσματα του `t()` σε αυτό το αρχείο**.
    // Ό,τι λύθηκε από τη συγκομιδή άλλων modules ΔΕΝ είναι εδώ — και αυτή
    // ακριβώς είναι η διαφορά ανάμεσα σε «ξέρω» και «υποθέτω».
    const atCallSite = new Set(extractTCalls(surface.source).map((call) => call.key));

    const judge = (entry, key, answers) => {
      callSites += 1;
      const explicit = entry.ns !== null && entry.ns !== undefined;
      if (!explicit && !atCallSite.has(key)) {
        records.push({ state: K2_STATES.KEY_NOT_AT_CALL_SITE, file: relFile, key });
        return;
      }
      if (!explicit && surface.namespaces.length === 0) {
        records.push({ state: K2_STATES.NAMESPACE_INJECTED, file: relFile, key });
        return;
      }
      const candidates = explicit ? [entry.ns] : surface.namespaces;
      records.push({
        state: candidates.some((namespace) => answers(namespace)) ? K2_STATES.ANSWERABLE : K2_STATES.UNANSWERABLE,
        file: relFile,
        key,
        candidates,
      });
    };

    for (const entry of resolved.keys) {
      judge(entry, entry.key, (namespace) => sliceAnswers(slice, namespace, entry.key));
    }
    for (const entry of resolved.prefixes) {
      judge(entry, `${entry.prefix}*`, (namespace) => sliceAnswersPrefix(slice, namespace, entry.prefix));
    }

    for (const unresolved of resolved.unresolved) {
      if (policy) {
        usedPolicy.add(relFile);
        records.push({ state: K2_STATES.POLICY_COVERED, file: relFile, line: unresolved.line, snippet: unresolved.snippet });
      } else {
        records.push({ state: K2_STATES.UNRESOLVED_NO_POLICY, file: relFile, line: unresolved.line, snippet: unresolved.snippet });
      }
    }
  }

  // 🔶 `policy-unfalsifiable` — εγγραφή `dynamicKeyPolicy` της οποίας το αρχείο
  // **ανήκει στο shell** αλλά δεν έχει πια καμία ανεπίλυτη κλήση: η δήλωση
  // επιβιώνει χωρίς τίποτα να την εκτελεί. Ακριβώς έτσι έζησε η ψευδής
  // παραδοχή του ADR-744 — **κανένας μηχανισμός δεν εκτελεί ένα `reason`**.
  const inClosure = new Set(closureFiles);
  for (const file of Object.keys(config.dynamicKeyPolicy)) {
    if (!inClosure.has(file)) continue;
    if (usedPolicy.has(file)) continue;
    records.push({ state: K2_STATES.POLICY_UNFALSIFIABLE, file });
  }

  return { records, files: surfaces.size, callSites };
}

/** Κλειστή λογιστική — ΜΙΑ υλοποίηση για τους τρεις κανόνες (βλ. `ledger.js`). */
function assertClosedK2(records) {
  return assertClosedLedger('Κ2', K2_STATES, records, (record) => record.file);
}

module.exports = {
  DEFAULT_NS,
  K2_STATES,
  K2_BLOCKING,
  K2_DECLARED_GAPS,
  candidatesFor,
  sliceAnswers,
  sliceAnswersPrefix,
  measureAnswerability,
  assertClosedK2,
};
