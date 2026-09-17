'use client';

/**
 * @fileoverview **Ο ΠΕΛΑΤΗΣ ΤΗΣ ΔΗΜΟΣΙΑΣ ΔΙΑΘΕΣΙΜΟΤΗΤΑΣ** — ημερολόγιο αγγελίας + απαντήσεις αναζήτησης.
 * @related ADR-835 §21 · app/api/public-listings/* · services/stay-calendar/stay-calendar-public.service.ts
 * @module services/stay-calendar/stay-public.client
 *
 * ⚠️ Αποτυχία δικτύου ⇒ `failed`, **ποτέ** κενή απάντηση: η οθόνη τη μετρά ως `unreadable`
 * (δικό μας χρέος), όχι ως «ελεύθερο» ή «αδήλωτο».
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { StayQuery } from '@/lib/stay/stay-availability-vocabulary';
import type { StayPublicNights } from '@/lib/stay/stay-nights-view';
import { STAY_PUBLIC_MAX_LISTINGS, type PublicStayAnswer } from '@/lib/stay/stay-public-request';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('stay-public.client');

export type StayNightsLoad =
  | { readonly kind: 'loaded'; readonly nights: StayPublicNights }
  | { readonly kind: 'failed' };

/** Το δημόσιο ημερολόγιο μιας αγγελίας για `months` μήνες από τον `fromMonth`. */
export async function fetchPublicStayNights(
  listingId: string,
  fromMonth: string,
  months: number,
): Promise<StayNightsLoad> {
  const query = new URLSearchParams({ from: fromMonth, months: String(months) });
  try {
    const url = `/api/public-listings/${encodeURIComponent(listingId)}/stay-nights?${query}`;
    return { kind: 'loaded', nights: await apiClient.get<StayPublicNights>(url) };
  } catch (cause) {
    logger.warn('Το δημόσιο ημερολόγιο δεν φορτώθηκε', {
      data: { listingId, fromMonth },
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return { kind: 'failed' };
  }
}

export type StayAnswersLoad =
  | { readonly kind: 'loaded'; readonly answers: Readonly<Record<string, PublicStayAnswer>> }
  | { readonly kind: 'failed' };

async function fetchChunk(listingIds: readonly string[], query: StayQuery): Promise<Record<string, PublicStayAnswer>> {
  const body = await apiClient.post<{ answers: Record<string, PublicStayAnswer> }>(
    '/api/public-listings/stay-availability',
    { listingIds, ...query },
  );
  return body.answers;
}

/** Απαντήσεις για όσες αγγελίες χρειάζεται — σε κομμάτια των {@link STAY_PUBLIC_MAX_LISTINGS}. */
export async function fetchStayAnswers(listingIds: readonly string[], query: StayQuery): Promise<StayAnswersLoad> {
  const chunks: string[][] = [];
  for (let start = 0; start < listingIds.length; start += STAY_PUBLIC_MAX_LISTINGS) {
    chunks.push(listingIds.slice(start, start + STAY_PUBLIC_MAX_LISTINGS));
  }
  try {
    const parts = await Promise.all(chunks.map((chunk) => fetchChunk(chunk, query)));
    return { kind: 'loaded', answers: Object.assign({}, ...parts) };
  } catch (cause) {
    logger.warn('Οι απαντήσεις διαθεσιμότητας δεν φορτώθηκαν', {
      data: { count: listingIds.length },
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return { kind: 'failed' };
  }
}
