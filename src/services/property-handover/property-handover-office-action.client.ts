/**
 * @fileoverview **Μία πράξη του γραφείου στην καρτέλα «Παράδοση»** — το ΕΝΑ σχήμα «POST → έκβαση» (ADR-916 Φ-Δ.3 · Φ-Δ.4).
 * @related property-handover-invitation-renewal.client.ts · property-handover-file-decision.client.ts (οι δύο πράξεις)
 * @module services/property-handover/property-handover-office-action.client
 *
 * 🔑 **Ποτέ δεν πετά** — η άρνηση του κόσμου (λόγος από το κλειστό λεξιλόγιο της πόρτας) ≠ «δεν μπόρεσα τώρα» (503 · δίκτυο ·
 *    άγνωστος λόγος). Το `Idempotency-Key` το βάζει ο `apiClient` — ίδιο σε κάθε αυτόματη επανάληψη (CHECK 3.92).
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { apiRefusalReasonOf } from '@/lib/invitations/invitation-link-refusal';

export type HandoverOfficeActionResult<TDone, TReason extends string> =
  | { readonly kind: 'done'; readonly body: TDone }
  | { readonly kind: 'refused'; readonly reason: TReason }
  | { readonly kind: 'failed' };

export async function postHandoverOfficeAction<TDone, TReason extends string>(
  url: string,
  input: object,
  refusal: { readonly discriminator: string; readonly reasons: readonly TReason[] },
): Promise<HandoverOfficeActionResult<TDone, TReason>> {
  try {
    return { kind: 'done', body: await apiClient.post<TDone>(url, input) };
  } catch (cause: unknown) {
    const reason = apiRefusalReasonOf(cause, refusal.discriminator, refusal.reasons);
    return reason !== null ? { kind: 'refused', reason } : { kind: 'failed' };
  }
}
