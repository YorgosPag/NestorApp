/**
 * BOQPriceReviewTable — ο ΕΝΑΣ πίνακας ελέγχου τιμών (ADR-923 §5.11 «3ε» · §5.12 Δ9): παλιό δίπλα σε νέο, Δ%, επίπτωση.
 *
 * Παίρνει έτοιμες γραμμές, άρα ο τιμοκατάλογος κόστους και ο προμηθευτής δείχνουν το ίδιο πράγμα με τον ίδιο τρόπο.
 *
 * @module components/building-management/tabs/MeasurementsTabContent/BOQPriceReviewTable
 */

'use client';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatNumber } from '@/lib/intl-utils';

export interface PriceReviewCells {
  readonly id: string;
  readonly line: string;
  readonly state: string;
  readonly current: string;
  readonly next: string;
  readonly change: string;
  readonly impact: string;
}

export const signedPercent = (bp: number | null): string =>
  bp === null ? '—' : `${bp > 0 ? '+' : ''}${formatNumber(bp / 100, { maximumFractionDigits: 2 })}%`;

function ReviewRow({ row }: { row: PriceReviewCells }) {
  return (
    <tr className="border-t border-border/50">
      <td className="py-1 pr-2">{row.line}</td>
      <td className="py-1 pr-2">{row.state}</td>
      <td className="py-1 pr-2 text-right tabular-nums">{row.current}</td>
      <td className="py-1 pr-2 text-right tabular-nums">{row.next}</td>
      <td className="py-1 pr-2 text-right tabular-nums">{row.change}</td>
      <td className="py-1 text-right tabular-nums">{row.impact}</td>
    </tr>
  );
}

export function BOQPriceReviewTable({ rows }: { rows: readonly PriceReviewCells[] }) {
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
        <tbody>{rows.map((row) => <ReviewRow key={row.id} row={row} />)}</tbody>
      </table>
    </section>
  );
}
