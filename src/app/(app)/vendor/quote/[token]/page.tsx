/**
 * /vendor/quote/[token] — Public vendor portal page (Server Component).
 *
 * Validates the HMAC token signature server-side (cheap, no DB hit on bad tokens),
 * loads invite + RFQ from Firestore via the service layer, then renders the
 * `VendorPortalClient` for form interaction.
 *
 * Token-bound credential. NO Firebase auth.
 *
 * @module app/vendor/quote/[token]/page
 * @enterprise ADR-327 §7 — Phase 3 Vendor Portal
 */

import 'server-only';

import type { Metadata } from 'next';
import { validateVendorPortalTokenSignature } from '@/services/vendor-portal/vendor-portal-token-service';
import { getVendorInviteByToken } from '@/subapps/procurement/services/vendor-invite-service';
import { getRfq } from '@/subapps/procurement/services/rfq-service';
import { VendorPortalErrorState } from './VendorPortalErrorState';
import { VendorPortalClient } from './VendorPortalClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Υποβολή Προσφοράς | Nestor',
  description: 'Πύλη υποβολής προσφοράς προμηθευτή',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function VendorQuotePage({ params }: PageProps) {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken);

  const sig = validateVendorPortalTokenSignature(token);
  if (!sig.valid) {
    return <VendorPortalErrorState reason={sig.reason} />;
  }

  const invite = await getVendorInviteByToken(token);
  if (!invite) return <VendorPortalErrorState reason="invite_not_found" />;
  if (invite.status === 'declined') return <VendorPortalErrorState reason="token_revoked" />;
  if (invite.status === 'expired') return <VendorPortalErrorState reason="token_expired" />;

  const rfq = await getRfq(invite.companyId, invite.rfqId);
  if (!rfq) return <VendorPortalErrorState reason="invite_not_found" />;

  const editWindowOpen =
    invite.status === 'submitted' &&
    !!invite.editWindowExpiresAt &&
    invite.editWindowExpiresAt.toDate() > new Date();

  return (
    <VendorPortalClient
      token={token}
      initialData={{
        invite: {
          id: invite.id,
          status: invite.status,
          rfqId: invite.rfqId,
          vendorContactId: invite.vendorContactId,
          expiresAt: invite.expiresAt.toDate().toISOString(),
          editWindowExpiresAt: invite.editWindowExpiresAt?.toDate().toISOString() ?? null,
          editWindowOpen,
        },
        rfq: {
          id: rfq.id,
          title: rfq.title,
          description: rfq.description,
          lines: rfq.lines.map((line) => ({
            id: line.id,
            description: line.description,
            trade: line.trade,
            quantity: line.quantity,
            unit: line.unit,
            notes: line.notes,
          })),
          deadlineDate: rfq.deadlineDate?.toDate().toISOString() ?? null,
        },
      }}
    />
  );
}
