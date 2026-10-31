'use client';
/**
 * **Οι στήλες του ενιαίου πλέγματος προϊόντων** (ADR-923 §5.10.4 Β2). Μικρές συναρτήσεις ανά στήλη· η σειρά ζει στο
 * `productListColumns`. Κάθε στήλη δίνει **κείμενο** (αντιγραφή TSV) και, όπου χρειάζεται, πλουσιότερη απόδοση.
 *
 * @module components/catalog/products/product-list-columns
 */

import { FileThumbnail } from '@/components/shared/files/FileThumbnail';
import { Badge } from '@/components/ui/badge';
import type { DataGridColumn } from '@/components/ui/data-grid/data-grid-types';
import type { HumanLanguage } from '@/i18n/languages';
import { formatDateTime } from '@/lib/intl-formatting';
import type { AssetRecord, FamilyRecord } from '@/services/catalog/catalog-api.client';
import { readUnscopedSlot } from '@/subapps/catalog/values/value-shape';
import type { FacetSelection } from '@/subapps/catalog/list/catalog-list-query';
import type { CatalogChannel } from '@/subapps/catalog/vocabulary/channels';
import type { FileRecord } from '@/types/file-record';

import type { useCatalogText } from '../shared/catalog-ui-hooks';
import {
  rowCompleteness,
  rowIdentifier,
  rowLabel,
  rowMatches,
  rowVariantCount,
  type CatalogListRow,
  type CompletenessTone,
} from './product-list-rows';

export interface ProductListContext {
  readonly families: ReadonlyMap<string, FamilyRecord>;
  readonly assets: ReadonlyMap<string, AssetRecord>;
  readonly files: ReadonlyMap<string, FileRecord>;
  readonly channel: CatalogChannel;
  readonly locale: HumanLanguage;
  readonly facets: FacetSelection;
}

/** Οι λέξεις — ίδιος τύπος με το `useCatalogText` (όχι δεύτερη υπογραφή του `t`). */
export type ProductListWords = Pick<ReturnType<typeof useCatalogText>, 't' | 'text'>;

type Column = DataGridColumn<CatalogListRow>;

/** Πληρότητα: χρώμα **και** λέξη — ποτέ μόνο χρώμα (CHECK 3.41). Παραλλαγές του `Badge` = θεματικό SSoT. */
const TONE_VARIANT: Readonly<Record<CompletenessTone, 'success' | 'warning' | 'destructive'>> = {
  complete: 'success',
  partial: 'warning',
  empty: 'destructive',
};

function imageFileOf(row: CatalogListRow, ctx: ProductListContext): FileRecord | null {
  const attributeId = ctx.families.get(row.record.familyId)?.imageAttributeId;
  if (!attributeId) return null;
  const value = readUnscopedSlot(row.record.values[attributeId]);
  const assetId = value?.type === 'asset' ? value.assetIds[0] : undefined;
  const fileId = assetId ? ctx.assets.get(assetId)?.fileId : null;
  return fileId ? ctx.files.get(fileId) ?? null : null;
}

function header(id: string, w: ProductListWords): Pick<Column, 'id' | 'header' | 'label'> {
  const label = w.t(`products.columns.${id}`);
  return { id, header: label, label };
}

function identityColumns(ctx: ProductListContext, w: ProductListWords): Column[] {
  // Τα literals ΜΕΣΑ στην κλήση: έτσι τα βλέπει ο γεννήτορας του route slice (ADR-744) — συνάρτηση που ΕΠΙΣΤΡΕΦΕΙ κλειδί είναι «δυναμική t()».
  const kindLabel = (row: CatalogListRow) => w.t(row.kind === 'model' ? 'products.kind.productModel' : 'products.kind.product');
  return [
    { ...header('image', w), width: 'xs', text: () => '',
      render: (row) => { const file = imageFileOf(row, ctx); return file ? <FileThumbnail file={file} displayName={rowIdentifier(row) ?? ''} size="xs" /> : null; } },
    { ...header('identifier', w), width: 'md', sticky: true, text: (row) => rowIdentifier(row) ?? '',
      render: (row) => {
        const identifier = rowIdentifier(row);
        return identifier ? <span className="font-mono text-xs">{identifier}</span> : <span className="text-xs italic text-muted-foreground">{w.t('products.noIdentifier')}</span>;
      } },
    { ...header('label', w), width: 'lg', text: (row) => rowLabel(row) ?? '' },
    { ...header('family', w), width: 'md',
      text: (row) => { const family = ctx.families.get(row.record.familyId); return family ? w.text(family.labels, family.code) : ''; } },
    { ...header('kind', w), width: 'sm', text: kindLabel,
      render: (row) => <Badge variant={row.kind === 'model' ? 'secondary' : 'outline'}>{kindLabel(row)}</Badge> },
  ];
}

function statusColumns(ctx: ProductListContext, w: ProductListWords): Column[] {
  const completenessText = (row: CatalogListRow): string => {
    const cell = rowCompleteness(row, ctx.channel, ctx.locale);
    if (!cell) return '';
    const amount = cell.kind === 'summary'
      ? w.t('products.completeness.summary', { complete: cell.complete, total: cell.total })
      : w.t('products.completeness.percent', { percent: cell.percent });
    return `${amount} · ${w.t(`products.completeness.tone.${cell.tone}`)}`;
  };
  return [
    { ...header('completeness', w), width: 'md', text: completenessText,
      render: (row) => { const cell = rowCompleteness(row, ctx.channel, ctx.locale); return cell ? <Badge variant={TONE_VARIANT[cell.tone]}>{completenessText(row)}</Badge> : null; } },
    { ...header('variants', w), width: 'sm', align: 'end',
      text: (row) => {
        const matches = rowMatches(row, ctx.facets);
        if (matches) return w.t('products.matches', matches);
        const count = rowVariantCount(row);
        return count === null ? '' : String(count);
      } },
    { ...header('updated', w), width: 'md', text: (row) => (row.record.updatedAt ? formatDateTime(row.record.updatedAt) : '') },
  ];
}

export function productListColumns(ctx: ProductListContext, w: ProductListWords): Column[] {
  return [...identityColumns(ctx, w), ...statusColumns(ctx, w)];
}
