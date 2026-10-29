'use client';

/**
 * @fileoverview **Η καρτέλα «Γραμμές»** — οι τιμές μιας έκδοσης στο γενικό πλέγμα (ADR-923 §5.11 «3δ» Τμήμα 1).
 * @related use-price-line-grid.ts (κατάσταση) · price-line-columns.tsx (στήλες) · products/variants/VariantsPanel.tsx (ιδίωμα)
 * @module components/catalog/pricing/PriceLinesPanel
 *
 * 🔑 Επικόλληση από Excel με **κωδικούς SKU** (επίλυση σε όλο τον κατάλογο) · πληκτρολόγιο Excel · ευρήματα **στο κελί**
 *    από την ίδια επικύρωση με τον διακομιστή · αναίρεση/επανάληψη · αποθήκευση σε δέσμες με «N από M».
 * 🔑 **Μόνο η πρόχειρη γράφεται**: δημοσιευμένη/αντικατεστημένη έκδοση είναι αμετάβλητη (SAP: η περίοδος που ισχύει δεν
 *    ξαναγράφεται — φτιάχνεις νέα)· σε σπορά, ούτε η πρόχειρη (ο γραφέας αρνείται `versionSeeding`) — το λέμε, δεν το κρύβουμε.
 * ⚠️ Δηλωμένο κενό: γραμμές **εργασιών ΑΤΟΕ** (ανάλυση υλικό/εργασία/εξοπλισμός) φαίνονται, αλλά η ανάλυση δεν επεξεργάζεται
 *    ακόμη εδώ (ADR-923 §5.11 «3δ»).
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { AlertTriangle, Send, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DataGrid } from '@/components/ui/data-grid/DataGrid';
import type { DataGridColumn } from '@/components/ui/data-grid/data-grid-types';
import { useCatalogCollection } from '@/hooks/catalog/useCatalogCollection';
import { useUomLabel } from '@/hooks/useUomLabel';
import { DEFAULT_UOM } from '@/lib/uom/uom-registry';
import type { DiscountGroupWire, PriceListVersionWire, PriceListWire } from '@/subapps/catalog/types/pricing-views';
import { acceptsDiscountGroups } from '@/subapps/catalog/vocabulary/pricing';
import { useIssueMessage } from '../shared/CatalogIssues';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { useCatalogGridWords } from '../shared/use-catalog-grid-words';
import { newPriceLineRow, type PriceLineRow } from './price-line-rows';
import { PRICE_LINE_ISSUE_PATHS, priceLineColumns } from './price-line-columns';
import { usePriceLineGrid } from './use-price-line-grid';

export interface PriceLinesPanelProps {
  readonly list: PriceListWire;
  readonly version: PriceListVersionWire;
  readonly discountGroups: readonly DiscountGroupWire[];
  readonly canManage: boolean;
  readonly canPublish: boolean;
  readonly reportDirty: (dirty: boolean) => void;
  readonly onPublish: () => void;
}

type Grid = ReturnType<typeof usePriceLineGrid>;

function useColumns(props: PriceLinesPanelProps, grid: Grid, editable: boolean): DataGridColumn<PriceLineRow>[] {
  const { t, text } = useCatalogText();
  const message = useIssueMessage();
  const uom = useUomLabel();
  const groups = acceptsDiscountGroups(props.list.priceType) ? props.discountGroups : null;
  const columns = priceLineColumns({ words: { t, text }, uom, message, discountGroups: groups });
  if (!editable) return columns;
  const remove = (row: PriceLineRow) =>
    grid.change({ rows: grid.draft.rows.filter((other) => other.key !== row.key), removed: row.stored ? [...grid.draft.removed, row.stored] : grid.draft.removed });
  return [...columns, {
    id: '__remove', header: '', label: t('pricing.lines.removeRow'), width: 'xs', text: () => '',
    render: (row) => (
      <Button type="button" variant="ghost" size="icon" tabIndex={-1} aria-label={t('pricing.lines.removeRow')} onClick={() => remove(row)}>
        <X className="h-3 w-3" aria-hidden />
      </Button>
    ),
  }];
}

type ReadOnlyReason = 'published' | 'seeding' | 'noRight';

/** Κυριολεκτικά κλειδιά σε σταθερά (όχι επιστρεφόμενο string): ο γεννήτορας route slice τα λύνει στατικά (ADR-744). */
const READ_ONLY_KEYS: Readonly<Record<ReadOnlyReason, string>> = {
  published: 'pricing.lines.readOnlyPublished',
  seeding: 'pricing.lines.readOnlySeeding',
  noRight: 'common.readOnlyPricing',
};

/** Γιατί η έκδοση είναι μόνο για ανάγνωση — `null` αν γράφεται. */
function readOnlyReason(props: PriceLinesPanelProps): ReadOnlyReason | null {
  const seed = props.version.derived.seed;
  if (props.version.status !== 'draft') return 'published';
  if (seed !== null && !seed.done) return 'seeding';
  return props.canManage ? null : 'noRight';
}

function StatusLine({ grid }: { readonly grid: Grid }) {
  const { t } = useCatalogText();
  const text = (() => {
    if (grid.saving) return t('pricing.lines.saving');
    if (grid.issueCount > 0) return t('editor.status.issues', { count: grid.issueCount });
    if (grid.report?.kind === 'partial') return t('pricing.lines.savedPartial', { saved: grid.report.saved, total: grid.report.total });
    if (grid.dirty) return t('pricing.lines.unsaved');
    return grid.report?.kind === 'saved' ? t('pricing.lines.saved', { count: grid.report.total }) : t('pricing.lines.clean');
  })();
  return <p className="m-0 mr-auto text-sm text-muted-foreground" aria-live="polite">{text}</p>;
}

function Footer({ grid, props }: { readonly grid: Grid; readonly props: PriceLinesPanelProps }) {
  const { t } = useCatalogText();
  return (
    <footer className="flex flex-wrap items-center gap-2 border-t pt-3">
      <StatusLine grid={grid} />
      {grid.dirty ? <Button type="button" variant="ghost" disabled={grid.saving} onClick={() => { grid.discard(); grid.clearReport(); }}>{t('common.discard')}</Button> : null}
      <Button type="button" disabled={!grid.canSave} onClick={() => void grid.save()}>{t('pricing.lines.save')}</Button>
      {props.canPublish ? (
        <Button type="button" variant="outline" disabled={grid.dirty || grid.saving} onClick={props.onPublish}>
          <Send className="mr-1 h-4 w-4" aria-hidden />{t('pricing.publish.open')}
        </Button>
      ) : null}
    </footer>
  );
}

function useNewRowFactory() {
  const counter = useRef(0);
  return (): PriceLineRow => { counter.current += 1; return newPriceLineRow('variant', `new-${counter.current}`, DEFAULT_UOM); };
}

export function PriceLinesPanel(props: PriceLinesPanelProps) {
  const { t } = useCatalogText();
  const words = useCatalogGridWords();
  const message = useIssueMessage();
  const attributes = useCatalogCollection('CATALOG_ATTRIBUTES');
  const grid = usePriceLineGrid({ list: props.list, versionId: props.version.id, discountGroups: props.discountGroups, attributes: attributes.items });
  const reason = readOnlyReason(props);
  const columns = useColumns(props, grid, reason === null);
  const createRow = useNewRowFactory();
  const { reportDirty } = props;
  useEffect(() => reportDirty(grid.dirty), [grid.dirty, reportDirty]);
  const issuesOf = useMemo(() => (row: PriceLineRow, _index: number, columnId: string) =>
    (grid.issues.get(row.key) ?? []).filter((issue) => issue.path === PRICE_LINE_ISSUE_PATHS[columnId]).map(message), [grid.issues, message]);
  if (grid.lines.current.state === 'loading') return <p className="m-0 p-4 text-sm text-muted-foreground" role="status">{t('common.loading')}</p>;
  if (grid.lines.current.state === 'failed') {
    return <p className="m-0 flex items-center gap-2 p-4 text-sm" role="alert">{t('common.loadFailed')}<Button type="button" size="sm" variant="outline" onClick={grid.lines.reload}>{t('pricing.lines.retry')}</Button></p>;
  }
  return (
    <section className="flex flex-col gap-3 p-4" aria-label={t('pricing.lines.tab')}>
      {reason ? <p className="m-0 text-sm text-muted-foreground">{t(READ_ONLY_KEYS[reason])}</p> : null}
      {grid.conflicts.length > 0 ? (
        <p className="m-0 flex items-center gap-1 text-sm text-muted-foreground" role="status"><AlertTriangle className="h-4 w-4" aria-hidden />{t('pricing.lines.conflicts', { count: grid.conflicts.length, codes: grid.conflicts.join(', ') })}</p>
      ) : null}
      <DataGrid<PriceLineRow> label={t('pricing.lines.gridLabel', { number: props.version.number })} rows={grid.draft.rows} rowKey={(row) => row.key} columns={columns} words={words}
        onChange={reason === null ? (change) => grid.change({ ...grid.draft, rows: change.rows }) : undefined}
        createRow={reason === null ? createRow : undefined} issuesOf={issuesOf}
        rowTone={(row) => (row.stored === null ? 'new' : null)} onUndo={grid.undo} onRedo={grid.redo} />
      {reason === null ? <Footer grid={grid} props={props} /> : null}
    </section>
  );
}
