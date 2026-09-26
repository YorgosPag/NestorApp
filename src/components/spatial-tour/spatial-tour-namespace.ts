/**
 * @fileoverview **ΤΟ ΟΝΟΜΑ ΤΗΣ ΒΑΣΗΣ** της ροής φωτογράφου — μία φορά (πρότυπο `workspace-invite-namespace.ts`, ADR-744).
 * @related ADR-884 Φ0.10 · §4.5 (Κ3α) · `spatial-tour-labels.ts`
 * @module components/spatial-tour/spatial-tour-namespace
 *
 * 🔑 Χωριστό αρχείο **χωρίς κλειδιά**: ο καταναλωτής που θέλει μόνο το όνομα δεν σέρνει τον πίνακα κλειδιών στη
 * στατική του κλειστότητα. **Έξω** από το δημόσιο κέλυφος (Φ0.10) — φορτώνεται μόνο εκεί που χρειάζεται.
 */
export const SPATIAL_TOUR_NS = 'spatial-tour';
