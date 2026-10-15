#!/usr/bin/env node
/**
 * ADR-744 §18 — το namespace ενός αρχείου που δεν δηλώνει κανένα.
 *
 * Βγήκε από το `plan.js` (N.7.1) αυτούσιο· το `plan.js` κάνει re-export για τους καταναλωτές του.
 */

'use strict';

const path = require('node:path');

const MG = require('../module-graph');

/* =============================================================================
 * ADR-744 §18 — ΤΟ NAMESPACE ΕΝΟΣ ΑΡΧΕΙΟΥ ΠΟΥ ΔΕΝ ΔΗΛΩΝΕΙ ΚΑΝΕΝΑ
 * =============================================================================
 *
 * 🔴 Η ΤΡΥΠΑ ΗΤΑΝ ΜΙΑ ΓΡΑΜΜΗ, ΚΑΙ ΗΤΑΝ FAIL-OPEN. Το `addEntry` (plan.js) αποδίδει ένα
 * κλειδί χωρίς ρητό namespace στα namespaces **που δηλώνει το αρχείο**:
 * `targets = entry.ns !== null ? [entry.ns] : namespaces`. Όταν το αρχείο δηλώνει
 * **κανένα**, το `targets` είναι `[]` — ο βρόχος δεν τρέχει, και το κλειδί
 * **εξαφανίζεται ΣΙΩΠΗΛΑ**. Ο generator ΑΡΝΕΙΤΑΙ στο «δεν ξέρω το ΚΛΕΙΔΙ»
 * (`violations`) και **σιωπούσε** στο «ξέρω το κλειδί, δεν ξέρω το NAMESPACE» —
 * δύο ονόματα για την ίδια καταστροφή: κλειδί που λείπει από το slice και βάφεται
 * ωμό στην οθόνη.
 *
 * ⚠️ Η ΒΛΑΒΗ ΗΤΑΝ ΗΔΗ ΓΡΑΜΜΕΝΗ, ΓΙΑ ΤΗΝ ΑΛΛΗ ΤΗΣ ΕΙΣΟΔΟ. Το
 * `scripts/lib/i18n-namespace-extract.js:16-18` λέει ΚΑΤΑ ΛΕΞΗ ότι ένα
 * `useTranslation([...])` μετακομισμένο σε κοινή σταθερά «would make these checks
 * see ZERO namespaces for the file and **silently skip it**». Έκλεισε **εκείνη** την
 * είσοδο (ανάλυση bundle identifier) και άφησε ανοιχτή αυτήν: αρχείο που **δανείζεται**
 * το `t` — από hook που εισάγει, ή ως **prop/παράμετρο** από τους καλούντες του.
 *
 * 🔑 ΜΕΤΡΗΜΕΝΟ 2026-08-22, πριν γραφτεί η θεραπεία, σε **16** κλειστότητες
 * (κέλυφος + 15 διαδρομές): **3 αρχεία / 98 σιωπηλά χαμένα κλειδιά**, μηδέν ψευδώς
 * θετικά. Τα 42 ήταν του `/login` (`AuthForm.tsx` + `MfaVerificationForm.tsx`) και
 * εξηγούν **13 από τα 16** ωμά κλειδιά που μέτρησε ζωντανά ο χρησμός (CHECK 3.51 Χ).
 * Τα υπόλοιπα 30 ζουν στο **ΚΕΛΥΦΟΣ** (`photo-preview-helpers.ts`), άρα έλειπαν από
 * **κάθε** διαδρομή.
 *
 * ## ΔΥΟ ΚΑΤΕΥΘΥΝΣΕΙΣ ΡΟΗΣ, ΚΑΙ ΤΟ ΜΕΤΡΗΣΑΜΕ — ΓΙ᾽ ΑΥΤΟ Η ΑΚΜΗ ΕΙΝΑΙ ΑΝΕΥΘΥΝΤΗ
 *
 * Το `t` ταξιδεύει και προς τις **δύο** φορές πάνω στην ακμή εισαγωγής:
 *   · `AuthForm` → **εισάγει** το `useAuthFormState`, που δηλώνει `auth`·
 *   · `photo-preview-helpers` → το `t` του είναι **παράμετρος**, άρα το namespace
 *     ζει στους **εισαγωγείς** του (`PhotoPreviewModal`, που δηλώνει `common-photos`).
 * Ένας κανόνας που κοιτούσε μόνο «τι εισάγω» θα διόρθωνε το πρώτο και θα άφηνε το
 * δεύτερο — δηλαδή θα ήταν πράσινος πάνω στο μισό ελάττωμα.
 *
 * ## ΓΙΑΤΙ ΠΑΡΑΓΩΓΗ ΚΑΙ ΟΧΙ ΔΗΛΩΣΗ
 *
 * Μια χειρόγραφη δήλωση (σχόλιο-οδηγία, ή χάρτης στο αρχείο ρύθμισης) θα ήταν
 * **ισχυρισμός** — και σε αυτό το repo οι χειρόγραφες λίστες namespace έχουν ήδη
 * αποκλίνει **κατά 63** (CHECK 3.34). Εδώ η απάντηση **παράγεται** από τον ίδιο γράφο
 * module που παράγει και την κλειστότητα.
 *
 * ⚠️ **ΕΝΑ ΑΛΜΑ, ΠΟΤΕ ΣΤΑΘΕΡΟ ΣΗΜΕΙΟ.** Κληρονομεί μόνο από γείτονες που **ΔΗΛΩΝΟΥΝ**.
 * Αλυσίδα δύο αδήλωτων αρχείων ⇒ **άρνηση**, όχι μαντεψιά που κλιμακώνεται: το
 * μεταβατικό κλείσιμο θα έδινε σε ένα κοινό util τα namespaces δεκάδων component.
 *
 * ⚠️ **Η ΥΠΕΡ-ΑΠΟΔΟΣΗ ΕΙΝΑΙ ΔΩΡΕΑΝ, ΚΑΙ ΕΙΝΑΙ ΗΔΗ ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΟΥ `addEntry` (plan.js)**:
 * ένα κλειδί μπαίνει σε **κάθε** namespace που δηλώνει το αρχείο, και το
 * `pruneNamespace` πετά όσα δεν ορίζονται εκεί. Άρα η κληρονομιά ενός υπερσυνόλου δεν
 * μπορεί να βάλει **λάθος** συμβολοσειρά — μόνο να μη βρει τίποτα.
 *
 * ⚠️ **ΜΗΝ το κάνεις σιωπηλό fallback.** Η κληρονομιά υπάρχει για να είναι η **άρνηση**
 * ικανοποιήσιμη χωρίς χειρόγραφη λίστα — δεν την αντικαθιστά. Ό,τι δεν παράγεται,
 * ΜΠΛΟΚΑΡΕΙ.
 */
function inheritNamespaces(projectRoot, surfaces, graph) {
  const declared = new Map();
  for (const [relFile, surface] of surfaces) {
    declared.set(relFile, surface.excluded ? [] : surface.namespaces);
  }

  const resolve = MG.createResolver(graph);
  const neighbours = new Map();
  const link = (a, b) => {
    if (!neighbours.has(a)) neighbours.set(a, new Set());
    neighbours.get(a).add(b);
  };

  for (const relFile of surfaces.keys()) {
    const mod = graph.modules.get(MG.toPosix(path.join(projectRoot, relFile)));
    if (!mod) continue;
    for (const imp of mod.imports) {
      const target = resolve(imp.spec, mod.file);
      if (target.kind !== 'internal') continue;
      const rel = MG.toPosix(path.relative(projectRoot, target.file));
      if (!declared.has(rel)) continue;
      // ΚΑΙ ΟΙ ΔΥΟ ΦΟΡΕΣ: το `t` ταξιδεύει προς τα κάτω (hook που εισάγω) και προς
      // τα πάνω (παράμετρος/prop που μου δίνει ο εισαγωγέας μου).
      link(relFile, rel);
      link(rel, relFile);
    }
  }

  const inherited = new Map();
  for (const [relFile, own] of declared) {
    if (own.length > 0) continue;
    const union = new Set();
    for (const other of neighbours.get(relFile) || []) {
      for (const ns of declared.get(other) || []) union.add(ns);
    }
    inherited.set(relFile, [...union].sort());
  }
  return inherited;
}

/** Τα namespaces που ΟΝΤΩΣ θα χρησιμοποιηθούν για την απόδοση των κλειδιών ενός αρχείου. */
function effectiveNamespaces(relFile, surface, inherited) {
  return surface.namespaces.length > 0 ? surface.namespaces : (inherited.get(relFile) || []);
}

/** Υπάρχει έστω ένα κλειδί που ΧΡΕΙΑΖΕΤΑΙ τα namespaces του αρχείου για να προσγειωθεί; */
function needsFileNamespaces(resolved) {
  return resolved.keys.some(entry => entry.ns === null)
    || resolved.prefixes.some(entry => entry.ns === null);
}

module.exports = {
  inheritNamespaces,
  effectiveNamespaces,
  needsFileNamespaces,
};
