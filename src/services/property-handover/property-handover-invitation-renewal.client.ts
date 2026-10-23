/**
 * @fileoverview **«Νέα πρόσκληση» από την οθόνη του γραφείου** — `POST /api/properties/[id]/handover/invitation` (ADR-916 §5.17 Φ-Δ.3).
 * @related app/api/properties/[id]/handover/invitation/route.ts · πρότυπο `redeemHandoverInvitationFromScreen`
 * @module services/property-handover/property-handover-invitation-renewal.client
 *
 * 🔑 **Ποτέ δεν πετά** — η άρνηση του κόσμου (λόγος από το κλειστό λεξιλόγιο) ≠ «δεν μπόρεσα τώρα» (503 · δίκτυο · άγνωστος
 *    λόγος). Το `Idempotency-Key` το βάζει ο `apiClient` — ίδιο σε κάθε αυτόματη επανάληψη (CHECK 3.92).
 */

import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { apiRefusalReasonOf } from '@/lib/invitations/invitation-link-refusal';
import {
  HANDOVER_INVITATION_RENEWAL_REFUSALS,
  HANDOVER_INVITATION_RENEWAL_REFUSED,
  type HandoverInvitationRenewalRefusal,
} from '@/types/property-handover';

export type HandoverInvitationRenewalResult =
  | { readonly kind: 'renewed' }
  | { readonly kind: 'refused'; readonly reason: HandoverInvitationRenewalRefusal }
  | { readonly kind: 'failed' };

export async function renewHandoverInvitationFromScreen(
  propertyId: string,
  input: { readonly handoverId: string; readonly confirmDeclined: boolean },
): Promise<HandoverInvitationRenewalResult> {
  try {
    await apiClient.post<{ status: 'renewed' }>(API_ROUTES.PROPERTIES.HANDOVER_INVITATION(propertyId), input);
    return { kind: 'renewed' };
  } catch (cause: unknown) {
    const reason = apiRefusalReasonOf(cause, HANDOVER_INVITATION_RENEWAL_REFUSED, HANDOVER_INVITATION_RENEWAL_REFUSALS);
    return reason !== null ? { kind: 'refused', reason } : { kind: 'failed' };
  }
}
