/**
 * @fileoverview **ΤΙ ΛΕΙΠΕΙ ΑΠΟ ΤΗ ΦΟΡΜΑ ΖΗΤΗΣΗΣ** — όλα μαζί, ποτέ ένα τη φορά.
 * @related ADR-777 §7 (Α9 · Α14 §17.2) · types/property-demand.ts · lib/forms/draft-validation.ts
 * @module lib/demand/demand-form-validation
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΣΩΜΑ ΕΞΗΧΘΗ — ΚΑΙ Ο ΛΟΓΟΣ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι την **Α14** (2026-08-11) ο σκελετός ζούσε εδώ. Η **δεύτερη** φόρμα του
 * ADR-777 (η **προσφορά του ιδιώτη**) απαντά το **ίδιο** ερώτημα για άλλο λεξιλόγιο,
 * με **ταυτόσημο** σκελετό — δηλαδή θα ήταν κλώνος που **μπλοκάρει το CHECK 3.28**,
 * και ο κανόνας **N.0.2** ζητά να φτιαχτεί το SSoT **πριν** το δεύτερο αντίγραφο, όχι
 * μετά.
 *
 * Ο σκελετός, οι τρεις ερωτήσεις και η **σειρά-συμβόλαιο** ζουν πλέον στο
 * {@link validateDraftForm}. Εδώ μένει **μόνο** το λεξιλόγιο της ζήτησης — που είναι
 * ακριβώς ό,τι διαφέρει.
 *
 * ⚠️ **Ο τρίτος κριτής ΔΕΝ άλλαξε και δεν επιτρέπεται να αλλάξει**: το
 * {@link demandInvariantViolations} είναι η **ίδια** συνάρτηση που φρουρεί την πύλη
 * γραφής (`property-demand.service.ts`). Δεύτερο σύνολο κανόνων θα απέκλινε στην
 * πρώτη αλλαγή, και ο χρήστης θα έβλεπε «αποθηκεύεται…» και μετά αποτυχία **χωρίς
 * πεδίο**.
 *
 * **Layering**: leaf — καθαρή συνάρτηση.
 */

import {
  validateDraftForm,
  type DraftFormValidation,
} from '@/lib/forms/draft-validation';
import {
  demandInvariantViolations,
  type DemandInvariant,
} from '@/types/property-demand';
import {
  demandDraftFrom,
  demandFormBlockers,
  demandFormSchema,
  type DemandDraft,
  type DemandFormBlocker,
  type DemandFormValues,
} from './demand-form-values';

/**
 * Η πλήρης εικόνα της φόρμας ζήτησης.
 *
 * 🔑 **Ψευδώνυμο του γενικού τύπου με το λεξιλόγιο δεμένο** — ώστε οι καταναλωτές να
 * μη γράφουν τρεις παραμέτρους τύπου, και ώστε ένα μελλοντικό πέμπτο σκέλος στον
 * γενικό τύπο να φτάσει εδώ **χωρίς** να το θυμηθεί κανείς.
 */
export type DemandFormValidation = DraftFormValidation<
  DemandDraft,
  DemandFormBlocker,
  DemandInvariant
>;

/** **Τιμές φόρμας ζήτησης → μπορεί να σταλεί;** */
export function validateDemandForm(values: DemandFormValues): DemandFormValidation {
  return validateDraftForm(values, {
    schema: demandFormSchema,
    blockersOf: demandFormBlockers,
    draftOf: demandDraftFrom,
    violationsOf: demandInvariantViolations,
  });
}
