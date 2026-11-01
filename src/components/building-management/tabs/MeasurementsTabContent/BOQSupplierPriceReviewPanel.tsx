/**
 * BOQSupplierPriceReviewPanel — «Έλεγχος τιμών προμηθευτή»: το κτίριο απέναντι στις τρέχουσες τιμές των προμηθευτών (ADR-923 §5.12 Δ9).
 *
 * Παλιό δίπλα σε νέο, τίποτα δεν αλλάζει χωρίς ρητό πάτημα, και πάνω από τον φράχτη χρειάζεται δεύτερη επιβεβαίωση (Buildxact «Get
 * latest prices»). Μη διαθέσιμη πηγή φαίνεται χωρίς λόγο και το στιγμιότυπο μένει (Σ7). Χωρίς κάτι προς έλεγχο δεν εμφανίζεται.
 *
 * @module components/building-management/tabs/MeasurementsTabContent/BOQSupplierPriceReviewPanel
 */

'use client';

import { useCallback, useMemo, useState } from 'react';
import { Truck } from 'lucide-react';
import { useCatalogAccess } from '@/components/catalog/shared/catalog-neutral-hooks';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-utils';
import { useNotifications } from '@/providers/NotificationProvider';
import { applySupplierPriceToLine } from '@/services/catalog/supply-api.client';
import {
  applicableSupplierRows,
  foreignUnitPrice,
  hasFencedSupplierRow,
  supplierReviewIds,
  supplierReviewKey,
  supplierReviewRows,
  type BoqSupplierReviewRow,
} from '@/services/measurements/boq-supplier-review';
import type { BOQItem } from '@/types/boq';
import { BOQPriceReviewTable, signedPercent, type PriceReviewCells } from './BOQPriceReviewTable';
import { useSupplierDrift } from './useSupplierDrift';

const KEY = 'tabs.measurements.priceReview.supplier';

interface BOQSupplierPriceReviewPanelProps {
  items: readonly BOQItem[];
  onApplied: () => Promise<void> | void;
}

const NO_VALUE = '—';

function cellsOf(row: BoqSupplierReviewRow, stateOf: (kind: BoqSupplierReviewRow['drift']['kind']) => string): PriceReviewCells {
  const { item, drift, impact } = row;
  return {
    id: item.id,
    line: item.title,
    state: stateOf(drift.kind),
    current: formatCurrency(item.materialUnitCost + item.laborUnitCost + item.equipmentUnitCost),
    next: drift.kind === 'changed' ? formatCurrency(foreignUnitPrice(drift.price)) : NO_VALUE,
    change: drift.kind === 'changed' ? signedPercent(drift.changeBp) : NO_VALUE,
    impact: impact === null ? NO_VALUE : formatCurrency(impact),
  };
}

/** Μία μία, με τον έναν γραφέα: κάθε γραμμή κρίνεται χωριστά, και όσες κινήθηκαν στο μεταξύ μένουν για νέο έλεγχο. */
async function applyRows(rows: readonly BoqSupplierReviewRow[], confirmFence: boolean): Promise<boolean> {
  let allApplied = true;
  for (const row of rows) {
    if (row.drift.kind !== 'changed') continue;
    const acknowledged = { netAmount: row.drift.price.netAmount, quantity: row.drift.price.quantity };
    const outcome = await applySupplierPriceToLine(row.relationshipId, { boqItemId: row.item.id, variantId: row.variantId, acknowledged, confirmFence });
    allApplied = allApplied && outcome.kind === 'applied';
  }
  return allApplied;
}

function useApplySupplierRows(onApplied: BOQSupplierPriceReviewPanelProps['onApplied']) {
  const { t } = useTranslation(['building-tabs']);
  const { error } = useNotifications();
  const [busy, setBusy] = useState(false);
  const apply = useCallback(async (rows: readonly BoqSupplierReviewRow[], confirmFence: boolean) => {
    setBusy(true);
    try {
      if (!(await applyRows(rows, confirmFence))) error(t(`${KEY}.partial`));
    } catch {
      error(t(`${KEY}.partial`));
    } finally {
      await onApplied();
      setBusy(false);
    }
  }, [onApplied, error, t]);
  return { busy, apply };
}

export function BOQSupplierPriceReviewPanel({ items, onApplied }: BOQSupplierPriceReviewPanelProps) {
  const { t } = useTranslation(['building-tabs']);
  const access = useCatalogAccess('pricingView');
  const key = access === 'granted' ? supplierReviewKey(items) : '';
  const ids = useMemo(() => supplierReviewIds(items), [items]);
  const drift = useSupplierDrift(ids, key);
  const rows = useMemo(() => supplierReviewRows(items, drift.rows), [items, drift.rows]);
  const [fenceConfirmed, setFenceConfirmed] = useState(false);
  const { busy, apply } = useApplySupplierRows(onApplied);
  const applicable = applicableSupplierRows(rows, fenceConfirmed);
  const handleApply = async () => {
    await apply(applicable, fenceConfirmed);
    setFenceConfirmed(false);
    drift.recheck();
  };
  if (rows.length === 0) return null;
  const impact = applicable.reduce((sum, row) => sum + (row.impact ?? 0), 0);
  return (
    <aside className="space-y-2 rounded-md border border-border p-3 text-sm" aria-label={t(`${KEY}.title`)}>
      <header className="flex flex-wrap items-center gap-2">
        <Truck className="h-4 w-4 shrink-0" aria-hidden />
        <h3 className="m-0 flex-1 font-medium">{t(`${KEY}.summary`, { count: rows.length })}</h3>
        <Button type="button" size="sm" disabled={busy || applicable.length === 0} onClick={() => void handleApply()}>
          {t('tabs.measurements.priceReview.apply', { count: applicable.length, impact: formatCurrency(impact) })}
        </Button>
      </header>
      {hasFencedSupplierRow(rows) ? (
        <label className="flex items-center gap-2 text-xs">
          <Checkbox checked={fenceConfirmed} onCheckedChange={(next) => setFenceConfirmed(next === true)} />
          {t(`${KEY}.confirmFence`)}
        </label>
      ) : null}
      <BOQPriceReviewTable rows={rows.map((row) => cellsOf(row, (kind) => t(`${KEY}.kinds.${kind}`)))} />
    </aside>
  );
}
