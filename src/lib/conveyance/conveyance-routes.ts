/**
 * @fileoverview **Οι διευθύνσεις «Οι υποθέσεις μου»** — γραμμένες μία φορά (ADR-901 §5.4 · Φ2).
 * @related ADR-862 Φ1 (συμμετοχή) · lib/property-dossier/property-dossier-routes.ts · workspace-scope.ts
 * @module lib/conveyance/conveyance-routes
 *
 * 🔑 **`/cases`** — η ονομασία «Οι υποθέσεις μου» (✅ ADR-901 Ε-2). Ζει στο route group `(me)`, **εκτός**
 * προθέματος χώρου (`OUTSIDE_WORKSPACE`, CHECK 3.60): η υπόθεση ανήκει στον χώρο του **οικοδεσπότη**, ο
 * επαγγελματίας τη βλέπει από τον **δικό του** — ποτέ ως μέλος του ξένου γραφείου (ADR-862 §9).
 *
 * 🔑 **Η διεύθυνση φέρει τη ΣΥΜΜΕΤΟΧΗ, όχι την υπόθεση**: το `cvc_…` λέει *τι*, το `eng_…` λέει *με ποιο
 * δικαίωμα* — και το δεύτερο είναι αυτό που ο server κρίνει. Διεύθυνση με ταυτότητα υπόθεσης θα ήταν
 * όργανο απαρίθμησης.
 *
 * **Layering**: leaf — μόνο σταθερές και σύνθεση συμβολοσειρών.
 */

import { typedHref } from '@/lib/workspace/route-worlds';

/** **Οι υποθέσεις μου** — κάθε συμμετοχή του ανθρώπου σε ξένη υπόθεση. */
export const MY_CASES_ROUTE = '/cases' as const;

/** Η σελίδα **μιας** υπόθεσης, μέσω της συμμετοχής του θεατή. */
export function myCaseHref(engagementId: string) {
  return typedHref(`${MY_CASES_ROUTE}/${encodeURIComponent(engagementId)}`);
}

/** Ο φάκελος της σελίδας πρόσκλησης υπόθεσης (`app/(auth)/case-invite/[token]`) — ΕΝΑ όνομα. */
export const CASE_INVITE_SEGMENT = 'case-invite' as const;

/**
 * **Ο σύνδεσμος του email πρόσκλησης υπόθεσης** (ADR-901 Φ3). Ίδιο δόγμα με τα `workspaceInvitationHref` /
 * `tourCaptureInvitationHref`: το token είναι στη διεύθυνση **μόνο** εδώ (η πράξη το δέχεται σε σώμα), και η σελίδα
 * ανοίγει **όψη** που δεν καταναλώνει. Μία σελίδα **ανά είδος**: το token δεν φέρει είδος — το κρίνει το μυστικό.
 */
export function caseInvitationHref(token: string): string {
  return `/${CASE_INVITE_SEGMENT}/${encodeURIComponent(token)}`;
}
