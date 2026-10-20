import 'server-only';

/**
 * @fileoverview `/handover-invite/[token]` — η σελίδα της πρόσκλησης αγοραστή στον φάκελο του σπιτιού του (ADR-916 Φ-Β2).
 * @related `app/(auth)/case-invite/[token]/page.tsx` (το πρότυπο) · `server/property-handover-invitations/handover-invitation-preview.ts`
 * @module app/(auth)/handover-invite/[token]/page
 *
 * 🔑 **Η όψη πριν από κάθε ταυτότητα** (ADR-853 §5 #4): ο αγοραστής φτάνει από email και βλέπει **πρώτα** ποια εταιρεία
 * του δίνει τον φάκελο ποιου σπιτιού — **μετά** συνδέεται ή εγγράφεται. Η ανάγνωση **δεν** καίει την πρόσκληση.
 * 🔴 Ο σύνδεσμος που δεν δείχνει πουθενά απαντά **404** (ADR-853 §18 Ε-Η).
 * **Εκτός χώρου εργασίας**: ο αγοραστής δεν γίνεται ποτέ μέλος του γραφείου που πούλησε (`workspace-scope.ts`).
 * 🔑 **Μία σελίδα ανά είδος**: το token δεν φέρει είδος — το κρίνει το **μυστικό** του.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { after } from 'next/server';

import { HandoverInviteContent } from '@/components/handover-invite/HandoverInviteContent';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { CORE_REFUSAL_IS_NOT_FOUND, invitationPageViewOf } from '@/lib/invitations/invitation-respond';
import { handoverInvitationHref } from '@/lib/property-handover/handover-routes';
import { CREDENTIAL_LINK_PAGE_METADATA } from '@/lib/tokens/credential-link-page';
import { readInvitationPageRequest } from '@/server/invitations/invitation-page-request';
import { previewHandoverInvitation } from '@/server/property-handover-invitations/handover-invitation-preview';

export const dynamic = 'force-dynamic';

// ADR-876 — noindex · no-referrer από το ΕΝΑ SSoT: ο σύνδεσμος φέρει διαπιστευτήριο στη διεύθυνση.
export const metadata: Metadata = CREDENTIAL_LINK_PAGE_METADATA;

export default async function HandoverInvitePage({ params }: { params: Promise<{ token: string }> }): Promise<React.ReactElement> {
  const { token, viewerEmail } = await readInvitationPageRequest(params);

  const outcome = await previewHandoverInvitation(getAdminFirestore(), { token, viewerEmail });
  // «Ανοίχτηκε» ΜΕΤΑ την απόκριση, μόνο την πρώτη φορά — ποτέ δεν πετά.
  if (outcome.kind === 'preview') after(outcome.markOpened);
  if (outcome.kind === 'refused' && CORE_REFUSAL_IS_NOT_FOUND[outcome.reason]) notFound();

  return (
    <HandoverInviteContent
      view={invitationPageViewOf(outcome, { token, viewerEmail, invitationHref: handoverInvitationHref(token) })}
    />
  );
}
