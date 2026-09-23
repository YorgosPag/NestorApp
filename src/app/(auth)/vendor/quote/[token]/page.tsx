/**
 * /vendor/quote/[token] — Public vendor portal page (Server Component).
 *
 * Validates the HMAC token signature server-side (cheap, no DB hit on bad tokens),
 * loads invite + RFQ from Firestore via the service layer, then renders the
 * `VendorPortalClient` for form interaction.
 *
 * Token-bound credential. NO Firebase auth.
 *
 * 🔴 **ΓΙΑΤΙ ΣΤΟ `(auth)` ΚΑΙ ΟΧΙ ΣΤΟ `/o/[workspace]` (ADR-876).** Το `5ff0baa2` (ADR-787 §5.3)
 * την είχε βάλει κάτω από τον χώρο· ο φρουρός ταυτότητας του layout έστελνε **κάθε**
 * προμηθευτή — που εξ ορισμού δεν έχει λογαριασμό — στο `/login`. Μετρημένο στην παραγωγή.
 * Ίδια απάντηση με τα `contact/[token]` · `mandate/[token]`: η άδεια είναι το token.
 *
 * ⚠️ `force-dynamic` (CHECK 3.55) · metadata από το SSoT `credential-link-page` (noindex ·
 * no-referrer) — η άγκυρα `credential-link-page.test.ts` το απαιτεί.
 * ⚠️ `?intent=decline` = **μόνο** ανοιχτός διάλογος, ποτέ πράξη (Safe Links, ADR-876 Ε3).
 *
 * @module app/(auth)/vendor/quote/[token]/page
 * @enterprise ADR-327 §7 — Phase 3 Vendor Portal · ADR-876
 */

import 'server-only';

import type { Metadata } from 'next';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { CREDENTIAL_LINK_PAGE_METADATA } from '@/lib/tokens/credential-link-page';
import { validateVendorPortalTokenSignature } from '@/services/vendor-portal/vendor-portal-token-service';
import { getVendorInviteByToken } from '@/subapps/procurement/services/vendor-invite-service';
import { getRfq } from '@/subapps/procurement/services/rfq-service';
import { readVendorPortalIntent } from '@/subapps/procurement/services/vendor-portal-links';
import { VendorPortalErrorState } from './VendorPortalErrorState';
import { VendorPortalClient } from './VendorPortalClient';

export const dynamic = 'force-dynamic';

// ⚠️ Χωρίς `title`: εδώ ζούσε ωμό ελληνικό κείμενο (N.11). Όπως όλες οι σελίδες-διαπιστευτήρια,
//    ο τίτλος της καρτέλας είναι το όνομα του προϊόντος (`title.template` της ρίζας, ADR-857 Φ8α).
export const metadata: Metadata = CREDENTIAL_LINK_PAGE_METADATA;

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ intent?: string | string[] }>;
}

export default async function VendorQuotePage({ params, searchParams }: PageProps) {
  // ⚠️ Δύο χωριστές αποδομήσεις, ΟΧΙ `Promise.all`: η άγκυρα Γ6 (ADR-875 §10) διαβάζει
  //    `const { token… } = await params` για να αποδείξει ότι το token σπέρνεται από το API
  //    της εικόνας — ένα `Promise.all` την τύφλωνε (μετρημένο: η Γ6β κοκκίνισε).
  const { token: rawToken } = await params;
  const { intent } = await searchParams;
  const token = decodeRouteParam(rawToken);

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
      initialIntent={readVendorPortalIntent(intent)}
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
