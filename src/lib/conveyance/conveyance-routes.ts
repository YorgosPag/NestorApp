/**
 * @fileoverview **Οι διευθύνσεις «Οι υποθέσεις μου»** — γραμμένες μία φορά (ADR-901 §5.4 · Φ2 · §15 Γ2).
 * @related ADR-862 Φ1 (συμμετοχή) · lib/contact/first-contact-routes.ts (το πρότυπο) · workspace-scope.ts
 * @module lib/conveyance/conveyance-routes
 *
 * 🔑 **ΔΥΟ ΣΠΙΤΙΑ, ΕΝΑ ΑΝΑ ΕΙΔΟΣ ΧΩΡΟΥ** (ADR-901 §15.6.5 · ✅ Ε-9 = α):
 *
 * | Σπίτι | Διεύθυνση | Πότε |
 * |---|---|---|
 * | **γραφείο** (μόνιμο) | `/o/<γραφείο>/cases` | η υπόθεση αναλήφθηκε **για λογαριασμό γραφείου** (`actingFor.kind = 'org'`) |
 * | **προσωπικός** (προσωρινό) | `/engagements` | ο άνθρωπος **δεν έχει** ακόμη γραφείο (Α1) — ή συμμετοχή πριν από το §15 |
 *
 * 🔴 **ΓΙΑΤΙ ΔΥΟ ΤΜΗΜΑΤΑ ΚΑΙ ΟΧΙ ΕΝΑ**: ο κριτής `isInsideWorkspace` απαντά **ανά τμήμα** — ένα τμήμα με δύο
 * ιδιοκτήτες σημαίνει ότι ο ένας **χάνει** (η ζωντανή βλάβη του `/contacts`, 2026-09-04· κανόνας Κ3 της CHECK 3.60).
 * Το κανονικό όνομα πάει στο **μόνιμο** σπίτι· το προσωρινό παίρνει τη λέξη του API (`/api/engagements`) και της
 * συλλογής (`engagements`) — διεύθυνση = API = βάση, όπως το `first-contacts`.
 *
 * 🔑 **Ο δικηγόρος δεν μπαίνει ΠΟΤΕ στον χώρο του ΟΙΚΟΔΕΣΠΟΤΗ** (ADR-862 §9): το `/o/<γραφείο>` εδώ είναι το **δικό
 * του** γραφείο, όπου είναι ήδη μέλος για άλλον λόγο. Η πρόσβαση στην υπόθεση κρίνεται **ανά πόρο**
 * (`decideEngagement`, `engagement.uid === uid`) — το πρόθεμα απαντά «πού φαίνεται», ποτέ «ποιος βλέπει».
 *
 * 🔑 **Η διεύθυνση φέρει τη ΣΥΜΜΕΤΟΧΗ, όχι την υπόθεση**: το `cvc_…` λέει *τι*, το `eng_…` λέει *με ποιο
 * δικαίωμα* — και το δεύτερο είναι αυτό που ο server κρίνει. Διεύθυνση με ταυτότητα υπόθεσης θα ήταν
 * όργανο απαρίθμησης.
 *
 * **Layering**: leaf — μόνο σταθερές και σύνθεση συμβολοσειρών.
 */

import { typedHref } from '@/lib/workspace/route-worlds';
import type { WorkspaceRef } from '@/types/workspace-membership';

/**
 * **Σε ποιο είδος χώρου ζει μια υπόθεση** — το λεξιλόγιο του {@link WorkspaceRef}, όχι δεύτερο.
 * Το δηλώνει το **κέλυφος** της σελίδας (γραφείο · προσωπικός) και το φέρει κάθε διεύθυνση υπόθεσης.
 */
export type CaseHome = WorkspaceRef['kind'];

/** Το κλειστό σύνολο — για το σχήμα του σύρματος (`?home=`), ώστε να μη γραφτεί δεύτερη φορά. */
export const CASE_HOMES = ['org', 'personal'] as const satisfies readonly CaseHome[];

/** Η παράμετρος με την οποία η σελίδα **δηλώνει το είδος της** στον διακομιστή (ποτέ ταυτότητα χώρου). */
export const CASE_HOME_PARAM = 'home' as const;

/** Το τμήμα των υποθέσεων **μέσα** στον χώρο του γραφείου — ΕΝΑ όνομα (και για το προσωπικό του δίδυμο). */
export const OFFICE_CASES_SEGMENT = 'cases' as const;

/** **Οι υποθέσεις του γραφείου** — χωρίς πρόθεμα· το βάζει το σύνορο πλοήγησης (`/o/<γραφείο>/cases`). */
export const OFFICE_CASES_ROUTE = `/${OFFICE_CASES_SEGMENT}` as const;

/** Το τμήμα των υποθέσεων στον **προσωπικό** χώρο — δηλωμένο **εκτός** χώρου (`OUTSIDE_WORKSPACE`). */
export const PERSONAL_CASES_SEGMENT = 'engagements' as const;

/** **Οι υποθέσεις του ανθρώπου χωρίς γραφείο** — προσωρινό σπίτι (ADR-901 Α1 · Α1β). */
export const PERSONAL_CASES_ROUTE = `/${PERSONAL_CASES_SEGMENT}` as const;

/** Η λίστα των υποθέσεων **αυτού** του είδους χώρου. */
export function myCasesRoute(home: CaseHome) {
  return home === 'org' ? OFFICE_CASES_ROUTE : PERSONAL_CASES_ROUTE;
}

/**
 * Η σελίδα **μιας** υπόθεσης, μέσω της συμμετοχής του θεατή — στο σπίτι της.
 *
 * ⚠️ Το `home` έρχεται από τη **συμμετοχή** (`actingWorkspaceOf(engagement).kind`), όχι από το πού έτυχε να
 * βρίσκεται ο άνθρωπος: σύνδεσμος προς υπόθεση γραφείου γραμμένος μέσα στον προσωπικό χώρο είναι `/cases/…`.
 */
export function myCaseHref(engagementId: string, home: CaseHome) {
  const id = encodeURIComponent(engagementId);
  return home === 'org' ? typedHref(`${OFFICE_CASES_ROUTE}/${id}`) : typedHref(`${PERSONAL_CASES_ROUTE}/${id}`);
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
