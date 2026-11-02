'use client';

/**
 * @fileoverview **Τα προϊόντα που βλέπει ο εκδότης** — η λίστα της σελίδας προϊόντων, για επιλογή ή για κρίση φίλτρου (ADR-923 §5.6.1).
 * @related products/use-product-list.ts (τα ίδια ζωντανά παράθυρα)
 * @module components/catalog/publishing/use-publication-product-list
 *
 * ⚠️ Τα παράθυρα είναι ζωντανοί ακροατές: ο καλών αποδίδεται **μόνο όσο τα χρειάζεται**.
 */

import { useMemo } from 'react';

import { useCatalogCollection } from '@/hooks/catalog/useCatalogCollection';
import { useCatalogLibrary } from '@/hooks/catalog/useCatalogLibrary';
import { useCatalogSettings } from '@/hooks/catalog/useCatalogSettings';
import type { FacetSelection } from '@/subapps/catalog/list/catalog-list-query';
import { useProductList } from '../products/use-product-list';
import { useCatalogFailureNotice } from '../shared/catalog-ui-hooks';

export function usePublicationProductList(familyId: string | null, facets: FacetSelection) {
  const notice = useCatalogFailureNotice();
  const library = useCatalogLibrary(notice);
  const settings = useCatalogSettings();
  const families = useCatalogCollection('CATALOG_FAMILIES').items;
  const familyById = useMemo(() => new Map(families.map((family) => [family.id, family])), [families]);
  const filter = useMemo(() => ({ familyId, facets, sort: 'label' as const }), [familyId, facets]);
  const list = useProductList({ filter, families: familyById, attributes: library.attributeById, settings: settings.definition });
  return { families, library, list };
}
