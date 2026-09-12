/**
 * =============================================================================
 * ADDRESS HIERARCHY FIELD OPS — pure write/format primitives (ADR-332)
 * =============================================================================
 *
 * Εξήχθη από το `AddressWithHierarchy.tsx` (N.7.1: το component ξεπέρασε τις
 * 500 γραμμές). Εδώ ζει ό,τι είναι **καθαρή συνάρτηση πάνω στην τιμή** —
 * κανονικοποίηση ονομάτων από geocoding και τα δύο primitives εγγραφής της
 * ιεραρχίας. Καμία εξάρτηση από React.
 *
 * ⚠️ Οι συναρτήσεις Τ.Κ. **μετακόμισαν** στο `@/utils/address/postal-code`:
 * τις χρειάζονται πλέον και `types/`, και server-only μετάπτωση, και ένα
 * `types/ → components/` import θα ήταν ανάποδα (ADR-332 D16).
 *
 * ΓΙΑΤΙ ΕΝΑ ΣΗΜΕΙΟ: και οι δύο handlers επιλογής (οικισμός / επίπεδο ιεραρχίας)
 * έγραφαν τον ίδιο βρόχο πάνω στο `PATH_TO_VALUE`. Ο κανόνας «ταυτότητα και
 * όνομα γράφονται/καθαρίζονται ΜΑΖΙ» πρέπει να ζει σε ΕΝΑ σημείο — αν
 * αποκλίνουν, το UI δείχνει όνομα που δεν αντιστοιχεί σε καμία οντότητα.
 *
 * @module components/shared/addresses/address-hierarchy-field-ops
 * @see ADR-332 — Enterprise Address Editor System
 */

import type { AdminLevel, AdminPath } from '@/hooks/useAdministrativeHierarchy';
import type { ProvedAdminLevel } from '@/lib/geocoding/geocoding-types';
import { toCanonicalGreekPostalCode } from '@/utils/address/postal-code';
import {
  EMPTY_VALUE,
  PATH_TO_VALUE,
  type AddressWithHierarchyValue,
} from './address-with-hierarchy-config';

// =============================================================================
// GEOCODED NAME NORMALISATION
// =============================================================================

// ⚠️ **ΕΔΩ ΖΟΥΣΕ ΔΕΥΤΕΡΟ, ΕΛΛΙΠΕΣ `stripGreekAdminPrefix` — ΔΙΑΓΡΑΦΗΚΕ** (ADR-332 D27 Φάση Β′).
//
// Το κανονικό ζει στο `utils/address/place-name.ts` και είναι **αυστηρά καλύτερο**: ξέρει
// «αποκεντρωμένη διοίκηση», «περιφερειακή ενότητα», «περιφέρεια», «τοπική κοινότητα», κόβει
// **ακολουθία προθέματος** και όχι λέξεις **ως σύνολο**, και συγκρίνει **χωρίς τόνους**.
// Το εδώ αντίγραφο είχε **έναν** καταναλωτή (`use-settlement-autofill.ts`), που πλέον
// εισάγει το κανονικό — άρα καμία μετάπτωση, μόνο διαγραφή. *(N.0.2 · N.18)*

// =============================================================================
// HIERARCHY WRITE PRIMITIVES
// =============================================================================

/**
 * Γράφει id + όνομα για κάθε κόμβο της αναλυμένης διαδρομής.
 * Ο οικισμός (level 8) δίνει επιπλέον Τ.Κ.
 *
 * @param clearLevelsDeeperThan όταν δοθεί, τα επίπεδα πιο ειδικά από αυτό που
 *   δεν καλύπτονται από τη διαδρομή καθαρίζονται (δεν μένουν ορφανά).
 */
export function applyResolvedPath(
  target: AddressWithHierarchyValue,
  path: AdminPath,
  clearLevelsDeeperThan?: AdminLevel,
): void {
  for (const mapping of PATH_TO_VALUE) {
    const entity = path[mapping.pathKey];
    if (entity) {
      (target[mapping.idField] as string | null) = entity.id;
      (target[mapping.nameField] as string) = entity.name;
      if (mapping.level === 8 && entity.postalCode) {
        // ΚΑΝΟΝΙΚΗ μορφή στο μοντέλο (ADR-332 D16) — η μορφοποίηση «546 24»
        // ανήκει στο render. Γραμμένη εδώ, κατέληγε αυτούσια στο Firestore και
        // έσπαγε κάθε σύγκριση με το dataset ιεραρχίας (0 εγγραφές με κενό).
        target.postalCode = toCanonicalGreekPostalCode(entity.postalCode);
      }
    } else if (clearLevelsDeeperThan !== undefined && mapping.level > clearLevelsDeeperThan) {
      (target[mapping.idField] as string | null) = null;
      (target[mapping.nameField] as string) = '';
    }
  }
}

/** Καθαρίζει id + όνομα για κάθε επίπεδο που ταιριάζει στο κριτήριο. */
export function clearHierarchyLevels(
  target: AddressWithHierarchyValue,
  shouldClear: (level: AdminLevel) => boolean,
): void {
  for (const mapping of PATH_TO_VALUE) {
    if (shouldClear(mapping.level)) {
      (target[mapping.idField] as string | null) = null;
      (target[mapping.nameField] as string) = '';
    }
  }
}

/**
 * **ΟΙ ΑΠΟΔΕΔΕΙΓΜΕΝΕΣ ΒΑΘΜΙΔΕΣ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ → ΠΕΔΙΑ ΤΗΣ ΦΟΡΜΑΣ** *(ADR-332 D27 Φάση Β′)*.
 *
 * «**Γράψε ό,τι αποδείχθηκε, καθάρισε ό,τι ΔΕΝ αποδείχθηκε**» — άγνοια ≠ γνώση, και ποτέ
 * μπαγιάτικη ταυτότητα δίπλα σε νέο όνομα *(ADR-277)*.
 *
 * 🔑 **Καμία χειρόγραφη αντιστοίχιση**: η μετάφραση «αριθμός βαθμίδας → πεδίο id + πεδίο
 * ονόματος» ζει **μία** φορά, στο `PATH_TO_VALUE` — το ίδιο πρότυπο με το
 * {@link applyResolvedPath}. Ένας δικός του πίνακας θα ήταν ο πέμπτος του ADR-772.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ⚠️ **ΤΟ `undefined` ΔΕΝ ΕΙΝΑΙ ΠΑΝΤΟΥ «ΜΗΝ ΑΓΓΙΞΕΙΣ» — ΚΑΙ Ο ΚΑΛΩΝ ΠΡΕΠΕΙ ΝΑ ΑΠΟΦΑΣΙΣΕΙ.**
 *
 * Εδώ το `undefined` σημαίνει **«δεν ρωτήθηκε»** και η συνάρτηση **δεν πειράζει τίποτα**.
 * Αυτό είναι σωστό όταν το **κείμενο μένει** *(π.χ. «Μόνο η θέση»)*: η υπάρχουσα ταυτότητα
 * εξακολουθεί να αντιστοιχεί στην ίδια διεύθυνση, και μια βλάβη **δική μας** δεν επιτρέπεται
 * να σβήσει επιλογή ανθρώπου.
 *
 * 🔴 **ΕΙΝΑΙ ΛΑΘΟΣ όταν το κείμενο ΑΝΤΙΚΑΘΙΣΤΑΤΑΙ** *(«Ναι, ενημέρωσε»)*: νέα οδός με την
 * **παλιά** ταυτότητα δήμου δίπλα της είναι **ακριβώς** το ελάττωμα που περιγράφει το
 * ADR-277 *(«όνομα μιας περιοχής με την ταυτότητα μιας άλλης»)*, και είναι **αόρατο** σε
 * κάθε οθόνη. Εκεί «δεν ρωτήθηκε» και «ρωτήθηκα και δεν έμαθα» καταλήγουν στο **ίδιο**:
 * δεν έχουμε απόδειξη ⇒ **καθαρίζουμε**. Γι' αυτό οι τέσσερις γραφείς του συρσίματος
 * περνούν ρητά `admin ?? []` — η απόφαση είναι **γραμμένη στο σημείο κλήσης**, όχι κρυμμένη.
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * @returns `true` όταν κάτι γράφτηκε ή καθαρίστηκε· `false` όταν **δεν ρωτήθηκε** και άρα
 *   τα πεδία έμειναν **ανέγγιχτα**.
 */
export function applyProvedAdminLevels(
  target: AddressWithHierarchyValue,
  proved: readonly ProvedAdminLevel[] | undefined,
): boolean {
  // ⚠️ **`undefined` ≠ κενός πίνακας** (N.12): «δεν διαβάστηκε η ιεραρχία» δεν δικαιολογεί
  //    κανένα σβήσιμο — μια βλάβη δική μας δεν σβήνει επιλογή ανθρώπου.
  if (proved === undefined) return false;

  const byLevel = new Map(proved.map((level) => [level.level, level]));
  for (const mapping of PATH_TO_VALUE) {
    const hit = byLevel.get(mapping.level);
    (target[mapping.idField] as string | null) = hit ? hit.id : null;
    (target[mapping.nameField] as string) = hit ? hit.name : '';
  }
  return true;
}

/**
 * Οι αποδεδειγμένες βαθμίδες **ως τιμή φόρμας** — η γλώσσα που ξέρει να προβάλλει το
 * λεξιλόγιο του ADR-772 σε **κάθε** δοχείο (`companyAddress` · `projectAddress` · …).
 *
 * 🔑 **Γιατί περνά από τη φόρμα και όχι κατευθείαν στο δοχείο**: το `form` είναι το **μόνο**
 * λεξιλόγιο με ζεύγη `*Id` + `*Name` σε **και τα οκτώ** επίπεδα, άρα είναι η μόνη μορφή που
 * μπορεί να **εκφράσει** ό,τι αποδείχθηκε χωρίς απώλεια. Ό,τι το δοχείο-στόχος δεν κρατά,
 * το πετά **ο πίνακας** *(`NOT_STORED`)* — όχι εμείς με το χέρι.
 */
export function provedHierarchyValue(
  proved: readonly ProvedAdminLevel[],
): AddressWithHierarchyValue {
  const value: AddressWithHierarchyValue = { ...EMPTY_VALUE };
  applyProvedAdminLevels(value, proved);
  return value;
}
