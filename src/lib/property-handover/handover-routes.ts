/**
 * @fileoverview **Η διεύθυνση της πρόσκλησης αγοραστή** — ένα τμήμα, ένας κατασκευαστής (ADR-916 Φ-Β).
 * @related lib/spatial-tour/tour-routes.ts · lib/conveyance/conveyance-routes.ts (τα πρότυπα) · `workspace-scope.ts`
 * @module lib/property-handover/handover-routes
 *
 * 🔑 **Εκτός χώρου εργασίας**: ο αγοραστής φτάνει από email πριν από κάθε ταυτότητα και **δεν** θα γίνει ποτέ μέλος
 * του γραφείου που πούλησε — παίρνει τον **δικό του** φάκελο, στον προσωπικό του χώρο. Μία σελίδα **ανά είδος**: το
 * token δεν φέρει είδος, το κρίνει το μυστικό.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 */

/** `/handover-invite/<token>` — η σελίδα της πρόσκλησης αγοραστή (από το email, **πριν** από κάθε ταυτότητα). */
export const HANDOVER_INVITE_SEGMENT = 'handover-invite' as const;

/**
 * **Ο σύνδεσμος του email.** Το token είναι στη διεύθυνση **μόνο** εδώ (η πράξη το δέχεται σε σώμα) και η σελίδα
 * ανοίγει **όψη** που δεν καταναλώνει. ⚠️ `encodeURIComponent` **πάντα**.
 */
export function handoverInvitationHref(token: string): string {
  return `/${HANDOVER_INVITE_SEGMENT}/${encodeURIComponent(token)}`;
}
