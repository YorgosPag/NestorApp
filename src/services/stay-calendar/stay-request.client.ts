'use client';

/**
 * @fileoverview **Το αίτημα κράτησης από την πλευρά του επισκέπτη** — τα αιτήματά μου και οι πράξεις μου.
 * @related ADR-835 §23 (Στάδιο Δ) · app/api/public-listings/[listingId]/stay-request/route.ts ·
 *   services/stay-calendar/stay-calendar.client.ts (`postStayCommand` — η ΜΙΑ ανάγνωση έκβασης)
 * @module services/stay-calendar/stay-request.client
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { StayCalendarCommand } from '@/lib/stay/stay-calendar-command';
import { stayGuestRequestsFrom, type StayGuestRequests } from '@/lib/stay/stay-guest-request-view';
import { createModuleLogger } from '@/lib/telemetry';

import { postStayCommand, type StayCalendarSendOutcome } from './stay-calendar.client';

const logger = createModuleLogger('stay-request.client');

const urlOf = (listingId: string): string => `/api/public-listings/${encodeURIComponent(listingId)}/stay-request`;

/** Αποτυχία ⇒ `failed`, ποτέ «κανένα αίτημα» — θα έκανε τον άνθρωπο να ζητήσει ξανά ό,τι ήδη κρατά. */
export type StayGuestRequestsLoad = { readonly kind: 'loaded'; readonly requests: StayGuestRequests } | { readonly kind: 'failed' };

export async function fetchMyStayRequests(listingId: string): Promise<StayGuestRequestsLoad> {
  try {
    const requests = stayGuestRequestsFrom(await apiClient.get<unknown>(urlOf(listingId)));
    return requests === null ? { kind: 'failed' } : { kind: 'loaded', requests };
  } catch (cause) {
    logger.warn('Τα αιτήματα κράτησης δεν φορτώθηκαν', {
      data: { listingId },
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return { kind: 'failed' };
  }
}

/** Οι πράξεις του επισκέπτη — ο διακομιστής αρνείται κάθε άλλη με `absent` (πίνακας εξουσίας). */
export type StayGuestCommand = Extract<StayCalendarCommand, { action: 'request' | 'withdraw' }>;

export function sendStayGuestCommand(listingId: string, command: StayGuestCommand): Promise<StayCalendarSendOutcome> {
  return postStayCommand(urlOf(listingId), command);
}
