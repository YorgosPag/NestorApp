import 'server-only';

/**
 * @fileoverview `/supply-invite/[token]` — η πρόσκληση σε σχέση προμήθειας, για τον αγοραστή (ADR-923 §5.12 Σ2 πόρτα α).
 * @related `app/(auth)/case-invite/[token]/page.tsx` (το πρότυπο) · `server/supply-relationships/supply-invitation-redeem.server.ts`
 * @module app/(auth)/supply-invite/[token]/page
 *
 * 🔑 **Η όψη πριν από κάθε ταυτότητα**: ποιος σας καλεί, τι ανοίγει. Η ανάγνωση **δεν** καίει την πρόσκληση.
 * **Εκτός χώρου εργασίας**: ο σύνδεσμος του email ανήκει στον άνθρωπο, και τον χώρο τον δηλώνει εκείνος εδώ (Σ3).
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { after } from 'next/server';

import { SupplyAccessContent } from '@/components/supply-access/SupplyAccessContent';
import { activeWorkspaceOf } from '@/lib/auth/workspace-membership';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { CORE_REFUSAL_IS_NOT_FOUND, invitationPageViewOf } from '@/lib/invitations/invitation-respond';
import { CREDENTIAL_LINK_PAGE_METADATA } from '@/lib/tokens/credential-link-page';
import { readInvitationPageRequest } from '@/server/invitations/invitation-page-request';
import { previewSupplyInvitation } from '@/server/supply-relationships/supply-invitation-redeem.server';
import { actingViews } from '@/services/conveyance/conveyance-acting-workspace.server';
import { supplyInvitationHref } from '@/subapps/catalog/catalog-routes';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = CREDENTIAL_LINK_PAGE_METADATA;

export default async function SupplyInvitePage({ params }: { params: Promise<{ token: string }> }): Promise<React.ReactElement> {
  const { token, viewerEmail, viewer } = await readInvitationPageRequest(params);
  const outcome = await previewSupplyInvitation(getAdminFirestore(), { token, viewerEmail });
  if (outcome.kind === 'preview') after(outcome.markOpened);
  if (outcome.kind === 'refused' && CORE_REFUSAL_IS_NOT_FOUND[outcome.reason]) notFound();

  const view = invitationPageViewOf(outcome, { token, viewerEmail, invitationHref: supplyInvitationHref(token) });
  if (view.kind !== 'preview') return <SupplyAccessContent door="invitation" view={view} />;
  // Για ποιο γραφείο: ο ίδιος κριτής με την πράξη, μόνο για τον συνδεδεμένο στον οποίο απευθύνεται.
  const addressed = outcome.kind === 'preview' && outcome.addressedToViewer === true && viewer.ok;
  const acceptance = addressed ? await actingViews({ uid: viewer.ctx.uid, active: activeWorkspaceOf(viewer) }).acceptance() : null;
  return <SupplyAccessContent door="invitation" view={{ ...view, acceptance }} />;
}
