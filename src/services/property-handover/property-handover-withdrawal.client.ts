/**
 * @fileoverview **«Ανάκληση παράδοσης» από την οθόνη του γραφείου** — `POST /api/properties/[id]/handover/withdrawal`
 *   (ADR-916 §5.19 Φ-Δ.5).
 * @related app/api/properties/[id]/handover/withdrawal/route.ts · property-handover-office-action.client.ts (το ΕΝΑ σχήμα πράξης)
 * @module services/property-handover/property-handover-withdrawal.client
 *
 * 🔑 **Ποτέ δεν πετά** — βλ. `postHandoverOfficeAction`.
 */

import { API_ROUTES } from '@/config/domain-constants';
import {
  HANDOVER_WITHDRAWAL_REFUSALS,
  HANDOVER_WITHDRAWAL_REFUSED,
  type HandoverWithdrawalRefusal,
  type HandoverWithdrawalRequest,
} from '@/types/property-handover';

import { postHandoverOfficeAction } from './property-handover-office-action.client';

export type HandoverWithdrawalResult =
  | { readonly kind: 'withdrawn' | 'unchanged' }
  | { readonly kind: 'refused'; readonly reason: HandoverWithdrawalRefusal }
  | { readonly kind: 'failed' };

export async function withdrawHandoverFromScreen(propertyId: string, input: HandoverWithdrawalRequest): Promise<HandoverWithdrawalResult> {
  const result = await postHandoverOfficeAction<{ status: 'withdrawn' | 'unchanged' }, HandoverWithdrawalRefusal>(
    API_ROUTES.PROPERTIES.HANDOVER_WITHDRAWAL(propertyId), { ...input, confirmIrreversible: true },
    { discriminator: HANDOVER_WITHDRAWAL_REFUSED, reasons: HANDOVER_WITHDRAWAL_REFUSALS },
  );
  return result.kind === 'done' ? { kind: result.body.status } : result;
}
