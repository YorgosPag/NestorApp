/**
 * @fileoverview **ΤΙ ΚΑΤΑΠΙΕ ΤΙ, ΟΤΑΝ Ο ΑΝΘΡΩΠΟΣ ΠΡΟΣΘΕΣΕ ΠΕΡΙΟΧΗ** — ADR-846.
 * @related lib/agency/coverage-match · components/mandate/CoverageAreaPicker
 * @module lib/agency/coverage-absorption
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΣΙΩΠΗ ΠΟΥ ΔΙΑΒΑΖΕΤΑΙ ΩΣ ΣΦΑΛΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `normalizeCoverageIds` **απορροφά τους απογόνους**: δηλώνεις «Περιφέρεια Αττικής»
 * και ο «Δήμος Αθηναίων» φεύγει, γιατί ήδη περιέχεται. Σωστό — και **αόρατο**: ο
 * άνθρωπος πάτησε ένα πράγμα και **κάτι άλλο** συνέβη στην οθόνη. Χωρίς ανακοίνωση,
 * διαβάζεται ως *«η εφαρμογή έσβησε την επιλογή μου»*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΖΕΙ ΕΔΩ, ΕΞΩ ΑΠΟ ΤΟ COMPONENT (ADR-846 Φ4)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ήταν **26 γραμμές μέσα σε χειριστή συμβάντος**, δηλαδή κρίση τομέα *(«ποιος κατάπιε
 * ποιον, και πόσους;»)* δοκιμάσιμη **μόνο μέσω render**. Είναι καθαρή συνάρτηση των
 * τριών ορισμάτων της· ό,τι έχει απάντηση χωρίς React δεν χρειάζεται React για να
 * ελεγχθεί.
 *
 * ⚠️ **Δεν ξαναγράφει την απορρόφηση** — τη **ρωτά**: ο κανόνας ζει στο
 * `normalizeCoverageIds`, και εδώ διαβάζεται μόνο **η διαφορά** πριν/μετά. Δεύτερη
 * υλοποίηση του «ποιος περιέχει ποιον» θα ήταν κλώνος που θα απέκλινε από τον κριτή.
 */

import { normalizeCoverageIds, type LineageResolver } from './coverage-match';

/**
 * **Η ανακοίνωση**: *«το `narrow` απορροφήθηκε από το `wide`»* — και **πόσα** ήταν.
 *
 * ⚠️ **Γιατί ΠΛΗΘΟΣ και όχι ΛΙΣΤΑ ΟΝΟΜΑΤΩΝ**: μια λίστα απαιτεί συνένωση με στίξη
 * *(εισαγωγικά, «και»)* — δηλαδή **γλώσσα μέσα στον κώδικα**, που ο N.11 απαγορεύει και
 * που σπάει σε κάθε νέα γλώσσα. Το πλήθος μπαίνει σε **ένα** κλειδί ICU με `plural`.
 * Ο άνθρωπος βλέπει ούτως ή άλλως **ποια** chips έφυγαν· αυτό που δεν έβλεπε ήταν **πόσα**.
 */
export interface Absorption {
  readonly narrow: string;
  readonly wide: string;
  readonly count: number;
}

/** Το αποτέλεσμα μιας προσθήκης: η **νέα λίστα**, και τι **πρέπει να ειπωθεί**. */
export interface AbsorptionOutcome {
  readonly adminIds: readonly string[];
  readonly absorption: Absorption | null;
}

/**
 * **Πρόσθεσε μια περιοχή, και πες τι έγινε.**
 *
 * @param current — οι ήδη δηλωμένες ταυτότητες
 * @param added — αυτή που μόλις πάτησε ο άνθρωπος
 * @param lineageOf — ποιος περιέχει ποιον *(ο ίδιος αναγνώστης με τον κριτή)*
 * @param nameOf — πώς λέγεται μια ταυτότητα **στην οθόνη**
 */
export function absorbArea(
  current: readonly string[],
  added: string,
  lineageOf: LineageResolver,
  nameOf: (adminId: string) => string,
): AbsorptionOutcome {
  const adminIds = normalizeCoverageIds([...current, added], lineageOf);

  // 🔑 **Δύο κατευθύνσεις, και οι δύο ανακοινώνονται.** Αν ο νέος έφυγε, τον κατάπιε
  //    πρόγονος· αν έφυγαν άλλοι, τους κατάπιε ο νέος.
  if (!adminIds.includes(added)) {
    // Ο νέος καταπίνεται από **έναν** πρόγονο — το πλήθος είναι εξ ορισμού 1.
    const swallower = current.find((id) => lineageOf(added).includes(id));
    return {
      adminIds,
      absorption: { narrow: nameOf(added), wide: nameOf(swallower ?? added), count: 1 },
    };
  }

  const swallowed = current.filter((id) => !adminIds.includes(id));
  return {
    adminIds,
    absorption:
      swallowed.length === 0
        ? null
        : { narrow: nameOf(swallowed[0]), wide: nameOf(added), count: swallowed.length },
  };
}
