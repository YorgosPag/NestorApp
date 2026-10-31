/**
 * BOQPriceReviewPanel — «Έλεγχος τιμών»: το κτίριο απέναντι στον τιμοκατάλογο κόστους (ADR-923 §5.11 «3ε»).
 *
 * Δείχνει παλιά/νέα τιμή, Δ% και επίπτωση σε € πριν από κάθε εφαρμογή (Buildxact «Get latest prices» · Sage «Reprice»), και
 * προτείνει τιμές σε αδέτες γραμμές με ακριβές ταίριασμα κωδικού + μονάδας. Τίποτα δεν αλλάζει χωρίς ρητό πάτημα, και πάνω από
 * τον φράχτη της λίστας χρειάζεται δεύτερη επιβεβαίωση. Χωρίς κάτι προς έλεγχο δεν εμφανίζεται.
 *
 * @module components/building-management/tabs/MeasurementsTabContent/BOQPriceReviewPanel
 */

'use client';

import { useCallback, useMemo, useState } from 'react';
import { Tags } from 'lucide-react';
import { useCatalogAccess } from '@/components/catalog/shared/catalog-neutral-hooks';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useCostRateBook } from '@/hooks/catalog/usePriceListViews';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { nowISO } from '@/lib/date-local';
import { formatCurrency, formatNumber } from '@/lib/intl-utils';
import { majorFromMinor } from '@/lib/money/money';
import { useNotifications } from '@/providers/NotificationProvider';
import { boqService } from '@/services/measurements';
import { applicableReviewRows, reviewBoqPrices, reviewImpact, type BoqPriceReviewRow } from '@/services/measurements/boq-price-review';
import { priceFieldsFromRate } from '@/services/measurements/boq-price-source';
import type { BOQItem } from '@/types/boq';

interface BOQPriceReviewPanelProps {
  items: readonly BOQItem[];
  projectId: string;
  companyId: string;
  userId: string;
  onApplied: () => Promise<void> | void;
}

const ROW_KEYS: Readonly<Record<BoqPriceReviewRow['kind'], string>> = {
  proposal: 'tabs.measurements.priceReview.kinds.proposal',
  ambiguous: 'tabs.measurements.priceReview.kinds.ambiguous',
  changed: 'tabs.measurements.priceReview.kinds.changed',
  upcoming: 'tabs.measurements.priceReview.kinds.upcoming',
  unitChanged: 'tabs.measurements.priceReview.kinds.unitChanged',
  lineGone: 'tabs.measurements.priceReview.kinds.lineGone',
  listGone: 'tabs.measurements.priceReview.kinds.listGone',
};

const signedPercent = (bp: number | null): string =>
  bp === null ? '—' : `${bp > 0 ? '+' : ''}${formatNumber(bp / 100, { maximumFractionDigits: 2 })}%`;

const nextPrice = (row: BoqPriceReviewRow): string =>
  'rate' in row ? formatCurrency(majorFromMinor(row.rate.netPrice) / row.rate.priceQuantity) : '—';

function ReviewRow({ row }: { row: BoqPriceReviewRow }) {
  const { t } = useTranslation(['building-tabs']);
  const { item } = row;
  return (
    <tr className="border-t border-border/50">
      <td className="py-1 pr-2">{item.title}</td>
      <td className="py-1 pr-2">{t(ROW_KEYS[row.kind])}</td>
      <td className="py-1 pr-2 text-right tabular-nums">{formatCurrency(item.materialUnitCost + item.laborUnitCost + item.equipmentUnitCost)}</td>
      <td className="py-1 pr-2 text-right tabular-nums">{nextPrice(row)}</td>
      <td className="py-1 pr-2 text-right tabular-nums">{'changeBp' in row ? signedPercent(row.changeBp) : '—'}</td>
      <td className="py-1 text-right tabular-nums">{'impact' in row ? formatCurrency(row.impact) : '—'}</td>
    </tr>
  );
}

function ReviewTable({ rows }: { rows: readonly BoqPriceReviewRow[] }) {
  const { t } = useTranslation(['building-tabs']);
  return (
    <section className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-xs">
        <thead>
          <tr className="text-left">
            <th scope="col" className="pr-2 font-medium">{t('tabs.measurements.priceReview.columns.line')}</th>
            <th scope="col" className="pr-2 font-medium">{t('tabs.measurements.priceReview.columns.state')}</th>
            <th scope="col" className="pr-2 text-right font-medium">{t('tabs.measurements.priceReview.columns.current')}</th>
            <th scope="col" className="pr-2 text-right font-medium">{t('tabs.measurements.priceReview.columns.next')}</th>
            <th scope="col" className="pr-2 text-right font-medium">{t('tabs.measurements.priceReview.columns.change')}</th>
            <th scope="col" className="text-right font-medium">{t('tabs.measurements.priceReview.columns.impact')}</th>
          </tr>
        </thead>
        <tbody>{rows.map((row) => <ReviewRow key={row.item.id} row={row} />)}</tbody>
      </table>
    </section>
  );
}

function useApply({ companyId, userId, onApplied }: BOQPriceReviewPanelProps) {
  const { t } = useTranslation(['building-tabs']);
  const { error } = useNotifications();
  const [busy, setBusy] = useState(false);
  const apply = useCallback(async (rows: ReturnType<typeof applicableReviewRows>) => {
    setBusy(true);
    try {
      const application = { appliedAt: nowISO(), appliedBy: userId };
      await boqService.applyPriceFields(companyId, rows.map(({ item, rate }) => ({ id: item.id, fields: priceFieldsFromRate(item, rate, application) })));
      await onApplied();
    } catch {
      error(t('tabs.measurements.priceReview.failed'));
    } finally {
      setBusy(false);
    }
  }, [companyId, userId, onApplied, error, t]);
  return { busy, apply };
}

export function BOQPriceReviewPanel(props: BOQPriceReviewPanelProps) {
  const { items, projectId } = props;
  const { t } = useTranslation(['building-tabs']);
  const access = useCatalogAccess('pricingView');
  const api = useCostRateBook(access === 'granted' && projectId ? projectId : null);
  const book = api.current.state === 'ready' ? api.current.view : null;
  const rows = useMemo(() => (book === null ? [] : reviewBoqPrices(items, book)), [items, book]);
  const [fenceConfirmed, setFenceConfirmed] = useState(false);
  const { busy, apply } = useApply(props);
  const fenced = rows.some((row) => row.kind === 'changed' && row.exceedsFence && row.applicable);
  const applicable = applicableReviewRows(rows, fenceConfirmed);
  const handleApply = async () => {
    await apply(applicable);
    setFenceConfirmed(false);
  };
  if (rows.length === 0) return null;
  return (
    <aside className="space-y-2 rounded-md border border-border p-3 text-sm" aria-label={t('tabs.measurements.priceReview.title')}>
      <header className="flex flex-wrap items-center gap-2">
        <Tags className="h-4 w-4 shrink-0" aria-hidden />
        <h3 className="m-0 flex-1 font-medium">{t('tabs.measurements.priceReview.summary', { count: rows.length })}</h3>
        <Button type="button" size="sm" disabled={busy || applicable.length === 0} onClick={() => void handleApply()}>
          {t('tabs.measurements.priceReview.apply', { count: applicable.length, impact: formatCurrency(reviewImpact(applicable)) })}
        </Button>
      </header>
      {fenced ? (
        <label className="flex items-center gap-2 text-xs">
          <Checkbox checked={fenceConfirmed} onCheckedChange={(next) => setFenceConfirmed(next === true)} />
          {t('tabs.measurements.priceReview.confirmFence')}
        </label>
      ) : null}
      <ReviewTable rows={rows} />
    </aside>
  );
}
