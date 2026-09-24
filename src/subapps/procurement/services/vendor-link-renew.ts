/**
 * =============================================================================
 * «ΣΤΕΙΛΕ ΜΟΥ ΝΕΟ ΣΥΝΔΕΣΜΟ» — αυτοεξυπηρέτηση λήξης της πύλης προμηθευτή (ADR-876 §5 Φ4)
 * =============================================================================
 *
 * Ο προμηθευτής ανοίγει ληγμένο σύνδεσμο → κουμπί → νέος σύνδεσμος στο **καταχωρημένο** email
 * της πρόσκλησης (DocuSign: «Request a new link»). Ποτέ σε διεύθυνση που δίνει ο αιτών: ο
 * σύνδεσμος στο πρόχειρο ενός τρίτου δεν τον κάνει παραλήπτη (BuildingConnected: πρόσκληση δεμένη
 * με το email).
 *
 * 🔑 **Τι αρνείται** (ο αναλυτής ήδη κόβει ανακλημένο σύνδεσμο/πρόσκληση και αρνημένη ή
 * υποβεβλημένη πρόσκληση): RFQ που δεν δέχεται πια προσφορές, πρόσκληση χωρίς παραλήπτη,
 * εξαντλημένη ποσόστωση παραλήπτη. Ο **καλών** απαντά σε όλα το ίδιο ουδέτερο 202 — η έκβαση
 * επιστρέφεται μόνο για το log.
 *
 * Λήξη νέου συνδέσμου = min(τώρα + {@link VENDOR_LINK_LIFETIME_DAYS}, προθεσμία RFQ).
 *
 * @module subapps/procurement/services/vendor-link-renew
 * @enterprise ADR-876 §5
 */

import 'server-only';

import { VENDOR_LINK_RENEW_RECIPIENT_QUOTA } from '@/lib/middleware/rate-limit-config';
import { withinRecipientQuota } from '@/lib/middleware/recipient-quota';
import { vendorLinkExpiryMs } from '@/services/vendor-portal/vendor-invite-credential';

import type { VendorInvite } from '../types/vendor-invite';
import type { RFQ } from '../types/rfq';
import { resolveChannel } from './channels';
import { getRfq } from './rfq-service';
import { issueAdditionalVendorLink } from './vendor-invite-issue';
import { resolveInviteRecipient } from './vendor-invite-links-service';

/** Οι καταστάσεις RFQ που **δέχονται** ακόμη προσφορές. */
const RFQ_ACCEPTING: ReadonlySet<RFQ['status']> = new Set(['draft', 'active']);

const RENEW_QUOTA_SCOPE = 'vendor-link-renew';

export type VendorLinkRenewOutcome = 'sent' | 'rfq_closed' | 'no_recipient' | 'quota_exhausted' | 'delivery_failed';

export interface RenewVendorLinkInput {
  readonly invite: VendorInvite;
  readonly requesterIpHash: string;
  readonly locale: 'el' | 'en';
  readonly nowMs?: number;
}

/** Η λήξη του νέου συνδέσμου — `null` ⇒ η προθεσμία του RFQ πέρασε. */
export function renewedLinkExpiryMs(rfq: Pick<RFQ, 'deadlineDate'>, nowMs: number): number | null {
  const lifetime = vendorLinkExpiryMs(nowMs);
  const deadlineMs = rfq.deadlineDate?.toMillis() ?? null;
  if (deadlineMs === null) return lifetime;
  return deadlineMs <= nowMs ? null : Math.min(lifetime, deadlineMs);
}

export async function renewVendorLink(input: RenewVendorLinkInput): Promise<VendorLinkRenewOutcome> {
  const nowMs = input.nowMs ?? Date.now();
  const { invite } = input;
  const rfq = await getRfq(invite.companyId, invite.rfqId);
  if (!rfq || !RFQ_ACCEPTING.has(rfq.status)) return 'rfq_closed';
  const expiresAtMs = renewedLinkExpiryMs(rfq, nowMs);
  if (expiresAtMs === null) return 'rfq_closed';

  const recipient = await resolveInviteRecipient(invite);
  const emailChannel = resolveChannel('email');
  if (!recipient || !emailChannel) return 'no_recipient';
  if (!(await withinRecipientQuota(RENEW_QUOTA_SCOPE, recipient.email, VENDOR_LINK_RENEW_RECIPIENT_QUOTA))) {
    return 'quota_exhausted';
  }

  const link = await issueAdditionalVendorLink({
    invite,
    issuedVia: 'self_service',
    issuedBy: null,
    expiresAtMs,
    requesterIpHash: input.requesterIpHash,
  });
  const dispatch = await emailChannel.send({
    inviteId: invite.id,
    vendorName: recipient.name,
    recipient: recipient.email,
    rfqTitle: rfq.title,
    projectName: null,
    portalUrl: link.portalUrl,
    expiresAt: link.expiresAtIso,
    locale: input.locale,
    declineUrl: link.declineUrl,
  });
  return dispatch.success ? 'sent' : 'delivery_failed';
}
