import 'server-only';

/**
 * @fileoverview **ΤΙ ΞΕΡΕΙ ΜΙΑ ΣΕΛΙΔΑ ΠΡΟΣΚΛΗΣΗΣ ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΑΠΟΦΑΣΗ** — το token της διαδρομής και ποιος κοιτάζει.
 * @related ADR-853 §20 · `/tour-invite/[token]` (ADR-884 Κ3α) · `/case-invite/[token]` (ADR-901 Φ3)
 * @module server/invitations/invitation-page-request
 *
 * Εξήχθη 2026-10-03 (ADR-901 Φ3, CHECK 3.28): οι σελίδες φωτογράφου και υπόθεσης το έγραφαν δίδυμα.
 * ⚠️ Ποτέ ωμό `decodeURIComponent` (URIError ⇒ 500): χαλασμένη τιμή την απορρίπτει ο κριτής της υπογραφής.
 * ⚠️ Το cookie διαβάζεται, **δεν** φυλάει: αποφασίζει μόνο απάντηση / σύνδεση / «άλλος λογαριασμός» —
 *    η δέσμευση παραλήπτη κρίνεται ξανά στην εξαργύρωση.
 */

import { decodeRouteParam } from '@/lib/routes/route-param';
import { readPageIdentity, type PageIdentity } from '@/server/auth/page-identity';

export interface InvitationPageRequest {
  readonly token: string;
  readonly viewerEmail: string | null;
  /**
   * Ο θεατής **ολόκληρος** — για το είδος που πρέπει να πει κάτι **δικό του** πριν από το κλικ (ADR-901 §15 Γ1:
   * «για λογαριασμό ποιου γραφείου θα αναλάβετε»). Διαβάζεται **μία** φορά εδώ· η σελίδα δεν ξαναρωτά το cookie.
   */
  readonly viewer: PageIdentity;
}

export async function readInvitationPageRequest(params: Promise<{ readonly token: string }>): Promise<InvitationPageRequest> {
  const token = decodeRouteParam((await params).token);
  const viewer = await readPageIdentity();
  return { token, viewerEmail: viewer.ok ? viewer.ctx.email : null, viewer };
}
