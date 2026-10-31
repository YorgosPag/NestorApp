import 'server-only';

/**
 * @fileoverview `/supply-request/[token]` — ο δημόσιος σύνδεσμος/QR του προμηθευτή (ADR-923 §5.12 Σ2 πόρτα β).
 * @related `app/(auth)/supply-invite/[token]/page.tsx` · `server/supply-relationships/supply-request-link.server.ts`
 * @module app/(auth)/supply-request/[token]/page
 *
 * 🔑 Ο σύνδεσμος δεν απευθύνεται σε κανέναν (`addressedToViewer: null`): όποιος συνδεθεί ζητά, και ο προμηθευτής εγκρίνει.
 * 🔑 Ζει σε έντυπο κατάλογο, άρα η σελίδα δεν γράφει τίποτα και δεν καταναλώνει τίποτα στο άνοιγμα.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SupplyAccessContent } from '@/components/supply-access/SupplyAccessContent';
import { activeWorkspaceOf } from '@/lib/auth/workspace-membership';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { CORE_REFUSAL_IS_NOT_FOUND, invitationPageViewOf } from '@/lib/invitations/invitation-respond';
import { CREDENTIAL_LINK_PAGE_METADATA } from '@/lib/tokens/credential-link-page';
import { readInvitationPageRequest } from '@/server/invitations/invitation-page-request';
import { previewSupplyRequestLink } from '@/server/supply-relationships/supply-request-link.server';
import { actingViews } from '@/services/conveyance/conveyance-acting-workspace.server';
import { supplyRequestHref } from '@/subapps/catalog/catalog-routes';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = CREDENTIAL_LINK_PAGE_METADATA;

export default async function SupplyRequestPage({ params }: { params: Promise<{ token: string }> }): Promise<React.ReactElement> {
  const { token, viewerEmail, viewer } = await readInvitationPageRequest(params);
  const outcome = await previewSupplyRequestLink(getAdminFirestore(), token);
  if (outcome.kind === 'refused' && CORE_REFUSAL_IS_NOT_FOUND[outcome.reason]) notFound();

  const page = outcome.kind === 'preview' ? { ...outcome, addressedToViewer: null } : outcome;
  const view = invitationPageViewOf(page, { token, viewerEmail, invitationHref: supplyRequestHref(token) });
  if (view.kind !== 'preview') return <SupplyAccessContent door="link" view={view} />;
  const acceptance = viewer.ok ? await actingViews({ uid: viewer.ctx.uid, active: activeWorkspaceOf(viewer) }).acceptance() : null;
  return <SupplyAccessContent door="link" view={{ ...view, acceptance }} />;
}
