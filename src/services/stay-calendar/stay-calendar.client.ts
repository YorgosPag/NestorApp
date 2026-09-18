'use client';

/**
 * @fileoverview **Το ημερολόγιο καταλύματος από την πλευρά της οθόνης** — ανάγνωση
 *   παραθύρου και αποστολή πράξης, με κλειστές εκβάσεις.
 * @related ADR-835 §20 (Στάδιο Α) · app/api/owner-properties/[ownerPropertyId]/stay-calendar/route.ts ·
 *   hooks/stay/useStayCalendar.ts
 * @module services/stay-calendar/stay-calendar.client
 *
 * ⚠️ **Το 409 ΔΕΝ είναι «σφάλμα δικτύου»**: είναι η ονομασμένη απάντηση του κριτή
 * («πέφτει πάνω στην κράτηση 14–18/10»). Διαβάζεται από το σώμα του σφάλματος και
 * φτάνει στην οθόνη ως έκβαση — ποτέ ως γενικό «κάτι πήγε στραβά».
 */

import { apiClient, apiErrorBodyOf } from '@/lib/api/enterprise-api-client';
import type { StayCalendarCommand } from '@/lib/stay/stay-calendar-command';
import type { StayCalendarView } from '@/lib/stay/stay-calendar-view';
import { createModuleLogger } from '@/lib/telemetry';
import {
  stayCalendarWriteResultFrom,
  type StayCalendarWriteResult,
} from '@/services/stay-calendar/stay-calendar-write-result';

const logger = createModuleLogger('stay-calendar.client');

const urlOf = (ownerPropertyId: string): string =>
  `/api/owner-properties/${encodeURIComponent(ownerPropertyId)}/stay-calendar`;

export type StayCalendarLoad =
  | { readonly kind: 'loaded'; readonly view: StayCalendarView }
  | { readonly kind: 'absent' }
  | { readonly kind: 'failed' };

/** Αποτυχία που **δεν** είναι έκβαση του διακομιστή (δίκτυο, 500, άγνωστο σχήμα). */
export type StayCalendarSendOutcome = StayCalendarWriteResult | { readonly kind: 'failed' };

export async function fetchStayCalendar(
  ownerPropertyId: string,
  window: { readonly from: string; readonly to: string },
): Promise<StayCalendarLoad> {
  const query = new URLSearchParams({ from: window.from, to: window.to });
  try {
    return { kind: 'loaded', view: await apiClient.get<StayCalendarView>(`${urlOf(ownerPropertyId)}?${query}`) };
  } catch (cause) {
    if (apiErrorBodyOf(cause)?.error === 'ABSENT') return { kind: 'absent' };
    logger.error('Το ημερολόγιο καταλύματος δεν φορτώθηκε', {
      data: { ownerPropertyId },
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return { kind: 'failed' };
  }
}

/**
 * **Στέλνει μία πράξη σε μια πόρτα του ημερολογίου** — του οικοδεσπότη ή του επισκέπτη (Στάδιο Δ).
 * 🔑 Η **μία** ανάγνωση της έκβασης: το 409 διαβάζεται από το σώμα, ποτέ ως «σφάλμα δικτύου».
 */
export async function postStayCommand(url: string, command: StayCalendarCommand): Promise<StayCalendarSendOutcome> {
  try {
    const body = await apiClient.post<unknown>(url, command);
    return stayCalendarWriteResultFrom(body) ?? { kind: 'failed' };
  } catch (cause) {
    const refused = stayCalendarWriteResultFrom(apiErrorBodyOf(cause));
    if (refused !== null) return refused;
    logger.error('Η πράξη στο ημερολόγιο καταλύματος απέτυχε', {
      data: { url, action: command.action },
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return { kind: 'failed' };
  }
}

export async function sendStayCalendarCommand(
  ownerPropertyId: string,
  command: StayCalendarCommand,
): Promise<StayCalendarSendOutcome> {
  return postStayCommand(urlOf(ownerPropertyId), command);
}
