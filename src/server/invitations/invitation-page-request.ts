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
import { readPageIdentity } from '@/server/auth/page-identity';

export async function readInvitationPageRequest(
  params: Promise<{ readonly token: string }>,
): Promise<{ readonly token: string; readonly viewerEmail: string | null }> {
  const token = decodeRouteParam((await params).token);
  const identity = await readPageIdentity();
  return { token, viewerEmail: identity.ok ? identity.ctx.email : null };
}
