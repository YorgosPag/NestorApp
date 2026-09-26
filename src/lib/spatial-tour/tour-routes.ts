/**
 * @fileoverview **ΟΙ ΔΙΕΥΘΥΝΣΕΙΣ ΤΗΣ ΧΩΡΙΚΗΣ ΠΕΡΙΗΓΗΣΗΣ** — ένας κατασκευαστής ανά σελίδα, ένα όνομα ανά τμήμα.
 * @related ADR-884 §4.5 (Κ3α) · `lib/workspace/workspace-routes.ts` (το πρότυπο του `/invite`) · `workspace-scope.ts`
 * @module lib/spatial-tour/tour-routes
 *
 * 🔑 Τα τμήματα ζουν **εδώ** και τα διαβάζει ο πίνακας εξαιρέσεων χώρου (`workspace-scope.ts`), όπως το
 * `WORKSPACE_INVITE_SEGMENT`: και οι δύο σελίδες είναι **εκτός** χώρου εργασίας — ο φωτογράφος **δεν** είναι μέλος
 * (Φ0.5), άρα δεν υπάρχει ψευδώνυμο να μπει στο πρόθεμα.
 *
 * **Layering**: leaf — καμία εξάρτηση.
 */

/** `/tour-invite/<token>` — η σελίδα της πρόσκλησης φωτογράφου (από το email, **πριν** από κάθε ταυτότητα). */
export const TOUR_INVITE_SEGMENT = 'tour-invite' as const;

/** `/tour-captures` — «Οι λήψεις μου»: οι άδειες λήψης του φωτογράφου, σε όποιον χώρο κι αν ανήκουν. */
export const TOUR_CAPTURES_SEGMENT = 'tour-captures' as const;

/**
 * **Ο σύνδεσμος του email πρόσκλησης φωτογράφου.** Ίδιο δόγμα με το `workspaceInvitationHref`: το token είναι στη
 * διεύθυνση **μόνο** εδώ (η πράξη το δέχεται σε σώμα), και η σελίδα ανοίγει **όψη** που δεν καταναλώνει.
 * ⚠️ `encodeURIComponent` **πάντα** — ο κατασκευαστής δεν εξαρτάται από τη σημερινή κωδικοποίηση του token.
 */
export function tourCaptureInvitationHref(token: string): string {
  return `/${TOUR_INVITE_SEGMENT}/${encodeURIComponent(token)}`;
}

/** «Οι λήψεις μου» — εκεί προσγειώνεται ο φωτογράφος μετά την αποδοχή. */
export function myTourCapturesHref(): string {
  return `/${TOUR_CAPTURES_SEGMENT}`;
}
