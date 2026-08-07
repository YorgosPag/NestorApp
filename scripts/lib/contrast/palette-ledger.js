/**
 * Η ΛΟΓΙΣΤΙΚΗ του παλέτου χρωμάτων — **ποιος κρίθηκε, ποιος όχι, και γιατί**.
 *
 * 🔑 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΑ ΑΠΟ ΤΟ `theme-pairing.js`: εκείνο απαντά «**είναι σπασμένο;**»·
 * αυτό απαντά «**το ρώτησε κανείς;**». Δύο ερωτήσεις, δύο ευθύνες — και η δεύτερη είναι
 * που κρατά το «0 παραβιάσεις» από το να σημαίνει «δεν κοίταξα», το σχήμα που έχει
 * εμφανιστεί **έξι** φορές σε αυτό το αποθετήριο.
 *
 * ⚠️ ΤΑ ΚΑΤΗΓΟΡΗΜΑΤΑ ΕΙΝΑΙ ΤΑ ΙΔΙΑ ΠΟΥ ΑΠΟΦΑΣΙΖΟΥΝ ΤΗΝ ΚΡΙΣΗ (`SEMANTIC_ROLES`, `form`,
 * `alpha < 1`) και έρχονται από τον **ταξινομητή ρόλων**, όχι από αντίγραφο εδώ. Μια
 * λογιστική που αποκλίνει από την κρίση **επικυρώνει τον εαυτό της** — που είναι
 * χειρότερο από το να μην υπάρχει.
 *
 * @module scripts/lib/contrast/palette-ledger
 */

'use strict';

const { SEMANTIC_ROLES } = require('./ts-token-palette');

/**
 * ΑΠΟΓΡΑΦΗ ΑΝΑ ΜΟΡΦΗ — **κάθε** δήλωση, χωρισμένη σε `μορφή/ρόλος`.
 *
 * Καταγράφεται ώστε το «0 παραβιάσεις» να μη σημαίνει ποτέ «δεν κοίταξα», και δείχνει
 * ρητά την Κατηγορία Δ: ένα σκαλί παλέτας (`colors.blue.500`) δεν ισχυρίζεται ρόλο —
 * δεν είναι ούτε κείμενο ούτε φόντο μέχρι κάποιος να το βάλει κάπου, οπότε το να το
 * χαρακτηρίσουμε σπασμένο θα ήταν ψευδώς θετικό.
 *
 * ⚠️ ΛΕΓΟΤΑΝ `summarizeOutOfScope` ΜΕΧΡΙ ΤΙΣ 2026-08-08, ΚΑΙ ΤΟ ΟΝΟΜΑ ΕΛΕΓΕ ΨΕΜΑΤΑ:
 * περιέχει `literal-hex/border: 21` — καταχωρήσεις που **κρίνονται όλες**. Το ψέμα δεν
 * έμεινε ακίνδυνο· η άγκυρα `Κ5` το επικαλούνταν ως **απόδειξη** ότι το `rgb-literal`
 * δεν κρίνεται (`outOfScope['rgb-literal'] === 1`), κάτι που ίσχυε κατά σύμπτωση. Η
 * αυθεντία για το «ποιος κρίθηκε» είναι το `auditPalette`, **όχι** αυτή η απογραφή.
 */
function censusByForm(palette) {
  const counts = {};
  for (const e of palette.entries) {
    const key = ROLE_SPLIT_FORMS.includes(e.form) ? `${e.form}/${e.role}` : e.form;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

/**
 * Οι μορφές όπου ο **ρόλος** καθορίζει αν η δήλωση κρίνεται — άρα η απογραφή πρέπει να
 * τις σπάει ανά ρόλο, αλλιώς ένα `rgb-literal: 11` δεν λέει αν κρίθηκαν 11 ή 0.
 *
 * ⚠️ Το `hsl-literal` **δεν** είναι εδώ και είναι σκόπιμο: το `parseComputedColor`
 * διαβάζει `rgb()`/`rgba()`, όχι `hsl()`. Σήμερα υπάρχουν **0** — και ακριβώς γι' αυτό
 * γράφεται ρητά ως όριο: ένα «0» που δεν δηλώνεται γίνεται «δεν υπάρχουν τέτοια».
 */
const ROLE_SPLIT_FORMS = ['literal-hex', 'rgb-literal'];

/**
 * Η ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ: **κάθε** δήλωση του παλέτου μπαίνει σε ακριβώς **έναν** κάδο.
 *
 * 🔑 ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΗΝ ΠΥΛΗ: οι κάδοι είναι τα **ίδια κατηγορήματα** που αποφασίζουν
 * ποιος κρίνεται (`SEMANTIC_ROLES`, `form`, `alpha < 1`). Γραμμένοι δεύτερη φορά στην
 * πύλη, θα συμφωνούσαν σήμερα και θα απέκλιναν την πρώτη φορά που αλλάξει μια κατηγορία —
 * και μια λογιστική που αποκλίνει από την κρίση **επικυρώνει τον εαυτό της**.
 *
 * ⚠️ Ο έλεγχος ρωτά «**ΠΟΙΟΣ** κρίθηκε», όχι «κλείνει το άθροισμα»: το `judgedIds`
 * επιστρέφεται ονομαστικά. Το CHECK 3.42 έπιασε έτσι διπλομέτρηση (1533/1532) **πριν**
 * γραφτεί baseline· το Στρώμα 2β έπιασε έτσι 9 ημιδιαφανείς που δεν κρίνονταν ενώ το
 * άθροισμα έκλεινε.
 *
 * ΔΥΟ ΚΑΔΟΙ ΕΙΝΑΙ ΔΗΛΩΜΕΝΑ ΚΕΝΑ, με μετρημένο πλήθος **0** — και γράφονται ακριβώς
 * επειδή είναι 0: ένα μηδέν που δεν δηλώνεται διαβάζεται ως «δεν υπάρχουν τέτοια».
 */
function auditPalette(palette) {
  const buckets = {
    'judged-opaque': [],
    'judged-translucent': [],
    'unjudged-role': [],
    'unjudged-opaque-rgb': [],
    'unjudged-hsl-literal': [],
    'css-var': [],
    keyword: [],
    'non-color': [],
  };
  const idOf = (e) => `${e.file}::${e.path}`;
  const translucentIds = new Set((palette.translucent || []).map(idOf));

  for (const e of palette.entries) {
    const id = idOf(e);
    if (e.form === 'literal-hex') {
      buckets[SEMANTIC_ROLES.includes(e.role) ? 'judged-opaque' : 'unjudged-role'].push(id);
    } else if (e.form === 'rgb-literal') {
      if (translucentIds.has(id)) buckets['judged-translucent'].push(id);
      else if (SEMANTIC_ROLES.includes(e.role)) buckets['unjudged-opaque-rgb'].push(id);
      else buckets['unjudged-role'].push(id);
    } else if (e.form === 'hsl-literal') {
      buckets['unjudged-hsl-literal'].push(id);
    } else if (buckets[e.form]) {
      buckets[e.form].push(id);
    } else {
      /**
       * FAIL-CLOSED ΜΕ ΟΝΟΜΑ. Αν προστεθεί νέα `form` στο `classifyValue` και ξεχαστεί
       * εδώ, η εναλλακτική θα ήταν `undefined.push(...)`: ένα `TypeError` που δεν λέει
       * **τι** ξεχάστηκε. Η λογιστική είναι το όργανο που εγγυάται ότι κανείς δεν
       * χάνεται σιωπηλά — δεν επιτρέπεται να χαθεί **η ίδια** σιωπηλά (άγκυρα `Κ15β`).
       */
      throw new Error(
        `palette-ledger: άγνωστη μορφή «${e.form}» στο ${id} — κάθε form χρειάζεται κάδο, fail-closed.`,
      );
    }
  }

  const counts = Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length]));
  const placed = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    counts,
    placed,
    total: palette.entries.length,
    balanced: placed === palette.entries.length,
    judgedIds: [...new Set([...buckets['judged-opaque'], ...buckets['judged-translucent']])].sort(),
    descriptions: BUCKET_DESCRIPTIONS,
  };
}

/** Κάθε κάδος με **όνομα και λόγο** — αλλιώς «unjudged-role: 36» δεν λέει τίποτα. */
const BUCKET_DESCRIPTIONS = {
  'judged-opaque': 'σταθερό hex σε σημασιολογικό ρόλο — κατηγορίες Α/Β/Γ/Γ2',
  'judged-translucent': 'ημιδιαφανές rgba() σε σημασιολογικό ρόλο — κατηγορία Ε (σύνθεση)',
  'unjudged-role': 'ρόλος primitive/unknown — δεν ισχυρίζεται τίποτα (κατηγορία Δ)',
  'unjudged-opaque-rgb': '🔶 ΔΗΛΩΜΕΝΟ ΚΕΝΟ: rgb() με α=1 σε σημασιολογικό ρόλο (σήμερα 0)',
  'unjudged-hsl-literal': '🔶 ΔΗΛΩΜΕΝΟ ΚΕΝΟ: hsl() literal — δεν το διαβάζει ο parser (σήμερα 0)',
  'css-var': 'δείχνει σε custom property — το λύνει το Στρώμα 2β (CHECK 3.40)',
  keyword: 'transparent/currentColor/inherit — δεν είναι μονοθεματικό χρώμα',
  'non-color': 'δεν είναι χρώμα (μεγέθη, σκιές, μεταβάσεις)',
};

module.exports = {
  auditPalette,
  censusByForm,
  ROLE_SPLIT_FORMS,
  BUCKET_DESCRIPTIONS,
};
