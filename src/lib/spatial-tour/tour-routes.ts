/**
 * @fileoverview **ΟΙ ΔΙΕΥΘΥΝΣΕΙΣ ΤΗΣ ΧΩΡΙΚΗΣ ΠΕΡΙΗΓΗΣΗΣ** — ένας κατασκευαστής ανά σελίδα, ένα όνομα ανά τμήμα.
 * @related ADR-884 §4.5 (Κ3α) · `lib/workspace/workspace-routes.ts` (το πρότυπο του `/invite`) · `workspace-scope.ts`
 * @module lib/spatial-tour/tour-routes
 *
 * 🔑 Τα τμήματα ζουν **εδώ** και τα διαβάζει ο πίνακας εξαιρέσεων χώρου (`workspace-scope.ts`), όπως το
 * `WORKSPACE_INVITE_SEGMENT`: και οι δύο σελίδες είναι **εκτός** χώρου εργασίας — ο φωτογράφος **δεν** είναι μέλος
 * (Φ0.5), άρα δεν υπάρχει ψευδώνυμο να μπει στο πρόθεμα.
 *
 * **Layering**: leaf — μόνο SSoT διαδρομών (αγγελία · καταχώρηση ιδιώτη · καρτέλα ακινήτου).
 */

import type { PlaceSource } from '@/constants/place-sources';
import { LISTING_DETAIL_ROUTE_BASE } from '@/lib/listings/listing-routes';
import { offerTourHref } from '@/lib/owner-property/owner-property-routes';
import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import { typedHref } from '@/lib/workspace/route-worlds';

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

/** `/listing/<id>/tour` — η σελίδα θέασης: κάτω από τη δημόσια αγγελία, αφού η ταυτότητα αγγελίας **είναι** η ρίζα (Κ3β). */
export const TOUR_VIEW_SEGMENT = 'tour' as const;

/**
 * **Η σελίδα θέασης μιας περιήγησης** — ίδια για επισκέπτη, εγκεκριμένο αιτούντα και υπεύθυνο· η **πύλη θέασης**
 * αποφασίζει τι βλέπει ο καθένας, όχι η διεύθυνση. Χτίζεται πάνω στο `LISTING_DETAIL_ROUTE_BASE` (ένα σημείο ξέρει
 * το `/listing`), χωρίς τα φίλτρα αναζήτησης: ο σύνδεσμος ταξιδεύει σε email.
 */
export function tourViewHref(listingId: string) {
  // ίδιο ιδίωμα με το `listingDetailHref`: η κατασκευή ελέγχεται από τον `typedHref` στο **ένα** σημείο ορισμού.
  const path = `${LISTING_DETAIL_ROUTE_BASE}/${encodeURIComponent(listingId)}/${TOUR_VIEW_SEGMENT}` as const;
  return typedHref(path);
}

/**
 * **Πού διαχειρίζεται ο υπεύθυνος την περιήγηση** — γραφείο ⇒ η καρτέλα του ακινήτου (το πάνελ είναι ενσωματωμένο)·
 * ιδιώτης ⇒ η σελίδα περιήγησης της καταχώρησής του (χωριστή σελίδα, ADR-744 §20 — βλ. `offerTourHref`).
 */
export function tourManageHref(subject: { readonly kind: PlaceSource; readonly id: string }): string {
  return subject.kind === 'company-property' ? ENTITY_ROUTES.properties.withId(subject.id) : offerTourHref(subject.id);
}
