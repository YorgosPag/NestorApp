'use client';

/**
 * @fileoverview **Οι τιμές συμβολαίων μιας αγγελίας, στον browser** (ADR-889 Φ2 · ADR-890 Φ2).
 * @related `lib/market/listing-market-context.ts` (το συμβόλαιο + η διαδρομή) · `hooks/geo/usePlaceOutline.ts` (ίδιο ιδίωμα)
 * @module hooks/market/useListingMarketContext
 *
 * 🔑 **«Δεν μάθαμε» ≠ «δεν υπάρχει».** 429/503 ⇒ `unavailable` (η ενότητα το λέει)· ποτέ σιωπηλά «κανένα
 * συμβόλαιο». Η ακύρωση (αλλαγή αγγελίας) δεν είναι αποτυχία.
 */

import { useEffect, useState } from 'react';

import { listingMarketContextPath, type ListingMarketContext } from '@/lib/market/listing-market-context';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useListingMarketContext');

export type ListingMarketContextState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly context: ListingMarketContext }
  | { readonly kind: 'unavailable' };

export function useListingMarketContext(listingId: string): ListingMarketContextState {
  const [state, setState] = useState<ListingMarketContextState>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: 'loading' });

    void (async () => {
      try {
        const response = await fetch(listingMarketContextPath(listingId), { signal: controller.signal });
        if (!response.ok) {
          setState({ kind: 'unavailable' });
          return;
        }
        setState({ kind: 'ready', context: (await response.json()) as ListingMarketContext });
      } catch (error) {
        if (controller.signal.aborted) return;
        logger.warn('Οι τιμές συμβολαίων δεν απάντησαν', { data: { listingId }, error: String(error) });
        setState({ kind: 'unavailable' });
      }
    })();

    return () => controller.abort();
  }, [listingId]);

  return state;
}
