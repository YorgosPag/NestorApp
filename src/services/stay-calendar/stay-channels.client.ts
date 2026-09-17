'use client';

/**
 * @fileoverview **Τα κανάλια από την πλευρά της οθόνης** — ανάγνωση προβολής και
 *   αποστολή πράξης, με **κλειστές** εκβάσεις.
 * @related ADR-835 §22 (Στάδιο Γ) · app/api/owner-properties/[ownerPropertyId]/stay-channels/route.ts ·
 *   hooks/owner-property/useStayChannels.ts
 * @module services/stay-calendar/stay-channels.client
 *
 * ⚠️ **Το 409/422 ΔΕΝ είναι «σφάλμα δικτύου»**: είναι η ονομασμένη απάντηση του
 * διακομιστή («ο σύνδεσμος δεν διαβάζεται», «έχεις ήδη 10 πηγές»). Διαβάζεται από το
 * σώμα του σφάλματος και φτάνει στην οθόνη **ως έκβαση με διέξοδο**.
 */

import { apiClient, apiErrorBodyOf } from '@/lib/api/enterprise-api-client';
import {
  stayChannelWriteResultFrom,
  type StayChannelCommand,
  type StayChannelsView,
  type StayChannelWriteResult,
} from '@/lib/stay/stay-channel-command';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('stay-channels.client');

const urlOf = (ownerPropertyId: string): string =>
  `/api/owner-properties/${encodeURIComponent(ownerPropertyId)}/stay-channels`;

export type StayChannelsLoad =
  | { readonly kind: 'loaded'; readonly view: StayChannelsView }
  | { readonly kind: 'absent' }
  | { readonly kind: 'failed' };

/** Αποτυχία που **δεν** είναι έκβαση του διακομιστή (δίκτυο, 500, άγνωστο σχήμα). */
export type StayChannelsSendOutcome = StayChannelWriteResult | { readonly kind: 'failed' };

export async function fetchStayChannels(ownerPropertyId: string): Promise<StayChannelsLoad> {
  try {
    return { kind: 'loaded', view: await apiClient.get<StayChannelsView>(urlOf(ownerPropertyId)) };
  } catch (cause) {
    if (apiErrorBodyOf(cause)?.error === 'ABSENT') return { kind: 'absent' };
    logger.error('Τα κανάλια του καταλύματος δεν φορτώθηκαν', {
      data: { ownerPropertyId },
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return { kind: 'failed' };
  }
}

export async function sendStayChannelCommand(
  ownerPropertyId: string,
  command: StayChannelCommand,
): Promise<StayChannelsSendOutcome> {
  try {
    const body = await apiClient.post<unknown>(urlOf(ownerPropertyId), command);
    return stayChannelWriteResultFrom(body) ?? { kind: 'failed' };
  } catch (cause) {
    const refused = stayChannelWriteResultFrom(apiErrorBodyOf(cause));
    if (refused !== null) return refused;
    logger.error('Η πράξη στα κανάλια του καταλύματος απέτυχε', {
      data: { ownerPropertyId, action: command.action },
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return { kind: 'failed' };
  }
}
