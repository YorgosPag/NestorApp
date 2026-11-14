import 'server-only';

/**
 * @fileoverview `/tour-invite/[token]` — η σελίδα της πρόσκλησης φωτογράφου (ADR-884 Φ0.5 · §4.5 Κ3α).
 * @related `app/(auth)/invite/[token]/page.tsx` (το πρότυπο) · `server/spatial-tour/tour-capture-invitation-preview.ts`
 * @module app/(auth)/tour-invite/[token]/page
 *
 * 🔑 **Η όψη πριν από κάθε ταυτότητα** (ADR-853 §5 #4): ο φωτογράφος φτάνει από email και βλέπει **πρώτα** ποιος τον
 * καλεί, για ποιο ακίνητο και ως πότε — **μετά** αποφασίζει αν θα συνδεθεί. Η ανάγνωση **δεν** καίει την πρόσκληση.
 * 🔴 **Ο σύνδεσμος που δεν δείχνει πουθενά απαντά 404** (ADR-853 §18 Ε-Η) — οι υπόλοιπες αρνήσεις περιγράφουν υπαρκτή
 * πρόσκληση και μένουν 200. **Εκτός χώρου εργασίας**: ο φωτογράφος δεν είναι μέλος (Φ0.5 · `workspace-scope.ts`).
 */

import type { Metadata } from 'next';

import { TourCaptureInviteContent, type TourCaptureInviteView } from '@/components/spatial-tour/TourCaptureInviteContent';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { invitationPageViewOf, type InvitationAccountStep } from '@/lib/invitations/invitation-respond';
import { tourCaptureInvitationHref } from '@/lib/spatial-tour/tour-routes';
import { CREDENTIAL_LINK_PAGE_METADATA } from '@/lib/tokens/credential-link-page';
import { readInvitationPageRequest, settleInvitationPage } from '@/server/invitations/invitation-page-request';
import {
  previewTourCaptureInvitation,
  type TourCaptureInvitationPreviewOutcome,
} from '@/server/spatial-tour/tour-capture-invitation-preview';

export const dynamic = 'force-dynamic';

// ADR-876 — noindex · no-referrer από το ΕΝΑ SSoT: ο σύνδεσμος φέρει διαπιστευτήριο στη διεύθυνση.
export const metadata: Metadata = CREDENTIAL_LINK_PAGE_METADATA;

function viewOf(
  outcome: TourCaptureInvitationPreviewOutcome,
  page: { readonly token: string; readonly viewerEmail: string | null; readonly account: InvitationAccountStep | undefined },
): TourCaptureInviteView {
  return invitationPageViewOf(outcome, { ...page, invitationHref: tourCaptureInvitationHref(page.token) });
}

export default async function TourCaptureInvitePage({ params }: { params: Promise<{ token: string }> }): Promise<React.ReactElement> {
  const { token, viewerEmail } = await readInvitationPageRequest(params);

  const outcome = await previewTourCaptureInvitation(getAdminFirestore(), { token, viewerEmail });
  // «Ανοίχτηκε» μετά την απόκριση · 404 · βήμα λογαριασμού (ADR-915 §39.6) — ο ΕΝΑΣ δρόμος όλων των σελίδων πρόσκλησης.
  const account = await settleInvitationPage(outcome);
  return <TourCaptureInviteContent view={viewOf(outcome, { token, viewerEmail, account })} />;
}
