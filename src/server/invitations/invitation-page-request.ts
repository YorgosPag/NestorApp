import 'server-only';

/**
 * @fileoverview **ΤΙ ΞΕΡΕΙ ΜΙΑ ΣΕΛΙΔΑ ΠΡΟΣΚΛΗΣΗΣ ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΑΠΟΦΑΣΗ** — το token της διαδρομής και ποιος κοιτάζει.
 * @related ADR-853 §20 · `/tour-invite/[token]` (ADR-884 Κ3α) · `/case-invite/[token]` (ADR-901 Φ3)
 * @module server/invitations/invitation-page-request
 *
 * Εξήχθη 2026-10-03 (ADR-901 Φ3, CHECK 3.28): οι σελίδες φωτογράφου και υπόθεσης το έγραφαν δίδυμα.
 * ⚠️ Ποτέ ωμό `decodeURIComponent` (URIError ⇒ 500): χαλασμένη τιμή την απορρίπτει ο κριτής της υπογραφής.
 * 2026-11-14 (ADR-915 §39.6): και το `settleInvitationPage` — «ανοίχτηκε» · 404 · βήμα λογαριασμού — για τον ίδιο λόγο.
 * ⚠️ Το cookie διαβάζεται, **δεν** φυλάει: αποφασίζει μόνο απάντηση / σύνδεση / «άλλος λογαριασμός» —
 *    η δέσμευση παραλήπτη κρίνεται ξανά στην εξαργύρωση.
 */

import { notFound } from 'next/navigation';
import { after } from 'next/server';

import { CORE_REFUSAL_IS_NOT_FOUND, type InvitationAccountStep } from '@/lib/invitations/invitation-respond';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { readPageIdentity, type PageIdentity } from '@/server/auth/page-identity';

import { pageAccountStepOf } from './invitation-account-step';
import type { AddressedInvitationPreviewOutcome } from './invitation-preview-outcome';

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

/**
 * **Ό,τι κάνει κάθε σελίδα πρόσκλησης με παραλήπτη ΑΦΟΥ διαβάσει την όψη** (ADR-915 §39.6 — εξήχθη, CHECK 3.28):
 * «ανοίχτηκε» **μετά** την απόκριση (`after`, ποτέ δεν πετά) · σύνδεσμος που δεν δείχνει πουθενά ⇒ **404** · και το
 * βήμα λογαριασμού για θεατή που δεν είναι (ακόμη) ο παραλήπτης. Επιστρέφει το βήμα (ή `undefined`).
 */
export async function settleInvitationPage<P>(
  outcome: AddressedInvitationPreviewOutcome<P>,
): Promise<InvitationAccountStep | undefined> {
  if (outcome.kind === 'preview') after(outcome.markOpened);
  if (outcome.kind === 'refused' && CORE_REFUSAL_IS_NOT_FOUND[outcome.reason]) notFound();
  return pageAccountStepOf(outcome.kind === 'preview' ? outcome : null);
}
