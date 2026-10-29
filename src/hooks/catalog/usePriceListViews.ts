'use client';

/**
 * @fileoverview **Οι δύο όψεις της σελίδας τιμοκαταλόγων** — λίστες + χρονογραμμή, και οι γραμμές μιας έκδοσης
 *   (ADR-923 §5.11 «3δ» Τμήμα 1). Λεπτές συνδέσεις του {@link usePricingView}: ποια ανάγνωση, ποιο σήμα.
 * @module hooks/catalog/usePriceListViews
 *
 * 🔑 Οι γραμμές ακούν το σήμα `list:{id}` (κάθε γραφή γραμμής/έκδοσης της λίστας), **όχι** το `lists`: μια αλλαγή σε
 *    άλλη λίστα δεν ξαναδιαβάζει 4.000 γραμμές.
 */

import { useCallback, useMemo } from 'react';

import { fetchAllPriceLines, fetchDiscountsView, fetchPriceListsView } from '@/services/catalog/catalog-pricing-api.client';
import type { PricingView } from '@/subapps/catalog/pricing/pricing-view-key';
import type { DiscountsView, PriceLinesPageView, PriceListsView } from '@/subapps/catalog/types/pricing-views';
import { usePricingView, type PricingViewApi } from './usePricingView';

const LISTS_VIEW: PricingView = { kind: 'lists' };

export function usePriceListsView(isHeld?: () => boolean): PricingViewApi<PriceListsView> {
  return usePricingView({ view: LISTS_VIEW, read: fetchPriceListsView, isHeld, label: 'catalog-price-lists-view' });
}

const DISCOUNTS_VIEW: PricingView = { kind: 'discounts' };

/** Ομάδες έκπτωσης · ομάδες πελατών · αναθέσεις · συνθήκες — ό,τι αναφέρει το κοινό μιας λίστας και οι γραμμές της. */
export function useDiscountsView(isHeld?: () => boolean): PricingViewApi<DiscountsView> {
  return usePricingView({ view: DISCOUNTS_VIEW, read: fetchDiscountsView, isHeld, label: 'catalog-discounts-view' });
}

/** Οι γραμμές της έκδοσης `versionId` του τιμοκαταλόγου `priceListId` (όλες οι σελίδες, ένα συνεπές στιγμιότυπο). */
export function usePriceLinesView(priceListId: string, versionId: string, isHeld?: () => boolean): PricingViewApi<PriceLinesPageView> {
  const view = useMemo<PricingView>(() => ({ kind: 'list', priceListId }), [priceListId]);
  const read = useCallback(() => fetchAllPriceLines(versionId), [versionId]);
  return usePricingView({ view, read, isHeld, label: 'catalog-price-lines-view' });
}
