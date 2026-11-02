'use client';
/**
 * **Αναζήτηση SKU με λέξεις μέσα στον δικό μου κατάλογο** (ADR-923 §5.6.1 · §5.12).
 *
 * 🔑 Ίδιο ευρετήριο, ίδιο σχέδιο όρου και ίδια κρίση με την αναζήτηση του αγοραστή: το πρόθεμα πάει στο ερώτημα, ο πλήρης όρος
 *    κρίνεται στο παράθυρο. Δεύτερη μηχανή δεν υπάρχει.
 * ⚠️ Όρος χωρίς λέξη τριών χαρακτήρων δεν ανοίγει ακροατή (`searching: false`).
 *
 * @module components/catalog/products/use-catalog-sku-search
 */

import { useMemo } from 'react';

import { useCatalogLiveWindow } from '@/hooks/catalog/useCatalogLiveWindow';
import type { ProductRecord } from '@/services/catalog/catalog-api.client';
import { catalogSearchPlan, skuMatchesCatalogSearch } from '@/subapps/catalog/derived/search-prefixes';
import { catalogSearchQueryPlan } from '@/subapps/catalog/list/catalog-list-query';

import { productRow } from './product-list-rows';
import { PRODUCT_LIST_PAGE, type ProductList } from './use-product-list';

export interface CatalogSkuSearch {
  readonly searching: boolean;
  readonly list: Pick<ProductList, 'state' | 'rows' | 'hasMore' | 'grow'>;
}

export function useCatalogSkuSearch(term: string, familyId: string | null): CatalogSkuSearch {
  const { seed, tokens } = useMemo(() => catalogSearchPlan(term), [term]);
  const plan = useMemo(() => (seed === null ? null : catalogSearchQueryPlan(seed)), [seed]);
  const window = useCatalogLiveWindow<ProductRecord>('CATALOG_PRODUCTS', plan, PRODUCT_LIST_PAGE);
  const rows = useMemo(
    () => window.items.filter((record) => (familyId === null || record.familyId === familyId) && skuMatchesCatalogSearch(record.derived, tokens)).map(productRow),
    [window.items, familyId, tokens],
  );
  return { searching: seed !== null, list: { state: window.state, rows, hasMore: window.state === 'ready' && !window.complete, grow: window.grow } };
}
