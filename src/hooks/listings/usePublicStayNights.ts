'use client';

/**
 * @fileoverview **Το δημόσιο ημερολόγιο μιας αγγελίας** — δύο μήνες τη φορά (ADR-835 §21).
 * @related services/stay-calendar/stay-public.client.ts · components/listing-detail/ListingStayCalendar.tsx
 * @module hooks/listings/usePublicStayNights
 *
 * ⚠️ Η παλιότερη απάντηση χάνει (φρουρός σειράς): γρήγορη αλλαγή μήνα δεν ζωγραφίζει τον λάθος.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { StayPublicNights } from '@/lib/stay/stay-nights-view';
import { fetchPublicStayNights, type StayNightsFreshness } from '@/services/stay-calendar/stay-public.client';

/**
 * Πόσοι μήνες φορτώνονται μαζί: οι **δύο** που φαίνονται + **ένας** ακόμη, ώστε μια διαμονή
 * που ξεκινά στο τέλος του δεύτερου μήνα να μπορεί να τελειώσει στον επόμενο.
 */
const PUBLIC_STAY_MONTHS = 3;

export type PublicStayNightsState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'loaded'; readonly nights: StayPublicNights };

export function usePublicStayNights(
  listingId: string,
  monthKey: string,
): { readonly state: PublicStayNightsState; readonly reload: () => void } {
  const [state, setState] = useState<PublicStayNightsState>({ kind: 'loading' });
  const sequence = useRef(0);

  const load = useCallback(async (freshness: StayNightsFreshness): Promise<void> => {
    const seq = ++sequence.current;
    setState({ kind: 'loading' });
    const result = await fetchPublicStayNights(listingId, monthKey, PUBLIC_STAY_MONTHS, freshness);
    if (seq === sequence.current) setState(result);
  }, [listingId, monthKey]);

  useEffect(() => {
    void load('cached');
  }, [load]);

  // 🔴 Το `reload` καλείται μετά από **δική μου** γραφή ή «Δοκίμασε ξανά» ⇒ ΠΑΝΤΑ φρέσκο (§23.12 Ε2).
  return { state, reload: () => void load('fresh') };
}
