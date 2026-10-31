'use client';
/**
 * **Η ενιαία λίστα προϊόντων** — δύο ζωντανά παράθυρα, ένα πλέγμα (ADR-923 §5.10.4 Β2, Akeneo Serenity).
 *
 * Ριζικά μοντέλα + απλά SKU με **την ίδια** ταξινόμηση και όριο, ενωμένα με μέτωπο (`mergeListRows`). Η **στενότερη**
 * ομάδα facets πηγαίνει στο ερώτημα (`array-contains-any`)· ολόκληρη η επιλογή κρίνεται μέσα στο παράθυρο, γιατί το AND
 * αφορά το ίδιο SKU και η ρίζα κρατά μόνο την ένωση. Η μπαγιατίλα κρίνεται στην ανάγνωση (Δ7).
 *
 * @module components/catalog/products/use-product-list
 */

import { useMemo } from 'react';

import { useCatalogLiveWindow } from '@/hooks/catalog/useCatalogLiveWindow';
import type { CatalogSettingsDefinition } from '@/subapps/catalog/types/catalog-settings';
import type { CatalogAttributeDefinition } from '@/subapps/catalog/types/attribute';
import type { CatalogFamilyDefinition } from '@/subapps/catalog/types/family';
import { catalogListQueryPlan, serverFacetKeys, type CatalogListSort, type FacetSelection } from '@/subapps/catalog/list/catalog-list-query';
import type { ProductModelRecord, ProductRecord } from '@/services/catalog/catalog-api.client';

import { mergeListRows, rowPassesFacets, rowStaleReason, type CatalogListRow } from './product-list-rows';

/** Σελίδα του παραθύρου — όσο το Akeneo (25), διπλάσιο για λιγότερα «περισσότερα». */
export const PRODUCT_LIST_PAGE = 50;

export interface ProductListFilter {
  readonly familyId: string | null;
  readonly facets: FacetSelection;
  readonly sort: CatalogListSort;
}

export interface ProductListInputs {
  readonly filter: ProductListFilter;
  /** Για την κρίση μπαγιατίλας: η οικογένεια **κάθε γραμμής** (όχι του φίλτρου) + βιβλιοθήκη + ρυθμίσεις. */
  readonly families: ReadonlyMap<string, CatalogFamilyDefinition>;
  readonly attributes: ReadonlyMap<string, CatalogAttributeDefinition>;
  readonly settings: CatalogSettingsDefinition;
}

export interface ProductList {
  readonly state: 'loading' | 'ready' | 'failed';
  readonly rows: readonly CatalogListRow[];
  readonly hasMore: boolean;
  readonly grow: () => void;
  /** Πόσες γραμμές του παραθύρου έχουν μπαγιάτικα παράγωγα (⇒ πρόταση επανυπολογισμού). */
  readonly staleCount: number;
}

function useWindows(filter: ProductListFilter) {
  const { familyId, sort, facets } = filter;
  const modelPlan = useMemo(() => catalogListQueryPlan('model', { familyId, facetKeys: serverFacetKeys(facets), sort }), [familyId, facets, sort]);
  const productPlan = useMemo(() => catalogListQueryPlan('product', { familyId, facetKeys: serverFacetKeys(facets), sort }), [familyId, facets, sort]);
  const models = useCatalogLiveWindow<ProductModelRecord>('CATALOG_PRODUCT_MODELS', modelPlan, PRODUCT_LIST_PAGE);
  const products = useCatalogLiveWindow<ProductRecord>('CATALOG_PRODUCTS', productPlan, PRODUCT_LIST_PAGE);
  return { models, products };
}

export function useProductList(inputs: ProductListInputs): ProductList {
  const { filter, families, attributes, settings } = inputs;
  const { models, products } = useWindows(filter);
  const merged = useMemo(() => mergeListRows(models, products, filter.sort), [models, products, filter.sort]);
  const rows = useMemo(() => merged.items.filter((row) => rowPassesFacets(row, filter.facets)), [merged.items, filter.facets]);
  const staleCount = useMemo(() => rows.filter((row) => {
    const family = families.get(row.record.familyId) ?? null;
    // Απλό SKU ⇒ χωρίς σχήμα παραλλαγών (η αλυσίδα του είναι μόνο ο εαυτός του).
    return rowStaleReason(row, family ? { family, attributes, settings, scheme: null } : null) !== null;
  }).length, [rows, families, attributes, settings]);
  const state = models.state === 'failed' || products.state === 'failed'
    ? 'failed'
    : models.state === 'ready' && products.state === 'ready' ? 'ready' : 'loading';
  return {
    state,
    rows,
    // Αποτυχία ⇒ κανένα «περισσότερα» (το παράθυρο είναι «ανοιχτό» μόνο επειδή δεν απάντησε ποτέ — μετρήθηκε ζωντανά).
    hasMore: state === 'ready' && merged.hasMore,
    grow: () => { if (!models.complete) models.grow(); if (!products.complete) products.grow(); },
    staleCount,
  };
}
