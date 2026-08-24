'use client';

/**
 * ADR-798 Φάση 3 — Ο **ΑΝΑΓΝΩΣΤΗΣ** του δηλωμένου επαγγέλματος.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 ΜΗΔΕΝ I/O — ΚΑΙ ΕΙΝΑΙ ΟΛΟΣ Ο ΣΧΕΔΙΑΣΜΟΣ, ΟΧΙ ΒΕΛΤΙΣΤΟΠΟΙΗΣΗ
 *
 * Διαβάζει **αποκλειστικά** από το `useAuth().declaredOccupation`, που η Φάση 2
 * γέμισε από ένα `getDoc` το οποίο **γινόταν ήδη** σε κάθε σύνδεση και του
 * οποίου το αποτέλεσμα **πεταγόταν** (`auth-context-profile.ts`).
 *
 * ⛔ **ΜΗΝ γράψεις εδώ `getDoc`/`onSnapshot`.** Θα ήταν I/O σε **κάθε σελίδα**
 * που δείχνει sidebar — ακριβώς η προειδοποίηση του
 * `useEffectivePermissions.ts:27-30`. Το επάγγελμα ζει στο Firestore και
 * **ποτέ στα claims** (Α4), άρα η μόνη δωρεάν διαδρομή είναι αυτή.
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ, **ΠΟΤΕ BOOLEAN** — ΤΟ ΠΡΟΤΥΠΟ ΕΙΝΑΙ ΤΟ `jobs-access.ts`
 *
 * Ένα `hasOccupation: boolean` θα ισοπέδωνε **δύο εντελώς διαφορετικά** πράγματα
 * σε ένα `false`: *«δεν τον ρωτήσαμε ποτέ»* και *«ρωτήθηκε και δεν έχει»*. Η
 * ίδια διάκριση που κρατά τίμιο το `granted` / `unknown` / `none` δίπλα.
 *
 *   `unknown`   — δεν ξέρουμε. Είτε δεν φορτώθηκε το προφίλ, είτε **δεν
 *                 δηλώθηκε τίποτα**. ⚠️ *Η απουσία δήλωσης ΔΕΝ είναι δήλωση.*
 *   `declared`  — ο άνθρωπος το έγραψε **ο ίδιος**. Αρκεί για **εξατομίκευση**,
 *                 ποτέ για δικαίωμα (Α4 · NIST SP 800-63: IAL1 ⇒ personalization).
 *   `verified`  — 🔭 **ΦΑΣΗ 5, ΔΕΝ ΠΑΡΑΓΕΤΑΙ ΣΗΜΕΡΑ.** Και δηλώνεται *τώρα*
 *                 επειδή το boolean θα ήταν αδιέξοδο: η επαλήθευση (W3C VC 2.0 /
 *                 EUDI QEAA) είναι **τρίτη** κατάσταση, όχι «πιο δυνατό ναι».
 *
 * 🔒 **ΣΥΜΒΟΛΑΙΟ ΜΕ ΤΟΝ SERVER**: το `verified` θα προκύψει από το πεδίο
 * **`occupationVerification`**, που τα `firestore.rules` (~γρ. 1937) ήδη
 * φυλάνε ως **server-owned** — ο χρήστης δεν μπορεί να το γράψει μόνος του.
 * ⚠️ Άλλο όνομα στη Φάση 5 ⇒ ο φρουρός μένει **πράσινος και ανενεργός**.
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 ΓΙΑΤΙ ΤΟ `escoUri` ΦΥΛΑΕΙ ΤΟ `iscoCode` — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΥΠΟΤΙΘΕΜΕΝΟ
 *
 * Το `escoUri` είναι η **αυθεντία** της ταξινόμησης· το `escoLabel` αντίγραφο
 * εμφάνισης και το `iscoCode` η ομάδα (`professional-identity.ts`). Ο ίδιος ο
 * τύπος λέει ότι τα τρία **πάνε ΠΑΝΤΑ μαζί**, αλλά δεν μπορεί να το επιβάλει.
 *
 * Ο **μοναδικός** γραφέας το τηρεί: το `EscoOccupationPicker` εκπέμπει είτε
 * `buildSelected` *(και τα τρία)* είτε `buildFreeText` *(κανένα)* — δεν υπάρχει
 * τρίτος δρόμος. Άρα `iscoCode` **χωρίς** `escoUri` σημαίνει εγγραφή που δεν
 * πέρασε από τον picker, δηλαδή **προέλευση που δεν μπορούμε να βεβαιώσουμε**.
 * Τέτοιος κωδικός **δεν εκτίθεται**: ένα ορφανό ψηφίο δεν επιτρέπεται να
 * οδηγήσει την πρόταση δουλειάς.
 *
 * @module hooks/useDeclaredOccupation
 * @see docs/centralized-systems/reference/adrs/ADR-798-person-professional-identity.md §7
 * @see src/hooks/useJobFilteredNavigation.ts — ο καταναλωτής (`useJobSuggestion`)
 * @see src/config/isco-job-affinity.ts — τι **σημαίνει** ο κωδικός για τη δουλειά
 */

import { useMemo } from 'react';
import { useAuth } from '@/auth';
import type { DeclaredOccupation } from '@/types/professional-identity';

/** Πόσο εμπιστευόμαστε το επάγγελμα. **Τρεις ρητές καταστάσεις, ποτέ boolean.** */
export type OccupationConfidence = 'unknown' | 'declared' | 'verified';

export interface DeclaredOccupationView {
  /**
   * Το ωμό στοιχείο, ή `null`.
   *
   * ⚠️ `null` σημαίνει **«δεν ρωτήθηκε»** — ποτέ «δεν έχει». Το προφίλ μπορεί
   * απλώς να μην έχει φορτώσει ακόμη.
   */
  readonly occupation: DeclaredOccupation | null;
  readonly confidence: OccupationConfidence;
  /**
   * Ταξινομημένο κατά ESCO; **Αυθεντία το `escoUri`**, ποτέ η ετικέτα: το
   * `escoLabel` είναι αντίγραφο εμφάνισης και μπορεί να υπάρχει από παλιά.
   */
  readonly isClassified: boolean;
  /**
   * Ο κωδικός ISCO-08 **μόνο όταν είναι ταξινομημένο**, αλλιώς `null`.
   * Δες την ενότητα «γιατί το `escoUri` φυλάει το `iscoCode`» παραπάνω.
   */
  readonly iscoCode: string | null;
}

/** Καμία δήλωση — μία **σταθερή** ταυτότητα, ώστε το `useMemo` να μη γεννά σκουπίδια. */
const NOT_DECLARED: DeclaredOccupationView = {
  occupation: null,
  confidence: 'unknown',
  isClassified: false,
  iscoCode: null,
};

/** Κενή συμβολοσειρά, `undefined`, μόνο κενά ⇒ **δεν είναι τιμή**. */
function isFilled(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Το δηλωμένο επάγγελμα του **συνδεδεμένου χρήστη**, χαρακτηρισμένο.
 *
 * ⚠️ Δεν αποφασίζει **τίποτα** για δουλειές: απαντά μόνο *«τι δήλωσε ο άνθρωπος
 * και πόσο το εμπιστευόμαστε»*. Το *«τι σημαίνει αυτό για την πλοήγηση»* είναι
 * **άλλο ερώτημα** και ζει στο `isco-job-affinity.ts`. Η ένωσή τους εδώ θα
 * έβαζε δύο ερωτήσεις σε ένα σπίτι — και θα έκανε τον χαρακτηρισμό αδοκίμαστο
 * χωρίς να ξέρεις τον πίνακα δουλειών.
 */
export function useDeclaredOccupation(): DeclaredOccupationView {
  const { declaredOccupation } = useAuth();

  return useMemo<DeclaredOccupationView>(() => {
    if (declaredOccupation === null) return NOT_DECLARED;

    const { profession, escoUri, escoLabel, iscoCode } = declaredOccupation;

    // 🔴 Η ΑΠΟΥΣΙΑ ΔΗΛΩΣΗΣ ΔΕΝ ΕΙΝΑΙ ΔΗΛΩΣΗ: ένα αντικείμενο υπάρχει πάντα (η
    // Φάση 2 επιστρέφει `{}` για νέο χρήστη). Αν κανένα από τα τέσσερα πεδία
    // δεν έχει τιμή, δεν έχουμε μάθει τίποτα ⇒ `unknown`, όχι `declared`.
    const hasAnyValue =
      isFilled(profession) || isFilled(escoUri) || isFilled(escoLabel) || isFilled(iscoCode);
    if (!hasAnyValue) return NOT_DECLARED;

    const isClassified = isFilled(escoUri);

    return {
      occupation: declaredOccupation,
      // 🔭 `verified` δεν παράγεται εδώ: το `occupationVerification` είναι
      // server-owned και προσγειώνεται στη Φάση 5 (ADR-798 §7).
      confidence: 'declared',
      isClassified,
      iscoCode: isClassified && isFilled(iscoCode) ? iscoCode : null,
    };
  }, [declaredOccupation]);
}
