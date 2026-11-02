'use client';

/**
 * @fileoverview **Το εύρος `filter`** — οικογένεια και φίλτρα ιδιοτήτων, όπως στη σελίδα προϊόντων (ADR-923 §5.6.1).
 * @related subapps/catalog/publishing/publication-filter.ts (η κρίση) · products/ProductFacetBar.tsx (τα ίδια φίλτρα)
 * @module components/catalog/publishing/PublicationFilterField
 *
 * 🔑 Το πλήθος έρχεται από τη λίστα της σελίδας προϊόντων, όχι από δεύτερο ερώτημα. Μετρά γραμμές του πλέγματος, πριν από το
 *    φρένο πληρότητας: το τι τυπώθηκε και τι έμεινε απέξω το λέει η αναφορά της έκδοσης.
 * ⚠️ Τα ζωντανά παράθυρα ανοίγουν μόνο όταν υπάρχει οικογένεια: χωρίς αυτήν ο άνθρωπος δεν ρωτά κάτι ακόμη.
 */

import React, { useMemo } from 'react';

import { ClearableSelect } from '@/components/ui/clearable-select';
import { SelectItem } from '@/components/ui/select';
import { useCatalogCollection } from '@/hooks/catalog/useCatalogCollection';
import { useCatalogLibrary } from '@/hooks/catalog/useCatalogLibrary';
import type { FacetSelection } from '@/subapps/catalog/list/catalog-list-query';
import { facetGroupsOf } from '@/subapps/catalog/list/product-facets';
import { facetSelectionOf, filterWithSelection } from '@/subapps/catalog/publishing/publication-filter';
import type { PublicationFilter } from '@/subapps/catalog/types/publication';
import { ProductFacetBar } from '../products/ProductFacetBar';
import { CatalogField } from '../shared/CatalogFormFields';
import { useCatalogFailureNotice, useCatalogText } from '../shared/catalog-ui-hooks';
import { usePublicationProductList } from './use-publication-product-list';

export interface PublicationFilterFieldProps {
  readonly filter: PublicationFilter;
  readonly disabled: boolean;
  readonly onChange: (filter: PublicationFilter) => void;
}

function FilterMatches({ familyId, facets }: { readonly familyId: string; readonly facets: FacetSelection }) {
  const { t } = useCatalogText();
  const { list } = usePublicationProductList(familyId, facets);
  if (list.state === 'loading') return null;
  if (list.state === 'failed') return <p className="m-0 text-sm text-destructive" role="alert">{t('publishing.selection.unavailable')}</p>;
  return <p className="m-0 text-sm text-muted-foreground" role="status">{t('publishing.filter.matches', { rows: `${list.rows.length}${list.hasMore ? '+' : ''}` })}</p>;
}

export function PublicationFilterField({ filter, disabled, onChange }: PublicationFilterFieldProps) {
  const { t, text } = useCatalogText();
  const notice = useCatalogFailureNotice();
  const library = useCatalogLibrary(notice);
  const families = useCatalogCollection('CATALOG_FAMILIES').items;
  const family = families.find((candidate) => candidate.id === filter.familyId) ?? null;
  const groups = useMemo(() => (family ? facetGroupsOf(family, library.attributeById) : []), [family, library.attributeById]);
  const selection = useMemo(() => facetSelectionOf(filter), [filter]);
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label={t('publishing.scope.filter')}>
      <CatalogField label={t('publishing.selection.family')}>
        {({ id }) => (
          <ClearableSelect id={id} value={filter.familyId ?? ''} placeholder={t('publishing.filter.chooseFamily')} clearLabel={t('publishing.filter.chooseFamily')} disabled={disabled}
            onValueChange={(value) => onChange({ familyId: value === '' ? null : value, facetGroups: [] })}>
            {families.map((candidate) => <SelectItem key={candidate.id} value={candidate.id}>{text(candidate.labels, candidate.code)}</SelectItem>)}
          </ClearableSelect>
        )}
      </CatalogField>
      <ProductFacetBar groups={groups} selection={selection} disabled={disabled} onChange={(next) => onChange(filterWithSelection(filter, next))} />
      {filter.familyId !== null ? <FilterMatches familyId={filter.familyId} facets={selection} /> : null}
    </section>
  );
}
