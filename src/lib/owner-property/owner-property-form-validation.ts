/**
 * @fileoverview **ΤΙ ΛΕΙΠΕΙ ΑΠΟ ΤΗ ΦΟΡΜΑ ΠΡΟΣΦΟΡΑΣ** — όλα μαζί, ποτέ ένα τη φορά.
 * @related ADR-777 §7 (Α14 §17.2 · Α22) · types/owner-property.ts · lib/forms/draft-validation.ts
 * @module lib/owner-property/owner-property-form-validation
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΚΑΜΙΑ ΝΕΑ ΜΗΧΑΝΗ — ΤΟ ΛΕΞΙΛΟΓΙΟ ΕΙΝΑΙ ΤΟ ΜΟΝΟ ΠΟΥ ΔΙΑΦΕΡΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο σκελετός (τρεις ερωτήσεις, σειρά-συμβόλαιο, «όλα μαζί») ζει στο
 * {@link validateDraftForm}. Εδώ δένεται με το λεξιλόγιο της **προσφοράς**.
 *
 * ⚠️ **Ο τρίτος κριτής είναι η ΙΔΙΑ συνάρτηση που φρουρεί την πύλη γραφής στον
 * ΔΙΑΚΟΜΙΣΤΗ** ({@link ownerPropertyInvariantViolations}, καλείται από το
 * `app/api/owner-properties/route.ts`). Δεν είναι διπλός έλεγχος — είναι **ο ίδιος**
 * έλεγχος σε δύο σημεία: η φόρμα τον τρέχει για να **δείξει** το σφάλμα, ο
 * διακομιστής γιατί **δεν εμπιστεύεται καμία φόρμα**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΧΕΤΑΙ ΤΗΝ ΠΗΓΗ ΤΑΥΤΟΤΗΤΩΝ, ΕΝΩ Η ΖΗΤΗΣΗ ΔΕΝ ΔΕΧΕΤΑΙ ΤΙΠΟΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η ζήτηση είναι **ένα** έγγραφο με **επίπεδους** άξονες. Η προσφορά περιέχει
 * **διαθέσεις**, και κάθε διάθεση έχει **δική της ταυτότητα** (`offr_*`) πάνω στην
 * οποία στηρίζεται η **Α20 σημείο 4** (*«το κλείσιμο μιας διάθεσης αποσύρει τις
 * άλλες»*). Άρα η σύνθεση του προσχεδίου **δεν είναι** συνάρτηση μόνο των τιμών: σε
 * **επεξεργασία** πρέπει να κρατήσει τις υπάρχουσες ταυτότητες, αλλιώς κάθε
 * αποθήκευση θα γεννούσε **νέες διαθέσεις** και το ιστορικό θα έσπαγε σιωπηλά.
 *
 * **Layering**: leaf — καθαρή συνάρτηση.
 */

import {
  validateDraftForm,
  type DraftFormValidation,
} from '@/lib/forms/draft-validation';
import type { OwnerPropertyDraft } from '@/types/owner-property';
import {
  ownerPropertyInvariantViolations,
  type OwnerPropertyInvariant,
} from '@/types/owner-property-invariants';
import {
  ownerPropertyDraftFrom,
  ownerPropertyFormBlockers,
  ownerPropertyFormSchema,
  type OfferIdentitySource,
  type OwnerPropertyFormBlocker,
  type OwnerPropertyFormValues,
} from './owner-property-form-values';

/** Η πλήρης εικόνα της φόρμας προσφοράς. */
export type OwnerPropertyFormValidation = DraftFormValidation<
  OwnerPropertyDraft,
  OwnerPropertyFormBlocker,
  OwnerPropertyInvariant
>;

/** **Τιμές φόρμας προσφοράς → μπορεί να σταλεί;** */
export function validateOwnerPropertyForm(
  values: OwnerPropertyFormValues,
  offerIdentity: OfferIdentitySource,
): OwnerPropertyFormValidation {
  return validateDraftForm(values, {
    schema: ownerPropertyFormSchema,
    blockersOf: ownerPropertyFormBlockers,
    draftOf: (parsed) => ownerPropertyDraftFrom(parsed, offerIdentity),
    violationsOf: ownerPropertyInvariantViolations,
  });
}
