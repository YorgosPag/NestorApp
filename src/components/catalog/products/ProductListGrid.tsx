'use client';
/**
 * **Το ενιαίο πλέγμα προϊόντων** — μοντέλα + απλά SKU (ADR-923 §5.10.4 Β2, Akeneo Serenity).
 *
 * Το **γενικό** `DataGrid` σε λειτουργία μόνο ανάγνωσης: πληκτρολόγιο του Excel, αντιγραφή εύρους σε TSV (το Akeneo
 * δεν το δίνει), virtualization με `aria-rowindex`. `Enter` / διπλό κλικ ανοίγει το προϊόν.
 *
 * @module components/catalog/products/ProductListGrid
 */

import { useMemo } from 'react';

import { DataGrid } from '@/components/ui/data-grid/DataGrid';

import { useCatalogText } from '../shared/catalog-ui-hooks';
import { useCatalogGridWords } from '../shared/use-catalog-grid-words';
import { productListColumns, type ProductListContext } from './product-list-columns';
import type { CatalogListRow } from './product-list-rows';

export interface ProductListGridProps extends ProductListContext {
  readonly rows: readonly CatalogListRow[];
  readonly onOpen: (row: CatalogListRow) => void;
  /** Τι λέει το άδειο πλέγμα — εξαρτάται από την κατάσταση: «φορτώνει» ≠ «δεν υπάρχει κανένα» ≠ «δεν φορτώθηκε». */
  readonly emptyText: string;
}

export function ProductListGrid(props: ProductListGridProps) {
  const { t, text } = useCatalogText();
  const gridWords = useCatalogGridWords();
  const { rows, onOpen, families, assets, files, channel, locale, facetKeys, emptyText } = props;
  const columns = useMemo(
    () => productListColumns({ families, assets, files, channel, locale, facetKeys }, { t, text }),
    [families, assets, files, channel, locale, facetKeys, t, text],
  );
  const words = useMemo(() => ({ ...gridWords, empty: emptyText }), [gridWords, emptyText]);
  return (
    <DataGrid<CatalogListRow>
      label={t('products.list.label')}
      rows={rows}
      rowKey={(row) => row.id}
      columns={columns}
      words={words}
      onActivateRow={(row) => onOpen(row)}
      className="max-h-[70vh]"
    />
  );
}
