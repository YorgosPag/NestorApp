'use client';

/**
 * @fileoverview **Οι δύο όψεις `supply`** (ADR-923 §5.12): λεπτές συνδέσεις του {@link usePricingView}. Το ίδιο σήμα ακούν και
 *   οι δύο: ο γραφέας της σχέσης το αυξάνει και στους δύο χώρους, άρα η αποδοχή φαίνεται αμέσως στον προμηθευτή.
 * @module hooks/catalog/useSupplyViews
 */

import { fetchBuyerSupplyView, fetchSupplierSupplyView } from '@/services/catalog/supply-api.client';
import type { PricingView } from '@/subapps/catalog/pricing/pricing-view-key';
import type { BuyerSupplyView, SupplierSupplyView } from '@/subapps/catalog/types/supply-views';
import { usePricingView, type PricingViewApi } from './usePricingView';

const SUPPLY_VIEW: PricingView = { kind: 'supply' };

export function useSupplierSupplyView(): PricingViewApi<SupplierSupplyView> {
  return usePricingView({ view: SUPPLY_VIEW, read: fetchSupplierSupplyView, label: 'catalog-supplier-supply-view' });
}

export function useBuyerSupplyView(): PricingViewApi<BuyerSupplyView> {
  return usePricingView({ view: SUPPLY_VIEW, read: fetchBuyerSupplyView, label: 'catalog-buyer-supply-view' });
}
