/**
 * @fileoverview **«Νέα πρόσκληση» από την οθόνη του γραφείου** — `POST /api/properties/[id]/handover/invitation` (ADR-916 §5.17 Φ-Δ.3).
 * @related app/api/properties/[id]/handover/invitation/route.ts · property-handover-office-action.client.ts (το ΕΝΑ σχήμα πράξης)
 * @module services/property-handover/property-handover-invitation-renewal.client
 *
 * 🔑 **Ποτέ δεν πετά** — βλ. `postHandoverOfficeAction`.
 */

import { API_ROUTES } from '@/config/domain-constants';
import {
  HANDOVER_INVITATION_RENEWAL_REFUSALS,
  HANDOVER_INVITATION_RENEWAL_REFUSED,
  type HandoverInvitationRenewalRefusal,
} from '@/types/property-handover';

import { postHandoverOfficeAction } from './property-handover-office-action.client';

export type HandoverInvitationRenewalResult =
  | { readonly kind: 'renewed' }
  | { readonly kind: 'refused'; readonly reason: HandoverInvitationRenewalRefusal }
  | { readonly kind: 'failed' };

export async function renewHandoverInvitationFromScreen(
  propertyId: string,
  input: { readonly handoverId: string; readonly confirmDeclined: boolean },
): Promise<HandoverInvitationRenewalResult> {
  const result = await postHandoverOfficeAction<{ status: 'renewed' }, HandoverInvitationRenewalRefusal>(
    API_ROUTES.PROPERTIES.HANDOVER_INVITATION(propertyId), input,
    { discriminator: HANDOVER_INVITATION_RENEWAL_REFUSED, reasons: HANDOVER_INVITATION_RENEWAL_REFUSALS },
  );
  return result.kind === 'done' ? { kind: 'renewed' } : result;
}
