'use client';

/**
 * @fileoverview **Ζωντανή προεπισκόπηση του πίνακα καταλόγου** — η δομή, όπως θα τυπωθεί, σε δείγμα στηλών
 *   (ADR-923 §5.6 · Φάση 1γ).
 * @module components/catalog/families/FamilyTablePreview
 *
 * 🔑 Σημασιολογικός `<table>`: κεφαλίδες γραμμών (`th scope="row"`), η συγχώνευση «μία τιμή σε όλη τη γραμμή» ως
 *    `colSpan` — αυτό που θα κάνει το ουδέτερο μοντέλο διάταξης του εκδότη (Typst, §21.4). Οι τιμές είναι κενές:
 *    προϊόντα δεν υπάρχουν ακόμη (Φάση 2) — φαίνεται ό,τι αποφασίζει **το σχήμα**.
 */

import React, { useMemo } from 'react';
import { Merge } from 'lucide-react';

import type { CatalogLibrary } from '@/hooks/catalog/useCatalogLibrary';
import type { CatalogFamilyDefinition } from '@/subapps/catalog/types/family';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { buildTablePreview, type PreviewRow } from './family-table-preview';

const EMPTY_CELL = '·';

function PreviewBodyRow({ row, columnCount }: { readonly row: PreviewRow; readonly columnCount: number }) {
  const { t } = useCatalogText();
  if (row.kind === 'groupHeader') {
    return <tr><th scope="rowgroup" colSpan={columnCount + 1} className="bg-muted px-2 py-1 text-left text-xs font-semibold uppercase">{row.label}</th></tr>;
  }
  if (row.kind === 'axis') {
    return (
      <tr className="border-b">
        <th scope="row" className="px-2 py-1 text-left font-semibold">{row.label}</th>
        {row.cells.map((cell, index) => <td key={index} className="px-2 py-1 text-center font-semibold">{cell}</td>)}
      </tr>
    );
  }
  const label = (
    <th scope="row" className="px-2 py-1 text-left font-normal">
      {row.label}
      {row.unit ? <span className="ml-1 text-muted-foreground">({row.unit})</span> : null}
      {row.filter ? <span className="ml-1 text-xs text-muted-foreground">{t('families.table.onlyFor', { value: row.filter })}</span> : null}
      {row.merge === 'equalAdjacent' ? <Merge className="ml-1 inline h-3 w-3 text-muted-foreground" aria-label={t('table.merge.equalAdjacent')} /> : null}
    </th>
  );
  return (
    <tr className="border-b">
      {label}
      {row.merge === 'all'
        ? <td colSpan={columnCount} className="px-2 py-1 text-center text-muted-foreground">{EMPTY_CELL}</td>
        : Array.from({ length: columnCount }, (_, index) => <td key={index} className="px-2 py-1 text-center text-muted-foreground">{EMPTY_CELL}</td>)}
    </tr>
  );
}

export function FamilyTablePreview({ draft, library }: { readonly draft: CatalogFamilyDefinition; readonly library: CatalogLibrary }) {
  const { t, text } = useCatalogText();
  const preview = useMemo(
    () => buildTablePreview(draft, library.attributeById, library.registry, { text, yes: t('common.yes'), no: t('common.no'), sample: t('families.table.sample') }),
    [draft, library.attributeById, library.registry, text, t],
  );
  if (!preview) return null;
  const columnCount = Math.max(preview.columns.length, 1);
  return (
    <section className="flex flex-col gap-2" aria-labelledby="family-table-preview-title">
      <h3 id="family-table-preview-title" className="m-0 text-sm font-semibold text-foreground">{t('families.table.preview')}</h3>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{t('families.table.preview')}</caption>
          <tbody>{preview.rows.map((row) => <PreviewBodyRow key={row.id} row={row} columnCount={columnCount} />)}</tbody>
        </table>
      </div>
      {preview.hiddenColumns > 0 ? <p className="m-0 text-xs text-muted-foreground">{t('families.table.moreColumns', { count: preview.hiddenColumns })}</p> : null}
    </section>
  );
}
