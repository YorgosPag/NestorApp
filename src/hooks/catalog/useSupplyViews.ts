'use client';

/**
 * @fileoverview **Οι δύο όψεις `supply`** (ADR-923 §5.12): λεπτές συνδέσεις του {@link useCatalogServerView}. Το ίδιο σήμα ακούν και
 *   οι δύο: ο γραφέας της σχέσης το αυξάνει και στους δύο χώρους, άρα η αποδοχή φαίνεται αμέσως στον προμηθευτή.
 * @module hooks/catalog/useSupplyViews
 */

import { fetchBuyerSupplyView, fetchSupplierSupplyView } from '@/services/catalog/supply-api.client';
import type { CatalogView } from '@/subapps/catalog/views/catalog-view-key';
import type { BuyerSupplyView, SupplierSupplyView } from '@/subapps/catalog/types/supply-views';
import { useCatalogServerView, type CatalogServerViewApi } from './useCatalogServerView';

const SUPPLY_VIEW: CatalogView = { kind: 'supply' };

export function useSupplierSupplyView(): CatalogServerViewApi<SupplierSupplyView> {
  return useCatalogServerView({ view: SUPPLY_VIEW, read: fetchSupplierSupplyView, label: 'catalog-supplier-supply-view' });
}

export function useBuyerSupplyView(): CatalogServerViewApi<BuyerSupplyView> {
  return useCatalogServerView({ view: SUPPLY_VIEW, read: fetchBuyerSupplyView, label: 'catalog-buyer-supply-view' });
}
