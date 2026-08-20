/**
 * =============================================================================
 * 🧩 ADR-744 §15 (Φ4) — Η ΠΑΡΑΔΟΣΗ ΤΟΥ PER-ROUTE SLICE
 * =============================================================================
 *
 * Το κέλυφος έχει το δικό του slice, φορτωμένο **στατικά** από το `config.ts`.
 * Μια **σελίδα** όμως είναι route boundary **εξ ορισμού**: ό,τι ζητά ζει έξω
 * από την κλειστότητα του κελύφους, και σε **ψυχρή φόρτωση** βάφει στο **ίδιο
 * καρέ** με το layout — χωρίς μετάβαση πίσω από την οποία να κρυφτεί.
 *
 * 🔑 **ΓΙΑΤΙ ΣΤΑΤΙΚΗ ΕΙΣΑΓΩΓΗ ΣΤΟ ΙΔΙΟ ΤΟ `page.tsx` ΚΑΙ ΟΧΙ ΦΟΡΤΩΣΗ.**
 * Το Next κόβει **ήδη** ένα chunk ανά διαδρομή. Μια στατική εισαγωγή μέσα στη
 * σελίδα προσγειώνεται **σε αυτό** το chunk: μηδέν επιπλέον αίτημα, μηδέν
 * κόστος για τις άλλες 150 διαδρομές, και — το κρίσιμο — **υπάρχει ΣΤΟΝ SERVER**,
 * σύγχρονα, την ώρα του SSR. Κάθε εκδοχή με `import()` ή fetch μετακινεί το ωμό
 * κλειδί από «μόνιμο» σε «για ένα καρέ» και το **κρύβει** από το CHECK 3.51 —
 * ακριβώς η παγίδα που το ADR-744 §14 απαγορεύει ρητά για το `ssr: false`.
 *
 * 🔴 **ΤΟ SLICE ΔΗΛΩΝΕΤΑΙ `shell-partial`, ΠΟΤΕ `complete`.**
 * Είναι **αφαίρεση**: περιέχει μόνο ό,τι το κέλυφος δεν απαντά ήδη, δηλαδή
 * είναι **εξ ορισμού** ελλιπές. Αν δηλωνόταν `complete`, το `loadNamespace` θα
 * σταματούσε να κατεβάζει το πλήρες locale και κάθε **άλλο** κλειδί του ίδιου
 * namespace θα έβγαινε ωμό — το ελάττωμα του §11 σε νέα θέση, με τη διαφορά
 * ότι θα **έμοιαζε** λυμένο. Το `bundle-registry` είναι η **μόνη** αυθεντία που
 * επιτρέπεται να απαντήσει «χρειάζεται φόρτωση;».
 *
 * ⚠️ **ΜΗΝ γράψεις `overwrite: true`**: αν ο loader πρόλαβε και εγκατέστησε το
 * πλήρες αρχείο, το μερικό slice δεν επιτρέπεται να το πατήσει από πάνω.
 *
 * @module i18n/route-slice
 * @see docs/centralized-systems/reference/adrs/ADR-744-i18n-shell-slice.md §15
 */

/**
 * 🔴 **ΕΙΣΑΓΩΓΗ ΑΠΟ ΤΟ `./config`, ΟΧΙ ΑΠΟ ΤΟ `i18next` — ΚΑΙ ΕΙΝΑΙ ΟΡΘΟΤΗΤΑ.**
 *
 * Το i18next **δεν έχει** `addResourceBundle` πριν το `init()`: το προσαρτά ο
 * ίδιος ο `init` δένοντας τις μεθόδους του store. Με σκέτο `import i18n from
 * 'i18next'` η κλήση σε **εμβέλεια module** θα έτρεχε πριν τον bootstrap και θα
 * πετούσε `addResourceBundle is not a function` — δηλαδή **λευκή οθόνη** στη
 * σελίδα που υποτίθεται ότι θεραπεύει. Το έπιασε το `Ρ3` πριν προσγειωθεί.
 *
 * Η εισαγωγή του `./config` κάνει τη σειρά **δομική**: η αποτίμηση των ES modules
 * είναι κατά βάθος, άρα ο bootstrap έχει τελειώσει όταν τρέξει αυτό το αρχείο.
 */
import i18n from './config';

import { DEFAULT_LANGUAGE } from './lazy-config';
import { getBundleState, recordShellBootstrap } from './bundle-registry';

/** Το σχήμα ενός παραγόμενου route slice: `{ namespace: { …κλειδιά } }`. */
export type RouteSlice = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

/**
 * Εγκαθιστά το slice μιας διαδρομής **σύγχρονα**, σε χρόνο φόρτωσης module.
 *
 * Καλείται από το `page.tsx` σε **εμβέλεια module** (όχι σε render, όχι σε
 * effect): έτσι τρέχει **πριν** αποδοθεί οτιδήποτε, και στον server **και** στον
 * client, χωρίς να εξαρτάται από τον κύκλο ζωής του React.
 *
 * Ιδεμποτικό: δεύτερη κλήση δεν αλλάζει τίποτα.
 */
export function registerRouteSlice(slice: RouteSlice, language: string = DEFAULT_LANGUAGE): void {
  const installed: string[] = [];

  for (const [namespace, tree] of Object.entries(slice)) {
    // Ένα ήδη πλήρες bundle δεν αγγίζεται: το μερικό δεν έχει τίποτα να του δώσει.
    if (getBundleState(language, namespace) === 'complete') continue;
    i18n.addResourceBundle(language, namespace, tree, /* deep */ true, /* overwrite */ false);
    installed.push(namespace);
  }

  // ⚠️ ΠΟΤΕ `whole`: το route slice είναι αφαίρεση, άρα μερικό εξ ορισμού.
  if (installed.length > 0) recordShellBootstrap(language, installed, []);
}
