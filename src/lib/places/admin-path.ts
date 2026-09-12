/**
 * @fileoverview **ΠΟΙΑ ΟΝΤΟΤΗΤΑ ΣΕ ΚΑΘΕ ΒΑΘΜΙΔΑ** — το δοχείο των 8 θέσεων, χωρίς React.
 * @related ADR-846 Φ4 · hooks/useAdministrativeHierarchy *(ο ξενιστής του στιγμιοτύπου)*
 * @module lib/places/admin-path
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΕΦΥΓΕ ΑΠΟ ΤΟ HOOK — Η ΣΥΝΕΧΕΙΑ ΜΙΑΣ ΑΠΟΦΑΣΗΣ ΠΟΥ ΕΙΧΕ ΗΔΗ ΓΡΑΦΤΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `useAdministrativeHierarchy` έγραφε **ήδη** ότι οι αναγνώστες *«ζουν ΕΞΩ από το
 * hook επίτηδες»*, με δύο μετρημένα κέρδη: σώμα hook κάτω από 40 γραμμές, και απάντηση
 * που εξαρτάται **μόνο** από τα ορίσματα. Αυτό εδώ είναι το επόμενο βήμα του **ίδιου**
 * σκεπτικού: «έξω από το hook» και «έξω από το αρχείο του hook» διαφέρουν μόνο ως προς
 * το **ποιος μπορεί να τα δοκιμάσει**.
 *
 * ⚠️ **Η αφορμή ήταν το όριο των 500 γραμμών (N.7.1, μετρημένο 511), ο λόγος όχι** — και
 * είναι η **τρίτη** φορά σήμερα που το όριο *αποκαλύπτει* τομή που ήταν ήδη αληθής,
 * αντί να τη δημιουργεί *(δες `agency-profile-credential` · `public-shelf-encoding`)*.
 *
 * ⛔ **ΜΟΝΟ type-only εισαγωγές από τον ξενιστή, ΚΑΙ ΕΙΝΑΙ ΟΡΘΟΤΗΤΑ**: ο ξενιστής
 * εισάγει **τιμές** από εδώ, οπότε μια εισαγωγή τιμής προς τα πίσω θα έκλεινε **κύκλο
 * σε χρόνο εκτέλεσης**. Οι τύποι σβήνονται στη μεταγλώττιση — ο κύκλος δεν υπάρχει ποτέ.
 */

import type {
  AdminEntity,
  AdminPath,
  HierarchySnapshot,
} from '@/hooks/useAdministrativeHierarchy';

/**
 * Ποιο κλειδί του `AdminPath` γεμίζει κάθε βαθμίδα.
 *
 * 🔑 **Είναι η ΜΙΑ αντιστοιχία «αριθμός βαθμίδας ↔ όνομα βαθμίδας»** *(ADR-332 D27 Φάση Β′)*, και
 * τη χρειάζονται πλέον και **διαδρομές διακομιστή** — μέσω του {@link PATH_KEY_TO_LEVEL}. Το `ADMIN_LEVELS`
 * του `useAdministrativeHierarchy` λέει το ίδιο, αλλά ζει σε module που **εισάγει React** —
 * ένα API route δεν επιτρέπεται να το σύρει. Αυτό εδώ εισάγει **μόνο τύπους** από τον
 * ξενιστή, άρα περνά καθαρά και στις δύο πλευρές.
 * ⛔ **ΜΗΝ γράψεις δεύτερο πίνακα βαθμίδων** — θα ήταν ο κλώνος που ονομάζει ο N.18, και
 * ακριβώς το σχήμα που το ADR-772 πλήρωσε με απώλεια δεδομένων.
 */
const LEVEL_TO_PATH_KEY: Record<number, keyof AdminPath> = {
  1: 'majorGeo',
  2: 'decentAdmin',
  3: 'region',
  4: 'regionalUnit',
  5: 'municipality',
  6: 'municipalUnit',
  7: 'community',
  8: 'settlement',
};

/** Η **αντίστροφη** ανάγνωση: όνομα βαθμίδας → αριθμός, από τον **ίδιο** πίνακα. */
export const PATH_KEY_TO_LEVEL: Readonly<Record<keyof AdminPath, number>> = Object.fromEntries(
  Object.entries(LEVEL_TO_PATH_KEY).map(([level, key]) => [key, Number(level)]),
) as Record<keyof AdminPath, number>;

/** Κενή διαδρομή — «δεν ξέρω», με **όλα** τα κλειδιά παρόντα. */
export function emptyAdminPath(): AdminPath {
  return {
    majorGeo: null,
    decentAdmin: null,
    region: null,
    regionalUnit: null,
    municipality: null,
    municipalUnit: null,
    community: null,
    settlement: null,
  };
}

/**
 * Ποια οντότητα σε **κάθε** βαθμίδα — δοχείο 8 θέσεων, για **διεύθυνση**.
 *
 * ⚠️ **ΔΕΝ είναι το `lineageIdsOf`**, και η διαφορά είναι η ερώτηση: εκείνο απαντά
 * *«ποιοι με περιέχουν;»* ως **αλυσίδα**, για **σχέση**· αυτό *«ποια οντότητα σε κάθε
 * βαθμίδα;»* ως **δοχείο**, για **διεύθυνση**. Ίδια διαδρομή, δύο καταναλωτές που δεν
 * εκφράζονται ο ένας με τον άλλο χωρίς ο καλών να ξέρει ποια κλειδιά είναι `null`.
 */
export function resolveAdminPath(
  snapshot: HierarchySnapshot,
  entityId: string,
): AdminPath {
  const path = emptyAdminPath();
  let current: AdminEntity | undefined = snapshot.entities.get(entityId);
  // 🔒 Φρουρός κύκλου: δεδομένα ΕΛΣΤΑΤ, αλλά ένας κύκλος `parentId` θα κρέμαγε την
  //    οθόνη αθόρυβα. Το βάθος είναι 8 — το 16 είναι διπλάσιο κάθε νόμιμης αλυσίδας.
  let guard = 16;

  while (current && guard-- > 0) {
    const key = LEVEL_TO_PATH_KEY[current.level];
    if (key) path[key] = current;
    current = current.parentId ? snapshot.entities.get(current.parentId) : undefined;
  }

  return path;
}
