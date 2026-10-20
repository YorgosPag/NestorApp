/**
 * @fileoverview **Η απάντηση του αγοραστή από την οθόνη** — `POST /api/property-handover-invitations/redeem`.
 * @related ADR-916 Φ-Β2 · `app/api/property-handover-invitations/redeem/route.ts` · πρότυπο `redeemCaseInvitationFromScreen`
 * @module services/property-handover/property-handover-invitation.client
 *
 * 🔑 **Ποτέ δεν πετά** — κάθε αποτυχία είναι **ονομασμένη**: η οθόνη ξεχωρίζει την άρνηση του κόσμου (422, με λόγο από
 * το κλειστό λεξιλόγιο) από το «δεν μπόρεσα τώρα» (503 · δίκτυο · άγνωστος λόγος), που παίρνει «Δοκιμάστε ξανά».
 */

import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { invitationLinkRefusalOf } from '@/lib/invitations/invitation-link-refusal';
import type { InvitationRedeemAction } from '@/contracts/invitation-redeem-body';
import {
  PROPERTY_HANDOVER_INVITATION_REFUSALS,
  type PropertyHandoverInvitationRefusal,
} from '@/types/property-handover-invitation';

export type HandoverInvitationRedeemResult =
  /** `dossierId` = ο φάκελος του αγοραστή — η οθόνη τον ανοίγει. */
  | { readonly kind: 'accepted'; readonly dossierId: string }
  | { readonly kind: 'declined' }
  | { readonly kind: 'refused'; readonly reason: PropertyHandoverInvitationRefusal }
  | { readonly kind: 'failed' };

export async function redeemHandoverInvitationFromScreen(
  token: string,
  action: InvitationRedeemAction,
): Promise<HandoverInvitationRedeemResult> {
  try {
    const body = await apiClient.post<{ status: 'accepted'; dossierId: string } | { status: 'declined' }>(
      API_ROUTES.PROPERTY_HANDOVER_INVITATIONS.REDEEM, { token, action },
    );
    return body.status === 'accepted' ? { kind: 'accepted', dossierId: body.dossierId } : { kind: 'declined' };
  } catch (cause: unknown) {
    const reason = invitationLinkRefusalOf(cause, PROPERTY_HANDOVER_INVITATION_REFUSALS);
    return reason !== null ? { kind: 'refused', reason } : { kind: 'failed' };
  }
}
