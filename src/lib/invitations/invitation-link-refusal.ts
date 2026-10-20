/**
 * @fileoverview **ΓΙΑΤΙ Ο ΣΥΝΔΕΣΜΟΣ ΔΕΝ ΔΟΥΛΕΨΕ;** — ο ΕΝΑΣ αναγνώστης του 422 `LINK_REFUSED` κάθε πόρτας εξαργύρωσης.
 * @related ADR-853 §20 · ADR-916 Φ-Β2 · `contracts/invitation-redeem-body.ts` (`INVITATION_REDEEM_REFUSED_STATUS`) ·
 *          `server/invitations/invitation-http.ts` (`InvitationLinkRefusedBody` — η πλευρά του διακομιστή)
 * @module lib/invitations/invitation-link-refusal
 *
 * Εξήχθη 2026-10-20 (ADR-916 Φ-Β2, N.0.2): η **ίδια** ανάγνωση ζούσε τρεις φορές (χώρος · φωτογράφος · υπόθεση) και η
 * σελίδα αγοραστή θα ήταν η τέταρτη. Κάθε είδος δίνει **μόνο** το κλειστό λεξιλόγιό του.
 *
 * ⚠️ **Ο διακριτής ελέγχεται ΠΡΩΤΟΣ** (`error === 'LINK_REFUSED'`) και **μετά** ο λόγος, στο κλειστό σύνολο: ένα `reason`
 * από **άλλη** διαδρομή δεν διαβάζεται ως δικό μας. Άγνωστος λόγος ⇒ `null` ⇒ η οθόνη λέει το γενικό μήνυμα — **ποτέ**
 * ωμός κωδικός σε σελίδα που τη βλέπει άνθρωπος από email.
 */

import { apiErrorBodyOf } from '@/lib/api/enterprise-api-client';
import { isOneOf } from '@/lib/type-guards';

export function invitationLinkRefusalOf<R extends string>(cause: unknown, refusals: readonly R[]): R | null {
  const body = apiErrorBodyOf(cause);
  if (body === null || body.error !== 'LINK_REFUSED') return null;
  return isOneOf(refusals, body.reason) ? body.reason : null;
}
