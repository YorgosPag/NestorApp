#!/usr/bin/env node
/**
 * =============================================================================
 * Κ1 — ΕΤΟΙΜΟΤΗΤΑ ΠΟΥ Ο SERVER ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΦΤΑΣΕΙ  (CHECK 3.51 / ADR-781 §4)
 * =============================================================================
 *
 * ΤΟ ΕΡΩΤΗΜΑ, ΜΕ ΜΙΑ ΠΡΟΤΑΣΗ:
 *   «παραδίδει ένα module το `t` **μαζί** με σημαία ετοιμότητας που γράφεται
 *    ΜΟΝΟ μέσα σε effect;»
 *
 * Αν ναι, τότε **στον server η σημαία είναι για πάντα ο σπόρος** — γιατί το
 * `useEffect`/`useLayoutEffect` **δεν εκτελείται ποτέ σε SSR**. Κάθε
 * καταναλωτής που την εμπιστεύεται παίρνει «δεν είμαι έτοιμος» σε κάθε αίτημα,
 * για πάντα, και ζωγραφίζει ό,τι έχει προβλέψει για αυτή την περίπτωση —
 * που στην πράξη ήταν **το ίδιο το κλειδί**.
 *
 * 🔴 ΓΙΑΤΙ ΤΟ ΚΡΙΤΗΡΙΟ ΕΙΝΑΙ «Η ΕΠΙΦΑΝΕΙΑ ΠΟΥ ΠΑΡΑΔΙΔΕΙ `t`» ΚΑΙ ΟΧΙ ΤΟ ΣΧΗΜΑ
 * ΤΟΥ STATE — ΤΟ ΑΠΟΦΑΣΙΣΕ Η ΜΕΤΡΗΣΗ, ΟΧΙ ΤΟ ΓΟΥΣΤΟ
 * ----------------------------------------------------------------------------
 * Η πρώτη γραφή αυτού του αρχείου ρωτούσε το προφανές: «διαβάζεται στο render
 * κατάσταση που γράφεται μόνο σε effect, σε αρχείο που κρατάει `t`;». Το
 * κριτήριο **μετρήθηκε πριν επιλεγεί πολιτική**, σε **11.515** αρχεία:
 * **81 ευρήματα** — `error`, `isMac`, `debouncedQuery`, `avatarKey`,
 * `unreadCount`, `selectedRoleId`. Καθημερινό state από fetch/DOM, που στον
 * server απλώς **δεν ζωγραφίζει τίποτα**. Αυτό είναι **σωστή** συμπεριφορά, όχι
 * ωμό κλειδί ⇒ **>95% ψευδώς θετικά**, απόλυτα έξω από τον πήχη **<10%** της
 * Google για **μπλοκάρουσα** πύλη. Ένας κανόνας με 95% θόρυβο δεν διαβάζεται·
 * και ένας που δεν διαβάζεται παρακάμπτεται με `SKIP_`.
 *
 * Το διακριτικό δεν είναι ΠΩΣ κρατιέται η τιμή, αλλά **ΣΕ ΠΟΙΟΝ δίνεται**: ο
 * `useTranslationLazy` έδινε `t` **και** `ready`/`isLoading` στο **ίδιο**
 * επιστρεφόμενο αντικείμενο. Αυτό είναι **συμβόλαιο**: «να το εργαλείο
 * μετάφρασης, και να η αλήθεια για το αν δουλεύει». Όταν η δεύτερη μισή
 * πρόταση είναι αναληθής στον server, **κάθε** καταναλωτής παραπλανάται —
 * ήταν **24**.
 *
 * Η ΜΕΤΡΗΜΕΝΗ ΒΛΑΒΗ (ADR-744 §12 — αυτό ΔΕΝ είναι υποθετικό)
 * ----------------------------------------------------------
 * Ο `useTranslationLazy` (διαγράφηκε στο `a21b5352`) έγραφε:
 *
 *     const [isNamespaceLoaded, setIsNamespaceLoaded] = useState(false);
 *     useEffect(() => { ... setIsNamespaceLoaded(true); ... }, [...]);
 *     return { t, isLoading: !isNamespaceLoaded, ... };
 *
 * ⇒ στον server `isLoading === true` **πάντα** ⇒ ο καταναλωτής
 * (`sidebar-menu-item.tsx: if (isLoading) return title;`) έβαφε **ωμό κλειδί**
 * σε **17 θέσεις × 141 διαδρομές**, μόνιμα, και στην παραγωγή.
 *
 * 🔴 Η ΜΕΤΑΦΡΑΣΗ ΗΤΑΝ ΗΔΗ ΕΚΕΙ. Το `navigation.pages.home` υπήρχε στο slice με
 * τιμή «Αρχική». Δεν έλειπαν δεδομένα — **το component τα αρνιόταν**. Γι' αυτό
 * καμία από τις πύλες δεδομένων (3.8 · 3.13 · 3.33 · 3.34 · 3.36) δεν μπορούσε
 * να το δει: όλες ρωτούν «υπάρχει το κλειδί;» και η απάντηση ήταν **ναι**.
 *
 * ΓΙΑΤΙ ΟΧΙ «ΦΡΟΥΡΟΣ ΠΟΥ ΚΑΝΕΙ return» — Η ΑΙΤΙΑ ΕΙΝΑΙ ΣΕ ΕΝΑ ΑΡΧΕΙΟ, ΤΟ
 * ΣΥΜΠΤΩΜΑ ΣΕ ΕΙΚΟΣΙ ΤΕΣΣΕΡΑ
 * ---------------------------------------------------------------------------
 * Ο πειρασμός είναι να ψάξεις για `if (isLoading) return <κάτι>`. Θα ήταν
 * **λάθος και μετρήσιμα ανεπαρκές**: στην πραγματική βλάβη **δεν υπήρχε τέτοιος
 * φρουρός σε αυτό το αρχείο**. Η κατάσταση **δραπέτευε** μέσα από το
 * επιστρεφόμενο αντικείμενο και ο φρουρός ζούσε σε **άλλα 24**. Ένας κανόνας
 * που κοιτάζει τον φρουρό κυνηγά **συμπτώματα**· αυτός εδώ πιάνει την **αιτία**.
 *
 * ΓΙΑΤΙ ΔΕΝ ΤΟ ΠΙΑΝΕΙ ΤΟ `react-hooks` ΟΥΤΕ Ο ΜΕΤΑΓΛΩΤΤΙΣΤΗΣ
 * ----------------------------------------------------------
 * Ο κώδικας είναι **απολύτως έγκυρος** React και TypeScript. Το
 * `exhaustive-deps` ελέγχει *εξαρτήσεις*, όχι *εκτελεσιμότητα σε SSR*. Το
 * `react-hooks/rules-of-hooks` ελέγχει *σειρά κλήσης*. Κανένα εργαλείο των
 * μεγάλων δεν έχει την έννοια «αυτή η τιμή είναι αναληθής στον server» — γιατί
 * κανένα δεν ξέρει ότι η τιμή είναι **ετοιμότητα μετάφρασης**. Εμείς το ξέρουμε
 * (το module κρατάει `t`), και γι' αυτό μπορούμε να ρωτήσουμε.
 *
 * ⚠️ Η ΔΙΑΚΡΙΣΗ ΠΟΥ ΚΑΝΕΙ ΤΗΝ ΠΥΛΗ ΕΦΙΚΤΗ ΩΣ ZERO-TOL
 * ----------------------------------------------------
 * Ο σημερινός `src/i18n/hooks/useTranslation.ts` γράφει:
 *
 *     const [namespaceLoaded, setNamespaceLoaded] = useState(() => { ...υπολογισμός... });
 *
 * Ο **αρχικοποιητής-συνάρτηση** εκτελείται **σύγχρονα, και στον server**. Αυτή
 * είναι η θεραπεία, όχι το «βάλε λιγότερα effects». Ο ταξινομητής ΠΡΕΠΕΙ να
 * ξεχωρίζει τα δύο, αλλιώς είναι μονίμως κόκκινος πάνω στη **σωστή** λύση.
 * ⚠️ `useState(() => false)` = **σταθερά με καπέλο** ⇒ κρίνεται ως σταθερά.
 *
 * ΔΗΛΩΜΕΝΑ ΟΡΙΑ (μετρημένα, όχι υποθετικά)
 * -----------------------------------------
 *  • Ένας φρουρός που διαβάζει **prop** ή **context** αντί για τοπικό `useState`
 *    δεν είναι ορατός εδώ. Καλύπτεται από τον **χρησμό Χ**, που είναι η αυθεντία.
 *  • Δεν κρίνεται module που **δεν** κρατάει `t`: μια ετοιμότητα που δεν αφορά
 *    μετάφραση δεν έχει ωμό κλειδί να βάψει.
 * =============================================================================
 */

'use strict';

const ts = require('typescript');
const { assertClosedLedger } = require('./ledger');
// Το «πώς διαβάζεται ο κώδικας» ζει χωριστά από το «τι σημαίνει» (N.7.1).
const {
  holdsTranslator,
  classifySeed,
  collectModuleLiterals,
  collectStateDeclarations,
  analyseWrites,
  collectTranslatorSurfaces,
  findExemption,
} = require('./readiness-nodes');

/**
 * ΟΙ ΚΑΤΑΣΤΑΣΕΙΣ — κλειστό σύνολο. Η σειρά **είναι** η προτεραιότητα
 * ταξινόμησης ενός αρχείου (χειρότερη πρώτη).
 */
const K1_STATES = Object.freeze({
  UNPARSABLE: 'unparsable',
  EFFECT_ONLY: 'translator-readiness-effect-only',
  SEED_UNANALYZABLE: 'translator-readiness-unanalyzable',
  SYNCHRONOUS: 'translator-readiness-synchronous',
  EAGER: 'translator-readiness-eager',
  UNRELATED: 'translator-flag-not-i18n',
  NO_READINESS: 'translator-without-readiness',
  NOT_A_SURFACE: 'not-a-translator-surface',
});

/** ⛔ μπλοκάρουν πάντα, δεν μπαίνουν ΠΟΤΕ σε baseline. */
const K1_BLOCKING = Object.freeze([K1_STATES.UNPARSABLE, K1_STATES.EFFECT_ONLY]);
/** 🔶 δηλωμένο κενό — μετριέται, δεν μπλοκάρει (πρότυπο CHECK 3.48). */
const K1_DECLARED_GAPS = Object.freeze([K1_STATES.SEED_UNANALYZABLE]);

// ---------------------------------------------------------------------------
// Δημόσιο API
// ---------------------------------------------------------------------------

/**
 * Ταξινομεί ΕΝΑ αρχείο. Επιστρέφει **ακριβώς μία** κατάσταση, συν τα ευρήματα.
 *
 * @param {string} relFile  διαδρομή σχετική με τη ρίζα (μόνο για μηνύματα)
 * @param {string} content  ο πηγαίος κώδικας
 * @returns {{file: string, state: string, findings: Array<{variable: string, setter: string, line: number, exempt: string|null}>}}
 */
function classifyFile(relFile, content) {
  let source;
  try {
    source = ts.createSourceFile(relFile, content, ts.ScriptTarget.Latest, /* setParentNodes */ true, ts.ScriptKind.TSX);
  } catch (error) {
    return { file: relFile, state: K1_STATES.UNPARSABLE, findings: [], detail: error.message };
  }
  if (!source || source.statements === undefined) {
    return { file: relFile, state: K1_STATES.UNPARSABLE, findings: [], detail: 'no statements' };
  }

  // ΒΗΜΑ 1 — παραδίδει αυτό το module το `t` μέσα από επιστρεφόμενο αντικείμενο;
  const surfaces = collectTranslatorSurfaces(source);
  if (surfaces.length === 0) return { file: relFile, state: K1_STATES.NOT_A_SURFACE, findings: [] };

  // ΒΗΜΑ 2 — ποιες από τις συνοδευτικές ιδιότητες συντίθενται από `useState`;
  const moduleLiterals = collectModuleLiterals(source);
  const declarations = collectStateDeclarations(source, moduleLiterals);
  if (declarations.length === 0) return { file: relFile, state: K1_STATES.NO_READINESS, findings: [] };

  const byValue = new Map(declarations.map((declaration) => [declaration.value, declaration]));
  const writes = analyseWrites(source, declarations.map((declaration) => declaration.setter));
  const lines = content.split(/\r?\n/);

  const claims = [];
  for (const surface of surfaces) {
    for (const name of surface.names) {
      const declaration = byValue.get(name);
      if (!declaration) continue;
      const setterStats = writes.get(declaration.setter);

      // ⚠️ Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ. Ο σύγχρονος σπόρος κρίνεται ΠΡΩΤΟΣ (είναι η
      // θεραπεία και δεν χρειάζεται άλλη ερώτηση)· το «δεν αφορά i18n» κρίνεται
      // ΤΕΛΕΥΤΑΙΟ πριν τη βλάβη, ώστε να μη σβήνει πραγματικό εύρημα.
      let state;
      if (declaration.seed === 'synchronous') state = K1_STATES.SYNCHRONOUS;
      else if (declaration.seed === 'unanalyzable') state = K1_STATES.SEED_UNANALYZABLE;
      else if (setterStats.writes > setterStats.writesInEffect) state = K1_STATES.EAGER;
      else if (setterStats.writesInEffect === 0) state = K1_STATES.SYNCHRONOUS; // ποτέ γραμμένο ⇒ ο σπόρος ΕΙΝΑΙ η απάντηση, και ο server τη βλέπει
      else if (setterStats.writesInI18nEffect === 0) state = K1_STATES.UNRELATED;
      else state = K1_STATES.EFFECT_ONLY;

      claims.push({
        property: surface.property,
        value: declaration.value,
        setter: declaration.setter,
        seed: declaration.seed,
        line: surface.line,
        declaredAt: declaration.line,
        state,
        exempt: findExemption(lines, surface.line) || findExemption(lines, declaration.line),
      });
    }
  }

  if (claims.length === 0) return { file: relFile, state: K1_STATES.NO_READINESS, findings: [], claims };

  // Η χειρότερη κατάσταση κερδίζει — η σειρά του K1_STATES ΕΙΝΑΙ η προτεραιότητα.
  const order = Object.values(K1_STATES);
  let worst = K1_STATES.NO_READINESS;
  for (const claim of claims) {
    const effective = claim.exempt && claim.state === K1_STATES.EFFECT_ONLY ? K1_STATES.EAGER : claim.state;
    if (order.indexOf(effective) < order.indexOf(worst)) worst = effective;
  }

  return {
    file: relFile,
    state: worst,
    findings: claims.filter((claim) => claim.state === K1_STATES.EFFECT_ONLY && !claim.exempt),
    claims,
  };
}

/** Κλειστή λογιστική — ΜΙΑ υλοποίηση για τους τρεις κανόνες (βλ. `ledger.js`). */
function assertClosedK1(results) {
  return assertClosedLedger('Κ1', K1_STATES, results, (result) => result.file);
}

module.exports = {
  K1_STATES,
  K1_BLOCKING,
  K1_DECLARED_GAPS,
  classifyFile,
  assertClosedK1,
  // εκτεθειμένα για τα tests — ο ταξινομητής σπόρου είναι ΤΟ κριτήριο
  classifySeed,
  holdsTranslator,
};
